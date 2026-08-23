"""Company profile business logic."""

from __future__ import annotations

from pathlib import Path

from flask import current_app
from sqlalchemy import select
from werkzeug.datastructures import FileStorage

from app.extensions import db
from app.models import CompanyProfile, User
from app.services.activity_service import log_activity
from app.services.auth_service import validate_email
from app.utils.uploads import UploadError, save_company_logo


class CompanyServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def get_or_create_company() -> CompanyProfile:
    company = db.session.scalar(select(CompanyProfile).order_by(CompanyProfile.id).limit(1))
    if company is None:
        company = CompanyProfile(
            name=current_app.config.get("COMPANY_DISPLAY_NAME", "CCMS"),
            email=None,
            description="Construction company profile",
        )
        db.session.add(company)
        db.session.commit()
    return company


def update_company(actor: User, data: dict, logo: FileStorage | None = None) -> CompanyProfile:
    company = get_or_create_company()
    name = (data.get("name") or "").strip()
    if not name:
        raise CompanyServiceError("Company name is required.")

    email_raw = (data.get("email") or "").strip()
    email = validate_email(email_raw) if email_raw else None

    company.name = name
    company.description = (data.get("description") or "").strip() or None
    company.phone = (data.get("phone") or "").strip() or None
    company.email = email
    company.address = (data.get("address") or "").strip() or None
    company.registration_info = (data.get("registration_info") or "").strip() or None
    company.updated_by_id = actor.id

    if logo is not None and getattr(logo, "filename", None):
        try:
            relative = save_company_logo(logo)
        except UploadError as exc:
            raise CompanyServiceError(exc.message) from exc
        # Remove previous logo file if present.
        if company.logo_path:
            old = Path(current_app.config["UPLOAD_FOLDER"]) / company.logo_path
            if old.is_file():
                old.unlink(missing_ok=True)
        company.logo_path = relative

    log_activity(
        actor=actor,
        action="Updated company profile",
        entity_type="company",
        entity_id=company.id,
        details=company.name,
    )
    db.session.commit()
    return company


def company_logo_abs_path(company: CompanyProfile) -> Path | None:
    if not company.logo_path:
        return None
    path = Path(current_app.config["UPLOAD_FOLDER"]) / company.logo_path
    return path if path.is_file() else None
