"""Smoke tests for Phase 1 API foundation."""

from __future__ import annotations

from app import create_app


def test_app_creates() -> None:
    app = create_app("testing")
    assert app is not None
    assert app.config["TESTING"] is True


def test_health_endpoint() -> None:
    app = create_app("testing")
    client = app.test_client()
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"


def test_foundation_endpoint() -> None:
    app = create_app("testing")
    client = app.test_client()
    response = client.get("/api/foundation")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["app_name"] == "CCMS"
    assert payload["auth_status"] == "pending"
    assert len(payload["checks"]) == 4


def test_404_json() -> None:
    app = create_app("testing")
    client = app.test_client()
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.get_json()["error"] == "not_found"


def test_database_uri_configured() -> None:
    app = create_app("testing")
    assert "sqlite" in app.config["SQLALCHEMY_DATABASE_URI"]
