"""Explicit action metadata and short-lived authentication rate limits."""

from django.conf import settings
from django.db import models
from portal.fields import LocalDateTimeField


class AuditEvent(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    action = models.CharField(max_length=60)
    target = models.CharField(max_length=150, blank=True)
    details = models.JSONField(default=dict)
    created_at = LocalDateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-pk"]


class LoginAttempt(models.Model):
    key = models.CharField(max_length=80, primary_key=True)
    count = models.PositiveIntegerField(default=0)
    expires_at = LocalDateTimeField()
