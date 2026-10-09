"""Project Manager domain services."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import (
    BudgetLine,
    Delivery,
    Expense,
    Material,
    MaterialRequest,
    Milestone,
    ProgressUpdate,
    Project,
    ProjectMember,
    PurchaseOrder,
    Quotation,
    Role,
    SiteReport,
    Supplier,
    Task,
    TaskComment,
    User,
)
from app.models.project import (
    BUDGET_CATEGORIES,
    PO_STATUSES,
    PROJECT_STATUSES,
    REQUEST_STATUSES,
    TASK_PRIORITIES,
    TASK_STATUSES,
)
from app.models.project import PROJECT_STATUSES
from app.services.activity_service import log_activity
from app.services.notification_service import (
    notify_material_request_reviewed,
    notify_material_request_submitted,
    notify_user,
)
from app.utils.project_access import (
    ProjectAccessError,
    assert_can_manage,
    assert_can_operate_site,
    assert_project_editable,
    can_manage_project,
    can_operate_site,
    get_accessible_project,
    projects_query_for,
)
from app.utils.roles import ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER
from app.utils.workflow import (
    MR_REVIEW_STATUSES,
    assert_can_approve_budget_revision,
    assert_can_approve_expense,
    assert_can_approve_material_request,
    assert_can_verify_task,
    can_approve_budget_revision,
    can_approve_expense,
    can_approve_material_request,
    can_verify_task,
    normalize_task_status,
)


class ProjectServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError as exc:
        raise ProjectServiceError("Invalid date format. Use YYYY-MM-DD.") from exc


def _as_money(value) -> Decimal:
    try:
        amount = Decimal(str(value))
    except Exception as exc:
        raise ProjectServiceError("Enter a valid amount.") from exc
    if amount < 0:
        raise ProjectServiceError("Amount cannot be negative.")
    return amount


def list_projects(user: User, *, search: str | None = None, status: str | None = None) -> list[dict]:
    stmt = projects_query_for(user).options(
        joinedload(Project.project_manager),
        joinedload(Project.site_engineer),
    )
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Project.name.ilike(term),
                Project.client_name.ilike(term),
                Project.location.ilike(term),
            )
        )
    if status:
        stmt = stmt.where(Project.status == status)
    projects = db.session.scalars(stmt.order_by(Project.created_at.desc())).unique().all()
    return [p.to_summary_dict() for p in projects]


def create_project(actor: User, data: dict) -> Project:
    if actor.role_name not in {ADMINISTRATOR, PROJECT_MANAGER}:
        raise ProjectServiceError("Only Project Managers can create projects.", status_code=403)

    name = (data.get("name") or "").strip()
    client_name = (data.get("client_name") or "").strip()
    location = (data.get("location") or "").strip()
    if not name or not client_name or not location:
        raise ProjectServiceError("Project name, client name, and location are required.")

    status = (data.get("status") or "Planned").strip()
    if status not in PROJECT_STATUSES:
        raise ProjectServiceError("Invalid project status.")

    start_date = _parse_date(data.get("start_date"))
    expected = _parse_date(data.get("expected_completion"))
    if start_date and expected and start_date > expected:
        raise ProjectServiceError("Start date must be on or before expected completion.")

    manager_id = data.get("project_manager_id") or actor.id
    if actor.role_name == PROJECT_MANAGER:
        manager_id = actor.id
    manager = db.session.get(User, int(manager_id))
    if manager is None or manager.role_name not in {PROJECT_MANAGER, ADMINISTRATOR}:
        raise ProjectServiceError("Select a valid project manager.")

    engineer_id = data.get("site_engineer_id")
    engineer = None
    if engineer_id:
        engineer = db.session.get(User, int(engineer_id))
        if engineer is None or engineer.role_name != SITE_ENGINEER:
            raise ProjectServiceError("Select a valid site engineer.")

    project = Project(
        name=name,
        client_name=client_name,
        client_phone=(data.get("client_phone") or "").strip() or None,
        client_email=(data.get("client_email") or "").strip() or None,
        location=location,
        description=(data.get("description") or "").strip() or None,
        start_date=start_date,
        expected_completion=expected,
        budget=_as_money(data.get("budget") or 0),
        status=status,
        project_manager_id=manager.id,
        site_engineer_id=engineer.id if engineer else None,
        created_by_id=actor.id,
        progress=float(data.get("progress") or 0),
    )
    db.session.add(project)
    db.session.flush()

    # Default budget lines
    total = Decimal(project.budget or 0)
    if total > 0:
        share = (total / Decimal(len(BUDGET_CATEGORIES))).quantize(Decimal("0.01"))
        for category in BUDGET_CATEGORIES:
            db.session.add(BudgetLine(project_id=project.id, category=category, amount=share))

    db.session.add(
        ProjectMember(project_id=project.id, user_id=manager.id, member_role="Project Manager")
    )
    if engineer:
        db.session.add(
            ProjectMember(project_id=project.id, user_id=engineer.id, member_role="Site Engineer")
        )

    log_activity(
        actor=actor,
        action=f'Created project "{project.name}"',
        entity_type="project",
        entity_id=project.id,
        details=project.location,
    )
    notify_user(
        user_id=manager.id,
        title="Project assigned",
        message=f'You are the project manager for "{project.name}".',
        link=f"/projects/{project.id}",
    )
    if engineer:
        notify_user(
            user_id=engineer.id,
            title="Site engineer assigned",
            message=f'You are the site engineer for "{project.name}".',
            link=f"/projects/{project.id}",
        )
    db.session.commit()
    return project


def update_project(actor: User, project_id: int, data: dict) -> Project:
    project = get_accessible_project(actor, project_id)
    assert_can_manage(actor, project)

    new_status = (data.get("status") or project.status).strip()
    if new_status not in PROJECT_STATUSES:
        raise ProjectServiceError("Invalid project status.")

    # Completed projects protected unless reopening
    if project.status == "Completed" and new_status == "Completed":
        raise ProjectServiceError(
            "Completed projects are protected. Change status to reopen before editing."
        )
    if project.status == "Completed" and new_status != "Completed":
        # reopen allowed for manager/admin
        pass
    elif project.status != "Completed":
        assert_project_editable(project)

    name = (data.get("name") or "").strip()
    client_name = (data.get("client_name") or "").strip()
    location = (data.get("location") or "").strip()
    if not name or not client_name or not location:
        raise ProjectServiceError("Project name, client name, and location are required.")

    start_date = _parse_date(data.get("start_date"))
    expected = _parse_date(data.get("expected_completion"))
    if start_date and expected and start_date > expected:
        raise ProjectServiceError("Start date must be on or before expected completion.")

    project.name = name
    project.client_name = client_name
    project.client_phone = (data.get("client_phone") or "").strip() or None
    project.client_email = (data.get("client_email") or "").strip() or None
    project.location = location
    project.description = (data.get("description") or "").strip() or None
    project.start_date = start_date
    project.expected_completion = expected
    project.budget = _as_money(data.get("budget") or project.budget or 0)
    project.status = new_status
    if "progress" in data:
        progress = float(data.get("progress") or 0)
        if progress < 0 or progress > 100:
            raise ProjectServiceError("Progress must be between 0 and 100.")
        project.progress = progress

    if actor.role_name == ADMINISTRATOR and data.get("project_manager_id"):
        manager = db.session.get(User, int(data["project_manager_id"]))
        if manager and manager.role_name in {PROJECT_MANAGER, ADMINISTRATOR}:
            project.project_manager_id = manager.id

    if "site_engineer_id" in data:
        engineer_id = data.get("site_engineer_id")
        if engineer_id:
            engineer = db.session.get(User, int(engineer_id))
            if engineer is None or engineer.role_name != SITE_ENGINEER:
                raise ProjectServiceError("Select a valid site engineer.")
            project.site_engineer_id = engineer.id
        else:
            project.site_engineer_id = None

    log_activity(
        actor=actor,
        action=f'Updated project "{project.name}"',
        entity_type="project",
        entity_id=project.id,
    )
    db.session.commit()
    return project


def project_workspace(actor: User, project_id: int) -> dict:
    project = get_accessible_project(actor, project_id)
    project = db.session.scalar(
        select(Project)
        .options(
            joinedload(Project.project_manager),
            joinedload(Project.site_engineer),
            joinedload(Project.members).joinedload(ProjectMember.user),
            joinedload(Project.tasks).joinedload(Task.assigned_user),
            joinedload(Project.milestones),
            joinedload(Project.budget_lines),
            joinedload(Project.expenses),
        )
        .where(Project.id == project_id)
    )
    assert project is not None

    actual = float(
        db.session.scalar(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.project_id == project.id,
                Expense.status == "Approved",
            )
        )
        or 0
    )
    budget_total = float(
        db.session.scalar(
            select(func.coalesce(func.sum(BudgetLine.amount), 0)).where(
                BudgetLine.project_id == project.id
            )
        )
        or project.budget
        or 0
    )

    budget_vs_actual = []
    for category in BUDGET_CATEGORIES:
        line = next((x for x in project.budget_lines if x.category == category), None)
        b = line.amount if line else 0
        a = sum(
            (
                x.amount
                for x in project.expenses
                if x.category == category and (x.status or "Pending") == "Approved"
            ),
            Decimal("0"),
        )
        budget_amt = float(b or 0)
        actual_amt = float(a or 0)
        variance = actual_amt - budget_amt
        row = {
            "category": category,
            "budget": budget_amt,
            "actual": actual_amt,
            "variance": variance,
            "status": "over" if variance > 0 else "under" if variance < 0 else "on_track",
            "pending_amount": float(line.pending_amount) if line and line.pending_amount is not None else None,
            "has_pending_revision": bool(line and line.pending_amount is not None),
            "can_approve_revision": can_approve_budget_revision(actor, line) if line else False,
            "budget_line_id": line.id if line else None,
        }
        budget_vs_actual.append(row)

    return {
        "project": project.to_dict(),
        "can_manage": can_manage_project(actor, project),
        "can_operate_site": can_operate_site(actor, project),
        "totals": {
            "budget": budget_total,
            "actual_expenditure": actual,
            "remaining": budget_total - actual,
        },
        "members": [m.to_dict() for m in project.members],
        "tasks": [
            {
                **t.to_dict(),
                "can_verify": can_verify_task(actor, t),
            }
            for t in project.tasks
        ],
        "milestones": [m.to_dict() for m in project.milestones],
        "budget_lines": [
            {
                **b.to_dict(),
                "can_approve_revision": can_approve_budget_revision(actor, b),
            }
            for b in project.budget_lines
        ],
        "expenses": [
            e.to_dict(can_approve=can_approve_expense(actor, e)) for e in project.expenses
        ],
        "budget_vs_actual": budget_vs_actual,
        "material_requests": [
            r.to_dict(can_approve=can_approve_material_request(actor, r))
            for r in db.session.scalars(
                select(MaterialRequest)
                .options(joinedload(MaterialRequest.material), joinedload(MaterialRequest.requested_by))
                .where(MaterialRequest.project_id == project.id)
                .order_by(MaterialRequest.created_at.desc())
            ).unique()
        ],
        "quotations": [
            q.to_dict()
            for q in db.session.scalars(
                select(Quotation)
                .options(joinedload(Quotation.supplier), joinedload(Quotation.material))
                .where(Quotation.project_id == project.id)
                .order_by(Quotation.created_at.desc())
            ).unique()
        ],
        "purchase_orders": [
            p.to_dict()
            for p in db.session.scalars(
                select(PurchaseOrder)
                .options(joinedload(PurchaseOrder.supplier), joinedload(PurchaseOrder.material))
                .where(PurchaseOrder.project_id == project.id)
                .order_by(PurchaseOrder.created_at.desc())
            ).unique()
        ],
        "deliveries": [
            d.to_dict()
            for d in db.session.scalars(
                select(Delivery)
                .join(PurchaseOrder)
                .options(joinedload(Delivery.purchase_order))
                .where(PurchaseOrder.project_id == project.id)
                .order_by(Delivery.created_at.desc())
            ).unique()
        ],
        "progress_updates": [
            p.to_dict()
            for p in db.session.scalars(
                select(ProgressUpdate)
                .where(ProgressUpdate.project_id == project.id)
                .order_by(ProgressUpdate.update_date.desc())
            )
        ],
        "site_reports": [
            s.to_dict()
            for s in db.session.scalars(
                select(SiteReport)
                .where(SiteReport.project_id == project.id)
                .order_by(SiteReport.report_date.desc())
            )
        ],
    }


def create_task(actor: User, data: dict) -> Task:
    project = get_accessible_project(actor, int(data.get("project_id")))
    assert_can_manage(actor, project)
    assert_project_editable(project)

    name = (data.get("name") or "").strip()
    if not name:
        raise ProjectServiceError("Task name is required.")
    priority = (data.get("priority") or "Medium").strip()
    if priority not in TASK_PRIORITIES:
        raise ProjectServiceError("Invalid priority.")
    start_date = _parse_date(data.get("start_date"))
    due_date = _parse_date(data.get("due_date"))
    if start_date and due_date and due_date < start_date:
        raise ProjectServiceError("Due date must be on or after start date.")

    assigned_id = data.get("assigned_user_id")
    if assigned_id:
        assigned = db.session.get(User, int(assigned_id))
        if assigned is None:
            raise ProjectServiceError("Assigned worker not found.")
    else:
        assigned = None

    task = Task(
        project_id=project.id,
        name=name,
        description=(data.get("description") or "").strip() or None,
        assigned_user_id=assigned.id if assigned else None,
        start_date=start_date,
        due_date=due_date,
        priority=priority,
        status="Pending",
        created_by_id=actor.id,
    )
    db.session.add(task)
    db.session.flush()
    log_activity(
        actor=actor,
        action=f'Created task "{task.name}"',
        entity_type="task",
        entity_id=task.id,
        details=project.name,
    )
    if assigned:
        notify_user(
            user_id=assigned.id,
            title="New task assigned",
            message=f'Task "{task.name}" was assigned on project {project.name}.',
            link=f"/tasks/{task.id}",
        )
    db.session.commit()
    return task


def update_task(actor: User, task_id: int, data: dict) -> Task:
    task = db.session.scalar(
        select(Task).options(joinedload(Task.project), joinedload(Task.assigned_user)).where(Task.id == task_id)
    )
    if task is None:
        raise ProjectServiceError("Task not found.", status_code=404)
    project = task.project
    if not can_manage_project(actor, project):
        # workers can update own task status only — handled in worker phase; for now PM/Admin
        raise ProjectAccessError("You cannot modify this task.")
    assert_project_editable(project)

    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            raise ProjectServiceError("Task name is required.")
        task.name = name
    if "description" in data:
        task.description = (data.get("description") or "").strip() or None
    if "priority" in data:
        priority = data["priority"]
        if priority not in TASK_PRIORITIES:
            raise ProjectServiceError("Invalid priority.")
        task.priority = priority
    if "status" in data:
        status = data["status"]
        if status == "Completed":
            status = "Verified"
        if status not in TASK_STATUSES and status != "Verified":
            raise ProjectServiceError("Invalid task status.")
        # PM may set planning statuses; prefer Verified over legacy Completed.
        allowed_pm = {
            "Pending",
            "In Progress",
            "Ready for Review",
            "Verified",
            "Cancelled",
        }
        if status not in allowed_pm:
            raise ProjectServiceError("Invalid task status.")
        task.status = status
    if "start_date" in data:
        task.start_date = _parse_date(data.get("start_date"))
    if "due_date" in data:
        task.due_date = _parse_date(data.get("due_date"))
    if task.start_date and task.due_date and task.due_date < task.start_date:
        raise ProjectServiceError("Due date must be on or after start date.")
    if "assigned_user_id" in data:
        assigned_id = data.get("assigned_user_id")
        task.assigned_user_id = int(assigned_id) if assigned_id else None

    log_activity(
        actor=actor,
        action=f'Updated task "{task.name}"',
        entity_type="task",
        entity_id=task.id,
    )
    db.session.commit()
    return task


def add_task_comment(actor: User, task_id: int, body: str) -> TaskComment:
    task = db.session.get(Task, task_id)
    if task is None:
        raise ProjectServiceError("Task not found.", status_code=404)
    get_accessible_project(actor, task.project_id)
    text = (body or "").strip()
    if not text:
        raise ProjectServiceError("Comment cannot be empty.")
    comment = TaskComment(task_id=task.id, user_id=actor.id, body=text)
    db.session.add(comment)
    db.session.commit()
    return comment


def create_milestone(actor: User, data: dict) -> Milestone:
    project = get_accessible_project(actor, int(data.get("project_id")))
    assert_can_manage(actor, project)
    assert_project_editable(project)
    name = (data.get("name") or "").strip()
    if not name:
        raise ProjectServiceError("Milestone name is required.")
    milestone = Milestone(
        project_id=project.id,
        name=name,
        target_date=_parse_date(data.get("target_date")),
        notes=(data.get("notes") or "").strip() or None,
    )
    db.session.add(milestone)
    db.session.flush()
    log_activity(
        actor=actor,
        action=f'Created milestone "{milestone.name}"',
        entity_type="milestone",
        entity_id=milestone.id,
        details=project.name,
    )
    db.session.commit()
    return milestone


def complete_milestone(actor: User, milestone_id: int) -> Milestone:
    milestone = db.session.get(Milestone, milestone_id)
    if milestone is None:
        raise ProjectServiceError("Milestone not found.", status_code=404)
    project = get_accessible_project(actor, milestone.project_id)
    assert_can_manage(actor, project)
    assert_project_editable(project)
    milestone.is_completed = True
    milestone.completed_at = date.today()
    log_activity(
        actor=actor,
        action=f'Completed milestone "{milestone.name}"',
        entity_type="milestone",
        entity_id=milestone.id,
    )
    db.session.commit()
    return milestone


def add_project_member(actor: User, project_id: int, user_id: int, member_role: str) -> ProjectMember:
    project = get_accessible_project(actor, project_id)
    assert_can_manage(actor, project)
    assert_project_editable(project)
    user = db.session.get(User, user_id)
    if user is None or not user.is_active:
        raise ProjectServiceError("Select a valid active user.")
    existing = db.session.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id, ProjectMember.user_id == user.id
        )
    )
    if existing:
        raise ProjectServiceError("User is already on this project team.")
    member = ProjectMember(
        project_id=project.id,
        user_id=user.id,
        member_role=(member_role or "Team Member").strip() or "Team Member",
    )
    db.session.add(member)
    log_activity(
        actor=actor,
        action=f"Added team member {user.full_name}",
        entity_type="project",
        entity_id=project.id,
    )
    notify_user(
        user_id=user.id,
        title="Added to project team",
        message=f'You were added to "{project.name}" as {member.member_role}.',
        link=f"/projects/{project.id}" if user.role_name != "Contractor/Worker" else "/projects",
    )
    db.session.commit()
    return member


def remove_project_member(actor: User, member_id: int) -> None:
    member = db.session.get(ProjectMember, member_id)
    if member is None:
        raise ProjectServiceError("Team member not found.", status_code=404)
    project = get_accessible_project(actor, member.project_id)
    assert_can_manage(actor, project)
    assert_project_editable(project)
    if member.user_id == project.project_manager_id:
        raise ProjectServiceError("Cannot remove the project manager from the team.")
    name = member.user.full_name if member.user else f"User #{member.user_id}"
    db.session.delete(member)
    log_activity(
        actor=actor,
        action=f"Removed team member {name}",
        entity_type="project",
        entity_id=project.id,
    )
    db.session.commit()


def upsert_budget_line(actor: User, project_id: int, category: str, amount) -> BudgetLine:
    """Set or propose a budget amount.

    First allocation for a category applies immediately. Later changes become a
    pending revision that another manager/admin must approve (SoD).
    """
    project = get_accessible_project(actor, project_id)
    assert_can_manage(actor, project)
    assert_project_editable(project)
    if category not in BUDGET_CATEGORIES:
        raise ProjectServiceError("Invalid budget category.")
    money = _as_money(amount)
    if money < 0:
        raise ProjectServiceError("Budget amount cannot be negative.")
    line = db.session.scalar(
        select(BudgetLine).where(BudgetLine.project_id == project.id, BudgetLine.category == category)
    )
    if line is None:
        line = BudgetLine(project_id=project.id, category=category, amount=money)
        db.session.add(line)
        action = f"Set {category} budget"
        details = str(money)
    elif Decimal(str(line.amount or 0)) == money and line.pending_amount is None:
        return line
    else:
        line.pending_amount = money
        line.pending_by_id = actor.id
        action = f"Proposed {category} budget revision"
        details = f"{line.amount} → {money} (pending)"
    log_activity(
        actor=actor,
        action=action,
        entity_type="project",
        entity_id=project.id,
        details=details,
    )
    db.session.commit()
    return line


def review_budget_revision(
    actor: User, project_id: int, category: str, decision: str
) -> BudgetLine:
    """Approve or reject a pending budget revision (SoD)."""
    project = get_accessible_project(actor, project_id)
    line = db.session.scalar(
        select(BudgetLine)
        .options(joinedload(BudgetLine.project))
        .where(BudgetLine.project_id == project.id, BudgetLine.category == category)
    )
    if line is None:
        raise ProjectServiceError("Budget line not found.", status_code=404)
    try:
        assert_can_approve_budget_revision(actor, line)
    except ProjectAccessError as exc:
        raise ProjectServiceError(exc.message, status_code=exc.status_code) from exc

    decision_n = (decision or "").strip().title()
    if decision_n not in {"Approved", "Rejected"}:
        raise ProjectServiceError("Decision must be Approved or Rejected.")

    previous = line.amount
    proposed = line.pending_amount
    if decision_n == "Approved":
        line.amount = proposed
        action = f"Approved {category} budget revision"
        details = f"{previous} → {proposed}"
    else:
        action = f"Rejected {category} budget revision"
        details = f"Kept {previous}; rejected {proposed}"
    line.pending_amount = None
    line.pending_by_id = None
    log_activity(
        actor=actor,
        action=action,
        entity_type="project",
        entity_id=project.id,
        details=details,
    )
    db.session.commit()
    return line


def create_expense(actor: User, data: dict) -> Expense:
    project = get_accessible_project(actor, int(data.get("project_id")))
    assert_can_manage(actor, project)
    assert_project_editable(project)
    category = (data.get("category") or "").strip()
    if category not in BUDGET_CATEGORIES:
        raise ProjectServiceError("Invalid expense category.")
    description = (data.get("description") or "").strip()
    if not description:
        raise ProjectServiceError("Expense description is required.")
    amount = _as_money(data.get("amount"))
    if amount <= 0:
        raise ProjectServiceError("Expense amount must be greater than zero.")
    expense_date = _parse_date(data.get("expense_date")) or date.today()
    expense = Expense(
        project_id=project.id,
        category=category,
        description=description,
        amount=amount,
        expense_date=expense_date,
        payee=(data.get("payee") or "").strip() or None,
        payment_method=(data.get("payment_method") or "").strip() or None,
        status="Pending",
        recorded_by_id=actor.id,
    )
    db.session.add(expense)
    log_activity(
        actor=actor,
        action=f"Submitted expense {amount} for approval",
        entity_type="expense",
        entity_id=None,
        details=f"{project.name}: {description}",
    )
    db.session.commit()
    return expense


def review_expense(actor: User, expense_id: int, status: str, notes: str | None = None) -> Expense:
    expense = db.session.scalar(
        select(Expense)
        .options(joinedload(Expense.project), joinedload(Expense.recorded_by))
        .where(Expense.id == expense_id)
    )
    if expense is None:
        raise ProjectServiceError("Expense not found.", status_code=404)
    try:
        assert_can_approve_expense(actor, expense)
    except ProjectAccessError as exc:
        raise ProjectServiceError(exc.message, status_code=exc.status_code) from exc

    decision = (status or "").strip().title()
    if decision not in {"Approved", "Rejected"}:
        raise ProjectServiceError("Review status must be Approved or Rejected.")

    previous = expense.status
    expense.status = decision
    expense.reviewed_by_id = actor.id
    expense.review_notes = (notes or "").strip() or None
    log_activity(
        actor=actor,
        action=f"{decision} expense",
        entity_type="expense",
        entity_id=expense.id,
        details=f"{previous} → {decision}; {expense.description}",
    )
    if expense.recorded_by_id:
        notify_user(
            user_id=expense.recorded_by_id,
            title=f"Expense {decision.lower()}",
            message=f"Your expense '{expense.description}' was {decision.lower()}.",
            link=f"/projects/{expense.project_id}?tab=expenses",
        )
    db.session.commit()
    return expense


def review_material_request(actor: User, request_id: int, status: str, notes: str | None = None) -> MaterialRequest:
    req = db.session.scalar(
        select(MaterialRequest)
        .options(joinedload(MaterialRequest.project), joinedload(MaterialRequest.material))
        .where(MaterialRequest.id == request_id)
    )
    if req is None:
        raise ProjectServiceError("Material request not found.", status_code=404)
    try:
        assert_can_approve_material_request(actor, req)
    except ProjectAccessError as exc:
        raise ProjectServiceError(exc.message, status_code=exc.status_code) from exc

    if status not in MR_REVIEW_STATUSES:
        raise ProjectServiceError("Review status must be Approved or Rejected.")

    previous = req.status
    req.status = status
    req.reviewed_by_id = actor.id
    req.review_notes = (notes or "").strip() or None
    log_activity(
        actor=actor,
        action=f"{status} material request",
        entity_type="material_request",
        entity_id=req.id,
        details=f"{previous} → {status}; {req.material.name if req.material else ''}".strip("; "),
    )
    notify_material_request_reviewed(req, status)
    db.session.commit()
    return req


def verify_task(actor: User, task_id: int) -> Task:
    """Site operator verifies a worker task that is Ready for Review."""
    task = db.session.scalar(
        select(Task)
        .options(joinedload(Task.project), joinedload(Task.assigned_user))
        .where(Task.id == task_id)
    )
    if task is None:
        raise ProjectServiceError("Task not found.", status_code=404)
    try:
        assert_can_verify_task(actor, task)
    except ProjectAccessError as exc:
        raise ProjectServiceError(exc.message, status_code=exc.status_code) from exc

    previous = normalize_task_status(task.status)
    task.status = "Verified"
    log_activity(
        actor=actor,
        action=f'Verified task "{task.name}"',
        entity_type="task",
        entity_id=task.id,
        details=f"{previous} → Verified",
    )
    if task.assigned_user_id and task.assigned_user_id != actor.id:
        notify_user(
            user_id=task.assigned_user_id,
            title="Task verified",
            message=f'"{task.name}" on {task.project.name} was verified.',
            link=f"/tasks/{task.id}",
        )
    db.session.commit()
    return task


def serialize_material_request(actor: User, req: MaterialRequest) -> dict:
    return req.to_dict(can_approve=can_approve_material_request(actor, req))


def create_material_request(actor: User, data: dict) -> MaterialRequest:
    """Site Engineer (primary) or PM/Admin can create requests on accessible projects."""
    project = get_accessible_project(actor, int(data.get("project_id")))
    assert_can_operate_site(actor, project)
    assert_project_editable(project)
    material = db.session.get(Material, int(data.get("material_id")))
    if material is None:
        raise ProjectServiceError("Material not found.")
    qty = _as_money(data.get("quantity"))
    if qty <= 0:
        raise ProjectServiceError("Quantity must be greater than zero.")
    req = MaterialRequest(
        project_id=project.id,
        material_id=material.id,
        quantity=qty,
        reason=(data.get("reason") or "").strip() or None,
        request_date=_parse_date(data.get("request_date")) or date.today(),
        status="Pending",
        requested_by_id=actor.id,
    )
    db.session.add(req)
    db.session.flush()
    log_activity(
        actor=actor,
        action=f"Submitted material request for {material.name}",
        entity_type="project",
        entity_id=project.id,
        details=f"{qty} {material.unit or ''}",
    )
    notify_material_request_submitted(req, actor)
    db.session.commit()
    return req


def ensure_supplier(name: str, contact: str | None = None, phone: str | None = None, email: str | None = None) -> Supplier:
    clean = (name or "").strip()
    if not clean:
        raise ProjectServiceError("Supplier name is required.")
    supplier = db.session.scalar(select(Supplier).where(Supplier.name == clean))
    if supplier is None:
        supplier = Supplier(name=clean, contact=contact, phone=phone, email=email)
        db.session.add(supplier)
        db.session.flush()
    return supplier


def create_quotation(actor: User, data: dict) -> Quotation:
    project = get_accessible_project(actor, int(data.get("project_id")))
    assert_can_manage(actor, project)
    material = db.session.get(Material, int(data.get("material_id")))
    if material is None:
        raise ProjectServiceError("Material not found.")
    supplier = ensure_supplier(
        data.get("supplier_name") or "",
        data.get("supplier_contact"),
        data.get("supplier_phone"),
        data.get("supplier_email"),
    )
    qty = _as_money(data.get("quantity"))
    unit_price = _as_money(data.get("unit_price"))
    if qty <= 0 or unit_price < 0:
        raise ProjectServiceError("Quantity and unit price must be valid.")
    quotation = Quotation(
        project_id=project.id,
        supplier_id=supplier.id,
        material_id=material.id,
        quantity=qty,
        unit_price=unit_price,
        total_price=qty * unit_price,
        delivery_info=(data.get("delivery_info") or "").strip() or None,
        validity_date=_parse_date(data.get("validity_date")),
        notes=(data.get("notes") or "").strip() or None,
        created_by_id=actor.id,
    )
    db.session.add(quotation)
    db.session.flush()
    log_activity(
        actor=actor,
        action=f"Recorded quotation from {supplier.name}",
        entity_type="project",
        entity_id=project.id,
        details=f"{material.name} · K{float(quotation.total_price):,.2f}",
    )
    db.session.commit()
    return quotation


def select_quotation(actor: User, quotation_id: int) -> Quotation:
    quotation = db.session.scalar(
        select(Quotation).options(joinedload(Quotation.project)).where(Quotation.id == quotation_id)
    )
    if quotation is None:
        raise ProjectServiceError("Quotation not found.", status_code=404)
    assert_can_manage(actor, quotation.project)
    peers = db.session.scalars(
        select(Quotation).where(
            Quotation.project_id == quotation.project_id,
            Quotation.material_id == quotation.material_id,
        )
    ).all()
    for peer in peers:
        peer.is_selected = peer.id == quotation.id
    log_activity(
        actor=actor,
        action="Selected preferred quotation",
        entity_type="project",
        entity_id=quotation.project_id,
        details=f"Quotation #{quotation.id}",
    )
    db.session.commit()
    return quotation


def create_purchase_order_from_quotation(actor: User, quotation_id: int, expected_delivery: str | None = None) -> PurchaseOrder:
    quotation = db.session.scalar(
        select(Quotation).options(joinedload(Quotation.project)).where(Quotation.id == quotation_id)
    )
    if quotation is None:
        raise ProjectServiceError("Quotation not found.", status_code=404)
    assert_can_manage(actor, quotation.project)
    if not quotation.is_selected:
        quotation.is_selected = True
    po = PurchaseOrder(
        project_id=quotation.project_id,
        supplier_id=quotation.supplier_id,
        quotation_id=quotation.id,
        material_id=quotation.material_id,
        quantity=quotation.quantity,
        unit_price=quotation.unit_price,
        total_price=quotation.total_price,
        expected_delivery=_parse_date(expected_delivery),
        status="Approved",
        created_by_id=actor.id,
    )
    db.session.add(po)
    db.session.flush()
    log_activity(
        actor=actor,
        action=f"Created purchase order #{po.id}",
        entity_type="project",
        entity_id=po.project_id,
        details=f"Qty {float(po.quantity or 0)}",
    )
    db.session.commit()
    return po


def record_delivery(actor: User, data: dict) -> Delivery:
    from app.models import MaterialTransaction

    po = db.session.scalar(
        select(PurchaseOrder)
        .options(joinedload(PurchaseOrder.project), joinedload(PurchaseOrder.material))
        .where(PurchaseOrder.id == int(data.get("purchase_order_id")))
    )
    if po is None:
        raise ProjectServiceError("Purchase order not found.", status_code=404)
    assert_can_manage(actor, po.project)
    qty = _as_money(data.get("quantity_received"))
    if qty <= 0:
        raise ProjectServiceError("Quantity received must be greater than zero.")
    delivery = Delivery(
        purchase_order_id=po.id,
        quantity_received=qty,
        delivery_date=_parse_date(data.get("delivery_date")) or date.today(),
        delivery_note=(data.get("delivery_note") or "").strip() or None,
        condition_notes=(data.get("condition_notes") or "").strip() or None,
        received_by_id=actor.id,
    )
    po.status = "Delivered"
    if po.material:
        po.material.quantity = Decimal(po.material.quantity or 0) + qty
        db.session.add(
            MaterialTransaction(
                material_id=po.material_id,
                project_id=po.project_id,
                transaction_type="PURCHASE",
                quantity=qty,
                unit_price=po.unit_price,
                notes=f"Delivery for PO #{po.id}"
                + (f": {delivery.delivery_note}" if delivery.delivery_note else ""),
                transaction_date=delivery.delivery_date,
                recorded_by_id=actor.id,
            )
        )
        # Mark matching approved requests as fulfilled
        approved = db.session.scalars(
            select(MaterialRequest).where(
                MaterialRequest.project_id == po.project_id,
                MaterialRequest.material_id == po.material_id,
                MaterialRequest.status == "Approved",
            )
        ).all()
        for req in approved:
            req.status = "Fulfilled"

    db.session.add(delivery)
    db.session.flush()
    log_activity(
        actor=actor,
        action=f"Recorded delivery for PO #{po.id}",
        entity_type="project",
        entity_id=po.project_id,
        details=f"{qty} received",
    )
    db.session.commit()
    return delivery


def list_quotations(actor: User) -> list[dict]:
    ids = [p["id"] for p in list_projects(actor)]
    if not ids:
        return []
    return [
        q.to_dict()
        for q in db.session.scalars(
            select(Quotation)
            .options(
                joinedload(Quotation.project),
                joinedload(Quotation.supplier),
                joinedload(Quotation.material),
            )
            .where(Quotation.project_id.in_(ids))
            .order_by(Quotation.created_at.desc())
        ).unique()
    ]


def list_purchase_orders(actor: User) -> list[dict]:
    ids = [p["id"] for p in list_projects(actor)]
    if not ids:
        return []
    return [
        po.to_dict()
        for po in db.session.scalars(
            select(PurchaseOrder)
            .options(
                joinedload(PurchaseOrder.project),
                joinedload(PurchaseOrder.supplier),
                joinedload(PurchaseOrder.material),
            )
            .where(PurchaseOrder.project_id.in_(ids))
            .order_by(PurchaseOrder.created_at.desc())
        ).unique()
    ]


def list_deliveries(actor: User) -> list[dict]:
    ids = [p["id"] for p in list_projects(actor)]
    if not ids:
        return []
    return [
        d.to_dict()
        for d in db.session.scalars(
            select(Delivery)
            .options(
                joinedload(Delivery.purchase_order).joinedload(PurchaseOrder.project),
                joinedload(Delivery.purchase_order).joinedload(PurchaseOrder.material),
                joinedload(Delivery.received_by),
            )
            .join(PurchaseOrder)
            .where(PurchaseOrder.project_id.in_(ids))
            .order_by(Delivery.delivery_date.desc(), Delivery.id.desc())
        ).unique()
    ]


def list_accessible_activity(actor: User, *, page: int = 1, per_page: int = 20) -> dict:
    """Activity visible to Admin (all) or PM/SE (their project-linked entities)."""
    from app.models import ActivityLog, Document
    from app.utils.roles import ADMINISTRATOR as ADMIN

    page = max(page, 1)
    per_page = min(max(per_page, 1), 100)

    if actor.role_name == ADMIN:
        total = db.session.scalar(select(func.count()).select_from(ActivityLog)) or 0
        items = db.session.scalars(
            select(ActivityLog)
            .order_by(ActivityLog.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
        return {
            "items": [i.to_dict() for i in items],
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page if total else 0,
        }

    projects = list_projects(actor)
    project_ids = [p["id"] for p in projects]
    if not project_ids:
        return {"items": [], "page": page, "per_page": per_page, "total": 0, "pages": 0}

    task_ids = list(
        db.session.scalars(select(Task.id).where(Task.project_id.in_(project_ids)))
    )
    doc_ids = list(
        db.session.scalars(select(Document.id).where(Document.project_id.in_(project_ids)))
    )

    filters = [
        db.and_(ActivityLog.entity_type == "project", ActivityLog.entity_id.in_(project_ids))
    ]
    if task_ids:
        filters.append(
            db.and_(ActivityLog.entity_type == "task", ActivityLog.entity_id.in_(task_ids))
        )
    if doc_ids:
        filters.append(
            db.and_(ActivityLog.entity_type == "document", ActivityLog.entity_id.in_(doc_ids))
        )

    base_where = or_(*filters)
    total = (
        db.session.scalar(select(func.count()).select_from(ActivityLog).where(base_where)) or 0
    )
    items = db.session.scalars(
        select(ActivityLog)
        .where(base_where)
        .order_by(ActivityLog.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()
    return {
        "items": [i.to_dict() for i in items],
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


def pm_dashboard(actor: User) -> dict:
    projects = db.session.scalars(
        projects_query_for(actor).options(joinedload(Project.project_manager))
    ).unique().all()
    active = [p for p in projects if p.status == "Active"]
    avg_progress = (
        sum(float(p.progress or 0) for p in projects) / len(projects) if projects else 0.0
    )
    today = date.today()
    deadlines = sorted(
        [p for p in projects if p.expected_completion and p.status in {"Planned", "Active", "On Hold"}],
        key=lambda p: p.expected_completion or today,
    )[:8]

    project_ids = [p.id for p in projects]
    pending_requests = []
    recent_expenses = []
    recent_updates = []
    budget_alerts = []

    if project_ids:
        pending_requests = list(
            db.session.scalars(
                select(MaterialRequest)
                .options(joinedload(MaterialRequest.material), joinedload(MaterialRequest.project))
                .where(
                    MaterialRequest.project_id.in_(project_ids),
                    MaterialRequest.status == "Pending",
                )
                .order_by(MaterialRequest.created_at.desc())
                .limit(8)
            ).unique()
        )
        recent_expenses = list(
            db.session.scalars(
                select(Expense)
                .options(joinedload(Expense.project))
                .where(Expense.project_id.in_(project_ids))
                .order_by(Expense.expense_date.desc())
                .limit(8)
            ).unique()
        )
        recent_updates = list(
            db.session.scalars(
                select(ProgressUpdate)
                .options(joinedload(ProgressUpdate.project))
                .where(ProgressUpdate.project_id.in_(project_ids))
                .order_by(ProgressUpdate.update_date.desc())
                .limit(8)
            ).unique()
        )
        for project in projects:
            budget_total = float(
                db.session.scalar(
                    select(func.coalesce(func.sum(BudgetLine.amount), 0)).where(
                        BudgetLine.project_id == project.id
                    )
                )
                or project.budget
                or 0
            )
            actual = float(
                db.session.scalar(
                    select(func.coalesce(func.sum(Expense.amount), 0)).where(
                        Expense.project_id == project.id,
                        Expense.status == "Approved",
                    )
                )
                or 0
            )
            if budget_total > 0 and actual > budget_total:
                budget_alerts.append(
                    {
                        "project_id": project.id,
                        "project_name": project.name,
                        "budget": budget_total,
                        "actual": actual,
                        "over_by": actual - budget_total,
                    }
                )

    status_counts = {}
    for status in PROJECT_STATUSES:
        status_counts[status] = len([p for p in projects if p.status == status])

    return {
        "cards": {
            "my_projects": len(projects),
            "active_projects": len(active),
            "average_progress": round(avg_progress, 1),
            "pending_material_requests": len(pending_requests),
            "budget_alerts": len(budget_alerts),
        },
        "status_breakdown": status_counts,
        "upcoming_deadlines": [p.to_summary_dict() for p in deadlines],
        "pending_material_requests": [r.to_dict() for r in pending_requests],
        "budget_alerts": budget_alerts,
        "recent_expenses": [e.to_dict() for e in recent_expenses],
        "recent_site_updates": [u.to_dict() for u in recent_updates],
        "projects": [p.to_summary_dict() for p in projects[:10]],
    }


def list_assignable_users() -> list[dict]:
    users = db.session.scalars(
        select(User).options(joinedload(User.role)).where(User.is_active.is_(True)).order_by(User.full_name)
    ).unique().all()
    return [
        {"id": u.id, "full_name": u.full_name, "email": u.email, "role": u.role_name}
        for u in users
    ]


def list_materials() -> list[dict]:
    apply_standard_material_units()
    materials = db.session.scalars(select(Material).order_by(Material.name)).all()
    return [m.to_dict() for m in materials]


def apply_standard_material_units() -> None:
    """Store the fixed quantity unit for known materials. Other units stay as entered."""
    from app.utils.material_units import standard_unit

    changed = False
    for material in db.session.scalars(select(Material)):
        unit = standard_unit(material.name)
        if unit and material.unit != unit:
            material.unit = unit
            changed = True
    if changed:
        db.session.commit()


def ensure_demo_materials() -> None:
    defaults = [
        ("Cement", "Structural", "bags", 100, 20),
        ("Steel Bars", "Structural", "tons", 15, 5),
        ("Sand", "Aggregates", "tons", 40, 10),
        ("Concrete Blocks", "Masonry", "inches", 200, 40),
    ]
    for name, category, unit, qty, minimum in defaults:
        existing = db.session.scalar(select(Material).where(Material.name == name))
        if existing is None:
            db.session.add(
                Material(
                    name=name,
                    category=category,
                    unit=unit,
                    quantity=qty,
                    minimum_stock=minimum,
                )
            )
    db.session.commit()
    apply_standard_material_units()
