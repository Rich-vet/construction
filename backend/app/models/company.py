"""Company profile and people/resource scaffold models."""

from __future__ import annotations

from app.extensions import db
from app.models.base import utcnow


class CompanyProfile(db.Model):
    """Singleton-style company information managed by Administrators."""

    __tablename__ = "company_profiles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, default="CCMS")
    description = db.Column(db.Text, nullable=True)
    phone = db.Column(db.String(40), nullable=True)
    email = db.Column(db.String(255), nullable=True)
    address = db.Column(db.String(255), nullable=True)
    registration_info = db.Column(db.String(255), nullable=True)
    logo_path = db.Column(db.String(255), nullable=True)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    updated_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    updated_by = db.relationship("User", foreign_keys=[updated_by_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "phone": self.phone,
            "email": self.email,
            "address": self.address,
            "registration_info": self.registration_info,
            "logo_url": f"/api/admin/company/logo/{self.id}" if self.logo_path else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Employee(db.Model):
    """Employee record (expanded in People phase; scaffold retained for counts)."""

    __tablename__ = "employees"
    __table_args__ = (
        db.UniqueConstraint("employee_code", name="uq_employees_employee_code"),
    )

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    employee_code = db.Column(db.String(40), nullable=True)
    phone = db.Column(db.String(40), nullable=True)
    email = db.Column(db.String(255), nullable=True)
    position = db.Column(db.String(120), nullable=True)
    skills = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(40), nullable=False, default="Active", index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "full_name": self.full_name,
            "employee_code": self.employee_code,
            "phone": self.phone,
            "email": self.email,
            "position": self.position,
            "skills": self.skills,
            "status": self.status,
        }


class Contractor(db.Model):
    """Contractor record scaffold."""

    __tablename__ = "contractors"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    specialty = db.Column(db.String(120), nullable=True)
    phone = db.Column(db.String(40), nullable=True)
    email = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(40), nullable=False, default="Active", index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    user = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "specialty": self.specialty,
            "phone": self.phone,
            "email": self.email,
            "status": self.status,
            "user_id": self.user_id,
        }


class Material(db.Model):
    """Inventory material."""

    __tablename__ = "materials"
    __table_args__ = (db.UniqueConstraint("name", name="uq_materials_name"),)

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(80), nullable=True)
    quantity = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    minimum_stock = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    unit = db.Column(db.String(40), nullable=True, default="unit")
    storage_location = db.Column(db.String(120), nullable=True)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    def to_dict(self) -> dict:
        qty = float(self.quantity or 0)
        minimum = float(self.minimum_stock or 0)
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "quantity": qty,
            "minimum_stock": minimum,
            "unit": self.unit,
            "storage_location": self.storage_location,
            "description": self.description,
            "is_low_stock": qty <= minimum,
        }
