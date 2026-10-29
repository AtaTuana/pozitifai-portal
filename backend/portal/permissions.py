"""Scope every query at the server, including calls evaluated at their historical team."""

from django.db.models import Exists, OuterRef, Q
from django.utils import timezone
from .models import Agent, AgentTeamAssignment, Call, Campaign, Team, TeamCampaign


def permitted(user):
    return (
        user.is_authenticated
        and user.is_active
        and user.role_id in ("admin", "manager", "captain")
    )


def scoped_teams(user):
    if not permitted(user):
        return Team.objects.none()
    return (
        Team.objects.filter(pk=user.team_id)
        if user.role_id == "captain"
        else Team.objects.all()
    )


def scoped_agents(user):
    if not permitted(user):
        return Agent.objects.none()
    if user.role_id != "captain":
        return Agent.objects.all()
    instant = timezone.now()
    memberships = AgentTeamAssignment.objects.filter(
        agent_id=OuterRef("pk"), team_id=user.team_id, valid_from__lte=instant
    ).filter(Q(valid_to__isnull=True) | Q(valid_to__gt=instant))
    return Agent.objects.filter(Exists(memberships))


def scoped_campaigns(user):
    if not permitted(user):
        return Campaign.objects.none()
    return (
        Campaign.objects.filter(teams__id=user.team_id).distinct()
        if user.role_id == "captain"
        else Campaign.objects.all()
    )


def scoped_links(user):
    if not permitted(user):
        return TeamCampaign.objects.none()
    return (
        TeamCampaign.objects.filter(team_id=user.team_id)
        if user.role_id == "captain"
        else TeamCampaign.objects.all()
    )


def scoped_calls(user):
    """Unknown agents stay in company totals but cannot leak into a captain's scope."""
    if not permitted(user):
        return Call.objects.none()
    if user.role_id != "captain":
        return Call.objects.all()
    memberships = AgentTeamAssignment.objects.filter(
        agent_id=OuterRef("agent_id"),
        team_id=user.team_id,
        valid_from__lte=OuterRef("started_at"),
    ).filter(Q(valid_to__isnull=True) | Q(valid_to__gt=OuterRef("started_at")))
    return Call.objects.filter(Exists(memberships))


def capabilities(user):
    return {
        "manage": permitted(user) and user.role_id == "admin",
        "upload": permitted(user) and user.role_id in ("admin", "manager"),
        "allTeams": permitted(user) and user.role_id in ("admin", "manager"),
    }
