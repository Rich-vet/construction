"""User management business logic (Administrator)."""

from __future__ import annotations

import re

from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import Role, User
from app.services.activity_service import log_activity
from app.services.auth_service import validate_email, validate_password_strength
from app.services.notification_service import notify_user
from app.utils.roles import ALL_ROLES, ADMINISTRATOR


class UserServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


PHONE_RE = re.compile(r"^[+0-9()\-\s]{7,40}$")


def list_roles() -> list[dict]:
    roles = db.session.scalars(select(Role).order_by(Role.name)).all()
    return [{"id": r.id, "name": r.name, "description": r.description} for r in roles]


def list_users(
    *,
    search: str | None = None,
    role: str | None = None,
    status: str | None = None,
    page: int = 1,
    per_page: int = 10,
) -> dict:
    page = max(page, 1)
    per_page = min(max(per_page, 1), 50)

    filters = []
    if search:
        term = f"%{search.strip()}%"
        filters.append(or_(User.full_name.ilike(term), User.email.ilike(term)))
    if role:
        filters.append(Role.name == role)
    if status == "active":
        filters.append(User.is_active.is_(True))
    elif status == "inactive":
        filters.append(User.is_active.is_(False))

    count_stmt = select(db.func.count(User.id)).select_from(User).join(Role)
    list_stmt = select(User).options(joinedload(User.role)).join(Role)
    if filters:
        count_stmt = count_stmt.where(*filters)
        list_stmt = list_stmt.where(*filters)

    total = db.session.scalar(count_stmt) or 0
    users = db.session.scalars(
        list_stmt.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    ).unique().all()

    return {
        "items": [u.to_dict() for u in users],
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


def get_user(user_id: int) -> User:
    user = db.session.scalar(
        select(User).options(joinedload(User.role)).where(User.id == user_id)
    )
    if user is None:
        raise UserServiceError("User not found.", status_code=404)
    return user


def _resolve_role(role_name: str) -> Role:
    if role_name not in ALL_ROLES:
        raise UserServiceError("Select a valid role.")
    role = db.session.scalar(select(Role).where(Role.name == role_name))
    if role is None:
        raise UserServiceError("Selected role is not available.")
    return role


def _validate_phone(phone: str | None) -> str | None:
    if phone is None or not str(phone).strip():
        return None
    value = str(phone).strip()
    if not PHONE_RE.match(value):
        raise UserServiceError("Enter a valid phone number.")
    return value


def create_user(actor: User, data: dict) -> User:
    full_name = (data.get("full_name") or "").strip()
    if not full_name:
        raise UserServiceError("Full name is required.")

    email = validate_email(data.get("email", ""))
    existing = db.session.scalar(select(User).where(User.email == email))
    if existing:
        raise UserServiceError("A user with this email already exists.")

    password = validate_password_strength(data.get("password", ""))
    role = _resolve_role((data.get("role") or "").strip())
    phone = _validate_phone(data.get("phone"))
    is_active = bool(data.get("is_active", True))

    user = User(
        full_name=full_name,
        email=email,
        phone=phone,
        role_id=role.id,
        is_active=is_active,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    log_activity(
        actor=actor,
        action="Created user account",
        entity_type="user",
        entity_id=user.id,
        details=f"{user.full_name} ({user.email}) as {role.name}",
    )
    notify_user(
        user_id=actor.id,
        title="New user account created",
        message=f"{user.full_name} was added with role {role.name}.",
        link=f"/users/{user.id}",
    )
    db.session.commit()
    return user


def update_user(actor: User, user_id: int, data: dict) -> User:
    user = get_user(user_id)
    full_name = (data.get("full_name") or "").strip()
    if not full_name:
        raise UserServiceError("Full name is required.")

    email = validate_email(data.get("email", ""))
    duplicate = db.session.scalar(
        select(User).where(User.email == email, User.id != user.id)
    )
    if duplicate:
        raise UserServiceError("A user with this email already exists.")

    role = _resolve_role((data.get("role") or "").strip())
    if user.id == actor.id and role.name != ADMINISTRATOR:
        raise UserServiceError("You cannot remove the Administrator role from your own account.")

    user.full_name = full_name
    user.email = email
    user.phone = _validate_phone(data.get("phone"))
    user.role_id = role.id
    if "is_active" in data:
        new_active = bool(data.get("is_active"))
        if user.id == actor.id and not new_active:
            raise UserServiceError("You cannot deactivate your own account.")
        user.is_active = new_active

    password = data.get("password")
    if password:
        validate_password_strength(password)
        user.set_password(password)

    log_activity(
        actor=actor,
        action="Updated user account",
        entity_type="user",
        entity_id=user.id,
        details=f"{user.full_name} ({user.email})",
    )
    db.session.commit()
    return user


def set_user_active(actor: User, user_id: int, is_active: bool) -> User:
    user = get_user(user_id)
    if user.id == actor.id:
        raise UserServiceError("You cannot change the active status of your own account.")
    user.is_active = is_active
    log_activity(
        actor=actor,
        action="Activated user" if is_active else "Deactivated user",
        entity_type="user",
        entity_id=user.id,
        details=f"{user.full_name} ({user.email})",
    )
    db.session.commit()
    return user
