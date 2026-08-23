"""Authentication API routes."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request
from flask_wtf.csrf import generate_csrf

from app.extensions import csrf
from app.services import auth_service
from app.utils.auth import get_current_user, login_required
from app.utils.permissions import navigation_for_role

auth_bp = Blueprint("auth", __name__)


@auth_bp.get("/csrf")
def csrf_token():
    """Issue a CSRF token for the SPA (also sets the CSRF cookie)."""
    return jsonify({"csrf_token": generate_csrf()})


@auth_bp.get("/me")
def me():
    """Return the current session user, or null when anonymous."""
    user = get_current_user()
    if user is None:
        return jsonify({"authenticated": False, "user": None})
    return jsonify(
        {
            "authenticated": True,
            "user": user.to_dict(),
            "navigation": navigation_for_role(user.role_name),
        }
    )


@auth_bp.post("/login")
@csrf.exempt  # Token validated manually after reading JSON body below
def login():
    _require_csrf()
    payload = request.get_json(silent=True) or {}
    try:
        user = auth_service.authenticate(
            email=payload.get("email", ""),
            password=payload.get("password", ""),
        )
    except auth_service.AuthError as exc:
        return jsonify({"error": "auth_error", "message": exc.message}), exc.status_code

    return jsonify(
        {
            "message": "Logged in successfully.",
            "user": user.to_dict(),
            "navigation": navigation_for_role(user.role_name),
        }
    )


@auth_bp.post("/logout")
@login_required
@csrf.exempt
def logout():
    _require_csrf()
    auth_service.end_session()
    return jsonify({"message": "Logged out successfully."})


@auth_bp.post("/forgot-password")
@csrf.exempt
def forgot_password():
    _require_csrf()
    payload = request.get_json(silent=True) or {}
    expose = bool(current_app.config.get("DEV_EXPOSE_PASSWORD_RESET_TOKEN", False))
    try:
        result = auth_service.create_password_reset(
            email=payload.get("email", ""),
            expose_token=expose,
        )
    except auth_service.AuthError as exc:
        return jsonify({"error": "auth_error", "message": exc.message}), exc.status_code
    return jsonify(result)


@auth_bp.post("/reset-password")
@csrf.exempt
def reset_password():
    _require_csrf()
    payload = request.get_json(silent=True) or {}
    try:
        auth_service.reset_password(
            token=payload.get("token", ""),
            new_password=payload.get("password", ""),
        )
    except auth_service.AuthError as exc:
        return jsonify({"error": "auth_error", "message": exc.message}), exc.status_code
    return jsonify({"message": "Password updated successfully. You can log in now."})


def _require_csrf() -> None:
    """Validate CSRF for JSON API mutations using header or form field."""
    if current_app.config.get("WTF_CSRF_ENABLED", True):
        csrf.protect()
