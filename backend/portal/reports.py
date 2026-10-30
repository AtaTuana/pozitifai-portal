"""Authenticated report endpoint; no frontend or spreadsheet presentation choices."""

import logging
from django.db import DatabaseError
from django.http import JsonResponse
from .http import ApiError, audit, endpoint
from .reporting import calculate_report, parse_query

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
