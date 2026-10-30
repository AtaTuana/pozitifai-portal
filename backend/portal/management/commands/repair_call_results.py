"""Preview or explicitly repair NULL outcomes from preserved, accepted source rows."""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from portal.ingestion.outcomes import RESULT_LABELS, resolve_result
from portal.ingestion.parsing import clean_text
from portal.ingestion.rules import RULESET_VERSION, RULE_VERSIONS
from portal.ingestion.summary import refresh_summaries
from portal.models import (
    AuditEvent,
    Call,
    ImportIssue,
    ImportRow,
    PlanningRevision,
    Result,
    User,
)


class Command(BaseCommand):
    help = "Kaynağı bilinen boş çağrı sonuçlarını önizler; yalnız --apply ile onarır."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Düzeltmeleri kaydet.")
        parser.add_argument(
            "--actor", help="İşlemi yapan mevcut admin hesabının e-postası."
        )

    @transaction.atomic
    def handle(self, **options):
        apply = options["apply"]
        actor = None
        if apply:
            if not options["actor"]:
                raise CommandError("--apply için --actor ile admin e-postası gerekli.")
            # Follow the upload lock order: account, then shared planning revision.
            actor = (
                User.objects.select_for_update()
                .filter(
                    email__iexact=options["actor"].strip(),
                    role_id="admin",
                    is_active=True,
                )
                .first()
            )
            if actor is None:
                raise CommandError(
                    "Aktif admin hesabı bulunamadı; hiçbir kayıt değişmedi."
                )
            PlanningRevision.objects.select_for_update().get_or_create(pk=1)

        calls = (
            Call.objects.filter(
                result__isnull=True,
                source_row__batch__kind="calls",
                source_row__status="accepted",
            )
            .select_related("source_row")
            .order_by("pk")
        )
        candidates = []
        for call in calls:
            source = call.source_row
            raw_result = source.raw_data.get("sonuc")
            if (
                not isinstance(raw_result, str)
                or source.reference_id != call.pk
                or clean_text(source.raw_data.get("call_id", "")) != call.pk
                or source.cleaned_data.get("result_id") is not None
            ):
                continue
            result_id = resolve_result(raw_result)
            if result_id is not None:
                candidates.append((call, source, raw_result, result_id))

        self.stdout.write(f"Düzeltilebilir boş sonuç: {len(candidates)}")
        for call, source, raw_result, result_id in candidates:
            self.stdout.write(
                f"{call.pk}: {raw_result!r} -> {RESULT_LABELS[result_id]} (ResultId={result_id})"
            )
        if not apply:
            self.stdout.write(
                "Önizleme tamamlandı. Veritabanında değişiklik yapılmadı."
            )
            return
        if not candidates:
            self.stdout.write("Onarılacak kayıt yok; hiçbir kayıt değişmedi.")
            return

        required_ids = {item[3] for item in candidates}
        if required_ids - set(
            Result.objects.filter(pk__in=required_ids).values_list("pk", flat=True)
        ):
            raise CommandError("Sonuç sözlüğü eksik. Migration durumunu kontrol et.")

        changed_sources, issues, call_ids, batch_ids = [], [], [], set()
        for call, source, raw_result, result_id in candidates:
            # A concurrent/manual edit must never be overwritten by this repair.
            if not Call.objects.filter(
                pk=call.pk, result__isnull=True, source_row_id=source.pk
            ).update(result_id=result_id):
                raise CommandError(
                    "Çağrı bu sırada değişti; bütün düzeltmeler geri alındı."
                )
            source.cleaned_data = {**source.cleaned_data, "result_id": result_id}
            changed_sources.append(source)
            call_ids.append(call.pk)
            batch_ids.add(source.batch_id)
            issues.append(
                ImportIssue(
                    row=source,
                    code="DQ-013",
                    rule_version=RULE_VERSIONS["DQ-013"],
                    field_name="sonuc",
                    operation="update",
                    before_value=None,
                    after_value=result_id,
                    message="Kaynak sonuç etiketi güncel harf eşleştirmesiyle yeniden okundu; boş sonuç onarıldı.",
                    evidence={
                        "sourceValue": raw_result,
                        "canonicalLabel": RESULT_LABELS[result_id],
                        "rulesetVersion": RULESET_VERSION,
                        "command": "repair_call_results",
                    },
                    report_effect="Çağrı artık bilinen sonuç sayımlarına katılabilir; diğer alanları değişmedi.",
                    actor=actor,
                )
            )

        ImportRow.objects.bulk_update(changed_sources, ["cleaned_data"], batch_size=250)
        ImportIssue.objects.filter(
            row_id__in=[source.pk for source in changed_sources],
            code="DQ-013",
            field_name="sonuc",
            operation="omit",
            resolved_at__isnull=True,
        ).update(
            resolved_at=timezone.now(),
            resolved_by=actor,
            resolution_note="DQ-013 v2 ile kaynak etiket eşleştirildi; boş sonuç onarıldı.",
        )
        ImportIssue.objects.bulk_create(issues, batch_size=500)
        refresh_summaries(batch_ids)
        AuditEvent.objects.create(
            actor=actor,
            action="import.results_repaired",
            target="calls",
            details={
                "count": len(call_ids),
                "callIds": call_ids,
                "batchIds": sorted(batch_ids),
                "rule": "DQ-013",
                "ruleVersion": RULE_VERSIONS["DQ-013"],
            },
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"{len(call_ids)} çağrının sonucu onarıldı; işlem izi ve yükleme özeti güncellendi."
            )
        )
