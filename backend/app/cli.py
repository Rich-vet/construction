"""CLI registration for development helpers."""

from __future__ import annotations

import os

import click
from flask import Flask
from sqlalchemy import func, inspect, select, text


def register_cli(app: Flask) -> None:
    @app.cli.command("seed")
    @click.option(
        "--scenario/--no-scenario",
        default=True,
        help="Include the Demo Civic Block walkthrough project (default: on).",
    )
    def seed_command(scenario: bool) -> None:
        """Seed roles, demo users, catalogs, and optional sample project."""
        from app.seed import run_seed

        result = run_seed(with_demo_scenario=scenario)
        click.echo("Seed complete.")
        click.echo(f"Roles: {', '.join(result['roles'])}")
        click.echo(f"Users: {', '.join(result['users'])}")
        click.echo(f"Dev password: {result['password']}")
        demo = result.get("demo_project")
        if demo and demo.get("created"):
            click.echo(f"Demo project created (id={demo['project_id']}): Demo Civic Block")
        elif demo:
            click.echo(f"Demo project already present (id={demo['project_id']}).")
        elif not scenario:
            click.echo("Demo scenario skipped.")
        workers = result.get("workers") or {}
        click.echo(
            "Zambian worker accounts: "
            f"created={workers.get('created', 0)} "
            f"skipped={workers.get('skipped', 0)} "
            f"failed={workers.get('failed', 0)} "
            f"team_members_added={workers.get('crew_members', 0)} "
            f"tasks_added={workers.get('crew_tasks', 0)}"
        )

    @app.cli.command("verify-db")
    def verify_db_command() -> None:
        """Verify DATABASE_URL connectivity, tables, and a short smoke query.

        Use after switching to MySQL, e.g.:
          DATABASE_URL=mysql+pymysql://user:pass@localhost:3306/ccms
          flask --app run.py db upgrade
          flask --app run.py seed
          flask --app run.py verify-db
        """
        from app.extensions import db
        from app.models import Role, User

        uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
        backend = "SQLite" if uri.startswith("sqlite") else "MySQL" if "mysql" in uri else "Other"
        click.echo(f"Backend: {backend}")
        click.echo(f"URI host hint: {_uri_hint(uri)}")

        try:
            db.session.execute(text("SELECT 1"))
            inspector = inspect(db.engine)
            tables = sorted(inspector.get_table_names())
            role_count = db.session.scalar(select(func.count()).select_from(Role))
            user_count = db.session.scalar(select(func.count()).select_from(User))
        except Exception as exc:  # noqa: BLE001 — CLI surfacing
            raise click.ClickException(f"Database verification failed: {exc}") from exc

        click.echo(f"Tables ({len(tables)}): {', '.join(tables[:8])}{'…' if len(tables) > 8 else ''}")
        click.echo(f"Roles: {role_count} | Users: {user_count}")
        if "mysql" in uri and len(tables) < 10:
            raise click.ClickException(
                "MySQL is connected but schema looks incomplete. Run: flask --app run.py db upgrade"
            )
        click.echo("verify-db: OK")

    @app.cli.command("print-mysql-uri")
    def print_mysql_uri_command() -> None:
        """Print a ready-to-edit MySQL DATABASE_URL template."""
        user = os.getenv("MYSQL_USER", "ccms")
        password = os.getenv("MYSQL_PASSWORD", "ccms_password")
        host = os.getenv("MYSQL_HOST", "127.0.0.1")
        port = os.getenv("MYSQL_PORT", "3306")
        name = os.getenv("MYSQL_DATABASE", "ccms")
        click.echo(
            f"DATABASE_URL=mysql+pymysql://{user}:{password}@{host}:{port}/{name}"
            "?charset=utf8mb4"
        )


def _uri_hint(uri: str) -> str:
    if "://" not in uri:
        return "(unset)"
    # Strip credentials for display.
    try:
        scheme, rest = uri.split("://", 1)
        if "@" in rest:
            rest = rest.split("@", 1)[1]
        return f"{scheme}://{rest}"
    except ValueError:
        return "(invalid)"
