"""Project Manager API tests."""

from __future__ import annotations

import pytest

from app import create_app
from app.extensions import db
from app.seed import DEMO_PASSWORD, run_seed
from app.services import project_service
from app.models import User
from sqlalchemy import select


@pytest.fixture()
def app():
    application = create_app("testing")
    with application.app_context():
        db.create_all()
        run_seed(with_demo_scenario=False)
        project_service.ensure_demo_materials()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _login(client, email: str):
    return client.post("/api/auth/login", json={"email": email, "password": DEMO_PASSWORD})


def test_worker_cannot_create_project(client):
    _login(client, "worker@example.com")
    response = client.post(
        "/api/projects",
        json={"name": "X", "client_name": "Y", "location": "Z"},
    )
    assert response.status_code == 403


def test_pm_creates_and_lists_own_project(client, app):
    _login(client, "manager@example.com")
    with app.app_context():
        engineer = db.session.scalar(select(User).where(User.email == "engineer@example.com"))
        engineer_id = engineer.id
    created = client.post(
        "/api/projects",
        json={
            "name": "Bridge Works",
            "client_name": "City Council",
            "location": "Kitwe",
            "budget": 100000,
            "status": "Active",
            "site_engineer_id": engineer_id,
            "start_date": "2026-02-01",
            "expected_completion": "2026-11-01",
        },
    )
    assert created.status_code == 201
    project_id = created.get_json()["project"]["id"]

    listed = client.get("/api/projects")
    assert listed.status_code == 200
    assert any(p["id"] == project_id for p in listed.get_json()["items"])

    workspace = client.get(f"/api/projects/{project_id}")
    assert workspace.status_code == 200
    assert workspace.get_json()["can_manage"] is True


def test_pm_cannot_access_other_manager_project(client, app):
    # Create project as manager
    _login(client, "manager@example.com")
    created = client.post(
        "/api/projects",
        json={"name": "Mine Road", "client_name": "ZCCM", "location": "Solwezi", "budget": 10},
    )
    project_id = created.get_json()["project"]["id"]
    client.post("/api/auth/logout")

    # Admin can view
    _login(client, "admin@example.com")
    assert client.get(f"/api/projects/{project_id}").status_code == 200


def test_task_and_expense_and_request_flow(client, app):
    _login(client, "manager@example.com")
    project = client.post(
        "/api/projects",
        json={"name": "Clinic Block", "client_name": "MoH", "location": "Kasama", "budget": 200000},
    ).get_json()["project"]

    meta = client.get("/api/projects/meta").get_json()
    material_id = meta["materials"][0]["id"]
    worker_id = next(u["id"] for u in meta["assignable_users"] if u["role"] == "Contractor/Worker")

    task = client.post(
        "/api/projects/tasks",
        json={
            "project_id": project["id"],
            "name": "Formwork",
            "priority": "High",
            "assigned_user_id": worker_id,
            "due_date": "2026-09-01",
        },
    )
    assert task.status_code == 201

    expense = client.post(
        "/api/projects/expenses",
        json={
            "project_id": project["id"],
            "category": "Materials",
            "description": "Cement purchase",
            "amount": 1500,
            "expense_date": "2026-08-01",
        },
    )
    assert expense.status_code == 201

    req = client.post(
        "/api/projects/material-requests",
        json={
            "project_id": project["id"],
            "material_id": material_id,
            "quantity": 10,
            "reason": "Pouring",
        },
    )
    assert req.status_code == 201
    request_id = req.get_json()["request"]["id"]

    reviewed = client.post(
        f"/api/projects/material-requests/{request_id}/review",
        json={"status": "Approved"},
    )
    assert reviewed.status_code == 200
    assert reviewed.get_json()["request"]["status"] == "Approved"

    dash = client.get("/api/projects/dashboard")
    assert dash.status_code == 200
    assert dash.get_json()["cards"]["my_projects"] >= 1
