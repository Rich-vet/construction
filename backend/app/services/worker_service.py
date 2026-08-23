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

WORKER_TASK_STATUSES = ("Pending", "In Progress", "Completed")


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

    open_tasks = [t for t in tasks if t.status in {"Pending", "In Progress"}]
    due_soon = [
        t
        for t in open_tasks
        if t.due_date is not None and today <= t.due_date <= soon
    ]
    overdue = [t for t in open_tasks if t.due_date is not None and t.due_date < today]
    completed = [t for t in tasks if t.status == "Completed"]

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
    return {
        "task": task.to_dict(),
        "comments": [c.to_dict() for c in task.comments],
        "evidence": evidence,
        "can_update": task.status != "Cancelled",
        "allowed_statuses": list(WORKER_TASK_STATUSES),
    }


def update_my_task_status(actor: User, task_id: int, data: dict) -> Task:
    task = _require_own_task(actor, task_id)
    assert_project_editable(task.project)
    if task.status == "Cancelled":
        raise WorkerServiceError("Cancelled tasks cannot be updated.")

    status = (data.get("status") or "").strip()
    if status not in WORKER_TASK_STATUSES:
        raise WorkerServiceError("You can set status to Pending, In Progress, or Completed only.")
    if status not in TASK_STATUSES:
        raise WorkerServiceError("Invalid task status.")

    previous = task.status
    task.status = status
    log_activity(
        actor=actor,
        action=f'Updated task status "{task.name}" to {status}',
        entity_type="task",
        entity_id=task.id,
        details=f"{previous} → {status}",
    )

    # Notify project manager / site engineer of completion
    if status == "Completed" and previous != "Completed":
        recipients = {
            task.project.project_manager_id,
            task.project.site_engineer_id,
        }
        for uid in recipients:
            if uid and uid != actor.id:
                notify_user(
                    user_id=uid,
                    title="Task completed",
                    message=f'{actor.full_name} completed "{task.name}" on {task.project.name}.',
                    link=f"/projects/{task.project_id}",
                )
    db.session.commit()
    return task


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
            link=f"/projects/{task.project_id}",
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
            link=f"/projects/{task.project_id}",
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
        "task_statuses": list(WORKER_TASK_STATUSES),
        "all_task_statuses": list(TASK_STATUSES),
    }
