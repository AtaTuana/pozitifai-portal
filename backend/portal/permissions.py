"""Authoritative role and team scope, reused by current and future reporting endpoints."""

from .models import Agent, Campaign, Team, TeamCampaign


def scoped_teams(user):
    return (
        Team.objects.filter(pk=user.team_id)
        if user.role == "captain"
        else Team.objects.all()
    )


def scoped_agents(user):
    return (
        Agent.objects.filter(team_id=user.team_id)
        if user.role == "captain"
        else Agent.objects.all()
    )


def scoped_campaigns(user):
    return (
        Campaign.objects.filter(teams__id=user.team_id).distinct()
        if user.role == "captain"
        else Campaign.objects.all()
    )


def scoped_links(user):
    return (
        TeamCampaign.objects.filter(team_id=user.team_id)
        if user.role == "captain"
        else TeamCampaign.objects.all()
    )


def capabilities(user):
    return {
        "manage": user.role == "admin",
        "upload": user.role in ("admin", "manager"),
        "allTeams": user.role in ("admin", "manager"),
    }
