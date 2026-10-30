"""Validate report selection separately from grouping and presentation."""

from dataclasses import dataclass
from datetime import date
import re
from portal.http import ApiError

DIMENSIONS = ("agent", "team", "campaign", "day", "hour")
ID_PATTERN = re.compile(r"[A-Z0-9_-]{1,12}\Z")
PARAMETERS = {
    "agentId",
    "teamId",
    "campaignId",
    "dateFrom",
    "dateTo",
    "groupBy",
    "limit",
    "offset",
}


@dataclass(frozen=True)
class ReportQuery:
    agent_ids: tuple[str, ...] = ()
    team_ids: tuple[str, ...] = ()
    campaign_ids: tuple[str, ...] = ()
    date_from: date | None = None
    date_to: date | None = None
    group_by: tuple[str, ...] = ()
    limit: int = 200
    offset: int = 0

    def filter_data(self):
        return {
            "agentIds": list(self.agent_ids),
            "teamIds": list(self.team_ids),
            "campaignIds": list(self.campaign_ids),
            "dateFrom": self.date_from.isoformat() if self.date_from else None,
            "dateTo": self.date_to.isoformat() if self.date_to else None,
        }


def single(params, name, default=""):
    values = params.getlist(name)
    if len(values) > 1:
        raise ApiError("RPT001", f"{name} yalnızca bir kez gönderilebilir.")
    if not values:
        return default
    value = values[0].strip()
    if not value:
        raise ApiError(
            "RPT001", f"{name} boş gönderilemez; filtre yoksa parametreyi kaldır."
        )
    return value


def identifiers(params, name):
    values = params.getlist(name)
    if len(values) > 100 or any(not ID_PATTERN.fullmatch(value) for value in values):
        raise ApiError(
            "RPT001",
            f"{name} en fazla 100 adet, 1–12 karakterlik geçerli kimlik içermeli.",
        )
    return tuple(sorted(set(values)))


def calendar_date(params, name):
    value = single(params, name)
    if not value:
        return None
    if re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    raise ApiError("RPT002", f"{name} geçerli bir YYYY-MM-DD tarihi olmalı.")


def integer(params, name, default, minimum, maximum):
    value = single(params, name, str(default))
    if not re.fullmatch(r"[0-9]{1,6}", value) or not minimum <= int(value) <= maximum:
        raise ApiError(
            "RPT001", f"{name} {minimum}–{maximum} aralığında tamsayı olmalı."
        )
    return int(value)


def parse_query(params):
    """Same-kind repeated IDs mean OR; different filter dimensions mean AND."""
    if set(params) - PARAMETERS:
        raise ApiError(
            "RPT001",
            "Desteklenmeyen rapor parametresi var; filtre adlarını kontrol et.",
        )
    start, end = calendar_date(params, "dateFrom"), calendar_date(params, "dateTo")
    if (start and end and start > end) or end == date.max:
        raise ApiError(
            "RPT002",
            "Başlangıç bitişten sonra olamaz; bitiş en fazla 9999-12-30 olabilir.",
        )
    grouping = single(params, "groupBy")
    groups = tuple(part.strip() for part in grouping.split(",")) if grouping else ()
    if len(set(groups)) != len(groups) or any(
        group not in DIMENSIONS for group in groups
    ):
        raise ApiError(
            "RPT001", "groupBy tekrar içermemeli: agent, team, campaign, day, hour."
        )
    return ReportQuery(
        agent_ids=identifiers(params, "agentId"),
        team_ids=identifiers(params, "teamId"),
        campaign_ids=identifiers(params, "campaignId"),
        date_from=start,
        date_to=end,
        group_by=groups,
        limit=integer(params, "limit", 200, 1, 1000),
        offset=integer(params, "offset", 0, 0, 100000),
    )
