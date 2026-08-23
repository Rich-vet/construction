"""End-to-end demo walkthrough against the development SQLite database.

Run from backend/:  python scripts/demo_walkthrough.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import create_app
from app.seed import DEMO_PASSWORD, run_seed

PASS = DEMO_PASSWORD
CHECKS: list[tuple[str, bool, str]] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    CHECKS.append((label, ok, detail))
    mark = "OK" if ok else "FAIL"
    print(f"[{mark}] {label}" + (f" — {detail}" if detail else ""))


def _csrf_headers(client) -> dict[str, str]:
    token = client.get("/api/auth/csrf").get_json()["csrf_token"]
    return {"X-CSRFToken": token}


def login(client, email: str):
    headers = _csrf_headers(client)
    # Best-effort logout; ignore failures when anonymous.
    client.post("/api/auth/logout", headers=headers)
    headers = _csrf_headers(client)
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": PASS},
        headers=headers,
    )


def main() -> int:
    app = create_app("development")
    with app.app_context():
        run_seed(with_demo_scenario=True)

    client = app.test_client()

    # --- Admin ---
    r = login(client, "admin@example.com")
    check("Admin login", r.status_code == 200, f"{r.status_code} {r.get_json()}")
    me_payload = client.get("/api/auth/me").get_json() or {}
    me = me_payload.get("user") or {}
    role = me.get("role") or me.get("role_name")
    check("Admin role", role == "Administrator", str(role))

    dash = client.get("/api/admin/dashboard")
    check("Admin dashboard", dash.status_code == 200)
    users = client.get("/api/admin/users")
    check("Admin users list", users.status_code == 200 and users.get_json().get("total", 0) >= 4)
    company = client.get("/api/admin/company")
    check("Admin company profile", company.status_code == 200)
    logs = client.get("/api/admin/activity-logs")
    check("Admin activity logs", logs.status_code == 200)
    notes = client.get("/api/notifications")
    check("Admin notifications", notes.status_code == 200)
    reports = client.get("/api/reports/meta")
    check("Admin reports meta", reports.status_code == 200)

    # --- Project Manager ---
    r = login(client, "manager@example.com")
    check("PM login", r.status_code == 200)
    pdash = client.get("/api/projects/dashboard")
    check("PM dashboard", pdash.status_code == 200)
    projects = client.get("/api/projects")
    items = projects.get_json().get("items", [])
    demo = next((p for p in items if p.get("name") == "Demo Civic Block"), None)
    check("PM sees Demo Civic Block", demo is not None, f"projects={len(items)}")
    if demo:
        ws = client.get(f"/api/projects/{demo['id']}")
        body = ws.get_json() if ws.status_code == 200 else {}
        check("PM project workspace", ws.status_code == 200)
        check("PM budget vs actual rows", len(body.get("budget_vs_actual", [])) == 5)
        check("PM tasks present", len(body.get("tasks", [])) >= 2)
        check("PM milestones present", len(body.get("milestones", [])) >= 2)
        reqs = client.get("/api/projects/material-requests")
        check("PM material requests", reqs.status_code == 200)
    inv = client.get("/api/reports/inventory")
    check("PM inventory report", inv.status_code == 200)
    prog = client.get("/api/reports/project_progress")
    check("PM project progress report", prog.status_code == 200)

    # --- Site Engineer ---
    r = login(client, "engineer@example.com")
    check("SE login", r.status_code == 200)
    sdash = client.get("/api/site/dashboard")
    check("SE dashboard", sdash.status_code == 200)
    splist = client.get("/api/projects")
    se_items = splist.get_json().get("items", [])
    se_demo = next((p for p in se_items if p.get("name") == "Demo Civic Block"), None)
    check("SE sees assigned demo project", se_demo is not None, f"projects={len(se_items)}")
    mats = client.get("/api/site/materials")
    check("SE materials catalog", mats.status_code == 200)
    equip = client.get("/api/site/equipment")
    check("SE equipment list", equip.status_code == 200)
    # SE must not manage users
    denied = client.get("/api/admin/users")
    check("SE blocked from admin users", denied.status_code == 403)

    # --- Worker ---
    r = login(client, "worker@example.com")
    check("Worker login", r.status_code == 200)
    wdash = client.get("/api/worker/dashboard")
    check("Worker dashboard", wdash.status_code == 200)
    tasks = client.get("/api/worker/tasks")
    check("Worker tasks list", tasks.status_code == 200)
    wtasks = tasks.get_json().get("items", [])
    check("Worker has assigned tasks", len(wtasks) >= 1, f"count={len(wtasks)}")
    att = client.get("/api/worker/attendance")
    check("Worker attendance view", att.status_code == 200)
    # Worker must not open reports / admin
    check("Worker blocked from reports", client.get("/api/reports/meta").status_code == 403)
    check("Worker blocked from admin", client.get("/api/admin/dashboard").status_code == 403)
    if wtasks:
        tid = wtasks[0]["id"]
        detail = client.get(f"/api/worker/tasks/{tid}")
        check("Worker task detail", detail.status_code == 200)

    # --- Cross-cutting notifications ---
    unread = client.get("/api/notifications/unread-count")
    check("Worker unread notifications", unread.status_code == 200)

    failed = [c for c in CHECKS if not c[1]]
    print()
    print(f"Passed {len(CHECKS) - len(failed)}/{len(CHECKS)}")
    if failed:
        print("Failures:")
        for label, _, detail in failed:
            print(f"  - {label}: {detail}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
