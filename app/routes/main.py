"""Main / foundation routes."""

from __future__ import annotations

from flask import Blueprint, current_app, render_template

main_bp = Blueprint("main", __name__)


@main_bp.get("/")
def index():
    """Foundation shell page — verifies layout and design system."""
    return render_template(
        "main/index.html",
        page_title="Foundation",
        phase_label="Phase 1",
        database_backend=_database_backend_label(),
    )


def _database_backend_label() -> str:
    """Human-readable database engine from the configured URI."""
    uri = current_app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if uri.startswith("sqlite"):
        return "SQLite"
    if uri.startswith("mysql"):
        return "MySQL"
    return "Configured database"
