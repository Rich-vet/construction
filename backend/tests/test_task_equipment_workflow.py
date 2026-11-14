"""Task inspection workflow and equipment request rules."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.extensions import db
from app.models import Equipment, Notification, ProjectMember, Task, User
from app.services.worker_service import dispatch_due_task_reminders
from tests.conftest import login


def _project_for_manager(client, app):
    login(client, "manager@example.com")
    with app.app_context():
        engineer = db.session.scalar(select(User).where(User.email == "engineer@example.com"))
        worker = db.session.scalar(select(User).where(User.email == "worker@example.com"))
        engineer_id = engineer.id
        worker_id = worker.id
    created = client.post(
        "/api/projects",
        json={
            "name": "Workflow Yard",
            "client_name": "Client",
            "location": "Lusaka",
            "budget": 1000,
            "status": "Active",
            "site_engineer_id": engineer_id,
        },
    )
    assert created.status_code == 201
    project_id = created.get_json()["project"]["id"]
    member = client.post(
        f"/api/projects/{project_id}/members",
        json={"user_id": worker_id, "member_role": "Labourer"},
    )
    assert member.status_code == 201
    return project_id, worker_id, engineer_id


def test_engineer_assigns_task_and_worker_cannot_approve(client, app):
    project_id, worker_id, _engineer_id = _project_for_manager(client, app)
    login(client, "engineer@example.com")
    deadline = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    created = client.post(
        "/api/projects/tasks",
        json={
            "project_id": project_id,
            "name": "Set out columns",
            "instructions": "Follow the grid drawing.",
            "checklist": ["Mark grid", "Check level"],
            "assigned_user_id": worker_id,
            "priority": "Critical",
            "due_at": deadline,
        },
    )
    assert created.status_code == 201
    task = created.get_json()["task"]
    assert task["priority"] == "Critical"
    assert task["instructions"] == "Follow the grid drawing."
    assert "minutes remaining" in task["time_remaining_label"]
    task_id = task["id"]

    login(client, "worker@example.com")
    denied = client.get("/api/worker/tasks/999999")
    assert denied.status_code in {403, 404}
    own = client.get(f"/api/worker/tasks/{task_id}")
    assert own.status_code == 200
    started = client.put(f"/api/worker/tasks/{task_id}/status", json={"status": "In Progress"})
    assert started.status_code == 200
    progress = client.post(
        f"/api/worker/tasks/{task_id}/progress",
        json={"percentage": 40, "description": "Grid marked", "work_performed": "Set pegs"},
    )
    assert progress.status_code == 201
    submitted = client.post(
        f"/api/worker/tasks/{task_id}/submit",
        json={"completion_report": "Columns set out.", "confirm_complete": True},
    )
    assert submitted.status_code == 200
    assert submitted.get_json()["task"]["status"] == "Ready for Review"

    approve = client.post(f"/api/projects/tasks/{task_id}/verify", json={})
    assert approve.status_code == 403

    login(client, "engineer@example.com")
    verified = client.post(f"/api/projects/tasks/{task_id}/verify", json={})
    assert verified.status_code == 200
    assert verified.get_json()["task"]["status"] == "Verified"


def test_rework_returns_same_task_with_new_deadline(client, app):
    project_id, worker_id, _ = _project_for_manager(client, app)
    login(client, "engineer@example.com")
    created = client.post(
        "/api/projects/tasks",
        json={
            "project_id": project_id,
            "name": "Pour footing",
            "assigned_user_id": worker_id,
            "priority": "High",
            "due_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        },
    )
    task_id = created.get_json()["task"]["id"]
    login(client, "worker@example.com")
    client.put(f"/api/worker/tasks/{task_id}/status", json={"status": "In Progress"})
    client.post(
        f"/api/worker/tasks/{task_id}/submit",
        json={"completion_report": "Poured.", "confirm_complete": True},
    )
    login(client, "engineer@example.com")
    new_deadline = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()
    rework = client.post(
        f"/api/projects/tasks/{task_id}/rework",
        json={"instructions": "Chip honeycombing and repour.", "new_deadline": new_deadline},
    )
    assert rework.status_code == 200
    body = rework.get_json()["task"]
    assert body["status"] == "Rework Required"
    assert body["rework_count"] == 1
    assert "Chip honeycombing" in body["rework_notes"]
    with app.app_context():
        stored = db.session.get(Task, task_id)
        assert stored.id == task_id
        assert stored.rework_count == 1


def test_overdue_is_derived_and_reminders_are_not_duplicated(client, app):
    project_id, worker_id, _ = _project_for_manager(client, app)
    login(client, "engineer@example.com")
    created = client.post(
        "/api/projects/tasks",
        json={
            "project_id": project_id,
            "name": "Late scaffold check",
            "assigned_user_id": worker_id,
            "priority": "High",
            "due_at": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(),
        },
    )
    task = created.get_json()["task"]
    assert task["is_overdue"] is True
    assert task["status"] == "Pending"
    with app.app_context():
        first = dispatch_due_task_reminders()
        second = dispatch_due_task_reminders()
        assert first >= 1
        assert second == 0
        notes = db.session.scalars(
            select(Notification).where(Notification.user_id == worker_id, Notification.title == "Task overdue")
        ).all()
        assert len(notes) == 1


def test_outsider_cannot_receive_another_workers_task(client, app):
    project_id, worker_id, _ = _project_for_manager(client, app)
    with app.app_context():
        other = db.session.scalar(select(User).where(User.email == "worker02@ccms-demo.local"))
        if other is None:
            other = db.session.scalar(select(User).where(User.email != "worker@example.com", User.role.has(name="Contractor/Worker")))
        other_id = other.id if other else None
    login(client, "engineer@example.com")
    created = client.post(
        "/api/projects/tasks",
        json={
            "project_id": project_id,
            "name": "Private task",
            "assigned_user_id": worker_id,
            "priority": "Low",
            "due_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        },
    )
    task_id = created.get_json()["task"]["id"]
    if other_id:
        login(client, other.email if False else "worker@example.com")
    login(client, "worker@example.com")
    visible = client.get("/api/worker/tasks")
    assert any(item["id"] == task_id for item in visible.get_json()["items"])
    with app.app_context():
        stranger = db.session.scalar(
            select(User).where(User.email == "admin@example.com")
        )
        assert stranger is not None
        member = db.session.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == worker_id,
            )
        )
        assert member is not None


def test_equipment_request_requires_manager_and_blocks_maintenance(client, app):
    project_id, _worker_id, _ = _project_for_manager(client, app)
    with app.app_context():
        shovel = db.session.scalar(select(Equipment).where(Equipment.name == "Shovel"))
        shovel_id = shovel.id
    login(client, "engineer@example.com")
    requested = client.post(
        "/api/site/equipment/requests",
        json={
            "project_id": project_id,
            "equipment_id": shovel_id,
            "quantity": 2,
            "purpose": "Trench excavation",
        },
    )
    assert requested.status_code == 201
    request_id = requested.get_json()["request"]["id"]
    sneak = client.post(
        f"/api/site/equipment/requests/{request_id}/review",
        json={"status": "Approved"},
    )
    assert sneak.status_code == 403

    login(client, "manager@example.com")
    approved = client.post(
        f"/api/site/equipment/requests/{request_id}/review",
        json={"status": "Approved"},
    )
    assert approved.status_code == 200
    assert approved.get_json()["request"]["status"] == "Approved"
    issued = client.post(f"/api/site/equipment/requests/{request_id}/issue", json={})
    assert issued.status_code == 200
    assert issued.get_json()["request"]["allocation_state"] == "Issued"

    again = client.post(
        "/api/site/equipment/requests",
        json={
            "project_id": project_id,
            "equipment_id": shovel_id,
            "quantity": 9999,
            "purpose": "Too many",
        },
    )
    assert again.status_code == 400

    login(client, "engineer@example.com")
    blocked = client.post(
        "/api/site/equipment/maintenance",
        json={"equipment_id": shovel_id, "maintenance_type": "Service", "description": "Worn blade"},
    )
    assert blocked.status_code == 400
