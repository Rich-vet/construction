"""MySQL dialect compatibility and optional live DATABASE_URL verification."""

from __future__ import annotations

import os

import pytest
from sqlalchemy.dialects import mysql
from sqlalchemy.schema import CreateTable

from app import create_app
from app.extensions import db


def test_models_compile_for_mysql_dialect():
    """Business models must emit valid MySQL DDL without code changes."""
    application = create_app("testing")
    with application.app_context():
        import app.models  # noqa: F401

        dialect = mysql.dialect()
        tables = list(db.metadata.sorted_tables)
        assert len(tables) >= 20
        for table in tables:
            ddl = str(CreateTable(table).compile(dialect=dialect))
            assert "CREATE TABLE" in ddl.upper()
            # MySQL rejects unnamed batch quirks; ensure table name present.
            assert table.name in ddl


def test_config_accepts_mysql_database_url(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "mysql+pymysql://ccms:secret@127.0.0.1:3306/ccms?charset=utf8mb4",
    )
    # Reload config helper path used by Config class construction.
    from config import _database_uri

    uri = _database_uri()
    assert uri.startswith("mysql+pymysql://")
    assert "ccms" in uri


@pytest.mark.mysql
def test_live_mysql_upgrade_seed_and_auth(monkeypatch):
    """Run only when CCMS_MYSQL_URL is set to a reachable MySQL database."""
    mysql_url = os.getenv("CCMS_MYSQL_URL", "").strip()
    if not mysql_url:
        pytest.skip("Set CCMS_MYSQL_URL to run live MySQL verification.")

    monkeypatch.setenv("DATABASE_URL", mysql_url)
    monkeypatch.setenv("FLASK_ENV", "development")

    # Import after env is set so Config picks up MySQL.
    import importlib

    import config as config_module

    importlib.reload(config_module)

    from flask_migrate import upgrade

    from app.seed import DEMO_PASSWORD, run_seed

    application = create_app("development")
    assert "mysql" in application.config["SQLALCHEMY_DATABASE_URI"]

    with application.app_context():
        upgrade()
        run_seed(with_demo_scenario=True)

    client = application.test_client()
    login = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": DEMO_PASSWORD},
    )
    assert login.status_code == 200
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.get_json()["user"]["role"] == "Administrator"

    projects = client.get("/api/projects")
    assert projects.status_code == 200

    reports = client.get("/api/reports/meta")
    assert reports.status_code == 200
