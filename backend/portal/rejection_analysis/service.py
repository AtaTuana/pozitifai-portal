"""Role-scoped queries and durable, idempotent single-conversation analysis."""

from datetime import timedelta
import os
from django.db import transaction
from django.db.models import Max, Min, Prefetch
from django.utils import timezone

from portal.http import ApiError, audit
from portal.models import (
    AnalysisLabel,
    AnalysisRun,
    PromptVersion,
    RejectionCategory,
    Result,
    Transcript,
    User,
)
from portal.permissions import permitted
from portal.reporting.queries import selected_calls
from .provider import classify
from .taxonomy import (
    CATEGORIES,
    CATEGORY_IDS,
    PROMPT_NAME,
    PROMPT_VERSION,
    digest,
    model_name,
    prompt_content,
)
from .transcripts import conversation_turns

MAX_SELECTION = 1000


def current_user(original, *, lock=False):
    users = User.objects.select_for_update() if lock else User.objects
    user = users.filter(pk=original.pk).first()
    if not user or not permitted(user) or user.auth_version != original.auth_version:
        raise ApiError("AUTH001", "Oturum yetkileri değişti. Yeniden giriş yap.", 401)
    return user


def eligible_calls(user, query):
    calls, before_dates = selected_calls(user, query, timezone.now())
    return calls.filter(result_id=Result.Id.REJECTED), before_dates.filter(
        result_id=Result.Id.REJECTED
    )


def cached_runs():
    return AnalysisRun.objects.filter(
        status=AnalysisRun.Status.COMPLETED,
        is_selected=True,
        provider="openai",
        model_name=model_name(),
        prompt__content_sha256=digest(prompt_content()),
    ).prefetch_related(
        Prefetch("labels", queryset=AnalysisLabel.objects.order_by("-is_primary", "pk"))
    )


def call_record(call, run=None):
    if run is None:
        run = next(
            (
                item
                for item in call.transcript.current_runs
                if item.input_sha256 == call.transcript.content_sha256
            ),
            None,
        )
    return {
        "callId": call.pk,
        "agentName": call.agent.name if call.agent else "Temsilci bilinmiyor",
        "campaignName": call.campaign.name,
        "startedAt": call.started_at.isoformat() if call.started_at else None,
        "analyzed": run is not None,
        "categoryIds": [label.category_id for label in run.labels.all()] if run else [],
    }


def loaded_calls(calls):
    return calls.select_related("agent", "campaign", "transcript").prefetch_related(
        Prefetch("transcript__analyses", queryset=cached_runs(), to_attr="current_runs")
    )


def overview(original, query):
    user = current_user(original)
    calls, all_dates = eligible_calls(user, query)
    available = calls.filter(transcript__isnull=False)
    count = available.count()
    if count > MAX_SELECTION:
        raise ApiError(
            "REJ002",
            "Bir seçimde en fazla 1.000 konuşma açılabilir. Tarih aralığını daralt.",
            422,
        )
    records = [
        call_record(call)
        for call in loaded_calls(available).order_by("started_at", "pk")
    ]
    bounds = all_dates.filter(transcript__isnull=False).aggregate(
        first=Min("started_at"), last=Max("started_at")
    )
    return {
        "records": records,
        "categories": [{"id": CATEGORY_IDS[name], "name": name} for name in CATEGORIES],
        "missingTranscripts": calls.filter(transcript__isnull=True).count(),
        "undatedTranscripts": all_dates.filter(
            transcript__isnull=False, started_at__isnull=True
        ).count(),
        "dateBounds": {
            name: value.date().isoformat() if value else None
            for name, value in bounds.items()
        },
        "canAnalyze": user.role_id in ("admin", "manager"),
        "providerConfigured": bool(os.environ.get("OPENAI_API_KEY", "").strip()),
        "model": model_name(),
    }


def detail(original, query, call_id):
    user = current_user(original)
    calls, _ = eligible_calls(user, query)
    call = loaded_calls(calls.filter(pk=call_id, transcript__isnull=False)).first()
    if call is None:
        raise ApiError(
            "REJ001", "Konuşma bulunamadı veya bu kapsamda erişilemiyor.", 404
        )
    return {**call_record(call), "turns": conversation_turns(call.transcript.content)}


def ensure_prompt(user):
    content = prompt_content()
    prompt, _ = PromptVersion.objects.get_or_create(
        name=PROMPT_NAME,
        version=PROMPT_VERSION,
        defaults={
            "content": content,
            "content_sha256": digest(content),
            "taxonomy_snapshot": list(CATEGORIES),
            "created_by": user,
        },
    )
    if prompt.content_sha256 != digest(content):
        raise ApiError(
            "LLM108", "Prompt değişti; yeni bir prompt sürümü tanımlanmalı.", 409
        )
    for name, key in CATEGORY_IDS.items():
        category, _ = RejectionCategory.objects.get_or_create(
            pk=key, defaults={"name": name, "description": ""}
        )
        if category.name != name:
            raise ApiError(
                "LLM108", "Kayıtlı kategori listesi prompt ile uyuşmuyor.", 409
            )
    return prompt


def analyze(request, query, call_id):
    """Reserve under locks, release before network I/O, then atomically select the result."""
    with transaction.atomic():
        user = current_user(request.user, lock=True)
        if user.role_id not in ("admin", "manager"):
            raise ApiError(
                "AUTH003", "Analizi yalnızca admin veya yönetici başlatabilir.", 403
            )
        calls, _ = eligible_calls(user, query)
        if not calls.filter(pk=call_id, transcript__isnull=False).exists():
            raise ApiError(
                "REJ001", "Konuşma bulunamadı veya seçilen tarih/kampanya dışında.", 404
            )
        transcript = Transcript.objects.select_for_update().get(pk=call_id)
        model = model_name()
        cached = (
            cached_runs()
            .filter(transcript=transcript, input_sha256=transcript.content_sha256)
            .first()
        )
        if cached:
            return {
                "callId": call_id,
                "analyzed": True,
                "categoryIds": [label.category_id for label in cached.labels.all()],
                "cached": True,
            }
        if not os.environ.get("OPENAI_API_KEY", "").strip():
            raise ApiError(
                "LLM001",
                "API anahtarı tanımlı değil. Yerel ayarları kaydedip start.bat dosyasını yeniden başlat.",
                503,
            )
        fresh_since = timezone.now() - timedelta(seconds=90)
        running = AnalysisRun.objects.filter(
            status=AnalysisRun.Status.RUNNING, created_at__gte=fresh_since
        )
        if running.filter(transcript=transcript).exists():
            raise ApiError(
                "REJ003",
                "Bu konuşma zaten analiz ediliyor. Kısa süre sonra sonuçları yenile.",
                409,
            )
        if running.filter(created_by=user).count() >= 3:
            raise ApiError(
                "REJ004",
                "Üç konuşma şu anda analiz ediliyor. Tamamlanmalarını bekle.",
                429,
            )
        AnalysisRun.objects.filter(
            transcript=transcript, status="running", created_at__lt=fresh_since
        ).update(status="failed", error_code="LLM105", completed_at=timezone.now())
        prompt = ensure_prompt(user)
        run = AnalysisRun.objects.create(
            transcript=transcript,
            prompt=prompt,
            provider="openai",
            model_name=model,
            input_content=transcript.content,
            input_sha256=transcript.content_sha256,
            status=AnalysisRun.Status.RUNNING,
            created_by=user,
            parameters={
                "reasoning_effort": "none",
                "max_output_tokens": 256,
                "schema_version": 1,
            },
        )
    try:
        answer = classify(
            call_id=call_id,
            transcript=run.input_content,
            prompt=prompt.content,
            model=model,
        )
        with transaction.atomic():
            refreshed = current_user(request.user, lock=True)
            if refreshed.role_id not in ("admin", "manager"):
                raise ApiError(
                    "AUTH003",
                    "Analiz yetkin değişti. Sonuç bu oturumda kaydedilemedi.",
                    403,
                )
            current = Transcript.objects.select_for_update().get(pk=call_id)
            if current.content_sha256 != run.input_sha256:
                raise ApiError(
                    "REJ005",
                    "Konuşma analiz sırasında değişti; güncel metinle yeniden başlat.",
                    409,
                )
            AnalysisRun.objects.filter(transcript=current, is_selected=True).update(
                is_selected=False
            )
            run.raw_response = answer.raw_response
            run.status = AnalysisRun.Status.COMPLETED
            run.is_selected = True
            run.completed_at = timezone.now()
            run.input_tokens, run.output_tokens, run.duration_ms = (
                answer.input_tokens,
                answer.output_tokens,
                answer.duration_ms,
            )
            run.save(
                update_fields=[
                    "raw_response",
                    "status",
                    "is_selected",
                    "completed_at",
                    "input_tokens",
                    "output_tokens",
                    "duration_ms",
                ]
            )
            AnalysisLabel.objects.bulk_create(
                [
                    AnalysisLabel(
                        run=run,
                        category_id=CATEGORY_IDS[name],
                        is_primary=index == 0,
                        evidence="",
                    )
                    for index, name in enumerate(answer.categories)
                ]
            )
            audit(
                request,
                "rejection.analyzed",
                call_id,
                runId=run.pk,
                model=model,
                categoryIds=[CATEGORY_IDS[name] for name in answer.categories],
                inputTokens=answer.input_tokens,
                outputTokens=answer.output_tokens,
                durationMs=answer.duration_ms,
            )
    except ApiError as exc:
        AnalysisRun.objects.filter(pk=run.pk, status="running").update(
            status="failed", error_code=exc.code, completed_at=timezone.now()
        )
        audit(request, "rejection.failed", call_id, runId=run.pk, code=exc.code)
        raise
    return {
        "callId": call_id,
        "analyzed": True,
        "categoryIds": [CATEGORY_IDS[name] for name in answer.categories],
        "cached": False,
    }
