"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _database_uri() -> str:
    """Build a SQLAlchemy URI that works for SQLite and MySQL."""
    url = os.getenv("DATABASE_URL", "sqlite:///ccms.db").strip()
    if url.startswith("sqlite:///"):
        # Keep SQLite files under instance/ for a clean project root.
        relative = url.removeprefix("sqlite:///")
        if not Path(relative).is_absolute():
            db_path = BASE_DIR / "instance" / Path(relative).name
            db_path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{db_path.as_posix()}"
    return url


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

    WTF_CSRF_ENABLED = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    REMEMBER_COOKIE_HTTPONLY = True


class DevelopmentConfig(Config):
    """Local development settings."""

    DEBUG = True


class ProductionConfig(Config):
    """Production settings."""

    DEBUG = False
    SESSION_COOKIE_SECURE = True


class TestingConfig(Config):
    """Automated test settings."""

    TESTING = True
    WTF_CSRF_ENABLED = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config(name: str | None = None) -> type[Config]:
    """Resolve a config class from FLASK_ENV or an explicit name."""
    env_name = (name or os.getenv("FLASK_ENV", "development")).lower()
    return config_by_name.get(env_name, DevelopmentConfig)
