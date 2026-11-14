"""Contextual workflow authorization (SoD + state), beyond role names."""

from __future__ import annotations

from app.models import BudgetLine, Expense, MaterialRequest, Project, Task, User
from app.utils.project_access import can_manage_project, can_operate_site

# Material request review outcomes (Fulfilled is set by delivery, not review).
MR_REVIEW_STATUSES = frozenset({"Approved", "Rejected"})
MR_REVIEWABLE_FROM = frozenset({"Pending"})

# Task lifecycle (legacy "Completed" treated as Verified).
TASK_WORKER_STATUSES = ("Pending", "In Progress", "Ready for Review", "Rework Required")
TASK_VERIFY_FROM = frozenset({"Ready for Review"})
TASK_VERIFIED = "Verified"
TASK_LEGACY_DONE = "Completed"
TASK_OPEN = frozenset({"Pending", "In Progress", "Rework Required"})


def normalize_task_status(status: str | None) -> str:
    """Map legacy Completed → Verified for comparisons."""
    if status == TASK_LEGACY_DONE:
        return TASK_VERIFIED
    return status or "Pending"


def can_approve_material_request(user: User, req: MaterialRequest) -> bool:
    """PM/Admin may approve/reject Pending requests they did not create."""
    if req is None or req.project is None:
        return False
    if req.status not in MR_REVIEWABLE_FROM:
        return False
    if req.requested_by_id == user.id:
        return False
    return can_manage_project(user, req.project)


def assert_can_approve_material_request(user: User, req: MaterialRequest) -> None:
    from app.utils.project_access import ProjectAccessError

    if req.status not in MR_REVIEWABLE_FROM:
        raise ProjectAccessError(
            f"This request is already {req.status.lower()} and cannot be reviewed again.",
            status_code=400,
        )
    if req.requested_by_id == user.id:
        raise ProjectAccessError(
            "You cannot approve or reject a material request you created.",
            status_code=403,
        )
    if not can_manage_project(user, req.project):
        raise ProjectAccessError("You do not have authority to review this material request.")


def can_verify_task(user: User, task: Task) -> bool:
    """Site engineer (or elevated site operator) verifies Ready for Review tasks."""
    if task is None or task.project is None:
        return False
    if task.assigned_user_id and task.assigned_user_id == user.id:
        return False
    status = normalize_task_status(task.status)
    if status not in TASK_VERIFY_FROM:
        return False
    return can_operate_site(user, task.project)


def assert_can_verify_task(user: User, task: Task) -> None:
    from app.utils.project_access import ProjectAccessError

    status = normalize_task_status(task.status)
    if task.assigned_user_id and task.assigned_user_id == user.id:
        raise ProjectAccessError("You cannot approve a task assigned to you.", status_code=403)
    if status not in TASK_VERIFY_FROM:
        raise ProjectAccessError(
            "Only tasks that are Ready for Review can be verified.",
            status_code=400,
        )
    if not can_operate_site(user, task.project):
        raise ProjectAccessError("You can only verify tasks on projects you operate.")


def worker_allowed_statuses_for(task: Task) -> list[str]:
    """Statuses a worker may set from the current state. Approval is never included."""
    status = normalize_task_status(task.status)
    if status in {TASK_VERIFIED, "Cancelled", "Ready for Review"}:
        return []
    if status in {"Pending", "Rework Required"}:
        return ["In Progress"]
    if status == "In Progress":
        return ["In Progress", "Ready for Review"]
    return []


def can_approve_expense(user: User, expense: Expense) -> bool:
    if expense is None or expense.project is None:
        return False
    if (expense.status or "Pending") != "Pending":
        return False
    if expense.recorded_by_id == user.id:
        return False
    return can_manage_project(user, expense.project)


def assert_can_approve_expense(user: User, expense: Expense) -> None:
    from app.utils.project_access import ProjectAccessError

    if (expense.status or "Pending") != "Pending":
        raise ProjectAccessError(
            f"This expense is already {str(expense.status).lower()} and cannot be reviewed again.",
            status_code=400,
        )
    if expense.recorded_by_id == user.id:
        raise ProjectAccessError(
            "You cannot approve or reject an expense you recorded.",
            status_code=403,
        )
    if not can_manage_project(user, expense.project):
        raise ProjectAccessError("You do not have authority to review this expense.")


def can_approve_budget_revision(user: User, line: BudgetLine) -> bool:
    if line is None or line.project is None:
        return False
    if line.pending_amount is None:
        return False
    if line.pending_by_id == user.id:
        return False
    return can_manage_project(user, line.project)


def assert_can_approve_budget_revision(user: User, line: BudgetLine) -> None:
    from app.utils.project_access import ProjectAccessError

    if line.pending_amount is None:
        raise ProjectAccessError("There is no pending budget revision to approve.", status_code=400)
    if line.pending_by_id == user.id:
        raise ProjectAccessError(
            "You cannot approve a budget revision you proposed.",
            status_code=403,
        )
    if not can_manage_project(user, line.project):
        raise ProjectAccessError("You do not have authority to approve this budget revision.")
