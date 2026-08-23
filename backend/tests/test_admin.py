"""Administrator role API tests."""

from __future__ import annotations

import pytest

from app import create_app
from app.extensions import db
from app.seed import DEMO_PASSWORD, run_seed


@pytest.fixture()
def app():
    application = create_app("testing")
    with application.app_context():
        db.create_all()
        run_seed()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _login(client, email: str):
    return client.post("/api/auth/login", json={"email": email, "password": DEMO_PASSWORD})


def test_non_admin_cannot_access_users(client):
    _login(client, "worker@example.com")
    response = client.get("/api/admin/users")
    assert response.status_code == 403


def test_admin_dashboard_counts(client):
    _login(client, "admin@example.com")
    response = client.get("/api/admin/dashboard")
    assert response.status_code == 200
    cards = response.get_json()["cards"]
    assert cards["total_users"] >= 4
    assert cards["active_users"] >= 4
    assert cards["total_projects"] == 0


def test_admin_create_and_list_users(client):
    _login(client, "admin@example.com")
    created = client.post(
        "/api/admin/users",
        json={
            "full_name": "New Manager",
            "email": "new.manager@example.com",
            "phone": "+260111222333",
            "role": "Project Manager",
            "password": "Password123!",
            "is_active": True,
        },
    )
    assert created.status_code == 201

    listed = client.get("/api/admin/users?search=new.manager")
    assert listed.status_code == 200
    assert listed.get_json()["total"] >= 1


def test_admin_cannot_deactivate_self(client):
    _login(client, "admin@example.com")
    me = client.get("/api/auth/me").get_json()["user"]
    response = client.post(f"/api/admin/users/{me['id']}/deactivate")
    assert response.status_code == 400


def test_company_profile_update(client):
    _login(client, "admin@example.com")
    response = client.put(
        "/api/admin/company",
        json={
            "name": "BuildRight Construction",
            "description": "Updated profile",
            "phone": "+260200000000",
            "email": "office@example.com",
            "address": "Ndola",
            "registration_info": "PACRA-100",
        },
    )
    assert response.status_code == 200
    assert response.get_json()["company"]["name"] == "BuildRight Construction"


def test_activity_log_created_on_user_create(client):
    _login(client, "admin@example.com")
    client.post(
        "/api/admin/users",
        json={
            "full_name": "Logged User",
            "email": "logged.user@example.com",
            "role": "Site Engineer",
            "password": "Password123!",
            "is_active": True,
        },
    )
    logs = client.get("/api/admin/activity-logs")
    assert logs.status_code == 200
    assert logs.get_json()["total"] >= 1
