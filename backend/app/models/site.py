"""Site operations models: attendance, inventory movements, equipment, documents."""

from __future__ import annotations

from decimal import Decimal

from app.extensions import db
from app.models.base import utcnow

ATTENDANCE_STATUSES = ("Present", "Absent", "Late", "Leave")
TRANSACTION_TYPES = ("PURCHASE", "USAGE", "ADJUSTMENT", "RETURN")
EQUIPMENT_STATUSES = ("Available", "Allocated", "Under Maintenance", "Unavailable")
EQUIPMENT_CONDITIONS = ("Excellent", "Good", "Fair", "Poor", "Damaged", "Needs inspection")
ALLOCATION_STATES = ("Reserved", "Issued", "Return Pending", "Returned")
EQUIPMENT_REQUEST_STATUSES = ("Pending Approval", "Approved", "Rejected", "Issued")


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
    maintenance_hold = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    allocations = db.relationship("EquipmentAllocation", back_populates="equipment")

    def open_allocations(self) -> list:
        return [row for row in self.allocations if row.returned_at is None]

    def allocated_unit_count(self) -> int:
        return sum(int(row.quantity or 1) for row in self.open_allocations())

    def available_unit_count(self) -> int:
        held = int(self.maintenance_hold or 0)
        return max(int(self.quantity or 1) - self.allocated_unit_count() - held, 0)

    def to_dict(self) -> dict:
        open_rows = self.open_allocations()
        allocated_qty = sum(int(row.quantity or 1) for row in open_rows)
        total_qty = int(self.quantity or 1)
        held = int(self.maintenance_hold or 0)
        available_qty = max(total_qty - allocated_qty - held, 0)
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
            "maintenance_hold": held,
            "reserved_quantity": sum(
                int(row.quantity or 1)
                for row in open_rows
                if (row.allocation_state or "Issued") == "Reserved"
            ),
            "description": self.description,
            "current_project_id": current.project_id if current else None,
            "current_project_name": ", ".join(site_names) if site_names else None,
            "open_allocations": [
                {
                    "id": row.id,
                    "project_id": row.project_id,
                    "project_name": row.project.name if row.project else None,
                    "quantity": int(row.quantity or 1),
                    "allocation_state": row.allocation_state or "Issued",
                    "allocated_at": row.allocated_at.isoformat() if row.allocated_at else None,
                    "expected_return": row.expected_return.isoformat() if row.expected_return else None,
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
    allocation_state = db.Column(db.String(40), nullable=False, default="Issued", server_default="Issued")
    issued_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    received_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    condition_at_issue = db.Column(db.String(40), nullable=True)
    return_condition = db.Column(db.String(40), nullable=True)
    damage_notes = db.Column(db.Text, nullable=True)
    notes = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    equipment = db.relationship("Equipment", back_populates="allocations")
    project = db.relationship("Project")
    operator = db.relationship("User", foreign_keys=[operator_user_id])
    issued_by = db.relationship("User", foreign_keys=[issued_by_id])
    received_by = db.relationship("User", foreign_keys=[received_by_id])

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
            "allocation_state": self.allocation_state or "Issued",
            "condition_at_issue": self.condition_at_issue,
            "return_condition": self.return_condition,
            "damage_notes": self.damage_notes,
            "issued_by_name": self.issued_by.full_name if self.issued_by else None,
            "received_by_name": self.received_by.full_name if self.received_by else None,
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
    priority = db.Column(db.String(20), nullable=True)
    reported_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    completed_at = db.Column(db.Date, nullable=True)
    inspection_result = db.Column(db.String(40), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    equipment = db.relationship("Equipment")
    reported_by = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "equipment_id": self.equipment_id,
            "equipment_name": self.equipment.name if self.equipment else None,
            "priority": self.priority,
            "reported_by_name": self.reported_by.full_name if self.reported_by else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "inspection_result": self.inspection_result,
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


class EquipmentRequest(db.Model):
    """Site request to reserve equipment. Approval does not hand the asset over."""

    __tablename__ = "equipment_requests"

    id = db.Column(db.Integer, primary_key=True)
    equipment_id = db.Column(db.Integer, db.ForeignKey("equipment.id"), nullable=False, index=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    purpose = db.Column(db.Text, nullable=True)
    requested_issue_date = db.Column(db.Date, nullable=True)
    expected_return = db.Column(db.Date, nullable=True)
    comments = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(40), nullable=False, default="Pending Approval", index=True)
    requested_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    review_notes = db.Column(db.Text, nullable=True)
    allocation_id = db.Column(db.Integer, db.ForeignKey("equipment_allocations.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    equipment = db.relationship("Equipment")
    project = db.relationship("Project")
    requested_by = db.relationship("User", foreign_keys=[requested_by_id])
    reviewed_by = db.relationship("User", foreign_keys=[reviewed_by_id])
    allocation = db.relationship("EquipmentAllocation")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "equipment_id": self.equipment_id,
            "equipment_name": self.equipment.name if self.equipment else None,
            "asset_id": self.equipment.asset_id if self.equipment else None,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "quantity": int(self.quantity or 1),
            "purpose": self.purpose,
            "requested_issue_date": (
                self.requested_issue_date.isoformat() if self.requested_issue_date else None
            ),
            "expected_return": self.expected_return.isoformat() if self.expected_return else None,
            "comments": self.comments,
            "status": self.status,
            "requested_by_id": self.requested_by_id,
            "requested_by_name": self.requested_by.full_name if self.requested_by else None,
            "reviewed_by_name": self.reviewed_by.full_name if self.reviewed_by else None,
            "review_notes": self.review_notes,
            "allocation_id": self.allocation_id,
            "allocation_state": self.allocation.allocation_state if self.allocation else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
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
