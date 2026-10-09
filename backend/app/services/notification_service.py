"""Notification helpers."""

from __future__ import annotations

from sqlalchemy import select, update
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import MaterialRequest, Notification, Role, User
from app.utils.roles import ADMINISTRATOR

NEW_MATERIAL_REQUEST = "New material request"


def notify_user(
    *,
    user_id: int,
    title: str,
    message: str,
    link: str | None = None,
) -> Notification:
    note = Notification(
        user_id=user_id,
        title=title,
        message=message,
        link=link,
    )
    db.session.add(note)
    return note


def material_request_link(request_id: int) -> str:
    return f"/material-requests?request={request_id}"


def _quantity_text(quantity) -> str:
    value = float(quantity or 0)
    if value.is_integer():
        return str(int(value))
    return f"{value:g}"


def material_request_summary(req: MaterialRequest) -> str:
    from app.utils.material_units import resolve_unit

    material = req.material
    name = material.name if material else "materials"
    unit = resolve_unit(name, material.unit) if material else "units"
    project_name = req.project.name if req.project else "a project"
    return f"{_quantity_text(req.quantity)} {unit} of {name} on {project_name}"


def material_request_recipient_ids(req: MaterialRequest) -> set[int]:
    """Project manager and administrators, excluding the person who submitted it."""
    ids = set(
        db.session.scalars(
            select(User.id)
            .join(User.role)
            .where(Role.name == ADMINISTRATOR, User.is_active.is_(True))
        ).all()
    )
    manager_id = req.project.project_manager_id if req.project else None
    if manager_id:
        ids.add(manager_id)
    if req.requested_by_id:
        ids.discard(req.requested_by_id)
    return ids


def notify_material_request_submitted(req: MaterialRequest, actor: User) -> None:
    summary = material_request_summary(req)
    link = material_request_link(req.id)
    for user_id in material_request_recipient_ids(req):
        notify_user(
            user_id=user_id,
            title=NEW_MATERIAL_REQUEST,
            message=f"{actor.full_name} requested {summary}.",
            link=link,
        )


def notify_material_request_reviewed(req: MaterialRequest, status: str) -> None:
    if not req.requested_by_id or req.requested_by_id == req.reviewed_by_id:
        return
    notify_user(
        user_id=req.requested_by_id,
        title=f"Material request {status.lower()}",
        message=f"Your request for {material_request_summary(req)} was {status.lower()}.",
        link=material_request_link(req.id),
    )


def ensure_material_request_notifications() -> None:
    """Create notifications for pending material requests that have not been announced yet."""
    pending = db.session.scalars(
        select(MaterialRequest)
        .options(
            joinedload(MaterialRequest.project),
            joinedload(MaterialRequest.material),
            joinedload(MaterialRequest.requested_by),
        )
        .where(MaterialRequest.status == "Pending")
    ).unique().all()
    added = False
    for req in pending:
        link = material_request_link(req.id)
        requester = req.requested_by.full_name if req.requested_by else "A team member"
        message = f"{requester} requested {material_request_summary(req)}."
        for user_id in material_request_recipient_ids(req):
            exists = db.session.scalar(
                select(Notification.id).where(
                    Notification.user_id == user_id,
                    Notification.link == link,
                    Notification.title == NEW_MATERIAL_REQUEST,
                )
            )
            if exists:
                continue
            notify_user(
                user_id=user_id,
                title=NEW_MATERIAL_REQUEST,
                message=message,
                link=link,
            )
            added = True
    if added:
        db.session.commit()


def unread_count(user_id: int) -> int:
    ensure_material_request_notifications()
    return (
        db.session.scalar(
            select(db.func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        )
        or 0
    )


def list_notifications(user_id: int, *, page: int = 1, per_page: int = 20) -> dict:
    ensure_material_request_notifications()
    page = max(page, 1)
    per_page = min(max(per_page, 1), 100)
    base = select(Notification).where(Notification.user_id == user_id)
    total = (
        db.session.scalar(
            select(db.func.count()).select_from(Notification).where(Notification.user_id == user_id)
        )
        or 0
    )
    items = db.session.scalars(
        base.order_by(Notification.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()
    return {
        "items": [i.to_dict() for i in items],
        "unread_count": unread_count(user_id),
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


def mark_notification_read(user_id: int, notification_id: int) -> Notification | None:
    note = db.session.get(Notification, notification_id)
    if note is None or note.user_id != user_id:
        return None
    note.is_read = True
    db.session.commit()
    return note


def mark_all_notifications_read(user_id: int) -> int:
    result = db.session.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.session.commit()
    return int(result.rowcount or 0)
