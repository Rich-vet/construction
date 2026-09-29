"""Role-based navigation permissions for the SPA sidebar.

Only include keys that map to implemented frontend routes.
Unimplemented modules must not appear (even disabled) in the sidebar.
"""

from __future__ import annotations

from app.utils.roles import (
    ADMINISTRATOR,
    CONTRACTOR_WORKER,
    PROJECT_MANAGER,
    SITE_ENGINEER,
)

# Keys match frontend navigation item ids (implemented routes only).
ROLE_NAV: dict[str, set[str]] = {
    ADMINISTRATOR: {
        "dashboard",
        "users",
        "employees",
        "contractors",
        "projects",
        "milestones",
        "budgets",
        "expenses",
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
        "milestones",
        "budgets",
        "expenses",
        "attendance",
        "materials",
        "equipment",
        "material_requests",
        "quotations",
        "purchase_orders",
        "deliveries",
        "site_diary",
        "documents",
        "reports",
        "notifications",
        "activity_log",
    },
    SITE_ENGINEER: {
        "dashboard",
        "projects",
        "attendance",
        "materials",
        "equipment",
        "material_requests",
        "site_diary",
        "documents",
        "notifications",
        "activity_log",
    },
    CONTRACTOR_WORKER: {
        "dashboard",
        "tasks",
        "attendance",
        "notifications",
    },
}


def navigation_for_role(role_name: str) -> list[str]:
    """Return allowed navigation keys for a role."""
    return sorted(ROLE_NAV.get(role_name, set()))
