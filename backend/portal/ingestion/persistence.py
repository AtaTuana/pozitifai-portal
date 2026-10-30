"""Bulk-persist validated facts; row conflicts never overwrite accepted records."""

import hashlib
from datetime import datetime
from decimal import Decimal
from django.utils import timezone
from portal.http import ApiError
from portal.models import (
    Agent,
    AgentTeamAssignment,
    Call,
    Campaign,
    ImportIssue,
    ImportRow,
    QualityScore,
    Rater,
    Team,
    Transcript,
)
from portal.services.assignments import change_team
from .parsing import ID_PATTERN, clean_text
from .rules import RULE_VERSIONS


class NamedRecords:
    """Exact normalized labels only; ambiguous existing names require human review."""

    def __init__(self, model, actor):
        self.model, self.actor = model, actor
        self.by_name, self.by_id = {}, {}
        for record in model.objects.all():
            self.by_id[record.pk] = record
            self.by_name.setdefault(clean_text(record.name).casefold(), []).append(
                record
            )

    def get(self, name):
        matches = self.by_name.get(name.casefold(), [])
        if len(matches) == 1:
            return matches[0]
        if matches:
            raise ApiError(
                "IMP007",
                "Aynı adda birden fazla kayıt var; takım planlamasındaki adları ayırt et.",
            )
        if self.model is Rater:
            if max(self.by_id, default=0) >= 32767:
                raise ApiError("IMP007", "Değerlendirici kimlik sınırına ulaşıldı.")
            record = self.model.objects.create(name=name)
        else:
            key = (
                name
                if ID_PATTERN.fullmatch(name)
                else ("K" if self.model is Campaign else "T")
                + hashlib.sha256(name.casefold().encode()).hexdigest()[:11].upper()
            )
            if key in self.by_id:
                raise ApiError(
                    "IMP007",
                    "Kaynak adından üretilen kimlik başka bir adla kayıtlı. Eşleştirmeyi incele; kayıt değiştirilmedi.",
                )
            record = self.model.objects.create(pk=key, name=name, created_by=self.actor)
        self.by_id[record.pk] = record
        self.by_name[name.casefold()] = [record]
        return record


def same_source_or_conflict(row, existing):
    if existing is None:
        return False
    if existing.source_row_id and existing.source_row.raw_data == row.raw:
        row.status = "duplicate"
        row.note(
            "DQ-021",
            "call_id",
            "Aynı kaynak kayıt daha önce kabul edildi.",
            row.reference,
            row.reference,
            operation="duplicate",
            existingBatch=existing.source_row.batch_id,
        )
    else:
        row.quarantine(
            "DQ-007",
            "call_id",
            "Bu kimlik farklı içerikle zaten kayıtlı; mevcut verinin üzerine yazılmadı.",
        )
    return True


def aware(iso):
    return (
        timezone.make_aware(
            datetime.fromisoformat(iso), timezone.get_default_timezone()
        )
        if iso
        else None
    )


def save_findings(rows, records, actor):
    ImportIssue.objects.bulk_create(
        [
            ImportIssue(
                row=record,
                code=issue.code,
                rule_version=RULE_VERSIONS.get(issue.code, 1),
                field_name=issue.field,
                message=issue.message,
                operation=issue.operation,
                before_value=issue.before,
                after_value=issue.after,
                evidence=issue.evidence,
                report_effect=issue.effect,
                actor=actor,
            )
            for row, record in zip(rows, records)
            for issue in row.findings
        ],
        batch_size=500,
    )


def finish_rows(rows, records, actor):
    for row, record in zip(rows, records):
        record.reference_id = row.reference
        record.status = row.status
        record.cleaned_data = row.values
    ImportRow.objects.bulk_update(
        records, ["reference_id", "status", "cleaned_data"], batch_size=250
    )
    save_findings(rows, records, actor)


def save_calls(rows, records, actor):
    existing = Call.objects.select_related("source_row").in_bulk(
        [row.reference for row in rows if row.reference]
    )
    agents = Agent.objects.in_bulk(
        {row.values.get("agent_reference", "") for row in rows}
    )
    campaigns = NamedRecords(Campaign, actor)
    pending = []
    for row, source in zip(rows, records):
        if row.status != "pending" or same_source_or_conflict(
            row, existing.get(row.reference)
        ):
            continue
        try:
            campaign = campaigns.get(row.values["campaign_name"])
        except ApiError as exc:
            row.quarantine("DQ-004", "kampanya", exc.message)
            continue
        agent = agents.get(row.values["agent_reference"])
        if agent is None:
            row.note(
                "DQ-011",
                "temsilci_id",
                "Temsilci eşleşmedi; çağrı şirket ve kampanya kapsamında korunur.",
                row.values["agent_reference"],
                None,
                operation="unmatched",
                effect="Kişi ve takım raporunda yer almaz. Kadro sonradan gelirse yeniden eşleştirilir.",
            )
        row.values.update(agent_id=agent.pk if agent else None, campaign_id=campaign.pk)
        pending.append(
            Call(
                id=row.reference,
                agent=agent,
                campaign=campaign,
                started_at=aware(row.values["started_at"]),
                duration_seconds=row.values["duration_seconds"],
                result_id=row.values["result_id"],
                source_row=source,
            )
        )
        row.status = "accepted"
    Call.objects.bulk_create(pending, batch_size=500)


def save_quality(rows, records, actor):
    references = [row.reference for row in rows if row.status == "pending"]
    calls = Call.objects.in_bulk(references)
    existing = QualityScore.objects.select_related("source_row").in_bulk(references)
    raters = NamedRecords(Rater, actor)
    pending = []
    for row, source in zip(rows, records):
        if row.status != "pending" or same_source_or_conflict(
            row, existing.get(row.reference)
        ):
            continue
        if row.reference not in calls:
            row.status = "unmatched"
            row.note(
                "DQ-018",
                "call_id",
                "Çağrı henüz kabul edilen kayıtlarda yok. Kalite sorunları ayrıca kaydedildi.",
                row.reference,
                None,
                operation="unmatched",
                effect="Çağrı gelene kadar kalite raporuna alınmaz.",
            )
            continue
        if not row.values["eligible"]:
            row.status = "quarantined"
            continue
        try:
            rater = raters.get(row.values["rater_name"])
        except ApiError as exc:
            row.quarantine("DQ-014", "degerlendiren", exc.message)
            continue
        total, greeting, need, closure = [
            Decimal(value) if value is not None else None
            for value in row.values["scores"]
        ]
        pending.append(
            QualityScore(
                call_id=row.reference,
                rater=rater,
                total_score=total,
                greeting_score=greeting,
                need_analysis_score=need,
                closure_score=closure,
                source_row=source,
            )
        )
        row.status = "accepted"
    QualityScore.objects.bulk_create(pending, batch_size=500)


def save_agents(rows, records, actor):
    """The uploaded roster updates named agents only; absent agents are not deleted."""
    teams = NamedRecords(Team, actor)
    for row in rows:
        if row.status != "pending":
            continue
        try:
            team = teams.get(row.values["team_name"])
        except ApiError as exc:
            row.quarantine("DQ-011", "takim", exc.message)
            continue
        agent = Agent.objects.filter(pk=row.reference).first()
        current = AgentTeamAssignment.objects.filter(
            agent_id=row.reference, valid_to__isnull=True
        ).first()
        before = (
            {
                "name": agent.name,
                "start_date": (
                    agent.start_date.isoformat() if agent.start_date else None
                ),
                "team_id": current.team_id if current else None,
            }
            if agent
            else None
        )
        after = {
            "name": row.values["name"],
            "start_date": row.values["start_date"],
            "team_id": team.pk,
        }
        if before == after and agent.is_active:
            row.status = "duplicate"
            row.note(
                "DQ-021",
                "temsilci_id",
                "Güncel kadro kaydı zaten aynı.",
                row.reference,
                row.reference,
                operation="duplicate",
            )
            continue
        agent, created = Agent.objects.update_or_create(
            pk=row.reference,
            defaults={
                "name": after["name"],
                "start_date": after["start_date"],
                "is_active": True,
            },
        )
        if created:
            agent.created_by = actor
            agent.save(update_fields=["created_by"])
        change_team(agent.pk, team.pk, actor=actor)
        if before:
            row.note(
                "DQ-011",
                "temsilci_id",
                "Güncel kadro kaydı yönetici girdisine göre güncellendi.",
                before,
                after,
                operation="update",
                effect="Case raporları güncel kadrodaki takımı kullanır.",
            )
        row.values["team_id"] = team.pk
        row.status = "accepted"


def save_transcripts(rows, records, actor):
    references = [row.reference for row in rows if row.status == "pending"]
    calls = Call.objects.in_bulk(references)
    existing = Transcript.objects.select_related("source_row").in_bulk(references)
    pending = []
    for row, source in zip(rows, records):
        if row.status != "pending" or same_source_or_conflict(
            row, existing.get(row.reference)
        ):
            continue
        if row.reference not in calls:
            row.status = "unmatched"
            row.note(
                "DQ-018",
                "call_id",
                "Transkriptin çağrısı henüz bulunamadı.",
                row.reference,
                None,
                operation="unmatched",
                effect="Çağrı gelince eşleştirilir; LLM analizi bu yüklemede çalışmaz.",
            )
            continue
        content = row.raw["content"]
        pending.append(
            Transcript(
                call_id=row.reference,
                content=content,
                content_sha256=hashlib.sha256(content.encode()).hexdigest(),
                uploaded_by=actor,
                source_row=source,
            )
        )
        row.status = "accepted"
    Transcript.objects.bulk_create(pending, batch_size=100)


SAVERS = {
    "calls": save_calls,
    "agents": save_agents,
    "quality": save_quality,
    "transcript": save_transcripts,
}
