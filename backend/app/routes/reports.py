"""Reports API routes."""

from __future__ import annotations

from flask import Blueprint, jsonify, request, send_file
from io import BytesIO

from app.services import report_service
from app.utils.auth import get_current_user, roles_required
from app.utils.roles import ADMINISTRATOR, PROJECT_MANAGER

reports_bp = Blueprint("reports", __name__)


def _actor():
    user = get_current_user()
    assert user is not None
    return user


def _handle(exc: Exception):
    if isinstance(exc, report_service.ReportServiceError):
        return jsonify({"error": "report_error", "message": exc.message}), exc.status_code
    raise exc


@reports_bp.get("/meta")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
def meta():
    return jsonify(report_service.list_report_types(_actor()))


@reports_bp.get("/<report_id>")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
def run_report(report_id: str):
    try:
        payload = report_service.generate_report(
            _actor(),
            report_id,
            project_id=request.args.get("project_id", type=int),
            date_from=request.args.get("from"),
            date_to=request.args.get("to"),
        )
    except Exception as exc:
        return _handle(exc)
    return jsonify(payload)


@reports_bp.get("/<report_id>/pdf")
@roles_required(ADMINISTRATOR, PROJECT_MANAGER)
def run_report_pdf(report_id: str):
    try:
        payload = report_service.generate_report(
            _actor(),
            report_id,
            project_id=request.args.get("project_id", type=int),
            date_from=request.args.get("from"),
            date_to=request.args.get("to"),
        )
        pdf_bytes = report_service.render_pdf(payload)
    except Exception as exc:
        return _handle(exc)
    filename = f"ccms-{report_id}.pdf"
    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
    )
