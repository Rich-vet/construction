"""CSRF session rotation and contractor-creation authorization."""

from __future__ import annotations

from app.seed import DEMO_PASSWORD


def _enable_csrf(app) -> None:
    app.config["WTF_CSRF_ENABLED"] = True


def _csrf(client) -> str:
    response = client.get("/api/auth/csrf")
    assert response.status_code == 200
    token = response.get_json()["csrf_token"]
    assert token
    return token


def _login(client, email: str) -> str:
    """Log in with a valid token. Returns that token, which login invalidates."""
    token = _csrf(client)
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": DEMO_PASSWORD},
        headers={"X-CSRFToken": token},
    )
    assert response.status_code == 200
    return token


def test_login_invalidates_previous_csrf_token(app, client):
    _enable_csrf(app)
    stale = _login(client, "admin@example.com")
    denied = client.post(
        "/api/admin/contractors",
        json={"name": "Stale Token Crew"},
        headers={"X-CSRFToken": stale},
    )
    assert denied.status_code == 400
    assert denied.get_json()["error"] == "csrf_failed"
    me = client.get("/api/auth/me")
    assert me.get_json()["authenticated"] is True
    assert me.get_json()["user"]["role"] == "Administrator"


def test_admin_creates_contractor_with_fresh_csrf(app, client):
    _enable_csrf(app)
    _login(client, "admin@example.com")
    created = client.post(
        "/api/admin/contractors",
        json={"name": "Authorized Crew", "specialty": "Formwork", "status": "Active"},
        headers={"X-CSRFToken": _csrf(client)},
    )
    assert created.status_code == 201
    body = created.get_json()
    assert body["contractor"]["name"] == "Authorized Crew"
    listed = client.get("/api/admin/contractors")
    names = [item["name"] for item in listed.get_json()["items"]]
    assert "Authorized Crew" in names


def test_other_roles_cannot_create_contractors(app, client):
    _enable_csrf(app)
    for email in ("manager@example.com", "engineer@example.com", "worker@example.com"):
        client.post("/api/auth/logout", headers={"X-CSRFToken": _csrf(client)})
        _login(client, email)
        response = client.post(
            "/api/admin/contractors",
            json={"name": "Should Not Exist"},
            headers={"X-CSRFToken": _csrf(client)},
        )
        assert response.status_code == 403
        payload = response.get_json()
        assert payload["error"] == "forbidden"
        assert payload["error"] != "csrf_failed"
        me = client.get("/api/auth/me")
        assert me.get_json()["authenticated"] is True


def test_contractor_create_requires_login(app, client):
    _enable_csrf(app)
    response = client.post(
        "/api/admin/contractors",
        json={"name": "Anonymous Crew"},
        headers={"X-CSRFToken": _csrf(client)},
    )
    assert response.status_code == 401
    assert response.get_json()["error"] == "unauthorized"
