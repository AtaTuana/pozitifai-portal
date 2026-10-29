"""Stable business IDs, current campaign links and dated team memberships."""

from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import F, Q
from portal.fields import LocalDateTimeField

BUSINESS_ID_PATTERN = r"^[A-Z0-9_-]{1,12}$"


class OrganizationRecord(models.Model):
    id = models.CharField(
        max_length=12,
        primary_key=True,
        validators=[RegexValidator(BUSINESS_ID_PATTERN)],
    )
    name = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="%(class)s_created",
    )
    created_at = LocalDateTimeField(auto_now_add=True)
    updated_at = LocalDateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(
                condition=Q(id__regex=BUSINESS_ID_PATTERN),
                name="%(class)s_valid_business_id",
            )
        ]


class Team(OrganizationRecord):
    pass


class Campaign(OrganizationRecord):
    teams = models.ManyToManyField(
        Team, through="TeamCampaign", related_name="campaigns"
    )


class TeamCampaign(models.Model):
    id = models.AutoField(primary_key=True)
    team = models.ForeignKey(Team, on_delete=models.PROTECT)
    campaign = models.ForeignKey(Campaign, on_delete=models.PROTECT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    created_at = LocalDateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["team", "campaign"], name="unique_team_campaign"
            )
        ]


class Agent(OrganizationRecord):
    """No duplicated current TeamId; assignments are the single source of membership."""

    start_date = models.DateField(null=True, blank=True)


class AgentTeamAssignment(models.Model):
    id = models.AutoField(primary_key=True)
    agent = models.ForeignKey(
        Agent, on_delete=models.PROTECT, related_name="team_assignments"
    )
    team = models.ForeignKey(
        Team, on_delete=models.PROTECT, related_name="agent_assignments"
    )
    valid_from = LocalDateTimeField()
    valid_to = LocalDateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )

    class Meta:
        ordering = ["agent_id", "valid_from"]
        constraints = [
            models.UniqueConstraint(
                fields=["agent"],
                condition=Q(valid_to__isnull=True),
                name="one_open_agent_assignment",
            ),
            models.CheckConstraint(
                condition=Q(valid_to__isnull=True) | Q(valid_to__gt=F("valid_from")),
                name="valid_assignment_period",
            ),
        ]
        indexes = [
            models.Index(
                fields=["agent", "valid_from", "valid_to"],
                name="assignment_agent_period",
            ),
            models.Index(fields=["team", "valid_from"], name="assignment_team_period"),
        ]


class PlanningRevision(models.Model):
    """Serializes editor saves and rejects stale browser drafts."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    version = models.PositiveIntegerField(default=0)
