"""Contractor/Worker workspace: assigned tasks, comments, evidence, own attendance."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from flask import current_app
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from werkzeug.datastructures import FileStorage

from app.extensions import db
from app.models import (
    Attendance,
    Document,
    Notification,
    Project,
    ProjectMember,
    Task,
    TaskComment,
    TaskInspection,
    TaskProgressReport,
    TaskReminder,
    User,
)
from app.models.project import TASK_STATUSES
from app.services.activity_service import log_activity
from app.services.notification_service import notify_user
from app.utils.project_access import (
    ProjectAccessError,
    assert_project_editable,
    get_accessible_project,
    projects_query_for,
)
from app.utils.uploads import UploadError, save_project_document
from app.utils.workflow import (
    TASK_WORKER_STATUSES,
    normalize_task_status,
    worker_allowed_statuses_for,
)


class WorkerServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _my_assigned_tasks_query(actor: User):
    return (
        select(Task)
        .options(joinedload(Task.project), joinedload(Task.assigned_user))
        .where(Task.assigned_user_id == actor.id)
        .order_by(Task.due_date.asc(), Task.id.desc())
    )


def _require_own_task(actor: User, task_id: int) -> Task:
    task = db.session.scalar(
        select(Task)
        .options(
            joinedload(Task.project),
            joinedload(Task.assigned_user),
            joinedload(Task.comments).joinedload(TaskComment.user),
        )
        .where(Task.id == task_id)
    )
    if task is None:
        raise WorkerServiceError("Task not found.", status_code=404)
    if task.assigned_user_id != actor.id:
        raise WorkerServiceError("You can only access tasks assigned to you.", status_code=403)
    get_accessible_project(actor, task.project_id)
    return task


def worker_dashboard(actor: User) -> dict:
    projects = list(db.session.scalars(projects_query_for(actor).order_by(Project.name)))
    tasks = list(db.session.scalars(_my_assigned_tasks_query(actor)).unique())
    today = date.today()
    soon = today + timedelta(days=7)

    open_statuses = {"Pending", "In Progress", "Ready for Review"}
    open_tasks = [t for t in tasks if normalize_task_status(t.status) in open_statuses]
    due_soon = [
        t
        for t in open_tasks
        if t.due_date is not None and today <= t.due_date <= soon
    ]
    overdue = [t for t in open_tasks if t.due_date is not None and t.due_date < today]
    completed = [t for t in tasks if normalize_task_status(t.status) == "Verified"]

    unread = (
        db.session.scalar(
            select(db.func.count())
            .select_from(Notification)
            .where(Notification.user_id == actor.id, Notification.is_read.is_(False))
        )
        or 0
    )

    recent_notifications = [
        n.to_dict()
        for n in db.session.scalars(
            select(Notification)
            .where(Notification.user_id == actor.id)
            .order_by(Notification.created_at.desc())
            .limit(5)
        )
    ]

    attendance_recent = [
        a.to_dict()
        for a in db.session.scalars(
            select(Attendance)
            .options(joinedload(Attendance.project))
            .where(Attendance.worker_user_id == actor.id)
            .order_by(Attendance.attendance_date.desc())
            .limit(5)
        ).unique()
    ]

    return {
        "cards": {
            "assigned_projects": len(projects),
            "my_tasks": len(open_tasks),
            "due_soon": len(due_soon),
            "overdue": len(overdue),
            "completed": len(completed),
            "unread_notifications": int(unread),
        },
        "projects": [p.to_dict() for p in projects],
        "due_soon_tasks": [t.to_dict() for t in due_soon[:10]],
        "overdue_tasks": [t.to_dict() for t in overdue[:10]],
        "open_tasks": [t.to_dict() for t in open_tasks[:10]],
        "completed_tasks": [t.to_dict() for t in completed[:5]],
        "recent_notifications": recent_notifications,
        "recent_attendance": attendance_recent,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def list_my_projects(actor: User) -> list[dict]:
    return [
        p.to_dict()
        for p in db.session.scalars(projects_query_for(actor).order_by(Project.name))
    ]


def list_my_tasks(actor: User, *, status: str | None = None) -> list[dict]:
    dispatch_due_task_reminders()
    stmt = _my_assigned_tasks_query(actor)
    if status:
        stmt = stmt.where(Task.status == status)
    return [t.to_dict() for t in db.session.scalars(stmt).unique()]


def get_my_task(actor: User, task_id: int) -> dict:
    task = _require_own_task(actor, task_id)
    evidence = [
        d.to_dict()
        for d in db.session.scalars(
            select(Document)
            .options(joinedload(Document.uploaded_by), joinedload(Document.project))
            .where(Document.task_id == task.id)
            .order_by(Document.created_at.desc())
        ).unique()
    ]
    allowed = worker_allowed_statuses_for(task)
    reports = [
        row.to_dict()
        for row in db.session.scalars(
            select(TaskProgressReport)
            .options(joinedload(TaskProgressReport.user))
            .where(TaskProgressReport.task_id == task.id)
            .order_by(TaskProgressReport.created_at.desc())
        ).unique()
    ]
    inspections = [
        row.to_dict()
        for row in db.session.scalars(
            select(TaskInspection)
            .options(joinedload(TaskInspection.inspector))
            .where(TaskInspection.task_id == task.id)
            .order_by(TaskInspection.created_at.desc())
        ).unique()
    ]
    return {
        "task": task.to_dict(),
        "comments": [c.to_dict() for c in task.comments],
        "evidence": evidence,
        "progress_reports": reports,
        "inspections": inspections,
        "can_update": bool(allowed),
        "allowed_statuses": allowed,
        "can_verify": False,
    }


def update_my_task_status(actor: User, task_id: int, data: dict) -> Task:
    task = _require_own_task(actor, task_id)
    assert_project_editable(task.project)
    if normalize_task_status(task.status) in {"Cancelled", "Verified"}:
        raise WorkerServiceError("This task can no longer be updated.")

    status = (data.get("status") or "").strip()
    # Legacy clients sending Completed mean Ready for Review (worker cannot officially complete).
    if status == "Completed" or status == "Verified":
        raise WorkerServiceError("You cannot approve or close your own task.", status_code=403)
    allowed = worker_allowed_statuses_for(task)
    if status not in allowed:
        raise WorkerServiceError(
            "You can start assigned work or submit it for inspection. You cannot approve it."
        )
    if status == "Ready for Review" and not (task.completion_report or "").strip():
        raise WorkerServiceError("Submit a completion report before sending this task for inspection.")
    if status == "Ready for Review" and task.require_evidence:
        evidence_count = db.session.scalar(
            select(db.func.count()).select_from(Document).where(Document.task_id == task.id)
        )
        if not evidence_count:
            raise WorkerServiceError("This task requires completion photos before inspection.")

    previous = task.status
    task.status = status
    log_activity(
        actor=actor,
        action=f'Updated task status "{task.name}" to {status}',
        entity_type="task",
        entity_id=task.id,
        details=f"{previous} → {status}",
    )

    if status == "Ready for Review" and previous != "Ready for Review":
        recipients = {
            task.project.project_manager_id,
            task.project.site_engineer_id,
        }
        for uid in recipients:
            if uid and uid != actor.id:
                notify_user(
                    user_id=uid,
                    title="Task ready for review",
                    message=f'{actor.full_name} marked "{task.name}" ready for review on {task.project.name}.',
                    link=f"/projects/{task.project_id}?tab=tasks",
                )
    db.session.commit()
    return task


def add_progress_report(actor: User, task_id: int, data: dict) -> TaskProgressReport:
    task = _require_own_task(actor, task_id)
    assert_project_editable(task.project)
    if normalize_task_status(task.status) not in {"In Progress", "Rework Required"}:
        raise WorkerServiceError("Progress can be reported only while the task is in progress.")
    try:
        percentage = float(data.get("percentage"))
    except (TypeError, ValueError) as exc:
        raise WorkerServiceError("Progress percentage must be between 0 and 100.") from exc
    if percentage < 0 or percentage > 100:
        raise WorkerServiceError("Progress percentage must be between 0 and 100.")
    description = (data.get("description") or "").strip()
    work = (data.get("work_performed") or "").strip()
    if not description and not work:
        raise WorkerServiceError("Describe the progress or the work performed.")
    report = TaskProgressReport(
        task_id=task.id,
        user_id=actor.id,
        percentage=percentage,
        description=description or None,
        work_performed=work or None,
        challenges=(data.get("challenges") or "").strip() or None,
    )
    task.progress_percent = percentage
    if task.status == "Rework Required":
        task.status = "In Progress"
    db.session.add(report)
    db.session.flush()
    if task.project.site_engineer_id and task.project.site_engineer_id != actor.id:
        notify_user(
            user_id=task.project.site_engineer_id,
            title="Task progress update",
            message=f'{actor.full_name} reported {int(percentage)}% on "{task.name}".',
            link=f"/projects/{task.project_id}?tab=tasks",
        )
    db.session.commit()
    return report


def submit_for_inspection(actor: User, task_id: int, data: dict) -> Task:
    task = _require_own_task(actor, task_id)
    assert_project_editable(task.project)
    if normalize_task_status(task.status) not in {"In Progress", "Rework Required"}:
        raise WorkerServiceError("Only active work can be submitted for inspection.")
    report = (data.get("completion_report") or "").strip()
    if not report:
        raise WorkerServiceError("A completion report is required.")
    if not data.get("confirm_complete"):
        raise WorkerServiceError("Confirm that the required work is finished.")
    if task.require_evidence:
        evidence_count = db.session.scalar(
            select(db.func.count()).select_from(Document).where(Document.task_id == task.id)
        )
        if not evidence_count:
            raise WorkerServiceError("Upload completion photos before submitting this task.")
    task.completion_report = report
    task.submitted_at = datetime.now(timezone.utc)
    task.status = "Ready for Review"
    if task.project.site_engineer_id and task.project.site_engineer_id != actor.id:
        notify_user(
            user_id=task.project.site_engineer_id,
            title="Task awaiting inspection",
            message=f'{actor.full_name} submitted "{task.name}" on {task.project.name} for inspection.',
            link=f"/projects/{task.project_id}?tab=tasks",
        )
    db.session.commit()
    return task


def dispatch_due_task_reminders() -> int:
    """Create in-app reminders for open tasks. Safe to call on each notification poll."""
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    open_statuses = ("Pending", "In Progress", "Rework Required")
    tasks = db.session.scalars(
        select(Task)
        .options(joinedload(Task.project))
        .where(Task.status.in_(open_statuses), Task.assigned_user_id.is_not(None))
    ).unique().all()
    created = 0
    for task in tasks:
        deadline = task.deadline()
        if deadline is None or task.assigned_user_id is None:
            continue
        seconds = (deadline - now).total_seconds()
        bands = ["daily"]
        if seconds < 0:
            bands.append("overdue")
        elif seconds <= 24 * 3600:
            bands.append("soon")
        for band in bands:
            key = f"{task.id}:{today}:{band}"
            exists = db.session.scalar(
                select(TaskReminder.id).where(
                    TaskReminder.task_id == task.id,
                    TaskReminder.reminder_key == key,
                )
            )
            if exists:
                continue
            if band == "overdue":
                title = "Task overdue"
                message = f'"{task.name}" is overdue. Submit it or ask the engineer for a new deadline.'
            elif band == "soon":
                title = "Task due soon"
                message = f'"{task.name}" is due within 24 hours ({task.to_dict()["time_remaining_label"]}).'
            else:
                title = "Task reminder"
                message = f'"{task.name}" is still open. {task.to_dict()["time_remaining_label"] or "No deadline set."}'
            notify_user(
                user_id=task.assigned_user_id,
                title=title,
                message=message,
                link=f"/tasks/{task.id}",
            )
            db.session.add(
                TaskReminder(task_id=task.id, user_id=task.assigned_user_id, reminder_key=key)
            )
            created += 1
    if created:
        db.session.commit()
    return created


def add_my_task_comment(actor: User, task_id: int, body: str) -> TaskComment:
    task = _require_own_task(actor, task_id)
    text = (body or "").strip()
    if not text:
        raise WorkerServiceError("Comment cannot be empty.")
    comment = TaskComment(task_id=task.id, user_id=actor.id, body=text)
    db.session.add(comment)
    db.session.flush()
    log_activity(
        actor=actor,
        action=f'Commented on task "{task.name}"',
        entity_type="task",
        entity_id=task.id,
    )
    if task.project.project_manager_id and task.project.project_manager_id != actor.id:
        notify_user(
            user_id=task.project.project_manager_id,
            title="New task comment",
            message=f'{actor.full_name} commented on "{task.name}".',
            link=f"/projects/{task.project_id}?tab=tasks",
        )
    db.session.commit()
    return comment


def upload_task_evidence(actor: User, task_id: int, data: dict, file: FileStorage) -> Document:
    task = _require_own_task(actor, task_id)
    assert_project_editable(task.project)
    name = (data.get("name") or "").strip() or (file.filename or "Work evidence")
    try:
        relative, original, mime = save_project_document(file)
    except UploadError as exc:
        raise WorkerServiceError(exc.message) from exc

    doc = Document(
        name=name[:200],
        document_type="Work Evidence",
        project_id=task.project_id,
        task_id=task.id,
        description=(data.get("description") or "").strip() or None,
        file_path=relative,
        original_filename=original,
        mime_type=mime,
        uploaded_by_id=actor.id,
    )
    db.session.add(doc)
    db.session.flush()
    log_activity(
        actor=actor,
        action=f'Uploaded work evidence for "{task.name}"',
        entity_type="document",
        entity_id=doc.id,
        details=doc.name,
    )
    if task.project.site_engineer_id and task.project.site_engineer_id != actor.id:
        notify_user(
            user_id=task.project.site_engineer_id,
            title="Work evidence uploaded",
            message=f'{actor.full_name} uploaded evidence for "{task.name}".',
            link=f"/projects/{task.project_id}?tab=tasks",
        )
    db.session.commit()
    return doc


def get_document_for_download(actor: User, document_id: int) -> tuple[Document, Path]:
    doc = db.session.get(Document, document_id)
    if doc is None or doc.project_id is None:
        raise WorkerServiceError("Document not found.", status_code=404)
    get_accessible_project(actor, doc.project_id)
    # Workers may only download evidence they uploaded or docs on their projects
    if actor.role_name == "Contractor/Worker":
        member = db.session.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == doc.project_id,
                ProjectMember.user_id == actor.id,
            )
        )
        if member is None and doc.uploaded_by_id != actor.id:
            raise WorkerServiceError("You do not have access to this document.", status_code=403)
    path = Path(current_app.config["UPLOAD_FOLDER"]) / doc.file_path
    if not path.is_file():
        raise WorkerServiceError("Document file is missing.", status_code=404)
    return doc, path


def list_my_attendance(actor: User) -> list[dict]:
    return [
        a.to_dict()
        for a in db.session.scalars(
            select(Attendance)
            .options(joinedload(Attendance.project), joinedload(Attendance.worker))
            .where(Attendance.worker_user_id == actor.id)
            .order_by(Attendance.attendance_date.desc(), Attendance.id.desc())
        ).unique()
    ]


def list_my_documents(actor: User) -> list[dict]:
    """Work evidence and documents uploaded by the worker on their projects."""
    ids = [
        p.id
        for p in db.session.scalars(projects_query_for(actor))
    ]
    if not ids:
        return []
    return [
        d.to_dict()
        for d in db.session.scalars(
            select(Document)
            .options(joinedload(Document.project), joinedload(Document.uploaded_by), joinedload(Document.task))
            .where(
                Document.project_id.in_(ids),
                Document.uploaded_by_id == actor.id,
            )
            .order_by(Document.created_at.desc())
        ).unique()
    ]


def worker_meta() -> dict:
    return {
        "task_statuses": list(TASK_WORKER_STATUSES),
        "all_task_statuses": [
            s for s in TASK_STATUSES if s != "Completed"
        ],
    }
