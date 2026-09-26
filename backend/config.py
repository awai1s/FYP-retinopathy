"""Centralized configuration for local development and Railway deployment."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

_BASE_DIR = Path(__file__).parent
_DOTENV_PATH = _BASE_DIR / ".env"

if _DOTENV_PATH.exists():
    load_dotenv(dotenv_path=_DOTENV_PATH, override=False)
    logger.info("[CONFIG] Loaded local .env file (existing env vars preserved)")
else:
    logger.info("[CONFIG] No local .env file found; using process environment only")


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


MONGODB_URL = os.getenv("MONGODB_URL", "").strip()
DATABASE_NAME = os.getenv("DATABASE_NAME", "dr_healthcare").strip()
SECRET_KEY = os.getenv("SECRET_KEY", "").strip()

SMTP_HOST = os.getenv("SMTP_HOST", os.getenv("BREVO_SMTP_HOST", "smtp.gmail.com")).strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", os.getenv("BREVO_SMTP_PORT", "587")))
SMTP_USER = (os.getenv("SMTP_USER") or os.getenv("EMAIL_ADDRESS") or os.getenv("BREVO_SMTP_LOGIN") or "").strip()
SMTP_PASSWORD = (os.getenv("SMTP_PASSWORD") or os.getenv("EMAIL_PASSWORD") or os.getenv("BREVO_API_KEY") or "").strip()
EMAIL_FROM = (os.getenv("EMAIL_FROM") or os.getenv("EMAIL_ADDRESS") or "dr.retinalhealthcare@gmail.com").strip()

PORT = int(os.getenv("PORT", "8000"))
IS_RAILWAY = bool(os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_PROJECT_ID"))

# Phase 10A security switches.
# Phase 10C provider verification is now implemented and enforced by default.
# Set ENFORCE_PROVIDER_VERIFICATION=false only as a short emergency rollback.
# Connection enforcement remains safe-by-default.
ENFORCE_PROVIDER_VERIFICATION = _env_bool("ENFORCE_PROVIDER_VERIFICATION", True)
REQUIRE_PATIENT_CONNECTION = _env_bool("REQUIRE_PATIENT_CONNECTION", True)
ALLOW_LEGACY_CLINICAL_RELATIONSHIPS = _env_bool("ALLOW_LEGACY_CLINICAL_RELATIONSHIPS", False)
ENABLE_DIAGNOSTIC_ENDPOINTS = _env_bool("ENABLE_DIAGNOSTIC_ENDPOINTS", not IS_RAILWAY)
CORS_ORIGINS = (os.getenv("CORS_ORIGINS") or "").strip()
UPLOAD_MAX_MB = max(1, min(int(os.getenv("UPLOAD_MAX_MB", "5")), 25))
HEALTH_CARD_PUBLIC_BASE_URL = (os.getenv("HEALTH_CARD_PUBLIC_BASE_URL") or os.getenv("PUBLIC_APP_URL") or "").strip().rstrip("/")


def _mask(value: str) -> str:
    if not value:
        return "(not set)"
    if len(value) <= 4:
        return "****"
    return f"{value[:2]}...{value[-2:]}"


def log_config_status() -> None:
    logger.info("[CONFIG] Running on Railway: %s", IS_RAILWAY)
    logger.info("[CONFIG] MONGODB_URL set: %s | value: %s", bool(MONGODB_URL), _mask(MONGODB_URL))
    logger.info("[CONFIG] DATABASE_NAME: %s", DATABASE_NAME or "(not set)")
    logger.info("[CONFIG] SECRET_KEY set: %s | length: %d", bool(SECRET_KEY), len(SECRET_KEY))
    logger.info("[CONFIG] SMTP_HOST set: %s", SMTP_HOST)
    logger.info("[CONFIG] SMTP_USER set: %s", bool(SMTP_USER))
    logger.info("[CONFIG] EMAIL_FROM set: %s", bool(EMAIL_FROM))
    logger.info("[CONFIG] SMTP_PASSWORD set: %s | length: %d", bool(SMTP_PASSWORD), len(SMTP_PASSWORD))
    logger.info("[SECURITY] Require patient connection: %s", REQUIRE_PATIENT_CONNECTION)
    logger.info("[SECURITY] Provider verification enforcement: %s", ENFORCE_PROVIDER_VERIFICATION)
    logger.info("[SECURITY] Legacy clinical relationship bridge: %s", ALLOW_LEGACY_CLINICAL_RELATIONSHIPS)
    logger.info("[SECURITY] Diagnostic endpoints enabled: %s", ENABLE_DIAGNOSTIC_ENDPOINTS)
    logger.info("[SECURITY] Upload max size: %s MB", UPLOAD_MAX_MB)
    logger.info("[PRIVACY] Health Card public frontend URL configured: %s", bool(HEALTH_CARD_PUBLIC_BASE_URL))
    if IS_RAILWAY:
        logger.info("[SECURITY] Production CORS origins configured: %s", bool(CORS_ORIGINS))


def validate_required_config() -> list[str]:
    missing = []
    if not MONGODB_URL:
        missing.append("MONGODB_URL")
    if not DATABASE_NAME:
        missing.append("DATABASE_NAME")
    if not SECRET_KEY:
        missing.append("SECRET_KEY")
    # Production must explicitly name the deployed frontend origin(s).
    if IS_RAILWAY and not CORS_ORIGINS:
        missing.append("CORS_ORIGINS")
    return missing
