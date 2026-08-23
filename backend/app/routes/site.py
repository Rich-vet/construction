"""Site Engineer API routes."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request, send_file

from app.extensions import csrf
from app.services import site_service
from app.utils.auth import get_current_user, roles_required
from app.utils.project_access import ProjectAccessError
from app.utils.roles import ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER

site_bp = Blueprint("site", __name__)

SITE_ROLES = (ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER)


def _require_csrf() -> None:
    if current_app.config.get("WTF_CSRF_ENABLED", True):
        csrf.protect()


def _actor():
    user = get_current_user()
    assert user is not None
    return user


def _handle(exc: Exception):
    if isinstance(exc, (site_service.SiteServiceError, ProjectAccessError)):
        return jsonify({"error": "site_error", "message": exc.message}), exc.status_code
    raise exc


@site_bp.get("/dashboard")
@roles_required(SITE_ENGINEER, ADMINISTRATOR)
def dashboard():
    return jsonify(site_service.se_dashboard(_actor()))


@site_bp.get("/meta")
@roles_required(*SITE_ROLES)
def meta():
    return jsonify(site_service.site_meta(_actor()))


@site_bp.get("/projects/<int:project_id>/workers")
@roles_required(*SITE_ROLES)
def project_workers(project_id: int):
    try:
        workers = site_service.list_project_workers(_actor(), project_id)
    except Exception as exc:
        return _handle(exc)
    return jsonify({"items": workers})


@site_bp.get("/attendance")
@roles_required(*SITE_ROLES)
def list_attendance():
    from datetime import date

    project_id = request.args.get("project_id", type=int)
    date_raw = request.args.get("date")
    attendance_date = date.fromisoformat(date_raw) if date_raw else None
    try:
        items = site_service.list_attendance(
            _actor(), project_id=project_id, attendance_date=attendance_date
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"items": items})


@site_bp.post("/attendance")
@roles_required(*SITE_ROLES)
@csrf.exempt
def create_attendance():
    _require_csrf()
    try:
        record = site_service.record_attendance(_actor(), request.get_json(silent=True) or {})
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Attendance recorded.", "attendance": record.to_dict()}), 201


@site_bp.get("/materials")
@roles_required(*SITE_ROLES)
def list_materials():
    return jsonify({"items": site_service.list_materials_stock(_actor())})


@site_bp.get("/material-transactions")
@roles_required(*SITE_ROLES)
def list_transactions():
    project_id = request.args.get("project_id", type=int)
    try:
        items = site_service.list_material_transactions(_actor(), project_id=project_id)
    except Exception as exc:
        return _handle(exc)
    return jsonify({"items": items})


@site_bp.post("/material-usage")
@roles_required(*SITE_ROLES)
@csrf.exempt
def material_usage():
    _require_csrf()
    try:
        txn = site_service.record_material_usage(_actor(), request.get_json(silent=True) or {})
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Material usage recorded.", "transaction": txn.to_dict()}), 201


@site_bp.post("/materials")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def create_material():
    from app.services import inventory_service

    _require_csrf()
    try:
        material = inventory_service.upsert_material(_actor(), request.get_json(silent=True) or {})
    except inventory_service.InventoryServiceError as exc:
        return jsonify({"error": "inventory_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "Material created.", "material": material.to_dict()}), 201


@site_bp.put("/materials/<int:material_id>")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def update_material(material_id: int):
    from app.services import inventory_service

    _require_csrf()
    try:
        material = inventory_service.upsert_material(
            _actor(), request.get_json(silent=True) or {}, material_id=material_id
        )
    except inventory_service.InventoryServiceError as exc:
        return jsonify({"error": "inventory_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "Material updated.", "material": material.to_dict()})


@site_bp.get("/equipment")
@roles_required(*SITE_ROLES)
def list_equipment():
    return jsonify({"items": site_service.list_equipment(_actor())})


@site_bp.get("/equipment/allocations")
@roles_required(*SITE_ROLES)
def list_allocations():
    project_id = request.args.get("project_id", type=int)
    try:
        items = site_service.list_allocations(_actor(), project_id=project_id)
    except Exception as exc:
        return _handle(exc)
    return jsonify({"items": items})


@site_bp.post("/equipment/allocate")
@roles_required(*SITE_ROLES)
@csrf.exempt
def allocate_equipment():
    _require_csrf()
    try:
        allocation = site_service.allocate_equipment(_actor(), request.get_json(silent=True) or {})
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Equipment allocated.", "allocation": allocation.to_dict()}), 201


@site_bp.post("/equipment/allocations/<int:allocation_id>/return")
@roles_required(*SITE_ROLES)
@csrf.exempt
def return_equipment(allocation_id: int):
    _require_csrf()
    try:
        allocation = site_service.return_equipment(
            _actor(), allocation_id, request.get_json(silent=True) or {}
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Equipment returned.", "allocation": allocation.to_dict()})


@site_bp.post("/equipment/maintenance")
@roles_required(*SITE_ROLES)
@csrf.exempt
def maintenance():
    _require_csrf()
    try:
        record = site_service.log_maintenance(_actor(), request.get_json(silent=True) or {})
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Maintenance logged.", "maintenance": record.to_dict()}), 201


@site_bp.get("/equipment/maintenance")
@roles_required(*SITE_ROLES)
def list_maintenance():
    from app.services import inventory_service

    equipment_id = request.args.get("equipment_id", type=int)
    try:
        items = inventory_service.list_maintenance(_actor(), equipment_id=equipment_id)
    except inventory_service.InventoryServiceError as exc:
        return jsonify({"error": "inventory_error", "message": exc.message}), exc.status_code
    return jsonify({"items": items})


@site_bp.post("/equipment")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def create_equipment():
    from app.services import inventory_service

    _require_csrf()
    try:
        equipment = inventory_service.upsert_equipment(_actor(), request.get_json(silent=True) or {})
    except inventory_service.InventoryServiceError as exc:
        return jsonify({"error": "inventory_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "Equipment created.", "equipment": equipment.to_dict()}), 201


@site_bp.put("/equipment/<int:equipment_id>")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
@csrf.exempt
def update_equipment(equipment_id: int):
    from app.services import inventory_service

    _require_csrf()
    try:
        equipment = inventory_service.upsert_equipment(
            _actor(), request.get_json(silent=True) or {}, equipment_id=equipment_id
        )
    except inventory_service.InventoryServiceError as exc:
        return jsonify({"error": "inventory_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "Equipment updated.", "equipment": equipment.to_dict()})


@site_bp.post("/equipment/<int:equipment_id>/complete-maintenance")
@roles_required(*SITE_ROLES)
@csrf.exempt
def complete_maintenance(equipment_id: int):
    from app.services import inventory_service

    _require_csrf()
    try:
        equipment = inventory_service.complete_maintenance(_actor(), equipment_id)
    except inventory_service.InventoryServiceError as exc:
        return jsonify({"error": "inventory_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "Equipment marked available.", "equipment": equipment.to_dict()})


@site_bp.get("/progress-updates")
@roles_required(*SITE_ROLES)
def list_progress():
    project_id = request.args.get("project_id", type=int)
    try:
        items = site_service.list_progress_updates(_actor(), project_id=project_id)
    except Exception as exc:
        return _handle(exc)
    return jsonify({"items": items})


@site_bp.post("/progress-updates")
@roles_required(*SITE_ROLES)
@csrf.exempt
def create_progress():
    _require_csrf()
    try:
        update = site_service.create_progress_update(
            _actor(), request.get_json(silent=True) or {}
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Progress update submitted.", "update": update.to_dict()}), 201


@site_bp.get("/site-reports")
@roles_required(*SITE_ROLES)
def list_reports():
    project_id = request.args.get("project_id", type=int)
    try:
        items = site_service.list_site_reports(_actor(), project_id=project_id)
    except Exception as exc:
        return _handle(exc)
    return jsonify({"items": items})


@site_bp.post("/site-reports")
@roles_required(*SITE_ROLES)
@csrf.exempt
def create_report():
    _require_csrf()
    try:
        report = site_service.create_site_report(_actor(), request.get_json(silent=True) or {})
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Site report submitted.", "report": report.to_dict()}), 201


@site_bp.get("/documents")
@roles_required(*SITE_ROLES)
def list_documents():
    project_id = request.args.get("project_id", type=int)
    try:
        items = site_service.list_documents(_actor(), project_id=project_id)
    except Exception as exc:
        return _handle(exc)
    return jsonify({"items": items})


@site_bp.post("/documents")
@roles_required(*SITE_ROLES)
@csrf.exempt
def upload_document():
    _require_csrf()
    file = request.files.get("file")
    payload = {
        "project_id": request.form.get("project_id"),
        "name": request.form.get("name"),
        "document_type": request.form.get("document_type"),
        "description": request.form.get("description"),
    }
    try:
        doc = site_service.upload_document(_actor(), payload, file)
    except Exception as exc:
        return _handle(exc)
    return jsonify({"message": "Document uploaded.", "document": doc.to_dict()}), 201


@site_bp.get("/documents/<int:document_id>/download")
@roles_required(*SITE_ROLES)
def download_document(document_id: int):
    try:
        doc, path = site_service.get_document_for_download(_actor(), document_id)
    except Exception as exc:
        return _handle(exc)
    return send_file(
        path,
        as_attachment=True,
        download_name=doc.original_filename or doc.name,
        mimetype=doc.mime_type or "application/octet-stream",
    )
