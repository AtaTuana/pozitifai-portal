"""Agent comparison and profiles, using the dashboard's formulas and current roster scope."""

from dataclasses import replace
from django.db.models import OuterRef, Q, Subquery
from django.utils import timezone
from portal.http import ApiError
from portal.models import AgentTeamAssignment, User
from portal.permissions import permitted, scoped_agents
from .metrics import aggregates, metrics
from .queries import grouped_rows, grouping_calls, selected_calls
from .service import report_snapshot


def current_roster(actor, query, instant):
    """Read current team metadata without joining historical assignments into call totals."""
    membership = (
        AgentTeamAssignment.objects.filter(
            agent_id=OuterRef("pk"), valid_from__lte=instant
        )
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=instant))
        .order_by("-valid_from", "-pk")
    )
    roster = scoped_agents(actor, at=instant).annotate(
        current_team_id=Subquery(membership.values("team_id")[:1]),
        current_team_name=Subquery(membership.values("team__name")[:1]),
    )
    if query.team_ids:
        roster = roster.filter(current_team_id__in=query.team_ids)
    if query.agent_ids:
        roster = roster.filter(pk__in=query.agent_ids)
    return roster.order_by("name", "pk")


def identity(agent):
    return {
        "id": agent.pk,
        "name": agent.name,
        "startDate": agent.start_date.isoformat() if agent.start_date else None,
        "active": agent.is_active,
        "team": (
            {"id": agent.current_team_id, "name": agent.current_team_name}
            if agent.current_team_id
            else None
        ),
    }


def agent_performance(user, query, agent_id=None):
    """A single authorized snapshot supplies either the roster or one agent's period/lifetime data."""
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
        roster = current_roster(actor, query, instant)
        agent = None
        if agent_id is not None:
            agent = roster.filter(pk=agent_id).first()
            if agent is None:
                # The same response for missing and unauthorized IDs prevents identity disclosure.
                raise ApiError(
                    "RPT004",
                    "Temsilci bulunamadı veya bu kapsamda görüntülenemiyor.",
                    404,
                )
            query = replace(query, agent_ids=(agent_id,))
        calls, before_dates = selected_calls(actor, query, instant)
        summary = metrics(calls.aggregate(**aggregates()))
        result = {
            "generatedAt": instant.isoformat(),
            "filters": query.filter_data(),
            "teamBasis": "current",
            "summary": summary,
            "undatedCallsExcluded": (
                before_dates.filter(started_at__isnull=True).count()
                if query.date_from or query.date_to
                else 0
            ),
        }
        if agent is None:
            rows = grouped_rows(grouping_calls(calls, ("agent",)), ("agent",))
            by_agent = {row["agent_id"]: metrics(row) for row in rows}
            empty = metrics(calls.none().aggregate(**aggregates()))
            result["agents"] = [
                {**identity(person), "metrics": by_agent.get(person.pk, empty)}
                for person in roster
            ]
        else:
            result["agent"] = identity(agent)
            # Only dates are removed: agent, campaign, team and role restrictions still apply.
            result["allTime"] = metrics(before_dates.aggregate(**aggregates()))
            rows = grouped_rows(grouping_calls(calls, ("hour",)), ("hour",))
            result["hourly"] = [
                {"hour": row["report_hour"], "metrics": metrics(row)} for row in rows
            ]
        return result
