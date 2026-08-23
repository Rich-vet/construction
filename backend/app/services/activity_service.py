"""Activity logging helpers."""

from __future__ import annotations

from app.extensions import db
from app.models import ActivityLog, User


def log_activity(
    *,
    actor: User | None,
    action: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
    details: str | None = None,
) -> ActivityLog:
    entry = ActivityLog(
        actor_id=actor.id if actor else None,
        actor_name=actor.full_name if actor else "System",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.session.add(entry)
    return entry
