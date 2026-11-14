"""Contractor/Worker API routes."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request, send_file

from app.extensions import csrf
from app.services import worker_service
from app.utils.auth import get_current_user, roles_required
from app.utils.project_access import ProjectAccessError
from app.utils.roles import (
    ADMINISTRATOR,
    CONTRACTOR_WORKER,
    PROJECT_MANAGER,
    SITE_ENGINEER,
)

worker_bp = Blueprint("worker", __name__)


def _require_csrf() -> None:
    if current_app.config.get("WTF_CSRF_ENABLED", True):
        csrf.protect()


def _actor():
    user = get_current_user()
    assert user is not None
    return user


def _handle(exc: Exception):
    if isinstance(exc, (worker_service.WorkerServiceError, ProjectAccessError)):
        return jsonify({"error": "worker_error", "message": exc.message}), exc.status_code
    raise exc


@worker_bp.get("/dashboard")
@roles_required(CONTRACTOR_WORKER)
def dashboard():
    return jsonify(worker_service.worker_dashboard(_actor()))


@worker_bp.get("/meta")
@roles_required(CONTRACTOR_WORKER)
def meta():
    return jsonify(worker_service.worker_meta())


@worker_bp.get("/projects")
@roles_required(CONTRACTOR_WORKER)
def list_projects():
    return jsonify({"items": worker_service.list_my_projects(_actor())})


@worker_bp.get("/tasks")
@roles_required(CONTRACTOR_WORKER)
def list_tasks():
    status = request.args.get("status")
    return jsonify({"items": worker_service.list_my_tasks(_actor(), status=status)})


@worker_bp.get("/tasks/<int:task_id>")
@roles_required(CONTRACTOR_WORKER)
def task_detail(task_id: int):
    try:
        payload = worker_service.get_my_task(_actor(), task_id)
    except Exception as exc:
        return _handle(exc)
    return jsonify(payload)


@worker_bp.put("/tasks/<int:task_id>/status")
@roles_required(CONTRACTOR_WORKER)
@csrf.exempt
def update_task_status(task_id: int):
    _require_csrf()
    try:
        task = worker_service.update_my_task_status(
            _actor(), task_id, request.get_json(silent=True) or {}
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Task status updated.", "task": task.to_dict()})


@worker_bp.post("/tasks/<int:task_id>/progress")
@roles_required(CONTRACTOR_WORKER)
@csrf.exempt
def add_progress(task_id: int):
    _require_csrf()
    try:
        report = worker_service.add_progress_report(
            _actor(), task_id, request.get_json(silent=True) or {}
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Progress recorded.", "report": report.to_dict()}), 201


@worker_bp.post("/tasks/<int:task_id>/submit")
@roles_required(CONTRACTOR_WORKER)
@csrf.exempt
def submit_task(task_id: int):
    _require_csrf()
    try:
        task = worker_service.submit_for_inspection(
            _actor(), task_id, request.get_json(silent=True) or {}
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Task submitted for inspection.", "task": task.to_dict()})


@worker_bp.post("/tasks/<int:task_id>/comments")
@roles_required(CONTRACTOR_WORKER)
@csrf.exempt
def add_comment(task_id: int):
    _require_csrf()
    payload = request.get_json(silent=True) or {}
    try:
        comment = worker_service.add_my_task_comment(_actor(), task_id, payload.get("body", ""))
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Comment added.", "comment": comment.to_dict()}), 201


@worker_bp.post("/tasks/<int:task_id>/evidence")
@roles_required(CONTRACTOR_WORKER)
@csrf.exempt
def upload_evidence(task_id: int):
    _require_csrf()
    file = request.files.get("file")
    payload = {
        "name": request.form.get("name"),
        "description": request.form.get("description"),
    }
    try:
        doc = worker_service.upload_task_evidence(_actor(), task_id, payload, file)
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Work evidence uploaded.", "document": doc.to_dict()}), 201


@worker_bp.get("/attendance")
@roles_required(CONTRACTOR_WORKER)
def my_attendance():
    return jsonify({"items": worker_service.list_my_attendance(_actor())})


@worker_bp.get("/documents")
@roles_required(CONTRACTOR_WORKER)
def my_documents():
    return jsonify({"items": worker_service.list_my_documents(_actor())})


@worker_bp.get("/documents/<int:document_id>/download")
@roles_required(CONTRACTOR_WORKER, ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER)
def download_document(document_id: int):
    try:
        doc, path = worker_service.get_document_for_download(_actor(), document_id)
    except Exception as exc:
        return _handle(exc)
    return send_file(
        path,
        as_attachment=True,
        download_name=doc.original_filename or doc.name,
        mimetype=doc.mime_type or "application/octet-stream",
    )
