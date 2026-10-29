"""Preserve original uploads and row-level issues separately from reportable records."""

from django.conf import settings
from django.db import models
from django.db.models import Q
from portal.fields import LocalDateTimeField


class ImportBatch(models.Model):
    class Kind(models.TextChoices):
        CALLS = "calls", "Çağrılar"
        QUALITY = "quality", "Kalite değerlendirmeleri"
        AGENTS = "agents", "Temsilciler"
        TRANSCRIPT = "transcript", "Transkript"

    class Status(models.TextChoices):
        PENDING = "pending", "Bekliyor"
        PROCESSING = "processing", "İşleniyor"
        COMPLETED = "completed", "Tamamlandı"
        FAILED = "failed", "Başarısız"

    kind = models.CharField(max_length=12, choices=Kind.choices)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING
    )
    original_filename = models.CharField(max_length=255)
    original_content = models.BinaryField()
    content_sha256 = models.CharField(max_length=64)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    uploaded_at = LocalDateTimeField(auto_now_add=True)
    completed_at = LocalDateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["kind", "content_sha256"], name="import_content_lookup"
            )
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(kind__in=["calls", "quality", "agents", "transcript"]),
                name="known_import_kind",
            ),
            models.CheckConstraint(
                condition=Q(
                    status__in=["pending", "processing", "completed", "failed"]
                ),
                name="known_import_status",
            ),
        ]


class ImportRow(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Bekliyor"
        ACCEPTED = "accepted", "Kabul edildi"
        DUPLICATE = "duplicate", "Tekrar"
        QUARANTINED = "quarantined", "İnceleme gerekli"
        UNMATCHED = "unmatched", "Eşleşme bekliyor"

    batch = models.ForeignKey(
        ImportBatch, on_delete=models.PROTECT, related_name="rows"
    )
    row_number = models.PositiveIntegerField()
    raw_data = models.JSONField(default=dict)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["batch", "row_number"], name="unique_import_row"
            ),
            models.CheckConstraint(
                condition=Q(row_number__gte=1), name="positive_import_row_number"
            ),
            models.CheckConstraint(
                condition=Q(
                    status__in=[
                        "pending",
                        "accepted",
                        "duplicate",
                        "quarantined",
                        "unmatched",
                    ]
                ),
                name="known_import_row_status",
            ),
        ]
        indexes = [models.Index(fields=["status", "batch"], name="import_pending_rows")]


class ImportIssue(models.Model):
    row = models.ForeignKey(ImportRow, on_delete=models.PROTECT, related_name="issues")
    code = models.CharField(max_length=32)
    field_name = models.CharField(max_length=64, blank=True)
    message = models.TextField()
    resolved_at = LocalDateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    resolution_note = models.TextField(blank=True)
