"""Versioned prompts and traceable classifications; the user's taxonomy is not prefilled."""

from django.conf import settings
from django.db import models
from django.db.models import Q
from portal.fields import LocalDateTimeField


class RejectionCategory(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True)
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField()
    is_active = models.BooleanField(default=True)


class PromptVersion(models.Model):
    name = models.CharField(max_length=100)
    version = models.PositiveIntegerField()
    content = models.TextField()
    taxonomy_snapshot = models.JSONField(default=list)
    content_sha256 = models.CharField(max_length=64)
    created_at = LocalDateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["name", "version"], name="unique_prompt_version"
            ),
            models.CheckConstraint(
                condition=Q(version__gte=1), name="positive_prompt_version"
            ),
        ]


class AnalysisRun(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Bekliyor"
        RUNNING = "running", "Çalışıyor"
        COMPLETED = "completed", "Tamamlandı"
        FAILED = "failed", "Başarısız"

    transcript = models.ForeignKey(
        "Transcript", on_delete=models.PROTECT, related_name="analyses"
    )
    prompt = models.ForeignKey(PromptVersion, on_delete=models.PROTECT)
    provider = models.CharField(max_length=40)
    model_name = models.CharField(max_length=150)
    input_content = models.TextField()
    input_sha256 = models.CharField(max_length=64)
    parameters = models.JSONField(default=dict)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING
    )
    raw_response = models.TextField(blank=True)
    error_code = models.CharField(max_length=32, blank=True)
    input_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = LocalDateTimeField(auto_now_add=True)
    completed_at = LocalDateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    is_selected = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["transcript"],
                condition=Q(is_selected=True),
                name="one_selected_transcript_analysis",
            ),
            models.CheckConstraint(
                condition=Q(is_selected=False) | Q(status="completed"),
                name="selected_analysis_completed",
            ),
            models.CheckConstraint(
                condition=Q(status__in=["pending", "running", "completed", "failed"]),
                name="known_analysis_status",
            ),
        ]
        indexes = [
            models.Index(
                fields=["transcript", "input_sha256", "prompt"],
                name="analysis_input_lookup",
            )
        ]


class AnalysisLabel(models.Model):
    run = models.ForeignKey(
        AnalysisRun, on_delete=models.PROTECT, related_name="labels"
    )
    category = models.ForeignKey(RejectionCategory, on_delete=models.PROTECT)
    evidence = models.TextField()
    explanation = models.TextField(blank=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["run", "category"], name="unique_analysis_category"
            ),
            models.UniqueConstraint(
                fields=["run"],
                condition=Q(is_primary=True),
                name="one_primary_analysis_category",
            ),
        ]
