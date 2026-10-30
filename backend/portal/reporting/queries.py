"""Build scoped one-row-per-call queries; never join the many-row assignment history."""

from datetime import datetime, time, timedelta
from django.db.models import DateField, OuterRef, Q, Subquery
from django.db.models.functions import Cast
from portal.fields import BUSINESS_TIMEZONE
from portal.models import Agent, AgentTeamAssignment, Campaign, Team
from portal.permissions import scoped_calls
from .expressions import StoredHour
from .metrics import aggregates

GROUP_FIELDS = {
    "agent": "agent_id",
    "team": "report_team_id",
    "campaign": "campaign_id",
    "day": "report_day",
    "hour": "report_hour",
}
LABEL_MODELS = {"agent": Agent, "team": Team, "campaign": Campaign}


def selected_calls(user, query, instant):
    membership = (
        AgentTeamAssignment.objects.filter(
            agent_id=OuterRef("agent_id"), valid_from__lte=instant
        )
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=instant))
        .order_by()
    )
    calls = (
        scoped_calls(user, at=instant)
        .annotate(report_team_id=Subquery(membership.values("team_id")[:1]))
        .order_by()
    )
    for name, ids in (
        ("agent_id", query.agent_ids),
        ("report_team_id", query.team_ids),
        ("campaign_id", query.campaign_ids),
    ):
        if ids:
            calls = calls.filter(**{name + "__in": ids})
    # These counts obey role/entity filters but precede the optional date restriction.
    before_dates = calls
    if query.date_from:
        start = datetime.combine(query.date_from, time.min, BUSINESS_TIMEZONE)
        calls = calls.filter(started_at__gte=start)
    if query.date_to:
        end = datetime.combine(
            query.date_to + timedelta(days=1), time.min, BUSINESS_TIMEZONE
        )
        calls = calls.filter(started_at__lt=end)
    return calls, before_dates


def grouping_calls(calls, dimensions):
    """Missing group keys are excluded once; summary totals still retain those calls."""
    if "agent" in dimensions:
        calls = calls.filter(agent_id__isnull=False)
    if "team" in dimensions:
        calls = calls.filter(report_team_id__isnull=False)
    if "day" in dimensions or "hour" in dimensions:
        calls = calls.filter(started_at__isnull=False)
    if "day" in dimensions:
        calls = calls.annotate(report_day=Cast("started_at", DateField()))
    if "hour" in dimensions:
        calls = calls.annotate(report_hour=StoredHour("started_at"))
    return calls


def grouped_rows(calls, dimensions):
    fields = [GROUP_FIELDS[dimension] for dimension in dimensions]
    return calls.values(*fields).annotate(**aggregates()).order_by(*fields)


def labels_for(rows, dimensions):
    labels = {}
    for dimension in dimensions:
        if dimension not in LABEL_MODELS:
            continue
        ids = {row[GROUP_FIELDS[dimension]] for row in rows}
        labels[dimension] = dict(
            LABEL_MODELS[dimension].objects.filter(pk__in=ids).values_list("pk", "name")
        )
    return labels


def dimension_values(row, dimensions, labels):
    result = {}
    for dimension in dimensions:
        value = row[GROUP_FIELDS[dimension]]
        if dimension in LABEL_MODELS:
            result[dimension] = {"id": value, "name": labels[dimension][value]}
        else:
            result[dimension] = value.isoformat() if dimension == "day" else value
    return result
