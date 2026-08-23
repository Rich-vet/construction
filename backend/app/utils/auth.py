"""Authentication and authorization helpers."""

from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any

from flask import g, jsonify, session

from app.extensions import db
from app.models import User


def get_current_user() -> User | None:
    """Load the authenticated user from the session, if any."""
    if hasattr(g, "current_user"):
        return g.current_user

    user_id = session.get("user_id")
    if not user_id:
        g.current_user = None
        return None

    user = db.session.get(User, user_id)
    if user is None or not user.is_active:
        session.clear()
        g.current_user = None
        return None

    g.current_user = user
    return user


def login_user(user: User) -> None:
    """Create an authenticated session for the user."""
    session.clear()
    session["user_id"] = user.id
    session.permanent = True
    g.current_user = user


def logout_user() -> None:
    """Destroy the authenticated session."""
    session.clear()
    g.current_user = None


def login_required(view: Callable[..., Any]) -> Callable[..., Any]:
    """Reject unauthenticated requests."""

    @wraps(view)
    def wrapped(*args: Any, **kwargs: Any):
        user = get_current_user()
        if user is None:
            return jsonify(
                {
                    "error": "unauthorized",
                    "message": "Please log in to continue.",
                }
            ), 401
        return view(*args, **kwargs)

    return wrapped


def roles_required(*role_names: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Allow only users whose role name is in the provided set."""

    allowed = set(role_names)

    def decorator(view: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(view)
        def wrapped(*args: Any, **kwargs: Any):
            user = get_current_user()
            if user is None:
                return jsonify(
                    {
                        "error": "unauthorized",
                        "message": "Please log in to continue.",
                    }
                ), 401
            if user.role_name not in allowed:
                return jsonify(
                    {
                        "error": "forbidden",
                        "message": "You do not have permission to access this resource.",
                    }
                ), 403
            return view(*args, **kwargs)

        return wrapped

    return decorator
