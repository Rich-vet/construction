"""Shared role name constants."""

from __future__ import annotations

ADMINISTRATOR = "Administrator"
PROJECT_MANAGER = "Project Manager"
SITE_ENGINEER = "Site Engineer"
CONTRACTOR_WORKER = "Contractor/Worker"

ALL_ROLES = (
    ADMINISTRATOR,
    PROJECT_MANAGER,
    SITE_ENGINEER,
    CONTRACTOR_WORKER,
)

ROLE_DESCRIPTIONS = {
    ADMINISTRATOR: "Full system administration and monitoring",
    PROJECT_MANAGER: "Project, budget, procurement, and reporting oversight",
    SITE_ENGINEER: "Site operations, attendance, materials, and progress",
    CONTRACTOR_WORKER: "Assigned tasks, evidence uploads, and own attendance",
}
