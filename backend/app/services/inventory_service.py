"""Cross-role inventory catalog: materials and equipment master data."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from sqlalchemy import select

from app.extensions import db
from app.models import Equipment, Material, MaintenanceRecord, User
from app.models.site import EQUIPMENT_CONDITIONS, EQUIPMENT_STATUSES
from app.services.activity_service import log_activity
from app.utils.roles import ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER


class InventoryServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _as_qty(value) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError) as exc:
        raise InventoryServiceError("Quantity must be a valid number.") from exc


def assert_catalog_manager(actor: User) -> None:
    if actor.role_name not in {ADMINISTRATOR, PROJECT_MANAGER}:
        raise InventoryServiceError("Only Administrators and Project Managers can manage the catalog.", status_code=403)


def upsert_material(actor: User, data: dict, material_id: int | None = None) -> Material:
    assert_catalog_manager(actor)
    name = (data.get("name") or "").strip()
    if not name:
        raise InventoryServiceError("Material name is required.")

    if material_id is not None:
        material = db.session.get(Material, material_id)
        if material is None:
            raise InventoryServiceError("Material not found.", status_code=404)
    else:
        existing = db.session.scalar(select(Material).where(Material.name == name))
        if existing is not None:
            raise InventoryServiceError("A material with this name already exists.")
        material = Material(name=name, quantity=Decimal("0"))
        db.session.add(material)

    material.name = name
    material.category = (data.get("category") or "").strip() or None
    material.unit = (data.get("unit") or "").strip() or "unit"
    material.storage_location = (data.get("storage_location") or "").strip() or None
    material.description = (data.get("description") or "").strip() or None
    if "minimum_stock" in data or material_id is None:
        material.minimum_stock = _as_qty(data.get("minimum_stock") or 0)
    if material_id is None and data.get("quantity") not in (None, ""):
        material.quantity = _as_qty(data.get("quantity") or 0)
        if material.quantity < 0:
            raise InventoryServiceError("Opening quantity cannot be negative.")

    db.session.flush()
    log_activity(
        actor=actor,
        action=f'{"Updated" if material_id else "Created"} material "{material.name}"',
        entity_type="material",
        entity_id=material.id,
    )
    db.session.commit()
    return material


def upsert_equipment(actor: User, data: dict, equipment_id: int | None = None) -> Equipment:
    assert_catalog_manager(actor)
    name = (data.get("name") or "").strip()
    asset_id = (data.get("asset_id") or "").strip()
    if not name or not asset_id:
        raise InventoryServiceError("Equipment name and asset ID are required.")

    if equipment_id is not None:
        equipment = db.session.get(Equipment, equipment_id)
        if equipment is None:
            raise InventoryServiceError("Equipment not found.", status_code=404)
    else:
        existing = db.session.scalar(select(Equipment).where(Equipment.asset_id == asset_id))
        if existing is not None:
            raise InventoryServiceError("An asset with this ID already exists.")
        equipment = Equipment(name=name, asset_id=asset_id)
        db.session.add(equipment)

    equipment.name = name
    equipment.asset_id = asset_id
    equipment.equipment_type = (data.get("equipment_type") or "").strip() or None
    equipment.description = (data.get("description") or "").strip() or None

    condition = (data.get("condition") or equipment.condition or "Good").strip()
    if condition not in EQUIPMENT_CONDITIONS:
        raise InventoryServiceError("Invalid equipment condition.")
    equipment.condition = condition

    status = (data.get("status") or equipment.status or "Available").strip()
    if status not in EQUIPMENT_STATUSES:
        raise InventoryServiceError("Invalid equipment status.")
    # Do not force Available while actively allocated unless explicitly completing maintenance.
    equipment.status = status

    db.session.flush()
    log_activity(
        actor=actor,
        action=f'{"Updated" if equipment_id else "Created"} equipment "{equipment.name}"',
        entity_type="equipment",
        entity_id=equipment.id,
    )
    db.session.commit()
    return equipment


def list_maintenance(actor: User, equipment_id: int | None = None) -> list[dict]:
    if actor.role_name not in {ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER}:
        raise InventoryServiceError("Not allowed.", status_code=403)
    stmt = (
        select(MaintenanceRecord)
        .order_by(MaintenanceRecord.maintenance_date.desc(), MaintenanceRecord.id.desc())
    )
    if equipment_id is not None:
        stmt = stmt.where(MaintenanceRecord.equipment_id == equipment_id)
    return [r.to_dict() for r in db.session.scalars(stmt)]


def complete_maintenance(actor: User, equipment_id: int) -> Equipment:
    """Mark equipment available after maintenance."""
    if actor.role_name not in {ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER}:
        raise InventoryServiceError("Not allowed.", status_code=403)
    equipment = db.session.get(Equipment, equipment_id)
    if equipment is None:
        raise InventoryServiceError("Equipment not found.", status_code=404)
    equipment.status = "Available"
    log_activity(
        actor=actor,
        action=f'Marked equipment "{equipment.name}" available after maintenance',
        entity_type="equipment",
        entity_id=equipment.id,
    )
    db.session.commit()
    return equipment
