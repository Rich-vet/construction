"""Foundation / health API routes."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify

main_bp = Blueprint("main", __name__)


@main_bp.get("/health")
def health():
    """Liveness check for the API."""
    return jsonify({"status": "ok", "service": "ccms-api"})


@main_bp.get("/foundation")
def foundation():
    """Phase 1 foundation status payload for the React shell."""
    return jsonify(
        {
            "phase": "Phase 1",
            "phase_label": "Phase 1 complete",
            "app_name": current_app.config["APP_NAME"],
            "company_name": current_app.config["COMPANY_DISPLAY_NAME"],
            "currency_code": current_app.config["CURRENCY_CODE"],
            "currency_symbol": current_app.config["CURRENCY_SYMBOL"],
            "database_backend": _database_backend_label(),
            "auth_status": "pending",
            "message": (
                "The application shell, design system, configuration, "
                "and database layer are in place. Authentication arrives next."
            ),
            "checks": [
                {
                    "id": "factory",
                    "title": "Application factory",
                    "text": "Flask blueprints, extensions, and environment-driven config are wired.",
                    "status": "ready",
                },
                {
                    "id": "database",
                    "title": "Database layer",
                    "text": (
                        "SQLAlchemy + Flask-Migrate configured for "
                        f"{_database_backend_label()} via DATABASE_URL."
                    ),
                    "status": "ready",
                },
                {
                    "id": "design",
                    "title": "Design system",
                    "text": "Construction-inspired tokens, typography, and layout shell are active.",
                    "status": "ready",
                },
                {
                    "id": "security",
                    "title": "Security baseline",
                    "text": "Secrets via environment variables, CORS scoped to the SPA, secure cookie defaults set.",
                    "status": "ready",
                },
            ],
            "next": {
                "title": "Next: Phase 2",
                "text": "Login, logout, password security, sessions, RBAC, and role-aware navigation.",
                "note": "Sidebar modules are visible for orientation but disabled until their phases are implemented.",
            },
        }
    )


def _database_backend_label() -> str:
    """Human-readable database engine from the configured URI."""
    uri = current_app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if uri.startswith("sqlite"):
        return "SQLite"
    if uri.startswith("mysql"):
        return "MySQL"
    return "Configured database"
