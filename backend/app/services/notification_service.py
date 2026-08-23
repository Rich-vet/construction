"""Notification helpers."""

from __future__ import annotations

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
