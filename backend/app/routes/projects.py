"""Project Manager / project workspace API routes."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.extensions import csrf
from app.services import project_service
from app.models.project import PROJECT_STATUSES
from app.utils.auth import get_current_user, roles_required
from app.utils.project_access import ProjectAccessError
from app.utils.roles import ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER

projects_bp = Blueprint("projects", __name__)


def _require_csrf() -> None:
    if current_app.config.get("WTF_CSRF_ENABLED", True):
        csrf.protect()


def _actor():
    user = get_current_user()
    assert user is not None
    return user


def _handle(exc: Exception):
    if isinstance(exc, (project_service.ProjectServiceError, ProjectAccessError)):
        return jsonify({"error": "project_error", "message": exc.message}), exc.status_code
    raise exc


@projects_bp.get("/dashboard")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
def dashboard():
    return jsonify(project_service.pm_dashboard(_actor()))


@projects_bp.get("/meta")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER)
def meta():
    project_service.ensure_demo_materials()
    return jsonify(
        {
            "assignable_users": project_service.list_assignable_users(),
            "materials": project_service.list_materials(),
            "statuses": list(PROJECT_STATUSES),
            "budget_categories": ["Materials", "Labour", "Equipment", "Transport", "Other"],
            "task_priorities": ["Low", "Medium", "High", "Urgent"],
            "task_statuses": ["Pending", "In Progress", "Completed", "Cancelled"],
        }
    )


@projects_bp.get("")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER)
def list_projects():
    items = project_service.list_projects(
        _actor(),
        search=request.args.get("search"),
        status=request.args.get("status"),
    )
    return jsonify({"items": items})


@projects_bp.post("")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def create_project():
    _require_csrf()
    try:
        project = project_service.create_project(_actor(), request.get_json(silent=True) or {})
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Project created successfully.", "project": project.to_dict()}), 201


@projects_bp.get("/<int:project_id>")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER)
def project_detail(project_id: int):
    try:
        workspace = project_service.project_workspace(_actor(), project_id)
    except Exception as exc:
        return _handle(exc)
    return jsonify(workspace)


@projects_bp.put("/<int:project_id>")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def update_project(project_id: int):
    _require_csrf()
    try:
        project = project_service.update_project(
            _actor(), project_id, request.get_json(silent=True) or {}
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Project updated successfully.", "project": project.to_dict()})


@projects_bp.post("/tasks")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def create_task():
    _require_csrf()
    try:
        task = project_service.create_task(_actor(), request.get_json(silent=True) or {})
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Task created successfully.", "task": task.to_dict()}), 201


@projects_bp.put("/tasks/<int:task_id>")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def update_task(task_id: int):
    _require_csrf()
    try:
        task = project_service.update_task(_actor(), task_id, request.get_json(silent=True) or {})
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Task updated successfully.", "task": task.to_dict()})


@projects_bp.post("/tasks/<int:task_id>/comments")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER)
@csrf.exempt
def task_comment(task_id: int):
    _require_csrf()
    payload = request.get_json(silent=True) or {}
    try:
        comment = project_service.add_task_comment(_actor(), task_id, payload.get("body", ""))
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Comment added.", "comment": comment.to_dict()}), 201


@projects_bp.post("/milestones")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def create_milestone():
    _require_csrf()
    try:
        milestone = project_service.create_milestone(_actor(), request.get_json(silent=True) or {})
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Milestone created.", "milestone": milestone.to_dict()}), 201


@projects_bp.post("/milestones/<int:milestone_id>/complete")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def complete_milestone(milestone_id: int):
    _require_csrf()
    try:
        milestone = project_service.complete_milestone(_actor(), milestone_id)
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Milestone marked completed.", "milestone": milestone.to_dict()})


@projects_bp.post("/<int:project_id>/members")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def add_member(project_id: int):
    _require_csrf()
    payload = request.get_json(silent=True) or {}
    try:
        member = project_service.add_project_member(
            _actor(),
            project_id,
            int(payload.get("user_id")),
            payload.get("member_role") or "Team Member",
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Team member added.", "member": member.to_dict()}), 201


@projects_bp.delete("/members/<int:member_id>")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def remove_member(member_id: int):
    _require_csrf()
    try:
        project_service.remove_project_member(_actor(), member_id)
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Team member removed."})


@projects_bp.put("/<int:project_id>/budgets/<category>")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def upsert_budget(project_id: int, category: str):
    _require_csrf()
    payload = request.get_json(silent=True) or {}
    try:
        line = project_service.upsert_budget_line(
            _actor(), project_id, category, payload.get("amount", 0)
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Budget updated.", "budget_line": line.to_dict()})


@projects_bp.post("/expenses")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def create_expense():
    _require_csrf()
    try:
        expense = project_service.create_expense(_actor(), request.get_json(silent=True) or {})
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Expense recorded.", "expense": expense.to_dict()}), 201


@projects_bp.get("/material-requests")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER)
def list_material_requests():
    actor = _actor()
    projects = project_service.list_projects(actor)
    ids = {p["id"] for p in projects}
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    from app.extensions import db
    from app.models import MaterialRequest

    items = []
    if ids:
        items = [
            r.to_dict()
            for r in db.session.scalars(
                select(MaterialRequest)
                .options(
                    joinedload(MaterialRequest.material),
                    joinedload(MaterialRequest.project),
                    joinedload(MaterialRequest.requested_by),
                )
                .where(MaterialRequest.project_id.in_(ids))
                .order_by(MaterialRequest.created_at.desc())
            ).unique()
        ]
    return jsonify({"items": items})


@projects_bp.post("/material-requests")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER)
@csrf.exempt
def create_material_request():
    _require_csrf()
    try:
        req = project_service.create_material_request(
            _actor(), request.get_json(silent=True) or {}
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Material request submitted.", "request": req.to_dict()}), 201


@projects_bp.post("/material-requests/<int:request_id>/review")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def review_request(request_id: int):
    _require_csrf()
    payload = request.get_json(silent=True) or {}
    try:
        req = project_service.review_material_request(
            _actor(),
            request_id,
            payload.get("status", ""),
            payload.get("notes"),
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": f"Request {req.status.lower()}.", "request": req.to_dict()})


@projects_bp.post("/quotations")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def create_quotation():
    _require_csrf()
    try:
        quotation = project_service.create_quotation(
            _actor(), request.get_json(silent=True) or {}
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Quotation recorded.", "quotation": quotation.to_dict()}), 201


@projects_bp.post("/quotations/<int:quotation_id>/select")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def select_quotation(quotation_id: int):
    _require_csrf()
    try:
        quotation = project_service.select_quotation(_actor(), quotation_id)
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Preferred quotation selected.", "quotation": quotation.to_dict()})


@projects_bp.post("/purchase-orders")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def create_po():
    _require_csrf()
    payload = request.get_json(silent=True) or {}
    try:
        po = project_service.create_purchase_order_from_quotation(
            _actor(),
            int(payload.get("quotation_id")),
            payload.get("expected_delivery"),
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Purchase order created.", "purchase_order": po.to_dict()}), 201


@projects_bp.post("/deliveries")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def create_delivery():
    _require_csrf()
    try:
        delivery = project_service.record_delivery(_actor(), request.get_json(silent=True) or {})
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Delivery recorded and inventory updated.", "delivery": delivery.to_dict()}), 201


@projects_bp.get("/reports/summary")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
def reports_summary():
    dash = project_service.pm_dashboard(_actor())
    return jsonify(
        {
            "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            "cards": dash["cards"],
            "status_breakdown": dash["status_breakdown"],
            "budget_alerts": dash["budget_alerts"],
            "projects": dash["projects"],
        }
    )


@projects_bp.get("/quotations")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
def list_quotations():
    return jsonify({"items": project_service.list_quotations(_actor())})


@projects_bp.get("/purchase-orders")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
def list_purchase_orders():
    return jsonify({"items": project_service.list_purchase_orders(_actor())})


@projects_bp.get("/deliveries")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
def list_deliveries():
    return jsonify({"items": project_service.list_deliveries(_actor())})


@projects_bp.get("/activity-logs")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER)
def project_activity_logs():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 20)), 1), 100)
    return jsonify(project_service.list_accessible_activity(_actor(), page=page, per_page=per_page))
