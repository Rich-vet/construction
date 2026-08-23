"""Authentication business logic."""

from __future__ import annotations

import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.extensions import db
from app.models import PasswordResetToken, User
from app.utils.auth import login_user, logout_user


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$")


class AuthError(Exception):
    """Domain error with an HTTP-friendly message."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def validate_email(email: str) -> str:
    normalized = (email or "").strip().lower()
    if not normalized or not EMAIL_RE.match(normalized):
        raise AuthError("Enter a valid email address.")
    return normalized


def validate_password_strength(password: str) -> str:
    if not password or not PASSWORD_RE.match(password):
        raise AuthError(
            "Password must be at least 8 characters and include uppercase, "
            "lowercase, and a number."
        )
    return password


def authenticate(email: str, password: str) -> User:
    """Validate credentials and open a session."""
    normalized = validate_email(email)
    if not password:
        raise AuthError("Email and password are required.")

    user = db.session.scalar(select(User).where(User.email == normalized))
    if user is None or not user.check_password(password):
        raise AuthError("Invalid email or password.", status_code=401)
    if not user.is_active:
        raise AuthError("This account is inactive. Contact an administrator.", status_code=403)

    login_user(user)
    return user


def end_session() -> None:
    logout_user()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_password_reset(email: str, *, expose_token: bool) -> dict:
    """
    Create a password reset token.

    When expose_token is True (development), the raw token is returned so the
    flow can be tested without email infrastructure.
    """
    normalized = validate_email(email)
    user = db.session.scalar(select(User).where(User.email == normalized))

    # Always return a generic message to avoid account enumeration.
    generic = {
        "message": (
            "If an account exists for that email, a reset token has been created. "
            "In development the token is returned in the response."
            if expose_token
            else "If an account exists for that email, reset instructions have been prepared."
        )
    }

    if user is None or not user.is_active:
        return generic

    raw_token = secrets.token_urlsafe(32)
    reset = PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.session.add(reset)
    db.session.commit()

    if expose_token:
        return {
            **generic,
            "dev_reset_token": raw_token,
            "dev_reset_path": f"/reset-password?token={raw_token}",
            "expires_in_minutes": 60,
        }
    return generic


def reset_password(token: str, new_password: str) -> User:
    """Consume a reset token and set a new password."""
    if not token or not token.strip():
        raise AuthError("Reset token is required.")
    validate_password_strength(new_password)

    token_hash = _hash_token(token.strip())
    reset = db.session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    if reset is None or not reset.is_valid:
        raise AuthError("This reset link is invalid or has expired.", status_code=400)

    user = reset.user
    if user is None or not user.is_active:
        raise AuthError("Unable to reset password for this account.", status_code=400)

    user.set_password(new_password)
    reset.used_at = datetime.now(timezone.utc)
    db.session.commit()
    return user
