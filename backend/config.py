"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _database_uri() -> str:
    """Build a SQLAlchemy URI that works for SQLite and MySQL."""
    url = os.getenv("DATABASE_URL", "sqlite:///ccms.db").strip()
    if url.startswith("sqlite:///"):
        relative = url.removeprefix("sqlite:///")
        if not Path(relative).is_absolute():
            db_path = BASE_DIR / "instance" / Path(relative).name
            db_path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{db_path.as_posix()}"
    return url


def _cors_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    """Base configuration shared across environments."""

    SECRET_KEY = os.getenv("SECRET_KEY", "unsafe-dev-key")
    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
    }

    APP_NAME = os.getenv("APP_NAME", "CCMS")
    COMPANY_DISPLAY_NAME = os.getenv("COMPANY_DISPLAY_NAME", "CCMS")
    CURRENCY_CODE = os.getenv("CURRENCY_CODE", "ZMW")
    CURRENCY_SYMBOL = os.getenv("CURRENCY_SYMBOL", "K")

    UPLOAD_FOLDER = BASE_DIR / "uploads"
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH_MB", "16")) * 1024 * 1024
    # Logos stay small; documents use MAX_CONTENT_LENGTH.
    MAX_LOGO_BYTES = int(os.getenv("MAX_LOGO_MB", "2")) * 1024 * 1024

    CORS_ORIGINS = _cors_origins()

    # Cookie sessions for the React SPA.
    WTF_CSRF_ENABLED = True
    WTF_CSRF_CHECK_DEFAULT = False
    WTF_CSRF_HEADERS = ["X-CSRFToken", "X-CSRF-Token"]
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_NAME = "ccms_session"
    PERMANENT_SESSION_LIFETIME = timedelta(hours=12)
    REMEMBER_COOKIE_HTTPONLY = True

    # When true, forgot-password responses include the raw token (dev only).
    DEV_EXPOSE_PASSWORD_RESET_TOKEN = _env_bool("DEV_EXPOSE_PASSWORD_RESET_TOKEN", True)


class DevelopmentConfig(Config):
    """Local development settings."""

    DEBUG = True
    DEV_EXPOSE_PASSWORD_RESET_TOKEN = _env_bool("DEV_EXPOSE_PASSWORD_RESET_TOKEN", True)


class ProductionConfig(Config):
    """Production settings."""

    DEBUG = False
    SESSION_COOKIE_SECURE = True
    DEV_EXPOSE_PASSWORD_RESET_TOKEN = False


class TestingConfig(Config):
    """Automated test settings."""

    TESTING = True
    WTF_CSRF_ENABLED = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    DEV_EXPOSE_PASSWORD_RESET_TOKEN = True


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config(name: str | None = None) -> type[Config]:
    """Resolve a config class from FLASK_ENV or an explicit name."""
    env_name = (name or os.getenv("FLASK_ENV", "development")).lower()
    return config_by_name.get(env_name, DevelopmentConfig)
