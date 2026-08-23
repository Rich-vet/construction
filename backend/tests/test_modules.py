"""PRD module coverage: finance (budget vs actual) and progress (tasks → milestones)."""

from __future__ import annotations

from sqlalchemy import select

from app.extensions import db
from app.models import User
from app.seed_demo import seed_demo_scenario
from tests.conftest import login


def test_budget_vs_actual_on_project_workspace(client):
    login(client, "manager@example.com")
    created = client.post(
        "/api/projects",
        json={
            "name": "Budget Check",
            "client_name": "Client",
            "location": "Kitwe",
            "budget": 100000,
            "status": "Active",
        },
    )
    assert created.status_code == 201
    project_id = created.get_json()["project"]["id"]

    budget = client.put(
        f"/api/projects/{project_id}/budgets/Materials",
        json={"amount": 40000},
    )
    assert budget.status_code == 200

    expense = client.post(
        "/api/projects/expenses",
        json={
            "project_id": project_id,
            "category": "Materials",
            "description": "Cement delivery",
            "amount": 12500,
            "expense_date": "2026-08-01",
        },
    )
    assert expense.status_code == 201

    workspace = client.get(f"/api/projects/{project_id}")
    assert workspace.status_code == 200
    rows = workspace.get_json()["budget_vs_actual"]
    materials = next(r for r in rows if r["category"] == "Materials")
    assert float(materials["budget"]) == 40000
    assert float(materials["actual"]) == 12500
    assert float(materials["variance"]) == 12500 - 40000


def test_task_completion_and_milestone_progress(client, app):
    login(client, "manager@example.com")
    with app.app_context():
        worker = db.session.scalar(select(User).where(User.email == "worker@example.com"))
        engineer = db.session.scalar(select(User).where(User.email == "engineer@example.com"))
        worker_id = worker.id
        engineer_id = engineer.id

    created = client.post(
        "/api/projects",
        json={
            "name": "Progress Chain",
            "client_name": "Client",
            "location": "Ndola",
            "budget": 50000,
            "status": "Active",
            "site_engineer_id": engineer_id,
        },
    )
    assert created.status_code == 201
    project_id = created.get_json()["project"]["id"]

    task = client.post(
        "/api/projects/tasks",
        json={
            "project_id": project_id,
            "name": "Pour columns",
            "assigned_user_id": worker_id,
            "priority": "High",
            "status": "Pending",
        },
    )
    assert task.status_code == 201
    task_id = task.get_json()["task"]["id"]

    updated = client.put(
        f"/api/projects/tasks/{task_id}",
        json={"status": "Completed"},
    )
    assert updated.status_code == 200
    assert updated.get_json()["task"]["status"] == "Completed"

    milestone = client.post(
        "/api/projects/milestones",
        json={
            "project_id": project_id,
            "name": "Columns complete",
            "target_date": "2026-09-01",
        },
    )
    assert milestone.status_code == 201
    mid = milestone.get_json()["milestone"]["id"]

    done = client.post(f"/api/projects/milestones/{mid}/complete")
    assert done.status_code == 200
    assert done.get_json()["milestone"]["is_completed"] is True

    login(client, "engineer@example.com")
    progress = client.post(
        "/api/site/progress-updates",
        json={
            "project_id": project_id,
            "work_completed": "Columns poured and cured",
            "percentage": 55,
        },
    )
    assert progress.status_code == 201


def test_project_status_on_hold(client):
    login(client, "manager@example.com")
    created = client.post(
        "/api/projects",
        json={
            "name": "Hold Me",
            "client_name": "Client",
            "location": "Livingstone",
            "budget": 1000,
            "status": "Active",
        },
    )
    project_id = created.get_json()["project"]["id"]
    updated = client.put(
        f"/api/projects/{project_id}",
        json={
            "name": "Hold Me",
            "client_name": "Client",
            "location": "Livingstone",
            "budget": 1000,
            "status": "On Hold",
        },
    )
    assert updated.status_code == 200
    assert updated.get_json()["project"]["status"] == "On Hold"


def test_seed_demo_scenario_creates_walkthrough_project(app):
    from app.models import Project

    with app.app_context():
        first = seed_demo_scenario()
        assert first is not None and first["created"] is True
        second = seed_demo_scenario()
        assert second["created"] is False
        project = db.session.get(Project, first["project_id"])
        assert project is not None
        assert project.name == "Demo Civic Block"
        assert len(project.tasks) >= 2
        assert len(project.budget_lines) == 5
