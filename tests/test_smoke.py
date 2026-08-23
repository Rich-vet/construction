"""Smoke tests for Phase 1 foundation."""

from __future__ import annotations

from app import create_app


def test_app_creates() -> None:
    app = create_app("testing")
    assert app is not None
    assert app.config["TESTING"] is True


def test_home_page_renders() -> None:
    app = create_app("testing")
    client = app.test_client()
    response = client.get("/")
    assert response.status_code == 200
    assert b"Project Foundation" in response.data
    assert b"CCMS" in response.data


def test_404_page() -> None:
    app = create_app("testing")
    client = app.test_client()
    response = client.get("/this-route-does-not-exist")
    assert response.status_code == 404
    assert b"Page not found" in response.data


def test_database_uri_configured() -> None:
    app = create_app("testing")
    assert "sqlite" in app.config["SQLALCHEMY_DATABASE_URI"]
