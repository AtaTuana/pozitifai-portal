"""Read the same current-roster and authorization scope as the KPI service."""

from dataclasses import dataclass
from datetime import datetime
from django.db.models import F
from django.utils import timezone
from portal.http import ApiError
from portal.models import Result, Team, User
from portal.permissions import permitted, scoped_agents, scoped_campaigns, scoped_teams
from ..filters import ReportQuery
from ..queries import selected_calls
from ..service import report_snapshot

MAX_EXPORT_ROWS = 50_000


@dataclass(frozen=True)
class ExportData:
    rows: list[tuple]
    generated_at: datetime
    defaults: dict[str, str]


def default_selections(actor, query, instant):
    """Resolve server-owned labels for editable Summary controls, not data restrictions."""
    selections = {
        "J4": "Tüm Takımlar",
        "J7": "Tüm Temsilciler",
        "O7": "Kampanyalar",
        "O4": "Seçili Tarihe Kadar",
    }
    for address, ids, scope in (
        ("J4", query.team_ids, scoped_teams(actor)),
        ("J7", query.agent_ids, scoped_agents(actor, at=instant)),
        ("O7", query.campaign_ids, scoped_campaigns(actor)),
    ):
        if len(ids) > 1:
            raise ApiError(
                "RPT001",
                "Excel varsayılan filtreleri için her alanda tek seçim kullan.",
            )
        if ids:
            name = scope.filter(pk=ids[0]).values_list("name", flat=True).first()
            if name is None:
                raise ApiError(
                    "AUTH003",
                    "Seçilen rapor filtresine erişim yetkin yok veya kayıt artık bulunmuyor.",
                    403,
                )
            selections[address] = name
    for boundary in (query.date_from, query.date_to):
        if boundary and boundary.year < 1900:
            raise ApiError(
                "RPT002", "Excel tarih filtresi 1900 ve sonrası için kullanılabilir."
            )
    start = query.date_from.strftime("%d.%m.%Y") if query.date_from else None
    end = query.date_to.strftime("%d.%m.%Y") if query.date_to else None
    if start and end:
        selections["O4"] = f"{start}–{end}"
    elif start:
        selections["O4"] = f"{start}+"
    elif end:
        selections["O4"] = end
    return selections


def collect_export(user, query):
    """Materialize authorized rows in one snapshot; never put other teams in hidden sheets."""
    if not permitted(user):
        raise ApiError("AUTH003", "Rapor indirme yetkin yok.", 403)
    with report_snapshot():
        actor = User.objects.filter(pk=user.pk).first()
        if (
            actor is None
            or not permitted(actor)
            or actor.auth_version != user.auth_version
        ):
            raise ApiError("AUTH001", "Oturumun değişti. Yeniden giriş yap.", 401)
        instant = timezone.now()
        defaults = default_selections(actor, query, instant)
        # Presentation filters are editable defaults. Only authorization limits RawData.
        calls, _ = selected_calls(actor, ReportQuery(), instant)
        facts = list(
            calls.order_by(F("started_at").asc(nulls_last=True), "id").values_list(
                "id",
                "agent__name",
                "report_team_id",
                "started_at",
                "duration_seconds",
                "result_id",
                "campaign__name",
                "quality_score__rater__name",
                "quality_score__total_score",
                "quality_score__greeting_score",
                "quality_score__need_analysis_score",
                "quality_score__closure_score",
            )[: MAX_EXPORT_ROWS + 1]
        )
        if len(facts) > MAX_EXPORT_ROWS:
            raise ApiError(
                "XLS002",
                "Yetkili veri kapsamı 50.000 çağrıyı aşıyor. Tam veri dışa aktarma sınırının artırılması gerekiyor.",
                413,
            )
        team_names = dict(
            Team.objects.filter(pk__in={row[2] for row in facts if row[2]}).values_list(
                "pk", "name"
            )
        )
        results = dict(Result.Id.choices)
        rows = [
            (
                row[0],
                row[1] or "Bilinmeyen temsilci",
                team_names.get(row[2], "Takımı belirsiz"),
                row[3],
                row[4],
                results.get(row[5], "Belirsiz"),
                row[6],
                *row[7:],
            )
            for row in facts
        ]
        return ExportData(rows=rows, generated_at=instant, defaults=defaults)
