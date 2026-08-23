"""Company profile and operational scaffold models for admin dashboards."""

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


class Project(db.Model):
    """Minimal project record for dashboard counts (full module later)."""

    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    client_name = db.Column(db.String(200), nullable=True)
    location = db.Column(db.String(200), nullable=True)
    status = db.Column(db.String(40), nullable=False, default="Planned", index=True)
    progress = db.Column(db.Float, nullable=False, default=0.0)
    budget = db.Column(db.Numeric(14, 2), nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    expected_completion = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    def to_summary_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "client_name": self.client_name,
            "status": self.status,
            "progress": float(self.progress or 0),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Employee(db.Model):
    """Minimal employee record for dashboard counts."""

    __tablename__ = "employees"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    status = db.Column(db.String(40), nullable=False, default="Active", index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)


class Contractor(db.Model):
    """Minimal contractor record for dashboard counts."""

    __tablename__ = "contractors"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    status = db.Column(db.String(40), nullable=False, default="Active", index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)


class Material(db.Model):
    """Minimal material record for low-stock dashboard counts."""

    __tablename__ = "materials"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    quantity = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    minimum_stock = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    unit = db.Column(db.String(40), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
