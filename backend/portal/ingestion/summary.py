"""Count distinct source records and fields instead of summing overlapping rules."""

from django.db.models import Count
from portal.models import Call, ImportBatch, ImportIssue


def update_summary(batch):
    rows = batch.rows.all()
    issues = ImportIssue.objects.filter(row__batch=batch)
    counts = {
        item["status"]: item["count"]
        for item in rows.values("status").annotate(count=Count("pk"))
    }
    summary = {
        "total": sum(counts.values()),
        **{
            status: counts.get(status, 0)
            for status in ("accepted", "duplicate", "quarantined", "unmatched")
        },
        "uniqueRecords": rows.exclude(reference_id="")
        .values("reference_id")
        .distinct()
        .count(),
        "affectedRecords": issues.exclude(row__reference_id="")
        .values("row__reference_id")
        .distinct()
        .count(),
        "correctedFields": issues.filter(
            operation__in=["normalize", "infer", "recalculate", "update", "match"]
        )
        .exclude(field_name="")
        .values("row_id", "field_name")
        .distinct()
        .count(),
        "ruleCounts": {
            item["code"]: item["count"]
            for item in issues.values("code").annotate(count=Count("pk"))
        },
    }
    if batch.kind == "calls":
        calls = Call.objects.filter(source_row__batch=batch)
        summary.update(
            undatedCalls=calls.filter(started_at__isnull=True).count(),
            unknownAgents=calls.filter(agent__isnull=True).count(),
            unknownResults=calls.filter(result__isnull=True).count(),
            missingDurations=calls.filter(duration_seconds__isnull=True).count(),
        )
    batch.summary = summary
    batch.save(update_fields=["summary"])


def refresh_summaries(batch_ids):
    for batch in ImportBatch.objects.filter(pk__in=batch_ids, status="completed"):
        update_summary(batch)


def batch_data(batch):
    return {
        "id": batch.pk,
        "kind": batch.kind,
        "filename": batch.original_filename,
        "status": batch.status,
        "summary": batch.summary,
        "rulesetVersion": batch.ruleset_version,
        "options": batch.options,
        "uploadedAt": batch.uploaded_at.isoformat(),
        "uploadedBy": batch.uploaded_by.display_name if batch.uploaded_by else "Sistem",
    }
