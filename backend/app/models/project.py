"""Project operations models (PM / site modules)."""

from __future__ import annotations

from decimal import Decimal

from app.extensions import db
from app.models.base import utcnow

PROJECT_STATUSES = ("Planned", "Active", "On Hold", "Completed", "Cancelled")
TASK_STATUSES = ("Pending", "In Progress", "Completed", "Cancelled")
TASK_PRIORITIES = ("Low", "Medium", "High", "Urgent")
BUDGET_CATEGORIES = ("Materials", "Labour", "Equipment", "Transport", "Other")
REQUEST_STATUSES = ("Pending", "Approved", "Rejected", "Fulfilled")
PO_STATUSES = ("Draft", "Approved", "Ordered", "Delivered", "Cancelled")


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
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    project = db.relationship("Project", back_populates="tasks")
    assigned_user = db.relationship("User", foreign_keys=[assigned_user_id])
    created_by = db.relationship("User", foreign_keys=[created_by_id])
    comments = db.relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "name": self.name,
            "description": self.description,
            "assigned_user_id": self.assigned_user_id,
            "assigned_user_name": self.assigned_user.full_name if self.assigned_user else None,
            "assigned_by_name": self.created_by.full_name if self.created_by else None,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "priority": self.priority,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


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

    project = db.relationship("Project", back_populates="budget_lines")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "category": self.category,
            "amount": float(self.amount or 0),
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
    recorded_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    project = db.relationship("Project", back_populates="expenses")
    recorded_by = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "category": self.category,
            "description": self.description,
            "amount": float(self.amount or 0),
            "expense_date": self.expense_date.isoformat() if self.expense_date else None,
            "payee": self.payee,
            "payment_method": self.payment_method,
            "recorded_by_name": self.recorded_by.full_name if self.recorded_by else None,
        }


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
