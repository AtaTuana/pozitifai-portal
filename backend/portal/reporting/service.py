"""Calculate summary and paginated breakdowns from the same authorized snapshot."""

from contextlib import contextmanager
from django.db import connection, transaction
from django.utils import timezone
from portal.http import ApiError
from portal.models import User
from portal.permissions import permitted
from .metrics import aggregates, metrics
from .queries import (
    dimension_values,
    grouped_rows,
    grouping_calls,
    labels_for,
    selected_calls,
)


@contextmanager
def report_snapshot():
    # Export callers already inside a transaction own its isolation policy.
    nested = connection.in_atomic_block
    with transaction.atomic():
        if connection.vendor == "postgresql" and not nested:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"
                )
        yield


def calculate_report(user, query):
    """No HTTP or display dependencies; dashboard and Excel can share this service."""
    if not permitted(user):
        raise ApiError("AUTH003", "Raporlara erişim yetkin yok.", 403)
    with report_snapshot():
        actor = User.objects.filter(pk=user.pk).first()
        if (
            actor is None
            or not permitted(actor)
            or actor.auth_version != user.auth_version
        ):
            raise ApiError("AUTH001", "Oturumun değişti. Yeniden giriş yap.", 401)
        instant = timezone.now()
        calls, before_dates = selected_calls(actor, query, instant)
        summary = metrics(calls.aggregate(**aggregates()))
        omitted_dates = (
            before_dates.filter(started_at__isnull=True).count()
            if query.date_from or query.date_to
            else 0
        )
        breakdown = None
        if query.group_by:
            eligible = grouping_calls(calls, query.group_by)
            totals = metrics(eligible.aggregate(**aggregates()))
            groups = grouped_rows(eligible, query.group_by)
            total_groups = groups.count()
            rows = list(groups[query.offset : query.offset + query.limit])
            labels = labels_for(rows, query.group_by)
            next_offset = query.offset + len(rows)
            breakdown = {
                "dimensions": list(query.group_by),
                "totals": totals,
                "excludedCalls": summary["totalCalls"] - totals["totalCalls"],
                "rows": [
                    {
                        "dimensions": dimension_values(row, query.group_by, labels),
                        "metrics": metrics(row),
                    }
                    for row in rows
                ],
                "pagination": {
                    "limit": query.limit,
                    "offset": query.offset,
                    "totalGroups": total_groups,
                    "nextOffset": next_offset if next_offset < total_groups else None,
                },
            }
        return {
            "schemaVersion": 1,
            "formulaVersion": "1.0",
            "generatedAt": instant.isoformat(),
            "timezone": "Europe/Istanbul",
            "teamBasis": "current",
            "rateUnit": "percent",
            "scope": {
                "allTeams": actor.role_id != "captain",
                "teamId": actor.team_id if actor.role_id == "captain" else None,
            },
            "filters": query.filter_data(),
            "summary": summary,
            "dateCoverage": {"undatedCallsExcluded": omitted_dates},
            "breakdown": breakdown,
        }
