"""Expand seed with a demonstrable sample project and related records."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.extensions import db
from app.models import (
    BudgetLine,
    Expense,
    Milestone,
    Project,
    ProjectMember,
    Task,
    User,
)
from app.services.activity_service import log_activity
from app.services.notification_service import notify_user
from app.services.project_service import ensure_demo_materials
from app.services.site_service import ensure_demo_equipment


def seed_demo_scenario() -> dict | None:
    """Create one Active demo project with team, tasks, budget, and expense.

    Idempotent: skips when a project named \"Demo Civic Block\" already exists.
    """
    existing = db.session.scalar(select(Project).where(Project.name == "Demo Civic Block"))
    if existing is not None:
        return {"project_id": existing.id, "created": False}

    manager = db.session.scalar(select(User).where(User.email == "manager@example.com"))
    engineer = db.session.scalar(select(User).where(User.email == "engineer@example.com"))
    worker = db.session.scalar(select(User).where(User.email == "worker@example.com"))
    if manager is None or engineer is None or worker is None:
        return None

    ensure_demo_materials()
    ensure_demo_equipment()

    today = date.today()
    project = Project(
        name="Demo Civic Block",
        client_name="Lusaka City Council",
        client_phone="+260211111111",
        client_email="works@example.com",
        location="Lusaka CBD",
        description="Seeded demonstration project for CCMS walkthroughs.",
        start_date=today - timedelta(days=14),
        expected_completion=today + timedelta(days=90),
        budget=Decimal("250000.00"),
        progress=35.0,
        status="Active",
        project_manager_id=manager.id,
        site_engineer_id=engineer.id,
        created_by_id=manager.id,
    )
    db.session.add(project)
    db.session.flush()

    db.session.add(
        ProjectMember(
            project_id=project.id,
            user_id=worker.id,
            member_role="Contractor/Worker",
        )
    )
    db.session.add(
        ProjectMember(
            project_id=project.id,
            user_id=engineer.id,
            member_role="Site Engineer",
        )
    )

    foundation = Task(
        project_id=project.id,
        name="Complete foundation pour",
        description="Finish slab and curing checks.",
        status="Completed",
        priority="High",
        assigned_user_id=worker.id,
        created_by_id=manager.id,
        due_date=today - timedelta(days=3),
    )
    framing = Task(
        project_id=project.id,
        name="Erect structural framing",
        description="Columns and beams for ground floor.",
        status="In Progress",
        priority="Urgent",
        assigned_user_id=worker.id,
        created_by_id=manager.id,
        due_date=today + timedelta(days=10),
    )
    db.session.add_all([foundation, framing])

    db.session.add(
        Milestone(
            project_id=project.id,
            name="Foundation complete",
            notes="Slab accepted by site engineer.",
            target_date=today - timedelta(days=2),
            is_completed=True,
            completed_at=today - timedelta(days=2),
        )
    )
    db.session.add(
        Milestone(
            project_id=project.id,
            name="Structure topped out",
            notes="Frame complete to roof level.",
            target_date=today + timedelta(days=45),
            is_completed=False,
        )
    )

    for category, amount in (
        ("Materials", Decimal("90000.00")),
        ("Labour", Decimal("80000.00")),
        ("Equipment", Decimal("40000.00")),
        ("Transport", Decimal("20000.00")),
        ("Other", Decimal("20000.00")),
    ):
        db.session.add(BudgetLine(project_id=project.id, category=category, amount=amount))

    db.session.add(
        Expense(
            project_id=project.id,
            category="Materials",
            description="Initial cement and steel purchase",
            amount=Decimal("18500.00"),
            expense_date=today - timedelta(days=7),
            status="Approved",
            recorded_by_id=manager.id,
        )
    )
    db.session.add(
        Expense(
            project_id=project.id,
            category="Labour",
            description="Week 1 site crew wages",
            amount=Decimal("12000.00"),
            expense_date=today - timedelta(days=5),
            status="Approved",
            recorded_by_id=manager.id,
        )
    )

    db.session.flush()
    log_activity(
        actor=manager,
        action='Seeded demo project "Demo Civic Block"',
        entity_type="project",
        entity_id=project.id,
        details=f"project_id={project.id}",
    )
    notify_user(
        user_id=engineer.id,
        title="Assigned to Demo Civic Block",
        message="You are the site engineer on the seeded demo project.",
        link=f"/projects/{project.id}",
    )
    notify_user(
        user_id=worker.id,
        title="Tasks assigned on Demo Civic Block",
        message="You have demo tasks ready on the sample project.",
        link="/my-tasks",
    )
    db.session.commit()
    return {"project_id": project.id, "created": True}
