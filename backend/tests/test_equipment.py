"""Equipment stock quantity, catalog seed, and allocation units."""

from __future__ import annotations

from sqlalchemy import func, select

from app.equipment_catalog import EQUIPMENT_CATALOG
from app.extensions import db
from app.models import Equipment
from app.models.site import EQUIPMENT_CONDITIONS, EQUIPMENT_STATUSES
from app.services import site_service
from tests.conftest import login


def test_catalog_values_are_unique_and_valid():
    asset_ids = [item["asset_id"] for item in EQUIPMENT_CATALOG]
    names = [item["name"] for item in EQUIPMENT_CATALOG]
    assert len(asset_ids) == len(set(asset_ids))
    assert len(names) == len(set(names))
    assert len(EQUIPMENT_CATALOG) >= 50
    assert any(item["name"] == "Concrete Mixer" for item in EQUIPMENT_CATALOG)
    for item in EQUIPMENT_CATALOG:
        assert item["condition"] in EQUIPMENT_CONDITIONS
        assert item["status"] in EQUIPMENT_STATUSES
        assert isinstance(item["quantity"], int) and item["quantity"] >= 1


def test_seed_is_idempotent_and_keeps_existing_mixer(app):
    with app.app_context():
        db.session.query(Equipment).delete()
        db.session.commit()
        kept = Equipment(
            name="Concrete Mixer CM-02",
            asset_id="EQ-CM-02",
            equipment_type="Mixer",
            quantity=7,
            condition="Fair",
            status="Available",
        )
        db.session.add(kept)
        db.session.commit()

        site_service.ensure_demo_equipment()
        first = db.session.scalar(select(func.count()).select_from(Equipment))
        mixer = db.session.scalar(select(Equipment).where(Equipment.asset_id == "EQ-CM-02"))
        assert mixer is not None
        assert mixer.quantity == 7
        assert mixer.condition == "Fair"
        assert db.session.scalar(select(Equipment).where(Equipment.asset_id == "EQ-CM-001")) is None

        site_service.ensure_demo_equipment()
        second = db.session.scalar(select(func.count()).select_from(Equipment))
        assert first == second
        assert first >= 50


def test_quantity_must_be_a_positive_whole_number(client):
    login(client, "admin@example.com")
    rejected = client.post(
        "/api/site/equipment",
        json={"name": "Test Pump", "asset_id": "EQ-TEST-QTY", "quantity": 0},
    )
    assert rejected.status_code == 400
    fraction = client.post(
        "/api/site/equipment",
        json={"name": "Test Pump", "asset_id": "EQ-TEST-QTY", "quantity": 1.5},
    )
    assert fraction.status_code == 400
    created = client.post(
        "/api/site/equipment",
        json={
            "name": "Test Pump",
            "asset_id": "EQ-TEST-QTY",
            "equipment_type": "Plumbing and finishing",
            "quantity": 3,
            "condition": "Good",
        },
    )
    assert created.status_code == 201
    body = created.get_json()["equipment"]
    assert body["quantity"] == 3
    assert body["asset_id"] == "EQ-TEST-QTY"


def test_allocate_units_then_return(client, app):
    login(client, "manager@example.com")
    with app.app_context():
        from app.models import User

        engineer = db.session.scalar(select(User).where(User.email == "engineer@example.com"))
        engineer_id = engineer.id
        shovel = db.session.scalar(select(Equipment).where(Equipment.name == "Shovel"))
        excavator = db.session.scalar(select(Equipment).where(Equipment.asset_id == "EQ-EX-001"))
        shovel_id = shovel.id
        excavator_id = excavator.id
        shovel_qty = shovel.quantity

    project = client.post(
        "/api/projects",
        json={
            "name": "Plant Yard",
            "client_name": "NHA",
            "location": "Lusaka",
            "budget": 10000,
            "status": "Active",
            "site_engineer_id": engineer_id,
        },
    )
    assert project.status_code == 201
    project_id = project.get_json()["project"]["id"]

    partial = client.post(
        "/api/site/equipment/allocate",
        json={"project_id": project_id, "equipment_id": shovel_id, "quantity": 4},
    )
    assert partial.status_code == 201
    assert partial.get_json()["allocation"]["quantity"] == 4

    listed = client.get("/api/site/equipment")
    shovel_row = next(item for item in listed.get_json()["items"] if item["id"] == shovel_id)
    assert shovel_row["status"] == "Available"
    assert shovel_row["allocated_quantity"] == 4
    assert shovel_row["available_quantity"] == shovel_qty - 4

    full = client.post(
        "/api/site/equipment/allocate",
        json={"project_id": project_id, "equipment_id": excavator_id, "quantity": 1},
    )
    assert full.status_code == 201
    again = client.post(
        "/api/site/equipment/allocate",
        json={"project_id": project_id, "equipment_id": excavator_id, "quantity": 1},
    )
    assert again.status_code == 400

    listed = client.get("/api/site/equipment")
    excavator_row = next(item for item in listed.get_json()["items"] if item["id"] == excavator_id)
    assert excavator_row["status"] == "Allocated"
    assert excavator_row["available_quantity"] == 0

    returned = client.post(
        f"/api/site/equipment/allocations/{full.get_json()['allocation']['id']}/return",
        json={},
    )
    assert returned.status_code == 200
    listed = client.get("/api/site/equipment")
    excavator_row = next(item for item in listed.get_json()["items"] if item["id"] == excavator_id)
    assert excavator_row["status"] == "Available"
    assert excavator_row["available_quantity"] == 1
