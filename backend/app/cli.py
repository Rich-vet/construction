"""CLI registration for development helpers."""

from __future__ import annotations

import click
from flask import Flask


def register_cli(app: Flask) -> None:
    @app.cli.command("seed")
    def seed_command() -> None:
        """Seed roles and demo user accounts."""
        from app.seed import run_seed

        result = run_seed()
        click.echo("Seed complete.")
        click.echo(f"Roles: {', '.join(result['roles'])}")
        click.echo(f"Users: {', '.join(result['users'])}")
        click.echo(f"Dev password: {result['password']}")
