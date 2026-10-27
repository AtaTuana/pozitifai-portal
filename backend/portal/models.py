"""Identity and organizational records only. Call/report schemas are intentionally separate."""

import uuid
from django.conf import settings
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        user = self.model(email=email.strip().lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractUser):
    """Representatives never receive this model; only portal operators authenticate."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Yönetici"
        CAPTAIN = "captain", "Takım kaptanı"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=100)
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.MANAGER)
    team = models.ForeignKey(
        "Team", null=True, blank=True, on_delete=models.PROTECT, related_name="captains"
    )
    created_by = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL
    )
    auth_version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]
    objects = UserManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["role"], condition=Q(role="admin"), name="one_portal_admin"
            ),
            models.CheckConstraint(
                condition=(
                    Q(role="captain", team__isnull=False)
                    | Q(role__in=["admin", "manager"], team__isnull=True)
                ),
                name="valid_user_scope",
            ),
        ]


class OrganizationRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=40, unique=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="%(class)s_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["name"]


class Team(OrganizationRecord):
    pass


class Campaign(OrganizationRecord):
    teams = models.ManyToManyField(
        Team, through="TeamCampaign", related_name="campaigns"
    )


class TeamCampaign(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["team", "campaign"], name="unique_team_campaign"
            )
        ]


class Agent(OrganizationRecord):
    """A representative record, not a login account. An unassigned agent is allowed."""

    team = models.ForeignKey(
        Team, null=True, blank=True, on_delete=models.PROTECT, related_name="agents"
    )


class PlanningRevision(models.Model):
    """Optimistic concurrency prevents one administrator tab overwriting another tab."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    version = models.PositiveIntegerField(default=0)


class AuditEvent(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    action = models.CharField(max_length=60)
    target = models.CharField(max_length=150, blank=True)
    details = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-pk"]


class LoginAttempt(models.Model):
    """Hash keys avoid storing attempted email addresses in rate-limit records."""

    key = models.CharField(max_length=80, primary_key=True)
    count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField()
