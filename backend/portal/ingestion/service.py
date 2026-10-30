"""Preserve source bytes once, then commit canonical records in a per-file savepoint."""

import hashlib
import logging
from collections import defaultdict
from pathlib import PurePath
from django.db import DatabaseError, transaction
from django.utils import timezone
from portal.http import ApiError
from portal.models import AuditEvent, ImportBatch, ImportRow, PlanningRevision, User
from .cleaning import clean_rows, identify_rows
from .parsing import csv_rows, decode
from .persistence import SAVERS, finish_rows
from .reconciliation import reconcile, connect_campaigns
from .rules import RULESET_VERSION, SourceRow
from .summary import refresh_summaries

logger = logging.getLogger(__name__)


def import_one(kind, filename, content, actor, options):
    digest = hashlib.sha256(content).hexdigest()
    stored_options = {
        "profile": options.get("profile", "none"),
        "period": (
            [day.isoformat() for day in options["period"]]
            if options.get("period")
            else None
        ),
    }
    if kind == "transcript":
        # Identical conversations can belong to different calls; the filename is semantic here.
        stored_options["callReference"] = PurePath(filename).stem
        stored_options["conflictingTranscript"] = PurePath(
            filename
        ).stem in options.get("transcript_conflicts", set())
    # The planning revision lock held by import_files serializes competing uploads.
    retry = None
    for previous in ImportBatch.objects.filter(
        kind=kind, content_sha256=digest, ruleset_version=RULESET_VERSION
    ).order_by("pk"):
        if previous.options == stored_options and previous.status == "completed":
            AuditEvent.objects.create(
                actor=actor,
                action="import.repeated",
                target=str(previous.pk),
                details={"kind": kind},
            )
            return previous, True
        if (
            previous.options == stored_options
            and previous.status == "failed"
            and not previous.rows.exists()
        ):
            retry = previous
    if retry:
        batch = retry
        batch.status, batch.summary, batch.completed_at = "processing", {}, None
        batch.save(update_fields=["status", "summary", "completed_at"])
    else:
        batch = ImportBatch.objects.create(
            kind=kind,
            status="processing",
            original_filename=filename,
            original_content=content,
            content_sha256=digest,
            uploaded_by=actor,
            options=stored_options,
            ruleset_version=RULESET_VERSION,
        )
    try:
        with transaction.atomic():
            if kind == "transcript":
                text = decode(content)
                if not text.strip():
                    raise ApiError(
                        "IMP004", "Transkript boş. Konuşma içeren TXT dosyasını seç."
                    )
                row = SourceRow(
                    1, {"call_id": PurePath(filename).stem, "content": text}
                )
                rows = [row]
                identify_rows(rows, kind)
                if row.reference in options.get("transcript_conflicts", set()):
                    row.quarantine(
                        "DQ-007",
                        "call_id",
                        "Seçilen klasörde aynı çağrı kimliğine ait farklı transkriptler var; hiçbir sürüm seçilmedi.",
                    )
            else:
                rows = csv_rows(kind, content)
                clean_rows(rows, kind, options)
            sources = ImportRow.objects.bulk_create(
                [
                    ImportRow(
                        batch=batch,
                        row_number=row.number,
                        raw_data=row.raw,
                        reference_id=row.reference,
                        cleaned_data=row.values,
                        status=row.status,
                    )
                    for row in rows
                ],
                batch_size=500,
            )
            SAVERS[kind](rows, sources, actor)
            finish_rows(rows, sources, actor)
            batch.status = "completed"
            batch.completed_at = timezone.now()
            batch.save(update_fields=["status", "completed_at"])
    except ApiError as exc:
        batch.status = "failed"
        batch.summary = {"error": {"code": exc.code, "message": exc.message}}
    except DatabaseError:
        logger.exception("Import transaction failed (batch=%s).", batch.pk)
        batch.status = "failed"
        batch.summary = {
            "error": {
                "code": "IMP008",
                "message": "Veritabanı işlemi geri alındı. Bağlantıyı ve migration durumunu kontrol edip dosyayı yeniden yükle.",
            }
        }
    batch.completed_at = timezone.now()
    batch.save(update_fields=["status", "summary", "completed_at"])
    return batch, False


@transaction.atomic
def import_files(user, auth_version, kind, files, options):
    """Recheck the actor under lock before any upload or canonical write occurs."""
    actor = User.objects.select_for_update().get(pk=user.pk)
    if not actor.is_active or actor.auth_version != auth_version:
        raise ApiError("AUTH001", "Oturumun değişti. Yeniden giriş yap.", 401)
    if actor.role_id not in ("admin", "manager") or (
        kind == "agents" and actor.role_id != "admin"
    ):
        raise ApiError("AUTH003", "Bu dosyayı yükleme yetkin yok.", 403)
    revision, _ = PlanningRevision.objects.select_for_update().get_or_create(pk=1)
    if kind == "transcript":
        versions = defaultdict(set)
        for name, content in files:
            versions[PurePath(name).stem].add(hashlib.sha256(content).hexdigest())
        options = {
            **options,
            "transcript_conflicts": {
                key for key, values in versions.items() if len(values) > 1
            },
        }
    result = [
        import_one(kind, name, content, actor, options) for name, content in files
    ]
    affected = reconcile(actor)
    affected.update(
        batch.pk
        for batch, repeated in result
        if batch.status == "completed" and not repeated
    )
    refresh_summaries(affected)
    linked = connect_campaigns(actor) if kind in ("calls", "agents") else False
    if linked or (
        kind in ("calls", "agents")
        and any(
            batch.status == "completed" and not repeated for batch, repeated in result
        )
    ):
        revision.version += 1
        revision.save(update_fields=["version"])
    # Reconciliation can change summaries of both current and previous batches.
    for batch, repeated in result:
        batch.refresh_from_db()
        if not repeated:
            AuditEvent.objects.create(
                actor=actor,
                action="import." + batch.status,
                target=str(batch.pk),
                details={"kind": kind, "summary": batch.summary},
            )
    return result
