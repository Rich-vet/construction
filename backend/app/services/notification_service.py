"""Notification helpers."""

from __future__ import annotations

from sqlalchemy import select, update

from app.extensions import db
from app.models import Notification


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


def unread_count(user_id: int) -> int:
    return (
        db.session.scalar(
            select(db.func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        )
        or 0
    )


def list_notifications(user_id: int, *, page: int = 1, per_page: int = 20) -> dict:
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
