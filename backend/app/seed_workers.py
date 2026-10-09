"""Idempotent demo seed for fictional Zambian contractor/worker accounts.

Development and demonstration only. Existing accounts are never updated.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.extensions import db
from app.models import Project, ProjectMember, Role, Task, User
from app.services.auth_service import validate_email, validate_password_strength
from app.utils.roles import CONTRACTOR_WORKER

# Change this constant to rotate the shared demo password. Re-seed does not
# reset passwords on accounts that already exist.
WORKER_DEMO_PASSWORD = "CCMSWorker@2026"

WORKER_NAMES = (
    "Chanda Mwila",
    "Brian Phiri",
    "Joseph Banda",
    "Kelvin Mulenga",
    "Patrick Zulu",
    "Emmanuel Bwalya",
    "Moses Chileshe",
    "Daniel Tembo",
    "Gift Mumba",
    "Andrew Lungu",
    "Francis Sakala",
    "Peter Nkole",
    "James Chibwe",
    "Collins Kapambwe",
    "Michael Chomba",
    "Victor Sampa",
    "Richard Musonda",
    "Charles Kangwa",
    "Christopher Hamusonde",
    "David Chisanga",
    "Isaac Mwape",
    "Samuel Kabwe",
    "George Chitundu",
    "Martin Kalaba",
    "Edward Chama",
    "Simon Mweemba",
    "Benjamin Sichone",
    "Leonard Phiri",
    "Anthony Mutale",
    "Stephen Nyambe",
    "Jonathan Chulu",
    "Evans Chisala",
    "Maxwell Chibesa",
    "Dominic Lishomwa",
    "Wallace Chomba",
    "Lawrence Mwewa",
    "Kennedy Sinkala",
    "Austin Zimba",
    "Wesley Chanda",
    "Timothy Mwelwa",
)

# Three demo sites so the crew is not all parked on one project.
# Each tuple is (project name, client, location, task name, priority).
DEMO_SITES = (
    (
        "Demo Civic Block",
        "Lusaka City Council",
        "Lusaka CBD",
        (
            ("Demo crew: set out foundation grid", "High"),
            ("Demo crew: fix reinforcement", "High"),
            ("Demo crew: mix and place concrete", "Urgent"),
        ),
    ),
    (
        "Demo Kitwe Housing",
        "Kitwe Municipal Council",
        "Kitwe",
        (
            ("Demo crew: erect scaffold bay", "Medium"),
            ("Demo crew: lay blockwork", "High"),
            ("Demo crew: install door frames", "Medium"),
        ),
    ),
    (
        "Demo Ndola Warehouse",
        "Ndola Trade Yard",
        "Ndola",
        (
            ("Demo crew: first-fix plumbing", "Medium"),
            ("Demo crew: site housekeeping", "Low"),
            ("Demo crew: place floor screed", "High"),
        ),
    ),
)


def worker_email(index: int) -> str:
    """1-based index → worker01@ccms-demo.local."""
    return f"worker{index:02d}@ccms-demo.local"


def worker_phone(index: int) -> str:
    """Clearly fictional sequential demo numbers. Not real contacts."""
    return f"+26097001{index:04d}"


def seed_zambian_workers() -> dict:
    """Create missing Contractor/Worker demo accounts and attach a demo crew.

    Returns counts only. Does not include password hashes.
    """
    password = validate_password_strength(WORKER_DEMO_PASSWORD)
    role = db.session.scalar(select(Role).where(Role.name == CONTRACTOR_WORKER))
    if role is None:
        return {"created": 0, "skipped": 0, "failed": len(WORKER_NAMES), "crew_members": 0, "crew_tasks": 0}

    created = 0
    skipped = 0
    failed = 0
    accounts: list[User] = []

    for index, full_name in enumerate(WORKER_NAMES, start=1):
        try:
            email = validate_email(worker_email(index))
        except Exception:
            failed += 1
            continue
        existing = db.session.scalar(select(User).where(User.email == email))
        if existing is not None:
            skipped += 1
            accounts.append(existing)
            continue
        try:
            with db.session.begin_nested():
                user = User(
                    full_name=full_name,
                    email=email,
                    phone=worker_phone(index),
                    role_id=role.id,
                    is_active=True,
                )
                user.set_password(password)
                db.session.add(user)
                db.session.flush()
            created += 1
            accounts.append(user)
        except Exception:
            failed += 1

    crew_members, crew_tasks = _attach_demo_crew(accounts)
    db.session.commit()
    return {
        "created": created,
        "skipped": skipped,
        "failed": failed,
        "crew_members": crew_members,
        "crew_tasks": crew_tasks,
    }


def _attach_demo_crew(accounts: list[User]) -> tuple[int, int]:
    """Spread demo workers across the sample sites and assign distinct tasks.

    Assignment lists already include every active user. Project membership is what
    makes a worker selectable for attendance on that site.
    """
    if not accounts:
        return 0, 0
    anchor = db.session.scalar(select(Project).where(Project.name == "Demo Civic Block"))
    if anchor is None:
        return 0, 0
    manager = db.session.scalar(select(User).where(User.email == "manager@example.com"))
    engineer = db.session.scalar(select(User).where(User.email == "engineer@example.com"))
    if manager is None:
        return 0, 0

    groups = _split_crews(accounts, len(DEMO_SITES))
    added_members = 0
    added_tasks = 0
    today = date.today()
    for (name, client, location, tasks), crew in zip(DEMO_SITES, groups, strict=True):
        project = _ensure_demo_project(
            name=name,
            client=client,
            location=location,
            manager=manager,
            engineer=engineer,
            today=today,
        )
        for user in crew:
            already = db.session.scalar(
                select(ProjectMember).where(
                    ProjectMember.project_id == project.id,
                    ProjectMember.user_id == user.id,
                )
            )
            if already is not None:
                continue
            db.session.add(
                ProjectMember(
                    project_id=project.id,
                    user_id=user.id,
                    member_role="Contractor/Worker",
                )
            )
            added_members += 1
        for offset, (task_name, priority) in enumerate(tasks):
            if offset >= len(crew):
                break
            exists = db.session.scalar(
                select(Task).where(Task.project_id == project.id, Task.name == task_name)
            )
            if exists is not None:
                continue
            db.session.add(
                Task(
                    project_id=project.id,
                    name=task_name,
                    description="Seeded demonstration task for a fictional crew member.",
                    status="Pending",
                    priority=priority,
                    assigned_user_id=crew[offset].id,
                    created_by_id=manager.id,
                    start_date=today,
                    due_date=today + timedelta(days=14 + offset),
                )
            )
            added_tasks += 1
    return added_members, added_tasks


def _split_crews(accounts: list[User], parts: int) -> list[list[User]]:
    size = len(accounts) // parts
    groups: list[list[User]] = []
    start = 0
    for index in range(parts):
        end = start + size if index < parts - 1 else len(accounts)
        groups.append(accounts[start:end])
        start = end
    return groups


def _ensure_demo_project(
    *,
    name: str,
    client: str,
    location: str,
    manager: User,
    engineer: User | None,
    today: date,
) -> Project:
    project = db.session.scalar(select(Project).where(Project.name == name))
    if project is not None:
        return project
    project = Project(
        name=name,
        client_name=client,
        location=location,
        description="Seeded demonstration project for fictional CCMS worker accounts.",
        start_date=today - timedelta(days=7),
        expected_completion=today + timedelta(days=120),
        budget=Decimal("150000.00"),
        progress=10.0,
        status="Active",
        project_manager_id=manager.id,
        site_engineer_id=engineer.id if engineer else None,
        created_by_id=manager.id,
    )
    db.session.add(project)
    db.session.flush()
    if engineer is not None:
        db.session.add(
            ProjectMember(
                project_id=project.id,
                user_id=engineer.id,
                member_role="Site Engineer",
            )
        )
    return project
