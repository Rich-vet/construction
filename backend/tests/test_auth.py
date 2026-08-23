"""Authentication and RBAC tests."""

from __future__ import annotations

import pytest

from app import create_app
from app.extensions import db
from app.seed import DEMO_PASSWORD, run_seed
from app.utils.roles import ADMINISTRATOR, CONTRACTOR_WORKER


@pytest.fixture()
def app():
    application = create_app("testing")
    with application.app_context():
        db.create_all()
        run_seed(with_demo_scenario=False)
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def test_login_success(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": DEMO_PASSWORD},
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["user"]["role"] == ADMINISTRATOR
    assert "dashboard" in payload["navigation"]


def test_login_wrong_password(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "WrongPass1"},
    )
    assert response.status_code == 401


def test_me_requires_session(client):
    anonymous = client.get("/api/auth/me")
    assert anonymous.status_code == 200
    assert anonymous.get_json()["authenticated"] is False

    client.post(
        "/api/auth/login",
        json={"email": "worker@example.com", "password": DEMO_PASSWORD},
    )
    me = client.get("/api/auth/me")
    assert me.get_json()["user"]["role"] == CONTRACTOR_WORKER


def test_logout(client):
    client.post(
        "/api/auth/login",
        json={"email": "manager@example.com", "password": DEMO_PASSWORD},
    )
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    me = client.get("/api/auth/me")
    assert me.get_json()["authenticated"] is False


def test_worker_cannot_access_admin_only_endpoint(app, client):
    """RBAC sample: roles_required rejects unauthorized roles."""
    from flask import jsonify

    from app.utils.auth import roles_required
    from app.utils.roles import ADMINISTRATOR

    @app.get("/api/test-admin-only")
    @roles_required(ADMINISTRATOR)
    def admin_only():
        return jsonify({"ok": True})

    client.post(
        "/api/auth/login",
        json={"email": "worker@example.com", "password": DEMO_PASSWORD},
    )
    denied = client.get("/api/test-admin-only")
    assert denied.status_code == 403

    client.post("/api/auth/logout")
    client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": DEMO_PASSWORD},
    )
    allowed = client.get("/api/test-admin-only")
    assert allowed.status_code == 200


def test_forgot_and_reset_password_dev_flow(client):
    forgot = client.post(
        "/api/auth/forgot-password",
        json={"email": "engineer@example.com"},
    )
    assert forgot.status_code == 200
    token = forgot.get_json()["dev_reset_token"]

    reset = client.post(
        "/api/auth/reset-password",
        json={"token": token, "password": "NewPass123!"},
    )
    assert reset.status_code == 200

    old = client.post(
        "/api/auth/login",
        json={"email": "engineer@example.com", "password": DEMO_PASSWORD},
    )
    assert old.status_code == 401

    new = client.post(
        "/api/auth/login",
        json={"email": "engineer@example.com", "password": "NewPass123!"},
    )
    assert new.status_code == 200


def test_inactive_user_cannot_login(client, app):
    from app.models import User
    from sqlalchemy import select

    with app.app_context():
        user = db.session.scalar(select(User).where(User.email == "worker@example.com"))
        user.is_active = False
        db.session.commit()

    response = client.post(
        "/api/auth/login",
        json={"email": "worker@example.com", "password": DEMO_PASSWORD},
    )
    assert response.status_code == 403
