"""Persist editor drafts using stable business IDs and dated team memberships."""

import re
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from .http import ApiError, audit, body, endpoint, text_value
from .models import (
    Agent,
    AgentTeamAssignment,
    Campaign,
    PlanningRevision,
    Team,
    TeamCampaign,
    User,
)
from .permissions import scoped_agents, scoped_campaigns, scoped_links, scoped_teams
from .services.assignments import change_team

MODELS = {"team": Team, "campaign": Campaign, "agent": Agent}


def node_id(kind, key):
    """Graph keys include the entity type; independent tables may share the same ID."""
    return f"{kind}:{key}"


def planning_data(user):
    nodes, edges = [], []
    now = timezone.now()
    groups = {
        "team": scoped_teams(user),
        "campaign": scoped_campaigns(user),
        "agent": scoped_agents(user),
    }
    agent_ids = []
    for kind, rows in groups.items():
        for row in rows.filter(is_active=True):
            nodes.append(
                {
                    "id": node_id(kind, row.pk),
                    "kind": kind,
                    "name": row.name,
                    "code": row.pk,
                }
            )
            if kind == "agent":
                agent_ids.append(row.pk)
    assignments = AgentTeamAssignment.objects.filter(
        agent_id__in=agent_ids, team__is_active=True, valid_from__lte=now
    ).filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now))
    if user.role_id == "captain":
        assignments = assignments.filter(team_id=user.team_id)
    edges.extend(
        {
            "source": node_id("team", row.team_id),
            "target": node_id("agent", row.agent_id),
        }
        for row in assignments
    )
    edges.extend(
        {
            "source": node_id("team", link.team_id),
            "target": node_id("campaign", link.campaign_id),
        }
        for link in scoped_links(user).filter(
            team__is_active=True, campaign__is_active=True
        )
    )
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
    normalized = {}
    for node in nodes:
        if not isinstance(node, dict) or node.get("kind") not in MODELS:
            raise ApiError("PLAN002", "Kayıt türü geçersiz.")
        kind = node["kind"]
        name, code = text_value(node, "name", 150), text_value(node, "code", 12)
        if not re.fullmatch(r"[A-Z0-9_-]{1,12}", code):
            raise ApiError(
                "PLAN003",
                "Kayıt kimliği en fazla 12 karakter olmalı; büyük İngilizce harf, rakam, alt çizgi ve tire kullanılabilir.",
            )
        key = node_id(kind, code)
        if node.get("id") != key:
            raise ApiError(
                "PLAN001", "Kayıt kimliği değiştirilemez. Planı yeniden yükle."
            )
        if key in normalized:
            raise ApiError("PLAN004", "Aynı türde tekrarlanan kayıt kimliği var.")
        normalized[key] = {"kind": kind, "name": name, "code": code}
    pairs, agent_teams = set(), {}
    for edge in edges:
        if not isinstance(edge, dict):
            raise ApiError("PLAN005", "Bağlantı biçimi geçersiz.")
        source, target = edge.get("source"), edge.get("target")
        if not isinstance(source, str) or not isinstance(target, str):
            raise ApiError("PLAN005", "Bağlantı kimliği geçersiz.")
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
            if b["code"] in agent_teams:
                raise ApiError(
                    "PLAN006",
                    "Bir temsilci aynı anda yalnızca bir takıma bağlanabilir.",
                )
            agent_teams[b["code"]] = a["code"]
        pairs.add((source, target))
    return normalized, pairs, agent_teams


@endpoint(["GET"])
def workspace(request):
    """Provide scoped roster and campaign data without granting planning access."""
    return JsonResponse(planning_data(request.user))


@endpoint(["GET", "PUT"])
def planning(request):
    if request.user.role_id not in ("admin", "manager"):
        audit(request, "access.denied", request.path)
        raise ApiError("AUTH003", "Takım planlamasına erişim yetkin yok.", 403)
    if request.method == "GET":
        audit(request, "planning.view")
        return JsonResponse(planning_data(request.user))
    if request.user.role_id != "admin":
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
            actor.role_id != "admin"
            or not actor.is_active
            or actor.auth_version != request.session.get("auth_version")
        ):
            raise ApiError("AUTH001", "Oturumu yeniden doğrula.", 401)
        revision, _ = PlanningRevision.objects.select_for_update().get_or_create(pk=1)
        if revision.version != data["revision"]:
            raise ApiError(
                "PLAN008",
                "Plan başka bir sekmede değişti. Güncel planı yeniden yükle.",
                409,
            )
        keep_teams = [row["code"] for row in nodes.values() if row["kind"] == "team"]
        if (
            User.objects.filter(role_id="captain", team__is_active=True)
            .exclude(team_id__in=keep_teams)
            .exists()
        ):
            raise ApiError(
                "PLAN009",
                "Takımı kaldırmadan önce bu takıma bağlı kaptanların atamasını değiştir.",
            )
        before = planning_data(actor)
        instant = timezone.now()
        for kind, model in MODELS.items():
            rows = [row for row in nodes.values() if row["kind"] == kind]
            keys = [row["code"] for row in rows]
            if kind == "agent":
                for key in (
                    model.objects.exclude(pk__in=keys)
                    .filter(team_assignments__valid_to__isnull=True)
                    .values_list("pk", flat=True)
                    .distinct()
                ):
                    change_team(key, None, actor=actor, effective_at=instant)
            model.objects.exclude(pk__in=keys).update(is_active=False)
            for row in rows:
                record, created = model.objects.update_or_create(
                    pk=row["code"], defaults={"name": row["name"], "is_active": True}
                )
                if created:
                    record.created_by = actor
                    record.save(update_fields=["created_by"])
                if kind == "agent":
                    change_team(
                        record.pk,
                        agent_teams.get(record.pk),
                        actor=actor,
                        effective_at=instant,
                    )
        wanted = {
            (nodes[source]["code"], nodes[target]["code"])
            for source, target in edges
            if nodes[target]["kind"] == "campaign"
        }
        for link in TeamCampaign.objects.all():
            if (link.team_id, link.campaign_id) not in wanted:
                link.delete()
        for source, target in wanted:
            TeamCampaign.objects.get_or_create(
                team_id=source, campaign_id=target, defaults={"created_by": actor}
            )
        revision.version += 1
        revision.save(update_fields=["version"])
        result = planning_data(actor)
        audit(request, "planning.saved", revision.version, before=before, after=result)
    return JsonResponse(result)


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
