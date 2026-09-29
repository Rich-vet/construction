"""Cross-role inventory and procurement linkage tests."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app import create_app
from app.extensions import db
from app.models import Material, MaterialRequest, MaterialTransaction, User
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


def test_admin_creates_material_and_purchase_txn(client):
    _login(client, "admin@example.com")
    created = client.post(
        "/api/site/materials",
        json={"name": "Steel Bars 16mm", "unit": "ton", "minimum_stock": 2, "quantity": 0},
    )
    assert created.status_code == 201
    material_id = created.get_json()["material"]["id"]

    purchase = client.post(
        "/api/site/material-usage",
        json={
            "material_id": material_id,
            "quantity": 5,
            "transaction_type": "PURCHASE",
            "notes": "Opening stock",
        },
    )
    assert purchase.status_code == 201


def test_delivery_writes_ledger_and_fulfills_request(client, app):
    _login(client, "manager@example.com")
    with app.app_context():
        engineer = db.session.scalar(select(User).where(User.email == "engineer@example.com"))
        material = db.session.scalar(select(Material).limit(1))
        engineer_id = engineer.id
        material_id = material.id
        before_qty = float(material.quantity or 0)

    project = client.post(
        "/api/projects",
        json={
            "name": "Procure Link",
            "client_name": "Client",
            "location": "Lusaka",
            "budget": 1000,
            "status": "Active",
            "site_engineer_id": engineer_id,
        },
    )
    assert project.status_code == 201
    project_id = project.get_json()["project"]["id"]

    # SoD: Site Engineer creates the request; PM approves.
    _login(client, "engineer@example.com")
    req = client.post(
        "/api/projects/material-requests",
        json={"project_id": project_id, "material_id": material_id, "quantity": 3},
    )
    assert req.status_code == 201
    req_id = req.get_json()["request"]["id"]

    _login(client, "manager@example.com")
    review = client.post(
        f"/api/projects/material-requests/{req_id}/review",
        json={"status": "Approved"},
    )
    assert review.status_code == 200

    quotation = client.post(
        "/api/projects/quotations",
        json={
            "project_id": project_id,
            "material_id": material_id,
            "supplier_name": "BuildMart",
            "quantity": 3,
            "unit_price": 100,
        },
    )
    assert quotation.status_code == 201
    qid = quotation.get_json()["quotation"]["id"]
    client.post(f"/api/projects/quotations/{qid}/select")
    po = client.post("/api/projects/purchase-orders", json={"quotation_id": qid})
    assert po.status_code == 201
    po_id = po.get_json()["purchase_order"]["id"]

    delivery = client.post(
        "/api/projects/deliveries",
        json={"purchase_order_id": po_id, "quantity_received": 3},
    )
    assert delivery.status_code == 201

    listed = client.get("/api/projects/deliveries")
    assert listed.status_code == 200
    assert len(listed.get_json()["items"]) >= 1

    with app.app_context():
        material = db.session.get(Material, material_id)
        assert float(material.quantity or 0) == before_qty + 3
        txn = db.session.scalar(
            select(MaterialTransaction).where(
                MaterialTransaction.material_id == material_id,
                MaterialTransaction.transaction_type == "PURCHASE",
            )
        )
        assert txn is not None
        fulfilled = db.session.get(MaterialRequest, req_id)
        assert fulfilled.status == "Fulfilled"


def test_pm_activity_logs_scoped(client, app):
    _login(client, "manager@example.com")
    created = client.post(
        "/api/projects",
        json={"name": "Activity Proj", "client_name": "C", "location": "K", "budget": 1},
    )
    assert created.status_code == 201
    logs = client.get("/api/projects/activity-logs")
    assert logs.status_code == 200
    assert logs.get_json()["total"] >= 1
