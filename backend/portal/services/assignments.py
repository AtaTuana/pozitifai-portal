"""Serialize team changes and preserve the memberships used for historical reporting."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from portal.models import Agent, AgentTeamAssignment


@transaction.atomic
def change_team(agent_id, team_id, *, actor=None, effective_at=None):
    """Close the previous interval and begin a new one at the exact same instant."""
    agent = Agent.objects.select_for_update().get(pk=agent_id)
    instant = effective_at or timezone.now()
    current = agent.team_assignments.filter(valid_to__isnull=True).first()
    if current and current.team_id == team_id:
        return current
    if current:
        if instant <= current.valid_from:
            raise ValidationError(
                "TEAM001: Yeni atama, mevcut atamanın başlangıcından sonra olmalı."
            )
        current.valid_to = instant
        current.save(update_fields=["valid_to"])
    if team_id is None:
        return None
    if agent.team_assignments.filter(
        Q(valid_to__isnull=True) | Q(valid_to__gt=instant)
    ).exists():
        raise ValidationError("TEAM002: Takım üyeliği tarihleri çakışıyor.")
    return AgentTeamAssignment.objects.create(
        agent=agent, team_id=team_id, valid_from=instant, created_by=actor
    )
