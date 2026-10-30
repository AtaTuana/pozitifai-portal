"""Fill only RawData in a prepared XLSX. No Excel installation or runtime writer dependency."""

from copy import deepcopy
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path
import re
from xml.etree import ElementTree as E
from xml.dom import minidom
from zipfile import ZipFile, ZIP_DEFLATED
from portal.fields import BUSINESS_TIMEZONE

TEMPLATE = Path(__file__).resolve().parent.parent / "templates" / "report.xlsx"
NAMESPACE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS = {"m": NAMESPACE}
RAW_PART = "xl/worksheets/sheet2.xml"
TABLE_PART = "xl/tables/table1.xml"
SUMMARY_PART = "xl/worksheets/sheet1.xml"
HEADERS = (
    "Call ID",
    "Agent",
    "Agent Team",
    "Call Start",
    "Duration",
    "Result",
    "Campaign",
    "Rater",
    "Total Score",
    "Greeting Score",
    "Need Analysis Score",
    "Closure Score",
)
ROW_REFERENCE = re.compile(r"(?<![A-Za-z0-9_])(?P<column>\$?[A-Z]{1,3})2(?![0-9])")
INVALID_XML = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


class WorkbookError(Exception):
    """An incompatible template or value, safe to report without file-system details."""


def tag(name):
    return f"{{{NAMESPACE}}}{name}"


def excel_serial(value):
    """Keep Istanbul wall-clock dates, including Excel's historic 1900 leap-year offset."""
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(BUSINESS_TIMEZONE)
        value = value.replace(tzinfo=None)
    else:
        value = datetime.combine(value, datetime.min.time())
    if value.year < 1900:
        raise WorkbookError(
            "Excel tarihleri 1900 yılından önceki kayıtları desteklemiyor."
        )
    serial = (value - datetime(1899, 12, 30)).total_seconds() / 86400
    return serial - (1 if value < datetime(1900, 3, 1) else 0)


def value_cell(address, value, style=None):
    cell = E.Element(tag("c"), r=address)
    if style is not None:
        cell.set("s", style)
    if value is None:
        return cell
    if isinstance(value, (date, datetime)):
        value = excel_serial(value)
    if isinstance(value, (int, float, Decimal)):
        E.SubElement(cell, tag("v")).text = str(value)
    else:
        # Explicit string typing prevents =, +, - and @ source values becoming formulas.
        cell.set("t", "inlineStr")
        text = E.SubElement(E.SubElement(cell, tag("is")), tag("t"))
        text.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        text.text = INVALID_XML.sub("\ufffd", str(value))
    return cell


def set_summary_defaults(content, defaults):
    """Change only selection cells; preserve namespace declarations, layout and KPI formulas."""
    document = minidom.parseString(content)
    cells = {
        cell.getAttribute("r"): cell
        for cell in document.getElementsByTagNameNS(NAMESPACE, "c")
    }
    if set(defaults) != {"J4", "J7", "O7", "O4"}:
        raise WorkbookError("Raporun varsayılan filtreleri eksik veya geçersiz.")
    for address, value in defaults.items():
        cell = cells.get(address)
        if cell is None:
            raise WorkbookError("Rapor şablonunun filtre alanı bulunamadı.")
        for child in list(cell.childNodes):
            cell.removeChild(child)
        cell.setAttribute("t", "inlineStr")
        inline = document.createElementNS(NAMESPACE, "is")
        text = document.createElementNS(NAMESPACE, "t")
        text.setAttribute("xml:space", "preserve")
        text.appendChild(document.createTextNode(INVALID_XML.sub("\ufffd", value)))
        inline.appendChild(text)
        cell.appendChild(inline)
    # Saved template caches describe an empty table, not the just-exported data.
    for cell in cells.values():
        if any(child.localName == "f" for child in cell.childNodes):
            for child in list(cell.childNodes):
                if child.localName == "v":
                    cell.removeChild(child)
    return document.toxml(encoding="utf-8")


def render_workbook(rows, *, defaults=None):
    """Preserve Summary, formulas, styles, validations and names; replace the raw table body."""
    with ZipFile(TEMPLATE) as source:
        parts = {name: source.read(name) for name in source.namelist()}
    raw = E.fromstring(parts[RAW_PART])
    table = E.fromstring(parts[TABLE_PART])
    columns = table.find(tag("tableColumns"))
    if columns is None or tuple(c.get("name") for c in list(columns)[:12]) != HEADERS:
        raise WorkbookError("Rapor şablonunun RawData sütunları beklenen yapıda değil.")
    sheet_data = raw.find(tag("sheetData"))
    if sheet_data is None:
        raise WorkbookError("Rapor şablonunun veri alanı bulunamadı.")
    header = deepcopy(sheet_data.find("m:row[@r='1']", NS))
    example = sheet_data.find("m:row[@r='2']", NS)
    if header is None or example is None:
        raise WorkbookError("Rapor şablonunun başlangıç satırları eksik.")
    examples = {cell.get("r").rstrip("0123456789"): cell for cell in example}
    helpers = []
    for cell in example:
        formula = cell.find(tag("f"))
        if formula is not None:
            helpers.append(
                (cell.get("r").rstrip("0123456789"), formula.text, cell.get("s"))
            )
    if len(helpers) != 13:
        raise WorkbookError("Rapor şablonunun hesaplama sütunları eksik.")
    sheet_data.clear()
    sheet_data.append(header)
    for index, values in enumerate(rows or [tuple(None for _ in HEADERS)], start=2):
        if len(values) != len(HEADERS):
            raise WorkbookError("Rapor veri satırının sütun sayısı geçersiz.")
        row = E.SubElement(sheet_data, tag("row"), r=str(index))
        for column, value in enumerate(values):
            letter = chr(65 + column)
            example_cell = examples.get(letter)
            style = example_cell.get("s") if example_cell is not None else None
            row.append(value_cell(f"{letter}{index}", value, style))
        for letter, formula, style in helpers:
            cell = E.SubElement(row, tag("c"), r=f"{letter}{index}")
            if style is not None:
                cell.set("s", style)
            E.SubElement(cell, tag("f")).text = ROW_REFERENCE.sub(
                lambda match: f"{match['column']}{index}", formula
            )
    last = max(2, len(rows) + 1)
    dimension = raw.find(tag("dimension"))
    if dimension is None:
        dimension = E.Element(tag("dimension"))
        raw.insert(0, dimension)
    dimension.set("ref", f"A1:AD{last}")
    table.set("ref", f"A1:Y{last}")
    auto_filter = table.find(tag("autoFilter"))
    if auto_filter is not None:
        auto_filter.set("ref", f"A1:Y{last}")
    # These authored parts contain only standard namespaces; all original presentation parts stay bytes.
    parts[RAW_PART] = E.tostring(raw, encoding="utf-8", xml_declaration=True)
    parts[TABLE_PART] = E.tostring(table, encoding="utf-8", xml_declaration=True)
    if defaults is not None:
        parts[SUMMARY_PART] = set_summary_defaults(parts[SUMMARY_PART], defaults)
    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for name, data in parts.items():
            archive.writestr(name, data)
    return output.getvalue()
