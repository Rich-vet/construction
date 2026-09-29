"""Phase G role-matrix and upload hardening tests."""

from __future__ import annotations

import io

from sqlalchemy import select

from app.extensions import db
from app.models import User
from app.utils.uploads import UploadError, save_company_logo, save_project_document
from tests.conftest import login


def test_admin_denied_worker_and_se_dashboards(client):
    login(client, "admin@example.com")
    assert client.get("/api/worker/dashboard").status_code == 403
    assert client.get("/api/worker/tasks").status_code == 403
    assert client.get("/api/site/dashboard").status_code == 403


def test_worker_denied_admin_and_pm_surfaces(client):
    login(client, "worker@example.com")
    assert client.get("/api/admin/dashboard").status_code == 403
    assert client.get("/api/projects/dashboard").status_code == 403
    assert client.get("/api/reports/meta").status_code == 403
    assert client.post("/api/projects", json={"name": "Nope"}).status_code == 403


def test_engineer_denied_user_admin_and_worker_board(client):
    login(client, "engineer@example.com")
    assert client.get("/api/admin/users").status_code == 403
    assert client.get("/api/worker/dashboard").status_code == 403
    assert client.get("/api/reports/meta").status_code == 403


def test_admin_cannot_record_site_attendance(client, app):
    login(client, "manager@example.com")
    with app.app_context():
        engineer = db.session.scalar(select(User).where(User.email == "engineer@example.com"))
        worker = db.session.scalar(select(User).where(User.email == "worker@example.com"))
        engineer_id = engineer.id
        worker_id = worker.id

    created = client.post(
        "/api/projects",
        json={
            "name": "Admin Site Gate",
            "client_name": "Client",
            "location": "Kitwe",
            "budget": 5000,
            "status": "Active",
            "site_engineer_id": engineer_id,
        },
    )
    assert created.status_code == 201
    project_id = created.get_json()["project"]["id"]
    client.post(
        f"/api/projects/{project_id}/members",
        json={"user_id": worker_id, "member_role": "Labourer"},
    )

    login(client, "admin@example.com")
    denied = client.post(
        "/api/site/attendance",
        json={"project_id": project_id, "worker_user_id": worker_id, "status": "Present"},
    )
    assert denied.status_code == 403

    login(client, "engineer@example.com")
    ok = client.post(
        "/api/site/attendance",
        json={"project_id": project_id, "worker_user_id": worker_id, "status": "Present"},
    )
    assert ok.status_code == 201


def test_role_nav_keys(client):
    login(client, "admin@example.com")
    admin_nav = client.get("/api/auth/me").get_json()["navigation"]
    assert "users" in admin_nav
    assert "settings" in admin_nav
    assert "tasks" not in admin_nav

    login(client, "worker@example.com")
    worker_nav = client.get("/api/auth/me").get_json()["navigation"]
    assert "tasks" in worker_nav
    assert "users" not in worker_nav
    assert "reports" not in worker_nav


def test_upload_rejects_path_traversal_and_bad_magic(app):
    with app.app_context():
        bad_name = io.BytesIO(b"not-an-image")
        bad_name.name = "../../evil.png"
        storage = type("F", (), {})()
        from werkzeug.datastructures import FileStorage

        evil = FileStorage(stream=io.BytesIO(b"not-an-image"), filename="../../evil.png", content_type="image/png")
        try:
            save_company_logo(evil)
            assert False, "expected UploadError"
        except UploadError as exc:
            assert "path" in exc.message.lower() or "match" in exc.message.lower() or "contents" in exc.message.lower()

        mismatched = FileStorage(
            stream=io.BytesIO(b"<html>hi</html>"),
            filename="photo.png",
            content_type="text/html",
        )
        try:
            save_project_document(mismatched)
            assert False, "expected UploadError"
        except UploadError:
            pass

        png = (
            b"\x89PNG\r\n\x1a\n"
            b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
            b"\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        good = FileStorage(stream=io.BytesIO(png), filename="ok.png", content_type="image/png")
        path, original, mime = save_project_document(good)
        assert path.startswith("documents/")
        assert original == "ok.png"
        assert mime == "image/png"
