"""Local-first settings; private state never lives in the frontend directory."""

import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("PORTAL_DATA_DIR", BASE_DIR / ".local")).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
secret_file = DATA_DIR / "secret.key"
if not secret_file.exists():
    try:
        with secret_file.open("x", encoding="utf-8") as handle:
            handle.write(secrets.token_urlsafe(64))
    except FileExistsError:
        pass
SECRET_KEY = (
    os.environ.get("DJANGO_SECRET_KEY")
    or secret_file.read_text(encoding="utf-8").strip()
)
DEBUG = False
ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "[::1]",
    *filter(None, os.environ.get("PORTAL_ALLOWED_HOSTS", "").split(",")),
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "portal",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "portal.middleware.PortalSecurityMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
AUTH_USER_MODEL = "portal.User"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": DATA_DIR / "portal.sqlite3",
        "OPTIONS": {"timeout": 20, "transaction_mode": "IMMEDIATE"},
    }
}
if os.environ.get("PGDATABASE"):
    DATABASES["default"] = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["PGDATABASE"],
        "USER": os.environ.get("PGUSER", ""),
        "PASSWORD": os.environ.get("PGPASSWORD", ""),
        "HOST": os.environ.get("PGHOST", "localhost"),
        "PORT": os.environ.get("PGPORT", "5432"),
    }
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"
# Business timestamps are Turkish wall time in both database engines.
DATABASES["default"]["TIME_ZONE"] = "Europe/Istanbul"
LANGUAGE_CODE = "tr"
TIME_ZONE = "Europe/Istanbul"
USE_TZ = True
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
        "OPTIONS": {"user_attributes": ["email", "display_name"]},
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
SESSION_COOKIE_NAME = "pozitifai_session"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
SESSION_COOKIE_SECURE = os.environ.get("PORTAL_HTTPS") == "1"
SESSION_COOKIE_AGE = 8 * 60 * 60
SESSION_SAVE_EVERY_REQUEST = False
SESSION_IDLE_SECONDS = 30 * 60
CSRF_COOKIE_NAME = "pozitifai_csrf"
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Strict"
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
CSRF_FAILURE_VIEW = "portal.http.csrf_failure"
CSRF_TRUSTED_ORIGINS = list(
    filter(None, os.environ.get("PORTAL_TRUSTED_ORIGINS", "").split(","))
)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
DATA_UPLOAD_MAX_MEMORY_SIZE = 256 * 1024
APPEND_SLASH = False
