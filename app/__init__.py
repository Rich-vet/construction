"""CCMS Flask application factory."""

from __future__ import annotations

from flask import Flask, render_template

from config import get_config
from app.extensions import csrf, db, migrate


def create_app(config_name: str | None = None) -> Flask:
    """Create and configure the Flask application."""
    app = Flask(
        __name__,
        instance_relative_config=True,
        template_folder="templates",
        static_folder="static",
    )
    app.config.from_object(get_config(config_name))

    _ensure_runtime_directories(app)
    _register_extensions(app)
    _register_blueprints(app)
    _register_context_processors(app)
    _register_error_handlers(app)

    return app


def _ensure_runtime_directories(app: Flask) -> None:
    """Create folders required at runtime."""
    from pathlib import Path

    app.config["UPLOAD_FOLDER"].mkdir(parents=True, exist_ok=True)
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)


def _register_extensions(app: Flask) -> None:
    """Bind extensions to the application."""
    db.init_app(app)
    migrate.init_app(app, db)
    csrf.init_app(app)

    # Ensure model metadata is loaded for migrations (populated in later phases).
    with app.app_context():
        import app.models  # noqa: F401



def _register_blueprints(app: Flask) -> None:
    """Register route blueprints."""
    from app.routes.main import main_bp

    app.register_blueprint(main_bp)


def _register_context_processors(app: Flask) -> None:
    """Expose shared template variables."""

    @app.context_processor
    def inject_globals() -> dict:
        return {
            "app_name": app.config["APP_NAME"],
            "company_name": app.config["COMPANY_DISPLAY_NAME"],
            "currency_symbol": app.config["CURRENCY_SYMBOL"],
            "currency_code": app.config["CURRENCY_CODE"],
        }


def _register_error_handlers(app: Flask) -> None:
    """User-friendly error pages (no stack traces)."""

    @app.errorhandler(403)
    def forbidden(_error):
        return render_template("errors/403.html"), 403

    @app.errorhandler(404)
    def not_found(_error):
        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def server_error(_error):
        return render_template("errors/500.html"), 500
