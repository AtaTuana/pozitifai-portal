"""Consistent JSON errors; no stack traces or database details reach the browser."""

import json
from functools import wraps
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import JsonResponse
from .models import AuditEvent


class ApiError(Exception):
    def __init__(self, code, message, status=400):
        self.code, self.message, self.status = code, message, status


def error(code, message, status):
    return JsonResponse({"error": {"code": code, "message": message}}, status=status)


def body(request):
    if request.content_type != "application/json":
        raise ApiError("REQ001", "İstek JSON biçiminde olmalı.", 415)
    try:
        value = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        raise ApiError("REQ002", "İstek içeriği okunamadı.")
    if not isinstance(value, dict):
        raise ApiError("REQ002", "Geçerli bir kayıt gönderin.")
    return value


def text_value(data, key, maximum=100, required=True):
    value = data.get(key, "")
    if (
        not isinstance(value, str)
        or len(value) > maximum
        or (required and not value.strip())
    ):
        raise ApiError("VAL001", f"{key} alanı geçersiz veya boş.")
    return value.strip()


def audit(request, action, target="", **details):
    """Only explicit metadata is logged; request bodies, passwords and cookies are excluded."""
    AuditEvent.objects.create(
        actor=request.user if request.user.is_authenticated else None,
        action=action,
        target=str(target),
        details=details,
    )


def endpoint(methods, *, authenticated=True, admin=False):
    def decorate(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if request.method not in methods:
                return error("REQ003", "Bu HTTP yöntemi desteklenmiyor.", 405)
            if authenticated and not request.user.is_authenticated:
                return error("AUTH001", "Oturumun sona erdi. Yeniden giriş yap.", 401)
            if admin and request.user.role != "admin":
                audit(request, "access.denied", request.path)
                return error("AUTH003", "Bu işlem için admin yetkisi gerekli.", 403)
            try:
                return view(request, *args, **kwargs)
            except ApiError as exc:
                return error(exc.code, exc.message, exc.status)
            except ValidationError as exc:
                return error("VAL002", " ".join(exc.messages), 400)
            except IntegrityError:
                return error(
                    "DATA001",
                    "Kayıt kodu veya e-posta zaten kullanılıyor; kayıt ilişkilerini kontrol et.",
                    409,
                )

        return wrapped

    return decorate


def csrf_failure(request, reason=""):
    return error("AUTH004", "İstek doğrulanamadı. Sayfayı yenileyip tekrar dene.", 403)
