"""CCMS Flask application factory (API backend)."""

from __future__ import annotations

from flask import Flask, jsonify
from flask_wtf.csrf import CSRFError

from config import get_config
from app.cli import register_cli
from app.extensions import cors, csrf, db, migrate


def create_app(config_name: str | None = None) -> Flask:
    """Create and configure the Flask API application."""
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(get_config(config_name))

    _ensure_runtime_directories(app)
    _register_extensions(app)
    _register_blueprints(app)
    _register_error_handlers(app)
    register_cli(app)

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
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )

    with app.app_context():
        import app.models  # noqa: F401


def _register_blueprints(app: Flask) -> None:
    """Register API blueprints."""
    from app.routes.auth import auth_bp
    from app.routes.admin import admin_bp
    from app.routes.main import main_bp
    from app.routes.projects import projects_bp

    app.register_blueprint(main_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(projects_bp, url_prefix="/api/projects")


def _register_error_handlers(app: Flask) -> None:
    """JSON error responses (no stack traces to clients)."""

    @app.errorhandler(CSRFError)
    def csrf_error(_error):
        return jsonify(
            {
                "error": "csrf_failed",
                "message": "Security validation failed. Refresh the page and try again.",
            }
        ), 400

    @app.errorhandler(401)
    def unauthorized(_error):
        return jsonify(
            {
                "error": "unauthorized",
                "message": "Please log in to continue.",
            }
        ), 401

    @app.errorhandler(403)
    def forbidden(_error):
        return jsonify(
            {
                "error": "forbidden",
                "message": "You do not have permission to access this resource.",
            }
        ), 403

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify(
            {
                "error": "not_found",
                "message": "The requested resource was not found.",
            }
        ), 404

    @app.errorhandler(500)
    def server_error(_error):
        return jsonify(
            {
                "error": "server_error",
                "message": "Something went wrong. Please try again.",
            }
        ), 500
