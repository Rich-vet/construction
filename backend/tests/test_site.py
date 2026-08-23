"""Site Engineer API tests."""

from __future__ import annotations

import io

import pytest
from sqlalchemy import select

from app import create_app
from app.extensions import db
from app.models import Material, User
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


def _create_assigned_project(client, app):
    _login(client, "manager@example.com")
    with app.app_context():
        engineer = db.session.scalar(select(User).where(User.email == "engineer@example.com"))
        worker = db.session.scalar(select(User).where(User.email == "worker@example.com"))
        engineer_id = engineer.id
        worker_id = worker.id
    created = client.post(
        "/api/projects",
        json={
            "name": "Site Tower",
            "client_name": "NHA",
            "location": "Lusaka",
            "budget": 50000,
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
    return project_id, worker_id


def test_se_sees_only_assigned_projects(client, app):
    project_id, _ = _create_assigned_project(client, app)
    _login(client, "manager@example.com")
    other = client.post(
        "/api/projects",
        json={"name": "Other Job", "client_name": "X", "location": "Ndola", "budget": 1},
    )
    assert other.status_code == 201

    _login(client, "engineer@example.com")
    listed = client.get("/api/projects")
    assert listed.status_code == 200
    ids = {p["id"] for p in listed.get_json()["items"]}
    assert project_id in ids
    assert other.get_json()["project"]["id"] not in ids

    dash = client.get("/api/site/dashboard")
    assert dash.status_code == 200
    assert dash.get_json()["cards"]["assigned_projects"] >= 1


def test_se_records_attendance_and_progress(client, app):
    project_id, worker_id = _create_assigned_project(client, app)
    _login(client, "engineer@example.com")

    attendance = client.post(
        "/api/site/attendance",
        json={
            "project_id": project_id,
            "worker_user_id": worker_id,
            "status": "Present",
            "check_in": "07:30",
        },
    )
    assert attendance.status_code == 201

    progress = client.post(
        "/api/site/progress-updates",
        json={
            "project_id": project_id,
            "work_completed": "Foundation poured",
            "percentage": 25,
        },
    )
    assert progress.status_code == 201

    report = client.post(
        "/api/site/site-reports",
        json={
            "project_id": project_id,
            "workers_present": 1,
            "activities_completed": "Formwork inspection",
        },
    )
    assert report.status_code == 201


def test_se_material_usage_blocks_negative_stock(client, app):
    project_id, _ = _create_assigned_project(client, app)
    with app.app_context():
        material = db.session.scalar(select(Material).limit(1))
        material.quantity = 5
        db.session.commit()
        material_id = material.id

    _login(client, "engineer@example.com")
    over = client.post(
        "/api/site/material-usage",
        json={
            "project_id": project_id,
            "material_id": material_id,
            "quantity": 10,
            "transaction_type": "USAGE",
        },
    )
    assert over.status_code == 400

    ok = client.post(
        "/api/site/material-usage",
        json={
            "project_id": project_id,
            "material_id": material_id,
            "quantity": 2,
            "transaction_type": "USAGE",
        },
    )
    assert ok.status_code == 201


def test_se_can_upload_document(client, app):
    project_id, _ = _create_assigned_project(client, app)
    _login(client, "engineer@example.com")
    data = {
        "project_id": str(project_id),
        "name": "Site photo",
        "document_type": "Photo",
        "file": (io.BytesIO(b"fake-image-bytes"), "site.jpg"),
    }
    response = client.post(
        "/api/site/documents",
        data=data,
        content_type="multipart/form-data",
    )
    assert response.status_code == 201
    doc_id = response.get_json()["document"]["id"]
    download = client.get(f"/api/site/documents/{doc_id}/download")
    assert download.status_code == 200


def test_worker_cannot_access_site_dashboard(client):
    _login(client, "worker@example.com")
    response = client.get("/api/site/dashboard")
    assert response.status_code == 403
