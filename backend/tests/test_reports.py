"""Reports API tests."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app import create_app
from app.extensions import db
from app.models import User
from app.seed import DEMO_PASSWORD, run_seed
from app.services import project_service


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


def test_report_meta_and_project_progress(client, app):
    _login(client, "manager@example.com")
    with app.app_context():
        engineer = db.session.scalar(select(User).where(User.email == "engineer@example.com"))
        engineer_id = engineer.id
    client.post(
        "/api/projects",
        json={
            "name": "Report House",
            "client_name": "Client",
            "location": "Lusaka",
            "budget": 50000,
            "status": "Active",
            "site_engineer_id": engineer_id,
            "progress": 40,
        },
    )

    meta = client.get("/api/reports/meta")
    assert meta.status_code == 200
    types = {t["id"] for t in meta.get_json()["types"]}
    assert "project_progress" in types
    assert "budget_vs_actual" in types

    report = client.get("/api/reports/project_progress")
    assert report.status_code == 200
    body = report.get_json()
    assert body["row_count"] >= 1
    assert "Project" in body["columns"]

    pdf = client.get("/api/reports/project_progress/pdf")
    assert pdf.status_code == 200
    assert pdf.mimetype == "application/pdf"
    assert pdf.data[:4] == b"%PDF"


def test_worker_cannot_access_reports(client):
    _login(client, "worker@example.com")
    assert client.get("/api/reports/meta").status_code == 403


def test_inventory_report_available(client):
    _login(client, "admin@example.com")
    response = client.get("/api/reports/inventory")
    assert response.status_code == 200
    assert response.get_json()["report_id"] == "inventory"
