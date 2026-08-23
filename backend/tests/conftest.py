"""Shared pytest fixtures for CCMS API tests."""

from __future__ import annotations

import pytest

from app import create_app
from app.extensions import db
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


@pytest.fixture()
def demo_password():
    return DEMO_PASSWORD


def login(client, email: str, password: str = DEMO_PASSWORD):
    """Authenticate the test client as a demo user."""
    return client.post("/api/auth/login", json={"email": email, "password": password})
