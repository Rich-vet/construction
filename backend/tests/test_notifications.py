"""Notification API polish tests."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app import create_app
from app.extensions import db
from app.models import Notification, User
from app.seed import DEMO_PASSWORD, run_seed
from app.services.notification_service import notify_user


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


def _login(client, email: str):
    return client.post("/api/auth/login", json={"email": email, "password": DEMO_PASSWORD})


def test_notifications_list_mark_read_and_mark_all(client, app):
    with app.app_context():
        worker = db.session.scalar(select(User).where(User.email == "worker@example.com"))
        assert worker is not None
        notify_user(user_id=worker.id, title="One", message="First", link="/tasks")
        notify_user(user_id=worker.id, title="Two", message="Second", link="/projects")
        db.session.commit()

    _login(client, "worker@example.com")
    listed = client.get("/api/notifications")
    assert listed.status_code == 200
    body = listed.get_json()
    assert body["unread_count"] >= 2
    note_id = body["items"][0]["id"]

    unread = client.get("/api/notifications/unread-count")
    assert unread.status_code == 200
    assert unread.get_json()["unread_count"] >= 2

    marked = client.post(f"/api/notifications/{note_id}/read")
    assert marked.status_code == 200
    assert marked.get_json()["notification"]["is_read"] is True

    all_read = client.post("/api/notifications/read-all")
    assert all_read.status_code == 200
    assert all_read.get_json()["updated"] >= 1

    after = client.get("/api/notifications/unread-count")
    assert after.get_json()["unread_count"] == 0


def test_legacy_admin_notifications_path_still_works(client, app):
    with app.app_context():
        admin = db.session.scalar(select(User).where(User.email == "admin@example.com"))
        notify_user(user_id=admin.id, title="Admin note", message="Hello")
        db.session.commit()

    _login(client, "admin@example.com")
    response = client.get("/api/admin/notifications")
    assert response.status_code == 200
    assert response.get_json()["total"] >= 1
