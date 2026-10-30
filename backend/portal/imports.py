"""Authenticated multipart uploads and paginated, role-protected import evidence."""

from datetime import date
from django.db import OperationalError
from django.http import JsonResponse
from .http import ApiError, audit, endpoint
from .models import ImportBatch, ImportIssue
from .permissions import permitted
from .ingestion.rules import (
    HEADERS,
    MAX_FILE_BYTES,
    MAX_FILES,
    MAX_TOTAL_BYTES,
    Q1,
    RULES,
    RULE_VERSIONS,
    RULESET_VERSION,
)
from .ingestion.service import import_files
from .ingestion.summary import batch_data


def require_upload_access(request):
    if not permitted(request.user) or request.user.role_id not in ("admin", "manager"):
        audit(request, "access.denied", request.path)
        raise ApiError(
            "AUTH003", "Yükleme kayıtları yalnızca admin ve yöneticilere açıktır.", 403
        )


def positive_integer(value, default=1, maximum=1000000000):
    try:
        result = int(value) if value is not None else default
    except (TypeError, ValueError):
        raise ApiError("IMP006", "Sayfa veya kayıt numarası geçersiz.") from None
    if not 1 <= result <= maximum:
        raise ApiError("IMP006", "Sayfa veya kayıt numarası sınır dışında.")
    return result


def upload_options(request, kind):
    profile = request.POST.get("profile", "none")
    if profile not in ("none", Q1) or (kind != "quality" and profile != "none"):
        raise ApiError("IMP005", "Geçerli bir kalite profili seç.")
    start, end = request.POST.get("periodStart", ""), request.POST.get("periodEnd", "")
    period = None
    if start or end:
        try:
            period = (date.fromisoformat(start), date.fromisoformat(end))
        except ValueError:
            raise ApiError(
                "IMP005", "Kaynak döneminin başlangıç ve bitiş gününü birlikte belirt."
            ) from None
        if kind != "calls" or period[0] > period[1]:
            raise ApiError(
                "IMP005",
                "Kaynak dönemi yalnızca çağrılar için, başlangıç ≤ bitiş olacak şekilde verilebilir.",
            )
    return {"profile": profile, "period": period}


@endpoint(["GET", "POST"])
def imports(request):
    require_upload_access(request)
    if request.method == "GET":
        batches = ImportBatch.objects.select_related("uploaded_by").order_by("-pk")
        if request.GET.get("before"):
            batches = batches.filter(pk__lt=positive_integer(request.GET["before"]))
        rows = list(batches[:26])
        return JsonResponse(
            {
                "batches": [batch_data(batch) for batch in rows[:25]],
                "next": rows[24].pk if len(rows) > 25 else None,
            }
        )
    if request.content_type != "multipart/form-data":
        raise ApiError("IMP001", "Dosyayı portalın yükleme alanından seç.", 415)
    kind = request.POST.get("kind")
    if kind not in (*HEADERS, "transcript"):
        raise ApiError("IMP001", "Çağrı, kalite, temsilci veya transkript türünü seç.")
    if kind == "agents" and request.user.role_id != "admin":
        raise ApiError(
            "AUTH003", "Temsilci kadrosunu yalnızca admin yükleyebilir.", 403
        )
    options = upload_options(request, kind)
    uploads = request.FILES.getlist("files")
    if not uploads or len(uploads) > (MAX_FILES if kind == "transcript" else 1):
        raise ApiError(
            "IMP002",
            "CSV için bir dosya; transkriptler için en fazla 50 TXT dosyası seç.",
        )
    files, total = [], 0
    for upload in uploads:
        # The name is display metadata only; uploaded bytes are never executed or written to a path.
        name = upload.name.replace("\\", "/").rsplit("/", 1)[-1]
        extension = ".txt" if kind == "transcript" else ".csv"
        if len(name) > 255 or not name.lower().endswith(extension):
            raise ApiError(
                "IMP002",
                f"{extension} uzantılı, adı en fazla 255 karakter olan dosya seç.",
            )
        if upload.size > MAX_FILE_BYTES:
            raise ApiError("IMP003", "Tek dosya sınırı 5 MB. Dosyayı bölerek yükle.")
        content = upload.read(MAX_FILE_BYTES + 1)
        total += len(content)
        if len(content) > MAX_FILE_BYTES or total > MAX_TOTAL_BYTES:
            raise ApiError(
                "IMP003", "Tek dosya 5 MB, toplam yükleme 10 MB sınırını aşmamalı."
            )
        files.append((name, content))
    try:
        result = import_files(
            request.user, request.session.get("auth_version"), kind, files, options
        )
    except OperationalError:
        raise ApiError(
            "IMP008",
            "Veritabanı bağlantısı kesildi veya meşgul. Bağlantıyı kontrol et; yükleme geçmişine bakıp aynı dosyayla tekrar deneyebilirsin.",
            503,
        ) from None
    return JsonResponse(
        {
            "batches": [
                {**batch_data(batch), "repeated": repeated}
                for batch, repeated in result
            ]
        }
    )


@endpoint(["GET"])
def import_detail(request, batch_id):
    require_upload_access(request)
    batch = (
        ImportBatch.objects.select_related("uploaded_by").filter(pk=batch_id).first()
    )
    if batch is None:
        raise ApiError("IMP006", "Yükleme kaydı bulunamadı.", 404)
    page = positive_integer(request.GET.get("page"), maximum=10000)
    code = request.GET.get("rule", "")
    if code and code not in RULES:
        raise ApiError("IMP006", "Kural numarası geçersiz.")
    issues = (
        ImportIssue.objects.filter(row__batch=batch)
        .select_related("row", "actor")
        .order_by("row__row_number", "pk")
    )
    if code:
        issues = issues.filter(code=code)
    total = issues.count()
    issues = issues[(page - 1) * 50 : page * 50]
    return JsonResponse(
        {
            "batch": batch_data(batch),
            "page": page,
            "totalIssues": total,
            "hasMore": page * 50 < total,
            "issues": [
                {
                    "id": issue.pk,
                    "row": issue.row.row_number,
                    "reference": issue.row.reference_id,
                    "status": issue.row.status,
                    "code": issue.code,
                    "ruleTitle": RULES.get(issue.code, issue.code),
                    "version": issue.rule_version,
                    "field": issue.field_name,
                    "operation": issue.operation,
                    "message": issue.message,
                    "before": issue.before_value,
                    "after": issue.after_value,
                    "evidence": issue.evidence,
                    "effect": issue.report_effect,
                    "createdAt": issue.created_at.isoformat(),
                    "actor": issue.actor.display_name if issue.actor else "Sistem",
                    "resolvedAt": (
                        issue.resolved_at.isoformat() if issue.resolved_at else None
                    ),
                    "resolution": issue.resolution_note,
                }
                for issue in issues
            ],
        }
    )


@endpoint(["GET"])
def import_rules(request):
    require_upload_access(request)
    return JsonResponse(
        {
            "version": RULESET_VERSION,
            "rules": [
                {"code": code, "version": RULE_VERSIONS.get(code, 1), "title": title}
                for code, title in RULES.items()
            ],
        }
    )
