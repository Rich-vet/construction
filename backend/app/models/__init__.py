"""SQLAlchemy models package.

Phase 1: extensions only. Domain models are added in later phases.
Import models here as they are introduced so Flask-Migrate can detect them.
"""

from app.extensions import db

__all__ = ["db"]
