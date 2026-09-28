"""Role-based navigation permissions for the SPA sidebar."""

from __future__ import annotations

from app.utils.roles import (
    ADMINISTRATOR,
    CONTRACTOR_WORKER,
    PROJECT_MANAGER,
    SITE_ENGINEER,
)

# Keys match frontend navigation item ids.
ROLE_NAV: dict[str, set[str]] = {
    ADMINISTRATOR: {
        "dashboard",
        "users",
        "company",
        "projects",
        "employees",
        "contractors",
        "materials",
        "equipment",
        "material_requests",
        "documents",
        "reports",
        "notifications",
        "activity_log",
        "settings",
    },
    PROJECT_MANAGER: {
        "dashboard",
        "projects",
        "tasks",
        "milestones",
        "employees",
        "contractors",
        "attendance",
        "materials",
        "equipment",
        "budgets",
        "expenses",
        "material_requests",
        "quotations",
        "purchase_orders",
        "deliveries",
        "progress_updates",
        "site_reports",
        "documents",
        "reports",
        "notifications",
        "activity_log",
    },
    SITE_ENGINEER: {
        "dashboard",
        "projects",
        "tasks",
        "milestones",
        "employees",
        "contractors",
        "attendance",
        "materials",
        "equipment",
        "material_requests",
        "progress_updates",
        "site_reports",
        "documents",
        "notifications",
        "activity_log",
    },
    CONTRACTOR_WORKER: {
        "dashboard",
        "tasks",
        "attendance",
        "progress",
        "notifications",
    },
}


def navigation_for_role(role_name: str) -> list[str]:
    """Return allowed navigation keys for a role."""
    return sorted(ROLE_NAV.get(role_name, set()))
