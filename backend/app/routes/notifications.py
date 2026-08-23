"""User notifications API (all authenticated roles)."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.extensions import csrf
from app.services import notification_service
from app.utils.auth import get_current_user, roles_required
from app.utils.roles import (
    ADMINISTRATOR,
    CONTRACTOR_WORKER,
    PROJECT_MANAGER,
    SITE_ENGINEER,
)

notifications_bp = Blueprint("notifications", __name__)


def _require_csrf() -> None:
    if current_app.config.get("WTF_CSRF_ENABLED", True):
        csrf.protect()


def _actor():
    user = get_current_user()
    assert user is not None
    return user


@notifications_bp.get("/unread-count")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER, CONTRACTOR_WORKER)
def unread():
    return jsonify({"unread_count": notification_service.unread_count(_actor().id)})


@notifications_bp.get("")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER, CONTRACTOR_WORKER)
def list_notifications():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 20)), 1), 100)
    return jsonify(notification_service.list_notifications(_actor().id, page=page, per_page=per_page))


@notifications_bp.post("/<int:notification_id>/read")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER, CONTRACTOR_WORKER)
@csrf.exempt
def mark_read(notification_id: int):
    _require_csrf()
    note = notification_service.mark_notification_read(_actor().id, notification_id)
    if note is None:
        return jsonify({"error": "not_found", "message": "Notification not found."}), 404
    return jsonify({"message": "Notification marked as read.", "notification": note.to_dict()})


@notifications_bp.post("/read-all")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER, CONTRACTOR_WORKER)
@csrf.exempt
def mark_all_read():
    _require_csrf()
    count = notification_service.mark_all_notifications_read(_actor().id)
    return jsonify({"message": f"Marked {count} notification(s) as read.", "updated": count})
