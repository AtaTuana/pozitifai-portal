"""Canonical call facts; missing facts stay NULL and invalid source rows stay in ingestion."""

from django.conf import settings
from django.db import models
from django.db.models import Q
from portal.fields import LocalDateTimeField
from .organization import BUSINESS_ID_PATTERN


class Result(models.Model):
    class Id(models.IntegerChoices):
        SALE = 1, "Satış"
        REJECTED = 2, "Ret"
        CALLBACK = 3, "Geri ara"
        UNREACHABLE = 4, "Ulaşılamadı"

    id = models.PositiveSmallIntegerField(primary_key=True)
    name = models.CharField(max_length=100)
    is_reached = models.BooleanField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(id__gte=1, id__lte=32767), name="valid_result_id"
            )
        ]


class Call(models.Model):
    id = models.CharField(max_length=12, primary_key=True)
    agent = models.ForeignKey(
        "Agent", null=True, blank=True, on_delete=models.PROTECT, related_name="calls"
    )
    started_at = LocalDateTimeField(db_index=True)
    duration_seconds = models.PositiveSmallIntegerField(null=True, blank=True)
    result = models.ForeignKey(Result, null=True, blank=True, on_delete=models.PROTECT)
    campaign = models.ForeignKey(
        "Campaign", on_delete=models.PROTECT, related_name="calls"
    )
    source_row = models.ForeignKey(
        "ImportRow", null=True, blank=True, on_delete=models.PROTECT
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(id__regex=BUSINESS_ID_PATTERN),
                name="call_valid_business_id",
            ),
            models.CheckConstraint(
                condition=Q(duration_seconds__isnull=True)
                | Q(duration_seconds__gte=0, duration_seconds__lte=32767),
                name="valid_call_duration",
            ),
        ]
        indexes = [
            models.Index(fields=["campaign", "started_at"], name="call_campaign_date"),
            models.Index(fields=["agent", "started_at"], name="call_agent_date"),
        ]


class Rater(models.Model):
    id = models.SmallAutoField(primary_key=True)
    name = models.CharField(max_length=150)


class QualityScore(models.Model):
    call = models.OneToOneField(
        Call, primary_key=True, on_delete=models.PROTECT, related_name="quality_score"
    )
    rater = models.ForeignKey(Rater, on_delete=models.PROTECT)
    total_score = models.DecimalField(max_digits=5, decimal_places=2)
    greeting_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    need_analysis_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    closure_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    source_row = models.ForeignKey(
        "ImportRow", null=True, blank=True, on_delete=models.PROTECT
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(total_score__gte=0, total_score__lte=100),
                name="quality_total_range",
            ),
            *[
                models.CheckConstraint(
                    condition=Q(**{f"{field}__isnull": True})
                    | Q(**{f"{field}__gte": 0, f"{field}__lte": 100}),
                    name=name,
                )
                for field, name in [
                    ("greeting_score", "quality_greeting_range"),
                    ("need_analysis_score", "quality_need_range"),
                    ("closure_score", "quality_closure_range"),
                ]
            ],
        ]


class Transcript(models.Model):
    """One original conversation per call; ordered speaker turns are parsed in code."""

    call = models.OneToOneField(
        Call, primary_key=True, on_delete=models.PROTECT, related_name="transcript"
    )
    content = models.TextField()
    content_sha256 = models.CharField(max_length=64)
    uploaded_at = LocalDateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    source_row = models.ForeignKey(
        "ImportRow", null=True, blank=True, on_delete=models.PROTECT
    )
