"""Retry missing relations when a later upload provides the required source records."""

from collections import defaultdict
from django.db.models import Q
from django.utils import timezone
from portal.models import (
    Agent,
    AgentTeamAssignment,
    Call,
    ImportIssue,
    ImportRow,
    TeamCampaign,
)
from .cleaning import identify_rows
from .parsing import clean_text
from .persistence import SAVERS, finish_rows, save_findings
from .rules import SourceRow


def reconcile(actor):
    affected = set()
    agents = Agent.objects.in_bulk()
    calls = list(
        Call.objects.filter(
            agent__isnull=True, source_row__isnull=False
        ).select_related("source_row")
    )
    changed_calls, changed_sources, decisions = [], [], []
    for call in calls:
        source = call.source_row
        agent = agents.get(clean_text(source.raw_data.get("temsilci_id", "")))
        if agent is None:
            continue
        call.agent = agent
        source.cleaned_data = {**source.cleaned_data, "agent_id": agent.pk}
        row = SourceRow(source.row_number, source.raw_data, call.pk)
        row.note(
            "DQ-011",
            "temsilci_id",
            "Kadro sonradan geldi; çağrı temsilciyle eşleştirildi.",
            None,
            agent.pk,
            operation="match",
            effect="Kişi ve güncel takım kırılımlarına da dahil edilebilir.",
        )
        changed_calls.append(call)
        changed_sources.append(source)
        decisions.append(row)
        affected.add(source.batch_id)
    if changed_calls:
        Call.objects.bulk_update(changed_calls, ["agent"], batch_size=500)
        ImportRow.objects.bulk_update(changed_sources, ["cleaned_data"], batch_size=250)
        ImportIssue.objects.filter(
            row_id__in=[r.pk for r in changed_sources],
            code="DQ-011",
            operation="unmatched",
            resolved_at__isnull=True,
        ).update(
            resolved_at=timezone.now(),
            resolved_by=actor,
            resolution_note="Kadro yüklendikten sonra kaynak temsilci kimliği eşleşti.",
        )
        save_findings(decisions, changed_sources, actor)
    for kind in ("quality", "transcript"):
        sources = list(
            ImportRow.objects.filter(
                status="unmatched",
                batch__kind=kind,
                reference_id__in=Call.objects.values("pk"),
            ).order_by("pk")
        )
        if not sources:
            continue
        rows = [
            SourceRow(
                source.row_number,
                source.raw_data,
                source.reference_id,
                source.cleaned_data,
            )
            for source in sources
        ]
        interpretations = defaultdict(list)
        for row in rows:
            interpretations[row.reference].append(row)
        for group in interpretations.values():
            if any(row.values != group[0].values for row in group[1:]):
                for row in group:
                    row.quarantine(
                        "DQ-021",
                        "call_id",
                        "Aynı kimlik farklı yükleme seçenekleriyle yorumlanmış; otomatik bir sürüm seçilmedi.",
                    )
        identify_rows(rows, kind)
        SAVERS[kind](rows, sources, actor)
        for row, source in zip(rows, sources):
            row.note(
                "DQ-018",
                "call_id",
                "Beklenen çağrı geldi; kimlik, tekrar ve kalite uygunluğu yeniden değerlendirildi.",
                None,
                row.reference,
                operation="match",
                effect="Son satır durumu: " + row.status,
            )
            affected.add(source.batch_id)
        ImportIssue.objects.filter(
            row_id__in=[r.pk for r in sources],
            code="DQ-018",
            operation="unmatched",
            resolved_at__isnull=True,
        ).update(
            resolved_at=timezone.now(),
            resolved_by=actor,
            resolution_note="Çağrı bulundu; diğer kalite sorunları ayrıca korunur.",
        )
        finish_rows(rows, sources, actor)
    return affected


def connect_campaigns(actor):
    """Add observed current team/campaign links without removing explicit planning links."""
    now = timezone.now()
    memberships = dict(
        AgentTeamAssignment.objects.filter(valid_from__lte=now)
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now))
        .values_list("agent_id", "team_id")
    )
    observed = {
        (memberships[agent], campaign)
        for agent, campaign in Call.objects.filter(agent_id__in=memberships)
        .values_list("agent_id", "campaign_id")
        .distinct()
    }
    existing = set(TeamCampaign.objects.values_list("team_id", "campaign_id"))
    missing = observed - existing
    TeamCampaign.objects.bulk_create(
        [
            TeamCampaign(team_id=team, campaign_id=campaign, created_by=actor)
            for team, campaign in sorted(missing)
        ],
        batch_size=500,
    )
    return bool(missing)
