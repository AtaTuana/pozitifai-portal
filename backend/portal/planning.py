"""Translate an editor draft into normalized teams, campaigns and representatives."""

import re
import uuid
from django.db import transaction
from django.http import JsonResponse
from .http import ApiError, audit, body, endpoint, text_value
from .models import Agent, Campaign, PlanningRevision, Team, TeamCampaign, User
from .permissions import scoped_agents, scoped_campaigns, scoped_links, scoped_teams

MODELS = {"team": Team, "campaign": Campaign, "agent": Agent}


def identifier(value):
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        raise ApiError("PLAN001", "Kayıt kimliği geçersiz.")


def planning_data(user):
    nodes, edges = [], []
    groups = {
        "team": scoped_teams(user),
        "campaign": scoped_campaigns(user),
        "agent": scoped_agents(user),
    }
    for kind, rows in groups.items():
        for row in rows.filter(is_active=True):
            nodes.append(
                {"id": str(row.pk), "kind": kind, "name": row.name, "code": row.code}
            )
            if kind == "agent" and row.team_id and row.team.is_active:
                edges.append({"source": str(row.team_id), "target": str(row.pk)})
    edges += [
        {"source": str(link.team_id), "target": str(link.campaign_id)}
        for link in scoped_links(user).filter(
            team__is_active=True, campaign__is_active=True
        )
    ]
    revision, _ = PlanningRevision.objects.get_or_create(pk=1)
    return {"nodes": nodes, "edges": edges, "revision": revision.version}


def validate_draft(data):
    nodes, edges = data.get("nodes"), data.get("edges")
    if (
        not isinstance(nodes, list)
        or not isinstance(edges, list)
        or len(nodes) > 500
        or len(edges) > 1500
    ):
        raise ApiError("PLAN002", "En fazla 500 kayıt ve 1500 bağlantı gönderilebilir.")
    normalized, codes = {}, set()
    for node in nodes:
        if not isinstance(node, dict) or node.get("kind") not in MODELS:
            raise ApiError("PLAN002", "Kayıt türü geçersiz.")
        key, kind = identifier(node.get("id")), node["kind"]
        name, code = text_value(node, "name"), text_value(node, "code", 40).upper()
        if not re.fullmatch(r"[A-Z0-9_-]{1,40}", code):
            raise ApiError(
                "PLAN003",
                "Kod yalnızca İngilizce harf, rakam, alt çizgi ve tire içerebilir.",
            )
        if key in normalized or (kind, code) in codes:
            raise ApiError("PLAN004", "Tekrarlanan kayıt kimliği veya kodu var.")
        normalized[key] = {"kind": kind, "name": name, "code": code}
        codes.add((kind, code))
    pairs, agent_teams = set(), {}
    for edge in edges:
        if not isinstance(edge, dict):
            raise ApiError("PLAN005", "Bağlantı biçimi geçersiz.")
        source, target = identifier(edge.get("source")), identifier(edge.get("target"))
        a, b = normalized.get(source), normalized.get(target)
        if (
            not a
            or not b
            or a["kind"] != "team"
            or b["kind"] not in ("campaign", "agent")
            or (source, target) in pairs
        ):
            raise ApiError(
                "PLAN005",
                "Takımı bir kampanyaya veya temsilciye bağla; yinelenen bağlantıları kaldır.",
            )
        if b["kind"] == "agent":
            if target in agent_teams:
                raise ApiError(
                    "PLAN006",
                    "Bir temsilci aynı anda yalnızca bir takıma bağlanabilir.",
                )
            agent_teams[target] = source
        pairs.add((source, target))
    return normalized, pairs, agent_teams


@endpoint(["GET", "PUT"])
def planning(request):
    if request.method == "GET":
        audit(request, "planning.view")
        return JsonResponse(planning_data(request.user))
    if request.user.role != "admin":
        audit(request, "access.denied", request.path)
        raise ApiError(
            "AUTH003", "Takım planlamasını yalnızca admin değiştirebilir.", 403
        )
    data = body(request)
    nodes, edges, agent_teams = validate_draft(data)
    if type(data.get("revision")) is not int:
        raise ApiError("PLAN007", "Plan sürümü geçersiz. Sayfayı yenile.")
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=request.user.pk)
        if (
            actor.role != "admin"
            or not actor.is_active
            or actor.auth_version != request.session.get("auth_version")
        ):
            raise ApiError("AUTH001", "Oturumu yeniden doğrula.", 401)
        revision, _ = PlanningRevision.objects.select_for_update().get_or_create(pk=1)
        if revision.version != data["revision"]:
            raise ApiError(
                "PLAN008",
                "Plan başka bir sekmede değişti. Taslağını kontrol edip güncel planı yeniden yükle.",
                409,
            )
        keep_teams = [key for key, row in nodes.items() if row["kind"] == "team"]
        if (
            User.objects.filter(role="captain", team__is_active=True)
            .exclude(team_id__in=keep_teams)
            .exists()
        ):
            raise ApiError(
                "PLAN009",
                "Takımı kaldırmadan önce bu takıma bağlı kaptanların atamasını değiştir.",
            )
        existing = {
            str(row.pk): kind
            for kind, model in MODELS.items()
            for row in model.objects.all()
        }
        if any(
            key in existing and existing[key] != row["kind"]
            for key, row in nodes.items()
        ):
            raise ApiError("PLAN010", "Mevcut kaydın türü değiştirilemez.")
        before = planning_data(request.user)
        # Teams must exist before representatives are assigned to them.
        for kind, model in MODELS.items():
            keys = [key for key, row in nodes.items() if row["kind"] == kind]
            model.objects.exclude(pk__in=keys).update(is_active=False)
            for key in keys:
                row = nodes[key]
                defaults = {"name": row["name"], "code": row["code"], "is_active": True}
                if kind == "agent":
                    defaults["team_id"] = agent_teams.get(key)
                record, created = model.objects.update_or_create(
                    pk=key, defaults=defaults
                )
                if created:
                    record.created_by = actor
                    record.save(update_fields=["created_by"])
        wanted = {
            (source, target)
            for source, target in edges
            if nodes[target]["kind"] == "campaign"
        }
        for link in TeamCampaign.objects.all():
            if (str(link.team_id), str(link.campaign_id)) not in wanted:
                link.delete()
        for source, target in wanted:
            TeamCampaign.objects.get_or_create(
                team_id=source, campaign_id=target, defaults={"created_by": actor}
            )
        revision.version += 1
        revision.save(update_fields=["version"])
        audit(
            request,
            "planning.saved",
            revision.version,
            before=before,
            after={
                "nodes": [{"id": key, **row} for key, row in nodes.items()],
                "edges": [
                    {"source": source, "target": target}
                    for source, target in sorted(edges)
                ],
            },
        )
    return JsonResponse(planning_data(request.user))


@endpoint(["GET"], admin=True)
def activity(request):
    from .models import AuditEvent

    events = AuditEvent.objects.select_related("actor").all()[:200]
    return JsonResponse(
        {
            "events": [
                {
                    "id": row.pk,
                    "action": row.action,
                    "target": row.target,
                    "actor": row.actor.display_name if row.actor else "Sistem",
                    "createdAt": row.created_at.isoformat(),
                }
                for row in events
            ]
        }
    )
