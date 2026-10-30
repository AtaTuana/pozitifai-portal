"""Authenticated KPI and formula-driven Excel reports share server-side filter scope."""

import logging
from xml.etree.ElementTree import ParseError
from xml.parsers.expat import ExpatError
from django.db import DatabaseError
from django.http import HttpResponse, JsonResponse
from zipfile import BadZipFile
from .fields import BUSINESS_TIMEZONE
from .http import ApiError, audit, endpoint
from .reporting import calculate_report, parse_query
from .reporting.excel import collect_export, render_workbook
from .reporting.excel.workbook import WorkbookError

logger = logging.getLogger(__name__)


@endpoint(["GET"])
def kpis(request):
    query = parse_query(request.GET)
    try:
        result = calculate_report(request.user, query)
        audit(
            request,
            "report.calculated",
            "kpi",
            filters=result["filters"],
            groupBy=list(query.group_by),
        )
    except DatabaseError:
        logger.exception("KPI query failed.")
        raise ApiError(
            "RPT003",
            "Rapor hesaplanamadı. Veritabanı bağlantısını kontrol edip yeniden dene.",
            503,
        ) from None
    return JsonResponse(result)


@endpoint(["GET"])
def excel(request):
    # Query filters become editable Summary defaults; RawData retains all authorized calls.
    if set(request.GET) - {"agentId", "teamId", "campaignId", "dateFrom", "dateTo"}:
        raise ApiError(
            "RPT001",
            "Excel indirmede yalnız takım, temsilci, kampanya ve tarih filtreleri kullanılabilir.",
        )
    query = parse_query(request.GET)
    try:
        data = collect_export(request.user, query)
        content = render_workbook(data.rows, defaults=data.defaults)
        audit(
            request,
            "report.exported",
            "excel",
            filters=query.filter_data(),
            dataScope="all_authorized_calls",
            rowCount=len(data.rows),
        )
    except DatabaseError:
        logger.exception("Excel report query failed.")
        raise ApiError(
            "RPT003",
            "Rapor indirilemedi. Veritabanı bağlantısını kontrol edip yeniden dene.",
            503,
        ) from None
    except WorkbookError as exc:
        raise ApiError("XLS001", str(exc), 422) from None
    except (OSError, BadZipFile, ParseError, ExpatError, KeyError):
        logger.exception("Excel template could not be read.")
        raise ApiError(
            "XLS001",
            "Rapor şablonu okunamadı. Kurulumdaki rapor şablonunu kontrol et.",
            503,
        ) from None
    timestamp = data.generated_at.astimezone(BUSINESS_TIMEZONE).strftime(
        "%Y%m%d-%H%M%S"
    )
    response = HttpResponse(
        content,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = (
        f'attachment; filename="pozitifai-rapor-{timestamp}.xlsx"'
    )
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
