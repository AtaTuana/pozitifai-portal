"""Invalidate revoked roles and expired sessions on every authenticated request."""

import time
from django.conf import settings
from django.contrib.auth import logout


class PortalSecurityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        now = int(time.time())
        if request.user.is_authenticated:
            session = request.session
            invalid = (
                session.get("auth_version") != request.user.auth_version
                or now - session.get("last_seen", 0) > settings.SESSION_IDLE_SECONDS
                or now - session.get("signed_in", 0) > settings.SESSION_COOKIE_AGE
            )
            if invalid:
                logout(request)
            elif now - session.get("last_seen", 0) >= 60:
                session["last_seen"] = now
        response = self.get_response(request)
        if request.path.startswith("/api/"):
            response["Cache-Control"] = "no-store"
            response["Content-Security-Policy"] = (
                "default-src 'none'; frame-ancestors 'none'"
            )
            response["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response
