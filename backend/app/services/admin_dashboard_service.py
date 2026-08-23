"""Administrator dashboard aggregations from live database data."""

from __future__ import annotations

from sqlalchemy import func, select

from app.extensions import db
from app.models import (
    ActivityLog,
    Contractor,
    Employee,
    Material,
    Notification,
    Project,
    User,
)


def admin_dashboard(actor_id: int) -> dict:
    total_users = db.session.scalar(select(func.count()).select_from(User)) or 0
    active_users = (
        db.session.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True)))
        or 0
    )
    total_projects = db.session.scalar(select(func.count()).select_from(Project)) or 0
    active_projects = (
        db.session.scalar(
            select(func.count()).select_from(Project).where(Project.status == "Active")
        )
        or 0
    )
    completed_projects = (
        db.session.scalar(
            select(func.count()).select_from(Project).where(Project.status == "Completed")
        )
        or 0
    )
    employees = db.session.scalar(select(func.count()).select_from(Employee)) or 0
    contractors = db.session.scalar(select(func.count()).select_from(Contractor)) or 0
    low_stock = (
        db.session.scalar(
            select(func.count())
            .select_from(Material)
            .where(Material.quantity <= Material.minimum_stock)
        )
        or 0
    )

    recent_activity = db.session.scalars(
        select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(8)
    ).all()
    recent_projects = db.session.scalars(
        select(Project).order_by(Project.created_at.desc()).limit(5)
    ).all()
    notifications = db.session.scalars(
        select(Notification)
        .where(Notification.user_id == actor_id)
        .order_by(Notification.created_at.desc())
        .limit(8)
    ).all()

    return {
        "cards": {
            "total_users": total_users,
            "active_users": active_users,
            "total_projects": total_projects,
            "active_projects": active_projects,
            "completed_projects": completed_projects,
            "employees": employees,
            "contractors": contractors,
            "low_stock_materials": low_stock,
        },
        "recent_activity": [a.to_dict() for a in recent_activity],
        "recent_projects": [p.to_summary_dict() for p in recent_projects],
        "notifications": [n.to_dict() for n in notifications],
    }
