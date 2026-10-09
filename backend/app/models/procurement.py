"""Procurement models for internal workflow."""

from __future__ import annotations

from decimal import Decimal

from app.extensions import db
from app.models.base import utcnow


class MaterialRequest(db.Model):
    __tablename__ = "material_requests"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    material_id = db.Column(db.Integer, db.ForeignKey("materials.id"), nullable=False, index=True)
    quantity = db.Column(db.Numeric(14, 2), nullable=False)
    reason = db.Column(db.String(500), nullable=True)
    request_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(40), nullable=False, default="Pending", index=True)
    requested_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    review_notes = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    project = db.relationship("Project")
    material = db.relationship("Material")
    requested_by = db.relationship("User", foreign_keys=[requested_by_id])
    reviewed_by = db.relationship("User", foreign_keys=[reviewed_by_id])

    def to_dict(self, *, can_approve: bool | None = None) -> dict:
        from app.utils.material_units import resolve_unit

        data = {
            "id": self.id,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "material_id": self.material_id,
            "material_name": self.material.name if self.material else None,
            "unit": resolve_unit(self.material.name, self.material.unit) if self.material else None,
            "quantity": float(self.quantity or 0),
            "reason": self.reason,
            "request_date": self.request_date.isoformat() if self.request_date else None,
            "status": self.status,
            "requested_by_id": self.requested_by_id,
            "requested_by_name": self.requested_by.full_name if self.requested_by else None,
            "reviewed_by_name": self.reviewed_by.full_name if self.reviewed_by else None,
            "review_notes": self.review_notes,
        }
        if can_approve is not None:
            data["can_approve"] = can_approve
        return data


class Supplier(db.Model):
    __tablename__ = "suppliers"
    __table_args__ = (db.UniqueConstraint("name", name="uq_suppliers_name"),)

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    contact = db.Column(db.String(120), nullable=True)
    phone = db.Column(db.String(40), nullable=True)
    email = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "contact": self.contact,
            "phone": self.phone,
            "email": self.email,
        }


class Quotation(db.Model):
    __tablename__ = "quotations"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey("suppliers.id"), nullable=False, index=True)
    material_id = db.Column(db.Integer, db.ForeignKey("materials.id"), nullable=False, index=True)
    quantity = db.Column(db.Numeric(14, 2), nullable=False)
    unit_price = db.Column(db.Numeric(14, 2), nullable=False)
    total_price = db.Column(db.Numeric(14, 2), nullable=False)
    delivery_info = db.Column(db.String(255), nullable=True)
    validity_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    is_selected = db.Column(db.Boolean, nullable=False, default=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    project = db.relationship("Project")
    supplier = db.relationship("Supplier")
    material = db.relationship("Material")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "supplier_id": self.supplier_id,
            "supplier_name": self.supplier.name if self.supplier else None,
            "material_id": self.material_id,
            "material_name": self.material.name if self.material else None,
            "quantity": float(self.quantity or 0),
            "unit_price": float(self.unit_price or 0),
            "total_price": float(self.total_price or 0),
            "delivery_info": self.delivery_info,
            "validity_date": self.validity_date.isoformat() if self.validity_date else None,
            "notes": self.notes,
            "is_selected": self.is_selected,
        }


class PurchaseOrder(db.Model):
    __tablename__ = "purchase_orders"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey("suppliers.id"), nullable=False, index=True)
    quotation_id = db.Column(db.Integer, db.ForeignKey("quotations.id"), nullable=True)
    material_id = db.Column(db.Integer, db.ForeignKey("materials.id"), nullable=False)
    quantity = db.Column(db.Numeric(14, 2), nullable=False)
    unit_price = db.Column(db.Numeric(14, 2), nullable=False)
    total_price = db.Column(db.Numeric(14, 2), nullable=False)
    expected_delivery = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(40), nullable=False, default="Draft", index=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    project = db.relationship("Project")
    supplier = db.relationship("Supplier")
    material = db.relationship("Material")
    quotation = db.relationship("Quotation")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "supplier_id": self.supplier_id,
            "supplier_name": self.supplier.name if self.supplier else None,
            "quotation_id": self.quotation_id,
            "material_id": self.material_id,
            "material_name": self.material.name if self.material else None,
            "quantity": float(self.quantity or 0),
            "unit_price": float(self.unit_price or 0),
            "total_price": float(self.total_price or 0),
            "expected_delivery": (
                self.expected_delivery.isoformat() if self.expected_delivery else None
            ),
            "status": self.status,
        }


class Delivery(db.Model):
    __tablename__ = "deliveries"

    id = db.Column(db.Integer, primary_key=True)
    purchase_order_id = db.Column(
        db.Integer, db.ForeignKey("purchase_orders.id"), nullable=False, index=True
    )
    quantity_received = db.Column(db.Numeric(14, 2), nullable=False)
    delivery_date = db.Column(db.Date, nullable=False)
    delivery_note = db.Column(db.String(255), nullable=True)
    condition_notes = db.Column(db.String(500), nullable=True)
    received_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    purchase_order = db.relationship("PurchaseOrder")
    received_by = db.relationship("User")

    def to_dict(self) -> dict:
        po = self.purchase_order
        return {
            "id": self.id,
            "purchase_order_id": self.purchase_order_id,
            "project_name": po.project.name if po and po.project else None,
            "supplier_name": po.supplier.name if po and po.supplier else None,
            "material_name": po.material.name if po and po.material else None,
            "quantity_received": float(self.quantity_received or 0),
            "delivery_date": self.delivery_date.isoformat() if self.delivery_date else None,
            "delivery_note": self.delivery_note,
            "condition_notes": self.condition_notes,
            "received_by_name": self.received_by.full_name if self.received_by else None,
        }
