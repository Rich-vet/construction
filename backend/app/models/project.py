"""Project operations models (PM / site modules)."""

from __future__ import annotations

import json
from datetime import datetime, time, timezone
from decimal import Decimal

from app.extensions import db
from app.models.base import utcnow

PROJECT_STATUSES = ("Planned", "Active", "On Hold", "Completed", "Cancelled")
# Verified = approved work. Ready for Review = awaiting inspection.
# Rework Required returns the same task to the worker. Legacy Completed == Verified.
TASK_STATUSES = (
    "Pending",
    "In Progress",
    "Ready for Review",
    "Rework Required",
    "Verified",
    "Cancelled",
    "Completed",
)
TASK_PRIORITIES = ("Low", "Medium", "High", "Urgent", "Critical")
BUDGET_CATEGORIES = ("Materials", "Labour", "Equipment", "Transport", "Other")
REQUEST_STATUSES = ("Pending", "Approved", "Rejected", "Fulfilled")
PO_STATUSES = ("Draft", "Approved", "Ordered", "Delivered", "Cancelled")
EXPENSE_STATUSES = ("Pending", "Approved", "Rejected")


class Project(db.Model):
    """Construction project — central workspace entity."""

    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, index=True)
    client_name = db.Column(db.String(200), nullable=False)
    client_phone = db.Column(db.String(40), nullable=True)
    client_email = db.Column(db.String(255), nullable=True)
    location = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    expected_completion = db.Column(db.Date, nullable=True)
    budget = db.Column(db.Numeric(14, 2), nullable=True, default=0)
    progress = db.Column(db.Float, nullable=False, default=0.0)
    status = db.Column(db.String(40), nullable=False, default="Planned", index=True)
    project_manager_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    site_engineer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    project_manager = db.relationship("User", foreign_keys=[project_manager_id])
    site_engineer = db.relationship("User", foreign_keys=[site_engineer_id])
    created_by = db.relationship("User", foreign_keys=[created_by_id])
    members = db.relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    tasks = db.relationship("Task", back_populates="project", cascade="all, delete-orphan")
    milestones = db.relationship("Milestone", back_populates="project", cascade="all, delete-orphan")
    budget_lines = db.relationship("BudgetLine", back_populates="project", cascade="all, delete-orphan")
    expenses = db.relationship("Expense", back_populates="project", cascade="all, delete-orphan")

    def to_summary_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "client_name": self.client_name,
            "location": self.location,
            "status": self.status,
            "progress": float(self.progress or 0),
            "budget": float(self.budget or 0),
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "expected_completion": (
                self.expected_completion.isoformat() if self.expected_completion else None
            ),
            "project_manager_id": self.project_manager_id,
            "project_manager_name": self.project_manager.full_name if self.project_manager else None,
            "site_engineer_id": self.site_engineer_id,
            "site_engineer_name": self.site_engineer.full_name if self.site_engineer else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def to_dict(self) -> dict:
        data = self.to_summary_dict()
        data.update(
            {
                "client_phone": self.client_phone,
                "client_email": self.client_email,
                "description": self.description,
            }
        )
        return data


class ProjectMember(db.Model):
    __tablename__ = "project_members"
    __table_args__ = (db.UniqueConstraint("project_id", "user_id", name="uq_project_member"),)

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    member_role = db.Column(db.String(80), nullable=False, default="Team Member")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    project = db.relationship("Project", back_populates="members")
    user = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "user_id": self.user_id,
            "user_name": self.user.full_name if self.user else None,
            "user_email": self.user.email if self.user else None,
            "user_role": self.user.role_name if self.user else None,
            "member_role": self.member_role,
        }


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    assigned_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    start_date = db.Column(db.Date, nullable=True)
    due_date = db.Column(db.Date, nullable=True)
    priority = db.Column(db.String(20), nullable=False, default="Medium")
    status = db.Column(db.String(40), nullable=False, default="Pending", index=True)
    instructions = db.Column(db.Text, nullable=True)
    checklist_json = db.Column(db.Text, nullable=True)
    due_at = db.Column(db.DateTime(timezone=True), nullable=True)
    progress_percent = db.Column(db.Float, nullable=False, default=0)
    completion_report = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    approved_at = db.Column(db.DateTime(timezone=True), nullable=True)
    approved_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    rework_count = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    rework_notes = db.Column(db.Text, nullable=True)
    require_evidence = db.Column(db.Boolean, nullable=False, default=False, server_default="0")
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    project = db.relationship("Project", back_populates="tasks")
    assigned_user = db.relationship("User", foreign_keys=[assigned_user_id])
    created_by = db.relationship("User", foreign_keys=[created_by_id])
    approved_by = db.relationship("User", foreign_keys=[approved_by_id])
    comments = db.relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    progress_reports = db.relationship(
        "TaskProgressReport",
        back_populates="task",
        cascade="all, delete-orphan",
    )
    inspections = db.relationship(
        "TaskInspection",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    def deadline(self) -> datetime | None:
        if self.due_at is not None:
            value = self.due_at
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value
        if self.due_date is not None:
            return datetime.combine(self.due_date, time(23, 59), tzinfo=timezone.utc)
        return None

    def checklist(self) -> list[str]:
        if not self.checklist_json:
            return []
        try:
            parsed = json.loads(self.checklist_json)
        except (TypeError, ValueError):
            return []
        if not isinstance(parsed, list):
            return []
        return [str(item).strip() for item in parsed if str(item).strip()]

    def to_dict(self) -> dict:
        status = self.status
        if status == "Completed":
            status = "Verified"
        deadline = self.deadline()
        now = datetime.now(timezone.utc)
        seconds = int((deadline - now).total_seconds()) if deadline else None
        closed = status in {"Verified", "Cancelled"}
        overdue = bool(seconds is not None and seconds < 0 and not closed)
        return {
            "id": self.id,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "name": self.name,
            "description": self.description,
            "instructions": self.instructions,
            "checklist": self.checklist(),
            "assigned_user_id": self.assigned_user_id,
            "assigned_user_name": self.assigned_user.full_name if self.assigned_user else None,
            "assigned_by_name": self.created_by.full_name if self.created_by else None,
            "created_by_id": self.created_by_id,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "due_at": deadline.isoformat() if deadline else None,
            "deadline_at": deadline.isoformat() if deadline else None,
            "seconds_remaining": seconds,
            "is_overdue": overdue,
            "time_remaining_label": _remaining_label(seconds, overdue, deadline is not None),
            "priority": self.priority,
            "status": status,
            "progress_percent": float(self.progress_percent or 0),
            "completion_report": self.completion_report,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "approved_by_name": self.approved_by.full_name if self.approved_by else None,
            "rework_count": int(self.rework_count or 0),
            "rework_notes": self.rework_notes,
            "require_evidence": bool(self.require_evidence),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


def _remaining_label(seconds: int | None, overdue: bool, has_deadline: bool) -> str | None:
    if not has_deadline or seconds is None:
        return None
    if overdue:
        return "OVERDUE"
    minutes = max(seconds, 0) // 60
    days, minutes = divmod(minutes, 60 * 24)
    hours, minutes = divmod(minutes, 60)
    return f"{days} days, {hours:02d} hours, {minutes:02d} minutes remaining"


class TaskProgressReport(db.Model):
    """Historical worker progress. Earlier rows are never overwritten."""

    __tablename__ = "task_progress_reports"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    percentage = db.Column(db.Float, nullable=False, default=0)
    description = db.Column(db.Text, nullable=True)
    work_performed = db.Column(db.Text, nullable=True)
    challenges = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    task = db.relationship("Task", back_populates="progress_reports")
    user = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "user_id": self.user_id,
            "user_name": self.user.full_name if self.user else None,
            "percentage": float(self.percentage or 0),
            "description": self.description,
            "work_performed": self.work_performed,
            "challenges": self.challenges,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class TaskInspection(db.Model):
    """Approval or rework decision. Each cycle is a new row on the same task."""

    __tablename__ = "task_inspections"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=False, index=True)
    inspector_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    outcome = db.Column(db.String(40), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    correction_instructions = db.Column(db.Text, nullable=True)
    completion_report = db.Column(db.Text, nullable=True)
    new_deadline = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    task = db.relationship("Task", back_populates="inspections")
    inspector = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "inspector_id": self.inspector_id,
            "inspector_name": self.inspector.full_name if self.inspector else None,
            "outcome": self.outcome,
            "notes": self.notes,
            "correction_instructions": self.correction_instructions,
            "completion_report": self.completion_report,
            "new_deadline": self.new_deadline.isoformat() if self.new_deadline else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class TaskReminder(db.Model):
    """One row per reminder band so daily notices are not sent twice."""

    __tablename__ = "task_reminders"
    __table_args__ = (
        db.UniqueConstraint("task_id", "reminder_key", name="uq_task_reminder_key"),
    )

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    reminder_key = db.Column(db.String(80), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    task = db.relationship("Task")
    user = db.relationship("User")


class TaskComment(db.Model):
    __tablename__ = "task_comments"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    task = db.relationship("Task", back_populates="comments")
    user = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "user_id": self.user_id,
            "user_name": self.user.full_name if self.user else None,
            "body": self.body,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Milestone(db.Model):
    __tablename__ = "milestones"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    target_date = db.Column(db.Date, nullable=True)
    completed_at = db.Column(db.Date, nullable=True)
    is_completed = db.Column(db.Boolean, nullable=False, default=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    project = db.relationship("Project", back_populates="milestones")

    @property
    def is_delayed(self) -> bool:
        if self.is_completed or self.target_date is None:
            return False
        from datetime import date

        return date.today() > self.target_date

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "name": self.name,
            "target_date": self.target_date.isoformat() if self.target_date else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "is_completed": self.is_completed,
            "is_delayed": self.is_delayed,
            "notes": self.notes,
        }


class BudgetLine(db.Model):
    __tablename__ = "budget_lines"
    __table_args__ = (
        db.UniqueConstraint("project_id", "category", name="uq_project_budget_category"),
    )

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    category = db.Column(db.String(40), nullable=False)
    amount = db.Column(db.Numeric(14, 2), nullable=False, default=Decimal("0"))
    # Pending revision (SoD): proposed change awaiting approval by a different manager/admin.
    pending_amount = db.Column(db.Numeric(14, 2), nullable=True)
    pending_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    project = db.relationship("Project", back_populates="budget_lines")
    pending_by = db.relationship("User", foreign_keys=[pending_by_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "category": self.category,
            "amount": float(self.amount or 0),
            "pending_amount": float(self.pending_amount) if self.pending_amount is not None else None,
            "pending_by_id": self.pending_by_id,
            "pending_by_name": self.pending_by.full_name if self.pending_by else None,
            "has_pending_revision": self.pending_amount is not None,
        }


class Expense(db.Model):
    __tablename__ = "expenses"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    category = db.Column(db.String(40), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Numeric(14, 2), nullable=False)
    expense_date = db.Column(db.Date, nullable=False)
    payee = db.Column(db.String(120), nullable=True)
    payment_method = db.Column(db.String(80), nullable=True)
    status = db.Column(db.String(40), nullable=False, default="Pending", index=True)
    recorded_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    review_notes = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    project = db.relationship("Project", back_populates="expenses")
    recorded_by = db.relationship("User", foreign_keys=[recorded_by_id])
    reviewed_by = db.relationship("User", foreign_keys=[reviewed_by_id])

    def to_dict(self, *, can_approve: bool | None = None) -> dict:
        data = {
            "id": self.id,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "category": self.category,
            "description": self.description,
            "amount": float(self.amount or 0),
            "expense_date": self.expense_date.isoformat() if self.expense_date else None,
            "payee": self.payee,
            "payment_method": self.payment_method,
            "status": self.status or "Pending",
            "recorded_by_id": self.recorded_by_id,
            "recorded_by_name": self.recorded_by.full_name if self.recorded_by else None,
            "reviewed_by_name": self.reviewed_by.full_name if self.reviewed_by else None,
            "review_notes": self.review_notes,
        }
        if can_approve is not None:
            data["can_approve"] = can_approve
        return data


class ProgressUpdate(db.Model):
    __tablename__ = "progress_updates"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    update_date = db.Column(db.Date, nullable=False)
    work_completed = db.Column(db.Text, nullable=False)
    percentage = db.Column(db.Float, nullable=False, default=0)
    problems = db.Column(db.Text, nullable=True)
    next_activities = db.Column(db.Text, nullable=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    project = db.relationship("Project")
    created_by = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "update_date": self.update_date.isoformat() if self.update_date else None,
            "work_completed": self.work_completed,
            "percentage": float(self.percentage or 0),
            "problems": self.problems,
            "next_activities": self.next_activities,
            "created_by_name": self.created_by.full_name if self.created_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SiteReport(db.Model):
    __tablename__ = "site_reports"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    report_date = db.Column(db.Date, nullable=False)
    workers_present = db.Column(db.Integer, nullable=True)
    activities_completed = db.Column(db.Text, nullable=True)
    materials_used = db.Column(db.Text, nullable=True)
    equipment_used = db.Column(db.Text, nullable=True)
    problems = db.Column(db.Text, nullable=True)
    safety_observations = db.Column(db.Text, nullable=True)
    next_activities = db.Column(db.Text, nullable=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    project = db.relationship("Project")
    created_by = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "report_date": self.report_date.isoformat() if self.report_date else None,
            "workers_present": self.workers_present,
            "activities_completed": self.activities_completed,
            "materials_used": self.materials_used,
            "equipment_used": self.equipment_used,
            "problems": self.problems,
            "safety_observations": self.safety_observations,
            "next_activities": self.next_activities,
            "created_by_name": self.created_by.full_name if self.created_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
