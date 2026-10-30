"""Read the declared source formats without locale-dependent guessing or lost bytes."""

import csv
import io
import re
import unicodedata
from datetime import datetime
from decimal import Decimal, InvalidOperation
from portal.http import ApiError
from .rules import HEADERS, MAX_ROWS, SourceRow

ID_PATTERN = re.compile(r"[A-Z0-9_-]{1,12}\Z")
EXPLICIT_DATES = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%d.%m.%Y %H:%M",
    "%d.%m.%Y %H:%M:%S",
)


def decode(content):
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ApiError(
            "DQ-001",
            "Dosya UTF-8 olarak okunamadı. Özgün dosyayı koruyup UTF-8 CSV/TXT kopyası yükle.",
        ) from None
    if "\x00" in text or "\ufffd" in text:
        raise ApiError(
            "DQ-001",
            "Dosyada kayıp karakter veya NUL var. Kaynağı doğru kodlamayla yeniden dışa aktar.",
        )
    return text


def csv_rows(kind, content):
    """Header determines the delimiter; malformed row widths are preserved for review."""
    text = decode(content)
    expected = set(HEADERS[kind])
    reader = None
    for delimiter in (",", ";", "\t"):
        candidate = csv.reader(
            io.StringIO(text, newline=""), delimiter=delimiter, strict=True
        )
        try:
            header = next(candidate)
        except (StopIteration, csv.Error):
            continue
        if (
            expected.issubset(header)
            and len(header) == len(set(header))
            and len(header) <= 30
        ):
            reader = candidate
            break
    if reader is None:
        raise ApiError(
            "DQ-002",
            "CSV başlıklarını ve ayıracını kontrol et. Gerekli sütunlar: "
            + ", ".join(HEADERS[kind]),
        )
    rows = []
    try:
        while True:
            line = reader.line_num + 1
            try:
                values = next(reader)
            except StopIteration:
                break
            if len(rows) >= MAX_ROWS:
                raise ApiError(
                    "IMP003",
                    f"Dosya en fazla {MAX_ROWS} veri satırı içerebilir. Dosyayı bölerek yükle.",
                )
            if len(values) != len(header) or any(len(value) > 8192 for value in values):
                row = SourceRow(line, {"__columns__": values})
                row.quarantine(
                    "DQ-002",
                    "",
                    "Sütun sayısı farklı veya bir hücre 8192 karakteri aşıyor.",
                )
            else:
                row = SourceRow(line, dict(zip(header, values)))
            rows.append(row)
    except csv.Error:
        raise ApiError(
            "DQ-002",
            f"{reader.line_num}. satır civarında tırnak/satır yapısı bozuk. Dosya kısmen işlenmedi; CSV'yi yeniden dışa aktar.",
        ) from None
    if not rows:
        raise ApiError("DQ-002", "Dosyada veri satırı yok.")
    return rows


def clean_text(value):
    """Only reversible mojibake with a unique readable result is repaired."""
    value = unicodedata.normalize("NFC", value.strip())
    markers = ("Ã", "Â", "Ä", "Å", "â€")
    if any(marker in value for marker in markers):
        candidates = set()
        for encoding in ("latin1", "cp1252"):
            try:
                candidate = value.encode(encoding).decode("utf-8")
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue
            if not any(marker in candidate for marker in markers) and not any(
                unicodedata.category(c).startswith("C") for c in candidate
            ):
                candidates.add(candidate)
        if len(candidates) == 1:
            value = candidates.pop()
    return value


def text_field(row, name):
    original = row.raw.get(name, "")
    value = clean_text(original)
    if value != original:
        row.note(
            "DQ-004",
            name,
            "Kenar boşluğu / geri döndürülebilir kodlama düzeltildi.",
            original,
            value,
            operation="normalize",
        )
    return value


def decimal_value(value):
    if not re.fullmatch(r"[+-]?[0-9]+(?:[.,][0-9]+)?", value):
        return None
    try:
        number = Decimal(value.replace(",", "."))
        return number if number.is_finite() else None
    except InvalidOperation:
        return None


def number_field(row, name):
    value = text_field(row, name)
    number = decimal_value(value)
    if number is not None and "," in value:
        row.note(
            "DQ-003",
            name,
            "Ondalık virgül sayısal biçime çevrildi.",
            value,
            str(number),
            operation="normalize",
        )
    return number


def explicit_datetime(value):
    for pattern in EXPLICIT_DATES:
        try:
            return datetime.strptime(value, pattern)
        except ValueError:
            continue
    return None


def parse_started(row, source_period, clear_dates):
    value = text_field(row, "baslangic")
    result = explicit_datetime(value)
    if result:
        if value != result.strftime("%Y-%m-%d %H:%M:%S"):
            row.note(
                "DQ-008",
                "baslangic",
                "Tanımlı tarih biçimi standartlaştırıldı.",
                value,
                result.isoformat(),
                operation="normalize",
            )
        return result.isoformat()
    # Slash/dash formats with the year last can have two valid interpretations.
    candidates = set()
    for pattern in (
        "%d/%m/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%m/%d/%Y %H:%M",
        "%d-%m-%Y %H:%M",
        "%m-%d-%Y %H:%M",
    ):
        try:
            candidates.add(datetime.strptime(value, pattern))
        except ValueError:
            pass
    if len(candidates) == 1:
        result = next(iter(candidates))
        row.note(
            "DQ-008",
            "baslangic",
            "Tek geçerli takvim yorumu kullanıldı.",
            value,
            result.isoformat(),
            operation="normalize",
        )
        return result.isoformat()
    if len(candidates) > 1 and source_period and clear_dates:
        start, end = source_period
        # Both independent declared period and clear rows must support the month.
        months = {
            (date.year, date.month)
            for date in clear_dates
            if start <= date.date() <= end
        }
        supported = [
            date
            for date in candidates
            if start <= date.date() <= end and (date.year, date.month) in months
        ]
        if len(supported) == 1:
            result = supported[0]
            row.note(
                "DQ-009",
                "baslangic",
                "Kaynak dönemi ve açık tarihlerin dağılımı tek yorumu destekliyor.",
                value,
                result.isoformat(),
                operation="infer",
                period=[start.isoformat(), end.isoformat()],
                candidates=sorted(date.isoformat() for date in candidates),
            )
            return result.isoformat()
    row.note(
        "DQ-010",
        "baslangic",
        "Tarih güvenilir biçimde kurtarılamadı; boş bırakıldı.",
        value,
        None,
        operation="omit",
        effect="Çağrı tarih filtresiz toplamlarda korunur; tarih ve saat kırılımlarına katılmaz.",
        candidates=sorted(date.isoformat() for date in candidates),
    )
    return None
