"""Shared, permission-scoped KPI calculations for future dashboard and export consumers."""

from .filters import ReportQuery, parse_query
from .service import calculate_report

__all__ = ["ReportQuery", "parse_query", "calculate_report"]
