"""Database seed helpers for development demo accounts."""

from __future__ import annotations

from sqlalchemy import func, select

from app.extensions import db
from app.models import Role, User
from app.utils.roles import ALL_ROLES, ROLE_DESCRIPTIONS

# Documented development passwords — change before any real deployment.
DEMO_PASSWORD = "Password123!"

DEMO_USERS = (
    {
        "full_name": "System Administrator",
        "email": "admin@example.com",
        "phone": "+260000000001",
        "role": "Administrator",
    },
    {
        "full_name": "Project Manager",
        "email": "manager@example.com",
        "phone": "+260000000002",
        "role": "Project Manager",
    },
    {
        "full_name": "Site Engineer",
        "email": "engineer@example.com",
        "phone": "+260000000003",
        "role": "Site Engineer",
    },
    {
        "full_name": "Contractor Worker",
        "email": "worker@example.com",
        "phone": "+260000000004",
        "role": "Contractor/Worker",
    },
)


def seed_roles() -> None:
    for name in ALL_ROLES:
        existing = db.session.scalar(select(Role).where(Role.name == name))
        if existing is None:
            db.session.add(Role(name=name, description=ROLE_DESCRIPTIONS.get(name)))
    db.session.commit()


def seed_demo_users() -> None:
    seed_roles()
    for item in DEMO_USERS:
        role = db.session.scalar(select(Role).where(Role.name == item["role"]))
        if role is None:
            continue
        user = db.session.scalar(select(User).where(User.email == item["email"]))
        if user is None:
            user = User(
                full_name=item["full_name"],
                email=item["email"],
                phone=item["phone"],
                role_id=role.id,
                is_active=True,
            )
            user.set_password(DEMO_PASSWORD)
            db.session.add(user)
        else:
            user.full_name = item["full_name"]
            user.phone = item["phone"]
            user.role_id = role.id
            user.is_active = True
            # Do not overwrite password on re-seed if user already exists.
    db.session.commit()


def seed_company_profile() -> None:
    from flask import current_app

    from app.models import CompanyProfile

    existing = db.session.scalar(select(CompanyProfile).order_by(CompanyProfile.id).limit(1))
    if existing is None:
        db.session.add(
            CompanyProfile(
                name=current_app.config.get("COMPANY_DISPLAY_NAME", "CCMS"),
                description="Demo construction company profile for CCMS.",
                phone="+260211000000",
                email="info@example.com",
                address="Lusaka, Zambia",
                registration_info="PACRA DEMO-0001",
            )
        )
        db.session.commit()


def seed_people_registry() -> None:
    """Sample employees/contractors so Admin dashboard counts are meaningful."""
    from app.models import Contractor, Employee

    if db.session.scalar(select(func.count()).select_from(Employee)) == 0:
        db.session.add_all(
            [
                Employee(
                    full_name="Chanda Phiri",
                    employee_code="EMP-001",
                    phone="+260977100001",
                    email="chanda.phiri@example.com",
                    position="Quantity Surveyor",
                    skills="BOQ, costing",
                    status="Active",
                ),
                Employee(
                    full_name="Mwansa Banda",
                    employee_code="EMP-002",
                    phone="+260977100002",
                    email="mwansa.banda@example.com",
                    position="Safety Officer",
                    skills="HSE, inductions",
                    status="Active",
                ),
                Employee(
                    full_name="Thandiwe Zulu",
                    employee_code="EMP-003",
                    phone="+260977100003",
                    position="Store Keeper",
                    skills="inventory",
                    status="On Leave",
                ),
            ]
        )

    if db.session.scalar(select(func.count()).select_from(Contractor)) == 0:
        worker = db.session.scalar(select(User).where(User.email == "worker@example.com"))
        db.session.add_all(
            [
                Contractor(
                    name="Copperbelt Labour Co-op",
                    specialty="Formwork & concrete",
                    phone="+260966200001",
                    email="labour@example.com",
                    status="Active",
                    user_id=worker.id if worker else None,
                ),
                Contractor(
                    name="Ndola Steel Fixers",
                    specialty="Rebar",
                    phone="+260966200002",
                    status="Active",
                ),
            ]
        )
    db.session.commit()


def run_seed(*, with_demo_scenario: bool = True) -> dict:
    seed_demo_users()
    seed_company_profile()
    seed_people_registry()
    from app.services.project_service import ensure_demo_materials
    from app.services.site_service import ensure_demo_equipment

    ensure_demo_materials()
    ensure_demo_equipment()

    scenario = None
    if with_demo_scenario:
        from app.seed_demo import seed_demo_scenario

        scenario = seed_demo_scenario()

    return {
        "roles": list(ALL_ROLES),
        "users": [u["email"] for u in DEMO_USERS],
        "password": DEMO_PASSWORD,
        "demo_project": scenario,
    }
