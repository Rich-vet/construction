"""Employees and contractors registry API tests."""

from __future__ import annotations

from sqlalchemy import select

from app.extensions import db
from app.models import User
from tests.conftest import login


def test_admin_employee_crud(client):
    login(client, "admin@example.com")
    created = client.post(
        "/api/admin/employees",
        json={
            "full_name": "Test Employee",
            "employee_code": "EMP-T1",
            "position": "Clerk",
            "status": "Active",
        },
    )
    assert created.status_code == 201
    emp_id = created.get_json()["employee"]["id"]

    listed = client.get("/api/admin/employees?search=Test")
    assert listed.status_code == 200
    assert any(i["id"] == emp_id for i in listed.get_json()["items"])

    updated = client.put(
        f"/api/admin/employees/{emp_id}",
        json={
            "full_name": "Test Employee",
            "employee_code": "EMP-T1",
            "position": "Senior Clerk",
            "status": "On Leave",
        },
    )
    assert updated.status_code == 200
    assert updated.get_json()["employee"]["status"] == "On Leave"


def test_admin_contractor_link_worker(client, app):
    login(client, "admin@example.com")
    with app.app_context():
        worker = db.session.scalar(select(User).where(User.email == "worker@example.com"))
        worker_id = worker.id

    created = client.post(
        "/api/admin/contractors",
        json={
            "name": "Test Crew",
            "specialty": "Painting",
            "status": "Active",
            "user_id": worker_id,
        },
    )
    assert created.status_code == 201
    body = created.get_json()["contractor"]
    assert body["user_id"] == worker_id
    assert body["user_name"]


def test_non_admin_denied_people_registry(client):
    login(client, "manager@example.com")
    assert client.get("/api/admin/employees").status_code == 403
    assert client.get("/api/admin/contractors").status_code == 403


def test_seed_creates_people_counts(client):
    login(client, "admin@example.com")
    dash = client.get("/api/admin/dashboard")
    assert dash.status_code == 200
    cards = dash.get_json()["cards"]
    assert cards["employees"] >= 1
    assert cards["contractors"] >= 1
