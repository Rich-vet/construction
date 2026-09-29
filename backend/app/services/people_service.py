"""Employee and contractor registry services (Admin)."""

from __future__ import annotations

from sqlalchemy import func, or_, select

from app.extensions import db
from app.models import Contractor, Employee, User
from app.services.activity_service import log_activity
from app.services.auth_service import AuthError, validate_email
from app.utils.roles import CONTRACTOR_WORKER

EMPLOYEE_STATUSES = ("Active", "Inactive", "On Leave")
CONTRACTOR_STATUSES = ("Active", "Inactive")


class PeopleServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _optional_email(raw) -> str | None:
    value = (raw or "").strip()
    if not value:
        return None
    try:
        return validate_email(value)
    except AuthError as exc:
        raise PeopleServiceError(exc.message, status_code=exc.status_code) from exc


def _phone(raw) -> str | None:
    value = (raw or "").strip()
    return value or None


def list_employees(
    *,
    search: str | None = None,
    status: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    page = max(1, page)
    per_page = min(max(1, per_page), 100)
    stmt = select(Employee)
    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Employee.full_name.ilike(q),
                Employee.employee_code.ilike(q),
                Employee.email.ilike(q),
                Employee.position.ilike(q),
            )
        )
    if status:
        stmt = stmt.where(Employee.status == status)
    total = db.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = list(
        db.session.scalars(
            stmt.order_by(Employee.full_name.asc()).offset((page - 1) * per_page).limit(per_page)
        )
    )
    pages = (total + per_page - 1) // per_page if total else 0
    return {
        "items": [e.to_dict() for e in items],
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": pages,
    }


def get_employee(employee_id: int) -> Employee:
    emp = db.session.get(Employee, employee_id)
    if emp is None:
        raise PeopleServiceError("Employee not found.", status_code=404)
    return emp


def create_employee(actor: User, data: dict) -> Employee:
    full_name = (data.get("full_name") or "").strip()
    if not full_name:
        raise PeopleServiceError("Full name is required.")
    code = (data.get("employee_code") or "").strip() or None
    if code:
        existing = db.session.scalar(select(Employee).where(Employee.employee_code == code))
        if existing:
            raise PeopleServiceError("Employee code already exists.")
    status = (data.get("status") or "Active").strip()
    if status not in EMPLOYEE_STATUSES:
        raise PeopleServiceError("Invalid employee status.")
    emp = Employee(
        full_name=full_name,
        employee_code=code,
        phone=_phone(data.get("phone")),
        email=_optional_email(data.get("email")),
        position=(data.get("position") or "").strip() or None,
        skills=(data.get("skills") or "").strip() or None,
        status=status,
    )
    db.session.add(emp)
    db.session.flush()
    log_activity(
        actor=actor,
        action="Created employee",
        entity_type="employee",
        entity_id=emp.id,
        details=emp.full_name,
    )
    db.session.commit()
    return emp


def update_employee(actor: User, employee_id: int, data: dict) -> Employee:
    emp = get_employee(employee_id)
    full_name = (data.get("full_name") or "").strip()
    if not full_name:
        raise PeopleServiceError("Full name is required.")
    code = (data.get("employee_code") or "").strip() or None
    if code and code != emp.employee_code:
        existing = db.session.scalar(select(Employee).where(Employee.employee_code == code))
        if existing:
            raise PeopleServiceError("Employee code already exists.")
    status = (data.get("status") or emp.status).strip()
    if status not in EMPLOYEE_STATUSES:
        raise PeopleServiceError("Invalid employee status.")
    emp.full_name = full_name
    emp.employee_code = code
    emp.phone = _phone(data.get("phone"))
    emp.email = _optional_email(data.get("email"))
    emp.position = (data.get("position") or "").strip() or None
    emp.skills = (data.get("skills") or "").strip() or None
    emp.status = status
    log_activity(
        actor=actor,
        action="Updated employee",
        entity_type="employee",
        entity_id=emp.id,
        details=emp.full_name,
    )
    db.session.commit()
    return emp


def list_contractors(
    *,
    search: str | None = None,
    status: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    page = max(1, page)
    per_page = min(max(1, per_page), 100)
    stmt = select(Contractor)
    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Contractor.name.ilike(q),
                Contractor.specialty.ilike(q),
                Contractor.email.ilike(q),
                Contractor.phone.ilike(q),
            )
        )
    if status:
        stmt = stmt.where(Contractor.status == status)
    total = db.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = list(
        db.session.scalars(
            stmt.order_by(Contractor.name.asc()).offset((page - 1) * per_page).limit(per_page)
        )
    )
    pages = (total + per_page - 1) // per_page if total else 0
    return {
        "items": [c.to_dict() for c in items],
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": pages,
    }


def get_contractor(contractor_id: int) -> Contractor:
    row = db.session.get(Contractor, contractor_id)
    if row is None:
        raise PeopleServiceError("Contractor not found.", status_code=404)
    return row


def _link_user(user_id_raw) -> int | None:
    if user_id_raw in (None, "", 0, "0"):
        return None
    user = db.session.get(User, int(user_id_raw))
    if user is None:
        raise PeopleServiceError("Linked user not found.")
    if user.role_name != CONTRACTOR_WORKER:
        raise PeopleServiceError("Linked user must have the Contractor/Worker role.")
    return user.id


def create_contractor(actor: User, data: dict) -> Contractor:
    name = (data.get("name") or "").strip()
    if not name:
        raise PeopleServiceError("Contractor name is required.")
    status = (data.get("status") or "Active").strip()
    if status not in CONTRACTOR_STATUSES:
        raise PeopleServiceError("Invalid contractor status.")
    row = Contractor(
        name=name,
        specialty=(data.get("specialty") or "").strip() or None,
        phone=_phone(data.get("phone")),
        email=_optional_email(data.get("email")),
        status=status,
        user_id=_link_user(data.get("user_id")),
    )
    db.session.add(row)
    db.session.flush()
    log_activity(
        actor=actor,
        action="Created contractor",
        entity_type="contractor",
        entity_id=row.id,
        details=row.name,
    )
    db.session.commit()
    return row


def update_contractor(actor: User, contractor_id: int, data: dict) -> Contractor:
    row = get_contractor(contractor_id)
    name = (data.get("name") or "").strip()
    if not name:
        raise PeopleServiceError("Contractor name is required.")
    status = (data.get("status") or row.status).strip()
    if status not in CONTRACTOR_STATUSES:
        raise PeopleServiceError("Invalid contractor status.")
    row.name = name
    row.specialty = (data.get("specialty") or "").strip() or None
    row.phone = _phone(data.get("phone"))
    row.email = _optional_email(data.get("email"))
    row.status = status
    if "user_id" in data:
        row.user_id = _link_user(data.get("user_id"))
    log_activity(
        actor=actor,
        action="Updated contractor",
        entity_type="contractor",
        entity_id=row.id,
        details=row.name,
    )
    db.session.commit()
    return row


def list_linkable_worker_users() -> list[dict]:
    users = db.session.scalars(
        select(User).where(User.is_active.is_(True)).order_by(User.full_name.asc())
    )
    return [
        {"id": u.id, "full_name": u.full_name, "email": u.email, "role": u.role_name}
        for u in users
        if u.role_name == CONTRACTOR_WORKER
    ]
