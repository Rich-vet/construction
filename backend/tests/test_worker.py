"""Contractor/Worker API tests."""

from __future__ import annotations

import io
from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app import create_app
from app.extensions import db
from app.models import User
from app.seed import DEMO_PASSWORD, run_seed
from app.services import project_service, site_service


@pytest.fixture()
def app():
    application = create_app("testing")
    with application.app_context():
        db.create_all()
        run_seed(with_demo_scenario=False)
        project_service.ensure_demo_materials()
        site_service.ensure_demo_equipment()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _login(client, email: str):
    return client.post("/api/auth/login", json={"email": email, "password": DEMO_PASSWORD})


def _setup_worker_assignment(client, app):
    _login(client, "manager@example.com")
    with app.app_context():
        engineer = db.session.scalar(select(User).where(User.email == "engineer@example.com"))
        worker = db.session.scalar(select(User).where(User.email == "worker@example.com"))
        engineer_id = engineer.id
        worker_id = worker.id

    created = client.post(
        "/api/projects",
        json={
            "name": "Worker Site",
            "client_name": "Client A",
            "location": "Ndola",
            "budget": 20000,
            "status": "Active",
            "site_engineer_id": engineer_id,
        },
    )
    assert created.status_code == 201
    project_id = created.get_json()["project"]["id"]

    member = client.post(
        f"/api/projects/{project_id}/members",
        json={"user_id": worker_id, "member_role": "Labourer"},
    )
    assert member.status_code == 201

    task = client.post(
        "/api/projects/tasks",
        json={
            "project_id": project_id,
            "name": "Install formwork",
            "assigned_user_id": worker_id,
            "due_date": (date.today() + timedelta(days=3)).isoformat(),
            "priority": "High",
            "status": "Pending",
        },
    )
    assert task.status_code == 201
    task_id = task.get_json()["task"]["id"]
    return project_id, worker_id, task_id


def test_worker_dashboard_and_own_tasks(client, app):
    project_id, _, task_id = _setup_worker_assignment(client, app)
    _login(client, "worker@example.com")

    dash = client.get("/api/worker/dashboard")
    assert dash.status_code == 200
    body = dash.get_json()
    assert body["cards"]["assigned_projects"] >= 1
    assert body["cards"]["my_tasks"] >= 1
    assert any(p["id"] == project_id for p in body["projects"])

    tasks = client.get("/api/worker/tasks")
    assert tasks.status_code == 200
    assert any(t["id"] == task_id for t in tasks.get_json()["items"])

    detail = client.get(f"/api/worker/tasks/{task_id}")
    assert detail.status_code == 200
    assert detail.get_json()["task"]["id"] == task_id


def test_worker_updates_status_comments_and_evidence(client, app):
    _, _, task_id = _setup_worker_assignment(client, app)
    _login(client, "worker@example.com")

    updated = client.put(
        f"/api/worker/tasks/{task_id}/status",
        json={"status": "In Progress"},
    )
    assert updated.status_code == 200
    assert updated.get_json()["task"]["status"] == "In Progress"

    bad = client.put(
        f"/api/worker/tasks/{task_id}/status",
        json={"status": "Cancelled"},
    )
    assert bad.status_code == 400

    comment = client.post(
        f"/api/worker/tasks/{task_id}/comments",
        json={"body": "Started cutting boards"},
    )
    assert comment.status_code == 201

    evidence = client.post(
        f"/api/worker/tasks/{task_id}/evidence",
        data={
            "name": "Photo of work",
            "file": (io.BytesIO(b"fake-photo"), "work.jpg"),
        },
        content_type="multipart/form-data",
    )
    assert evidence.status_code == 201


def test_worker_cannot_access_other_task(client, app):
    _setup_worker_assignment(client, app)
    _login(client, "manager@example.com")
    with app.app_context():
        engineer = db.session.scalar(select(User).where(User.email == "engineer@example.com"))
        engineer_id = engineer.id
    other = client.post(
        "/api/projects/tasks",
        json={
            "project_id": client.get("/api/projects").get_json()["items"][0]["id"],
            "name": "Manager only task",
            "assigned_user_id": engineer_id,
            "status": "Pending",
        },
    )
    assert other.status_code == 201
    other_id = other.get_json()["task"]["id"]

    _login(client, "worker@example.com")
    response = client.get(f"/api/worker/tasks/{other_id}")
    assert response.status_code == 403


def test_worker_views_own_attendance(client, app):
    project_id, worker_id, _ = _setup_worker_assignment(client, app)
    _login(client, "engineer@example.com")
    att = client.post(
        "/api/site/attendance",
        json={
            "project_id": project_id,
            "worker_user_id": worker_id,
            "status": "Present",
            "check_in": "08:00",
        },
    )
    assert att.status_code == 201

    _login(client, "worker@example.com")
    mine = client.get("/api/worker/attendance")
    assert mine.status_code == 200
    assert len(mine.get_json()["items"]) >= 1


def test_engineer_cannot_use_worker_task_update(client, app):
    _, _, task_id = _setup_worker_assignment(client, app)
    _login(client, "engineer@example.com")
    response = client.put(
        f"/api/worker/tasks/{task_id}/status",
        json={"status": "Completed"},
    )
    assert response.status_code == 403
