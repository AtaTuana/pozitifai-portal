"""Session authentication and admin-only user lifecycle."""

import time
from datetime import timedelta
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.validators import validate_email
from django.db import transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.crypto import salted_hmac
from .http import ApiError, audit, body, endpoint, text_value
from .models import LoginAttempt, Team, User
from .permissions import capabilities


def user_data(user):
    return {
        "id": str(user.pk),
        "email": user.email,
        "name": user.display_name,
        "role": user.role_id,
        "roleLabel": user.get_role_display(),
        "teamId": str(user.team_id) if user.team_id else None,
        "active": user.is_active,
        "createdAt": user.date_joined.isoformat(),
        "createdBy": str(user.created_by_id) if user.created_by_id else None,
        "capabilities": capabilities(user),
    }


def throttle(request, identity, *, sensitive=False):
    """Database counters also work across server processes; forwarded IPs are not trusted."""
    now = timezone.now()
    prefix = "sensitive" if sensitive else "login"
    keys = [
        (prefix + ":account:" + salted_hmac(prefix, identity).hexdigest(), 10),
        (
            prefix
            + ":ip:"
            + salted_hmac(
                prefix, request.META.get("REMOTE_ADDR", "unknown")
            ).hexdigest(),
            60,
        ),
    ]
    with transaction.atomic():
        LoginAttempt.objects.filter(expires_at__lt=now).delete()
        for key, limit in keys:
            row, _ = LoginAttempt.objects.select_for_update().get_or_create(
                key=key, defaults={"expires_at": now + timedelta(minutes=15)}
            )
            if row.count >= limit:
                # Raising outside the transaction preserves preceding attempt counters.
                return False
            row.count += 1
            row.save(update_fields=["count"])
    return True


@endpoint(["GET"], authenticated=False)
def session(request):
    return JsonResponse(
        {
            "user": user_data(request.user) if request.user.is_authenticated else None,
            "csrf": get_token(request),
            "needsSetup": not User.objects.exists(),
        }
    )


@endpoint(["POST"], authenticated=False)
def sign_in(request):
    data = body(request)
    email = text_value(data, "email", 254).lower()
    password = data.get("password")
    if not isinstance(password, str) or not 1 <= len(password) <= 128:
        raise ApiError("AUTH002", "E-posta veya şifre hatalı.", 401)
    if not throttle(request, email):
        audit(request, "login.limited")
        raise ApiError(
            "AUTH005", "Çok fazla giriş denemesi. 15 dakika sonra tekrar dene.", 429
        )
    user = authenticate(request, email=email, password=password)
    if not user:
        audit(request, "login.failed", salted_hmac("audit-email", email).hexdigest())
        raise ApiError("AUTH002", "E-posta veya şifre hatalı.", 401)
    with transaction.atomic():
        fresh = User.objects.select_for_update().get(pk=user.pk)
        if (
            not fresh.is_active
            or fresh.password != user.password
            or fresh.auth_version != user.auth_version
        ):
            raise ApiError("AUTH002", "E-posta veya şifre hatalı.", 401)
        login(request, user)
        request.session.update(
            {
                "auth_version": fresh.auth_version,
                "signed_in": int(time.time()),
                "last_seen": int(time.time()),
            }
        )
        audit(request, "login.success", user.pk)
    return JsonResponse({"user": user_data(user), "csrf": get_token(request)})


@endpoint(["POST"])
def sign_out(request):
    audit(request, "logout", request.user.pk)
    logout(request)
    return JsonResponse({"ok": True, "csrf": get_token(request)})


def verify_actor(request, data):
    """A stolen idle browser session alone cannot create users or widen privileges."""
    password = data.get("currentPassword", "")
    if (
        not isinstance(password, str)
        or len(password) > 128
        or not throttle(request, str(request.user.pk), sensitive=True)
    ):
        raise ApiError(
            "AUTH005", "Çok fazla doğrulama denemesi. 15 dakika sonra tekrar dene.", 429
        )
    if not request.user.check_password(password):
        audit(request, "reauth.failed")
        raise ApiError("AUTH006", "Mevcut şifren doğrulanamadı.", 403)


@endpoint(["GET", "POST"], admin=True)
def users(request):
    if request.method == "GET":
        audit(request, "users.view")
        return JsonResponse(
            {
                "users": [
                    user_data(u)
                    for u in User.objects.select_related("role").order_by(
                        "display_name"
                    )
                ]
            }
        )
    return save_user(request)


@endpoint(["PATCH"], admin=True)
def user_detail(request, user_id):
    return save_user(request, user_id)


def save_user(request, user_id=None):
    data = body(request)
    verify_actor(request, data)
    name = text_value(data, "name", 150)
    email = text_value(data, "email", 254).lower()
    validate_email(email)
    role = data.get("role")
    if role not in ("admin", "manager", "captain"):
        raise ApiError("VAL003", "Geçerli bir portal rolü seç.")
    active = data.get("active", True)
    if not isinstance(active, bool):
        raise ApiError("VAL003", "Hesap durumu geçersiz.")
    team = None
    if role == "captain":
        team = (
            Team.objects.filter(pk=data.get("teamId"), is_active=True).first()
            if data.get("teamId")
            else None
        )
        if not team:
            raise ApiError("VAL004", "Takım kaptanı için etkin bir takım seç.")
    elif data.get("teamId"):
        raise ApiError(
            "VAL004", "Admin ve yönetici tüm takımlara erişir; takım ataması yapılamaz."
        )
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=request.user.pk)
        if (
            actor.role_id != "admin"
            or not actor.is_active
            or actor.auth_version != request.session.get("auth_version")
            or actor.password != request.user.password
        ):
            raise ApiError("AUTH001", "Oturumu yeniden doğrula.", 401)
        user = (
            User.objects.select_for_update().filter(pk=user_id).first()
            if user_id
            else User(created_by=actor)
        )
        if user is None:
            raise ApiError("DATA002", "Kullanıcı bulunamadı.", 404)
        if (role == "admin" and (not user_id or user.role_id != "admin")) or (
            user_id and user.role_id == "admin" and (role != "admin" or not active)
        ):
            raise ApiError(
                "AUTH007",
                "Tek admin hesabının rolü veya etkinliği değiştirilemez.",
                403,
            )
        user.display_name, user.email, user.role_id, user.team, user.is_active = (
            name,
            email,
            role,
            team,
            active,
        )
        if not user_id:
            password = data.get("password")
            if not isinstance(password, str) or not 1 <= len(password) <= 128:
                raise ApiError("VAL005", "En fazla 128 karakterli bir şifre belirle.")
            validate_password(password, user)
            user.set_password(password)
        else:
            user.auth_version += 1
        user.save()
        audit(
            request,
            "user.updated" if user_id else "user.created",
            user.pk,
            role=role,
            teamId=str(team.pk) if team else None,
            active=active,
        )
    return JsonResponse({"user": user_data(user)}, status=200 if user_id else 201)


@endpoint(["GET", "PATCH"])
def profile(request):
    if request.method == "GET":
        return JsonResponse({"user": user_data(request.user)})
    data = body(request)
    request.user.display_name = text_value(data, "name", 150)
    request.user.save(update_fields=["display_name", "updated_at"])
    audit(request, "profile.updated", request.user.pk)
    return JsonResponse({"user": user_data(request.user)})


@endpoint(["POST"])
def change_password(request):
    data = body(request)
    verify_actor(request, data)
    password = data.get("password")
    if not isinstance(password, str) or len(password) > 128:
        raise ApiError("VAL005", "Geçerli bir yeni şifre belirle.")
    validate_password(password, request.user)
    if request.user.check_password(password):
        raise ApiError("VAL005", "Yeni şifre mevcut şifreden farklı olmalı.")
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=request.user.pk)
        if (
            user.password != request.user.password
            or not user.is_active
            or user.auth_version != request.session.get("auth_version")
        ):
            raise ApiError("AUTH001", "Oturumu yeniden doğrula.", 401)
        user.set_password(password)
        user.auth_version += 1
        user.save(update_fields=["password", "auth_version", "updated_at"])
        audit(request, "password.changed", user.pk)
    logout(request)
    return JsonResponse({"ok": True, "csrf": get_token(request)})
