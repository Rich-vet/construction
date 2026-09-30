"""Site operations models: attendance, inventory movements, equipment, documents."""

from __future__ import annotations

from decimal import Decimal

from app.extensions import db
from app.models.base import utcnow

ATTENDANCE_STATUSES = ("Present", "Absent", "Late", "Leave")
TRANSACTION_TYPES = ("PURCHASE", "USAGE", "ADJUSTMENT", "RETURN")
EQUIPMENT_STATUSES = ("Available", "Allocated", "Under Maintenance", "Unavailable")
EQUIPMENT_CONDITIONS = ("Excellent", "Good", "Fair", "Poor")


class Attendance(db.Model):
    __tablename__ = "attendance_records"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    worker_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    attendance_date = db.Column(db.Date, nullable=False, index=True)
    check_in = db.Column(db.String(10), nullable=True)
    check_out = db.Column(db.String(10), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="Present")
    notes = db.Column(db.String(500), nullable=True)
    recorded_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    project = db.relationship("Project")
    worker = db.relationship("User", foreign_keys=[worker_user_id])
    recorded_by = db.relationship("User", foreign_keys=[recorded_by_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "worker_user_id": self.worker_user_id,
            "worker_name": self.worker.full_name if self.worker else None,
            "attendance_date": self.attendance_date.isoformat() if self.attendance_date else None,
            "check_in": self.check_in,
            "check_out": self.check_out,
            "status": self.status,
            "notes": self.notes,
            "recorded_by_name": self.recorded_by.full_name if self.recorded_by else None,
        }


class MaterialTransaction(db.Model):
    __tablename__ = "material_transactions"

    id = db.Column(db.Integer, primary_key=True)
    material_id = db.Column(db.Integer, db.ForeignKey("materials.id"), nullable=False, index=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True, index=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=True)
    transaction_type = db.Column(db.String(20), nullable=False, index=True)
    quantity = db.Column(db.Numeric(14, 2), nullable=False)
    unit_price = db.Column(db.Numeric(14, 2), nullable=True)
    notes = db.Column(db.String(500), nullable=True)
    transaction_date = db.Column(db.Date, nullable=False)
    recorded_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    material = db.relationship("Material")
    project = db.relationship("Project")
    task = db.relationship("Task")
    recorded_by = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "material_id": self.material_id,
            "material_name": self.material.name if self.material else None,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "task_id": self.task_id,
            "transaction_type": self.transaction_type,
            "quantity": float(self.quantity or 0),
            "unit_price": float(self.unit_price) if self.unit_price is not None else None,
            "notes": self.notes,
            "transaction_date": (
                self.transaction_date.isoformat() if self.transaction_date else None
            ),
            "recorded_by_name": self.recorded_by.full_name if self.recorded_by else None,
        }


class Equipment(db.Model):
    __tablename__ = "equipment"
    __table_args__ = (db.UniqueConstraint("asset_id", name="uq_equipment_asset_id"),)

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    asset_id = db.Column(db.String(80), nullable=False)
    equipment_type = db.Column(db.String(80), nullable=True)
    purchase_date = db.Column(db.Date, nullable=True)
    condition = db.Column(db.String(40), nullable=False, default="Good")
    status = db.Column(db.String(40), nullable=False, default="Available", index=True)
    # Units of this catalog asset. One row stays one asset identity (unique asset_id).
    quantity = db.Column(db.Integer, nullable=False, default=1, server_default="1")
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    allocations = db.relationship("EquipmentAllocation", back_populates="equipment")

    def open_allocations(self) -> list:
        return [row for row in self.allocations if row.returned_at is None]

    def allocated_unit_count(self) -> int:
        return sum(int(row.quantity or 1) for row in self.open_allocations())

    def available_unit_count(self) -> int:
        return max(int(self.quantity or 1) - self.allocated_unit_count(), 0)

    def to_dict(self) -> dict:
        open_rows = self.open_allocations()
        allocated_qty = sum(int(row.quantity or 1) for row in open_rows)
        total_qty = int(self.quantity or 1)
        available_qty = max(total_qty - allocated_qty, 0)
        current = open_rows[0] if open_rows else None
        site_names = []
        for row in open_rows:
            if row.project and row.project.name not in site_names:
                site_names.append(row.project.name)
        return {
            "id": self.id,
            "name": self.name,
            "asset_id": self.asset_id,
            "equipment_type": self.equipment_type,
            "purchase_date": self.purchase_date.isoformat() if self.purchase_date else None,
            "condition": self.condition,
            "status": self.status,
            "quantity": total_qty,
            "allocated_quantity": allocated_qty,
            "available_quantity": available_qty,
            "description": self.description,
            "current_project_id": current.project_id if current else None,
            "current_project_name": ", ".join(site_names) if site_names else None,
            "open_allocations": [
                {
                    "id": row.id,
                    "project_id": row.project_id,
                    "project_name": row.project.name if row.project else None,
                    "quantity": int(row.quantity or 1),
                    "allocated_at": row.allocated_at.isoformat() if row.allocated_at else None,
                    "notes": row.notes,
                }
                for row in open_rows
            ],
        }


class EquipmentAllocation(db.Model):
    __tablename__ = "equipment_allocations"

    id = db.Column(db.Integer, primary_key=True)
    equipment_id = db.Column(db.Integer, db.ForeignKey("equipment.id"), nullable=False, index=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    operator_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    allocated_at = db.Column(db.Date, nullable=False)
    expected_return = db.Column(db.Date, nullable=True)
    returned_at = db.Column(db.Date, nullable=True)
    quantity = db.Column(db.Integer, nullable=False, default=1, server_default="1")
    notes = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    equipment = db.relationship("Equipment", back_populates="allocations")
    project = db.relationship("Project")
    operator = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "equipment_id": self.equipment_id,
            "equipment_name": self.equipment.name if self.equipment else None,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "operator_user_id": self.operator_user_id,
            "operator_name": self.operator.full_name if self.operator else None,
            "quantity": int(self.quantity or 1),
            "allocated_at": self.allocated_at.isoformat() if self.allocated_at else None,
            "expected_return": self.expected_return.isoformat() if self.expected_return else None,
            "returned_at": self.returned_at.isoformat() if self.returned_at else None,
            "notes": self.notes,
        }


class MaintenanceRecord(db.Model):
    __tablename__ = "maintenance_records"

    id = db.Column(db.Integer, primary_key=True)
    equipment_id = db.Column(db.Integer, db.ForeignKey("equipment.id"), nullable=False, index=True)
    maintenance_date = db.Column(db.Date, nullable=False)
    maintenance_type = db.Column(db.String(80), nullable=False)
    description = db.Column(db.Text, nullable=True)
    cost = db.Column(db.Numeric(14, 2), nullable=True, default=Decimal("0"))
    service_provider = db.Column(db.String(120), nullable=True)
    next_maintenance_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    equipment = db.relationship("Equipment")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "equipment_id": self.equipment_id,
            "equipment_name": self.equipment.name if self.equipment else None,
            "maintenance_date": (
                self.maintenance_date.isoformat() if self.maintenance_date else None
            ),
            "maintenance_type": self.maintenance_type,
            "description": self.description,
            "cost": float(self.cost or 0),
            "service_provider": self.service_provider,
            "next_maintenance_date": (
                self.next_maintenance_date.isoformat() if self.next_maintenance_date else None
            ),
        }


class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    document_type = db.Column(db.String(80), nullable=False, default="Other")
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True, index=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=True, index=True)
    description = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=True)
    mime_type = db.Column(db.String(120), nullable=True)
    uploaded_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    project = db.relationship("Project")
    task = db.relationship("Task")
    uploaded_by = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "document_type": self.document_type,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "task_id": self.task_id,
            "task_name": self.task.name if self.task else None,
            "description": self.description,
            "download_url": f"/api/worker/documents/{self.id}/download",
            "original_filename": self.original_filename,
            "mime_type": self.mime_type,
            "uploaded_by_name": self.uploaded_by.full_name if self.uploaded_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
