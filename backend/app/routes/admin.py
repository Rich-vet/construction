"""Administrator API routes."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request, send_file
from werkzeug.exceptions import NotFound

from app.extensions import csrf
from app.models import ActivityLog, Notification
from app.services import company_service, people_service, user_service
from app.services.admin_dashboard_service import admin_dashboard
from app.utils.auth import get_current_user, roles_required
from app.utils.roles import (
    ADMINISTRATOR,
    CONTRACTOR_WORKER,
    PROJECT_MANAGER,
    SITE_ENGINEER,
)
from sqlalchemy import select

from app.extensions import db

admin_bp = Blueprint("admin", __name__)


def _require_csrf() -> None:
    if current_app.config.get("WTF_CSRF_ENABLED", True):
        csrf.protect()


@admin_bp.get("/dashboard")
@roles_required(ADMINISTRATOR)
def dashboard():
    actor = get_current_user()
    assert actor is not None
    return jsonify(admin_dashboard(actor.id))


@admin_bp.get("/settings")
@roles_required(ADMINISTRATOR)
def settings():
    company = company_service.get_or_create_company()
    return jsonify(
        {
            "app_name": current_app.config["APP_NAME"],
            "currency_code": current_app.config["CURRENCY_CODE"],
            "currency_symbol": current_app.config["CURRENCY_SYMBOL"],
            "company": company.to_dict(),
        }
    )


@admin_bp.get("/roles")
@roles_required(ADMINISTRATOR)
def roles():
    return jsonify({"items": user_service.list_roles()})


@admin_bp.get("/users")
@roles_required(ADMINISTRATOR)
def users_list():
    payload = user_service.list_users(
        search=request.args.get("search"),
        role=request.args.get("role"),
        status=request.args.get("status"),
        page=int(request.args.get("page", 1)),
        per_page=int(request.args.get("per_page", 10)),
    )
    return jsonify(payload)


@admin_bp.get("/users/<int:user_id>")
@roles_required(ADMINISTRATOR)
def users_detail(user_id: int):
    try:
        user = user_service.get_user(user_id)
    except user_service.UserServiceError as exc:
        return jsonify({"error": "user_error", "message": exc.message}), exc.status_code
    return jsonify({"user": user.to_dict()})


@admin_bp.post("/users")
@roles_required(ADMINISTRATOR)
@csrf.exempt
def users_create():
    _require_csrf()
    actor = get_current_user()
    assert actor is not None
    try:
        user = user_service.create_user(actor, request.get_json(silent=True) or {})
    except user_service.UserServiceError as exc:
        return jsonify({"error": "user_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "User created successfully.", "user": user.to_dict()}), 201


@admin_bp.put("/users/<int:user_id>")
@roles_required(ADMINISTRATOR)
@csrf.exempt
def users_update(user_id: int):
    _require_csrf()
    actor = get_current_user()
    assert actor is not None
    try:
        user = user_service.update_user(actor, user_id, request.get_json(silent=True) or {})
    except user_service.UserServiceError as exc:
        return jsonify({"error": "user_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "User updated successfully.", "user": user.to_dict()})


@admin_bp.post("/users/<int:user_id>/activate")
@roles_required(ADMINISTRATOR)
@csrf.exempt
def users_activate(user_id: int):
    _require_csrf()
    actor = get_current_user()
    assert actor is not None
    try:
        user = user_service.set_user_active(actor, user_id, True)
    except user_service.UserServiceError as exc:
        return jsonify({"error": "user_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "User activated.", "user": user.to_dict()})


@admin_bp.post("/users/<int:user_id>/deactivate")
@roles_required(ADMINISTRATOR)
@csrf.exempt
def users_deactivate(user_id: int):
    _require_csrf()
    actor = get_current_user()
    assert actor is not None
    try:
        user = user_service.set_user_active(actor, user_id, False)
    except user_service.UserServiceError as exc:
        return jsonify({"error": "user_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "User deactivated.", "user": user.to_dict()})


@admin_bp.get("/company")
@roles_required(ADMINISTRATOR)
def company_get():
    company = company_service.get_or_create_company()
    return jsonify({"company": company.to_dict()})


@admin_bp.put("/company")
@roles_required(ADMINISTRATOR)
@csrf.exempt
def company_update():
    _require_csrf()
    actor = get_current_user()
    assert actor is not None
    # Support JSON or multipart form for logo upload.
    if request.content_type and "multipart/form-data" in request.content_type:
        data = {key: request.form.get(key) for key in request.form.keys()}
        logo = request.files.get("logo")
    else:
        data = request.get_json(silent=True) or {}
        logo = None
    try:
        company = company_service.update_company(actor, data, logo=logo)
    except company_service.CompanyServiceError as exc:
        return jsonify({"error": "company_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "Company profile updated.", "company": company.to_dict()})


@admin_bp.get("/employees")
@roles_required(ADMINISTRATOR)
def employees_list():
    return jsonify(
        people_service.list_employees(
            search=request.args.get("search"),
            status=request.args.get("status"),
            page=int(request.args.get("page", 1)),
            per_page=int(request.args.get("per_page", 20)),
        )
    )


@admin_bp.get("/employees/meta")
@roles_required(ADMINISTRATOR)
def employees_meta():
    return jsonify({"statuses": list(people_service.EMPLOYEE_STATUSES)})


@admin_bp.get("/employees/<int:employee_id>")
@roles_required(ADMINISTRATOR)
def employees_detail(employee_id: int):
    try:
        emp = people_service.get_employee(employee_id)
    except people_service.PeopleServiceError as exc:
        return jsonify({"error": "people_error", "message": exc.message}), exc.status_code
    return jsonify({"employee": emp.to_dict()})


@admin_bp.post("/employees")
@roles_required(ADMINISTRATOR)
@csrf.exempt
def employees_create():
    _require_csrf()
    actor = get_current_user()
    assert actor is not None
    try:
        emp = people_service.create_employee(actor, request.get_json(silent=True) or {})
    except people_service.PeopleServiceError as exc:
        return jsonify({"error": "people_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "Employee created.", "employee": emp.to_dict()}), 201


@admin_bp.put("/employees/<int:employee_id>")
@roles_required(ADMINISTRATOR)
@csrf.exempt
def employees_update(employee_id: int):
    _require_csrf()
    actor = get_current_user()
    assert actor is not None
    try:
        emp = people_service.update_employee(
            actor, employee_id, request.get_json(silent=True) or {}
        )
    except people_service.PeopleServiceError as exc:
        return jsonify({"error": "people_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "Employee updated.", "employee": emp.to_dict()})


@admin_bp.get("/contractors")
@roles_required(ADMINISTRATOR)
def contractors_list():
    return jsonify(
        people_service.list_contractors(
            search=request.args.get("search"),
            status=request.args.get("status"),
            page=int(request.args.get("page", 1)),
            per_page=int(request.args.get("per_page", 20)),
        )
    )


@admin_bp.get("/contractors/meta")
@roles_required(ADMINISTRATOR)
def contractors_meta():
    return jsonify(
        {
            "statuses": list(people_service.CONTRACTOR_STATUSES),
            "linkable_users": people_service.list_linkable_worker_users(),
        }
    )


@admin_bp.get("/contractors/<int:contractor_id>")
@roles_required(ADMINISTRATOR)
def contractors_detail(contractor_id: int):
    try:
        row = people_service.get_contractor(contractor_id)
    except people_service.PeopleServiceError as exc:
        return jsonify({"error": "people_error", "message": exc.message}), exc.status_code
    return jsonify({"contractor": row.to_dict()})


@admin_bp.post("/contractors")
@roles_required(ADMINISTRATOR)
@csrf.exempt
def contractors_create():
    _require_csrf()
    actor = get_current_user()
    assert actor is not None
    try:
        row = people_service.create_contractor(actor, request.get_json(silent=True) or {})
    except people_service.PeopleServiceError as exc:
        return jsonify({"error": "people_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "Contractor created.", "contractor": row.to_dict()}), 201


@admin_bp.put("/contractors/<int:contractor_id>")
@roles_required(ADMINISTRATOR)
@csrf.exempt
def contractors_update(contractor_id: int):
    _require_csrf()
    actor = get_current_user()
    assert actor is not None
    try:
        row = people_service.update_contractor(
            actor, contractor_id, request.get_json(silent=True) or {}
        )
    except people_service.PeopleServiceError as exc:
        return jsonify({"error": "people_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "Contractor updated.", "contractor": row.to_dict()})


@admin_bp.get("/company/logo/<int:company_id>")
@roles_required(ADMINISTRATOR)
def company_logo(company_id: int):
    company = company_service.get_or_create_company()
    if company.id != company_id:
        raise NotFound()
    path = company_service.company_logo_abs_path(company)
    if path is None:
        raise NotFound()
    return send_file(path)


@admin_bp.get("/activity-logs")
@roles_required(ADMINISTRATOR)
def activity_logs():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 20)), 1), 100)
    query = select(ActivityLog).order_by(ActivityLog.created_at.desc())
    total = db.session.scalar(select(db.func.count()).select_from(ActivityLog)) or 0
    items = db.session.scalars(query.offset((page - 1) * per_page).limit(per_page)).all()
    return jsonify(
        {
            "items": [i.to_dict() for i in items],
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page if total else 0,
        }
    )


@admin_bp.get("/notifications")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER, CONTRACTOR_WORKER)
def notifications_list():
    """Legacy path — prefer /api/notifications."""
    from app.services import notification_service

    actor = get_current_user()
    assert actor is not None
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 20)), 1), 100)
    return jsonify(notification_service.list_notifications(actor.id, page=page, per_page=per_page))


@admin_bp.post("/notifications/<int:notification_id>/read")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER, CONTRACTOR_WORKER)
@csrf.exempt
def notifications_read(notification_id: int):
    """Legacy path — prefer /api/notifications."""
    from app.services import notification_service

    _require_csrf()
    actor = get_current_user()
    assert actor is not None
    note = notification_service.mark_notification_read(actor.id, notification_id)
    if note is None:
        return jsonify({"error": "not_found", "message": "Notification not found."}), 404
    return jsonify({"message": "Notification marked as read.", "notification": note.to_dict()})
