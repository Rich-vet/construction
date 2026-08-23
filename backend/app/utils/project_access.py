"""Project access control helpers (RBAC + ownership)."""

from __future__ import annotations

from sqlalchemy import or_, select

from app.extensions import db
from app.models import Project, ProjectMember, User
from app.utils.roles import ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER, CONTRACTOR_WORKER


class ProjectAccessError(Exception):
    def __init__(self, message: str, status_code: int = 403) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def projects_query_for(user: User):
    """Return a filtered Project select for the user's visibility."""
    stmt = select(Project)
    role = user.role_name
    if role == ADMINISTRATOR:
        return stmt
    if role == PROJECT_MANAGER:
        return stmt.where(Project.project_manager_id == user.id)
    if role == SITE_ENGINEER:
        return stmt.where(Project.site_engineer_id == user.id)
    if role == CONTRACTOR_WORKER:
        return stmt.join(ProjectMember).where(ProjectMember.user_id == user.id)
    return stmt.where(False)


def get_accessible_project(user: User, project_id: int) -> Project:
    project = db.session.get(Project, project_id)
    if project is None:
        raise ProjectAccessError("Project not found.", status_code=404)
    if not can_view_project(user, project):
        raise ProjectAccessError("You do not have access to this project.")
    return project


def can_view_project(user: User, project: Project) -> bool:
    role = user.role_name
    if role == ADMINISTRATOR:
        return True
    if role == PROJECT_MANAGER:
        return project.project_manager_id == user.id
    if role == SITE_ENGINEER:
        return project.site_engineer_id == user.id
    if role == CONTRACTOR_WORKER:
        member = db.session.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == user.id,
            )
        )
        return member is not None
    return False


def can_manage_project(user: User, project: Project) -> bool:
    """Create/update project content (PM owns; Admin elevated)."""
    if user.role_name == ADMINISTRATOR:
        return True
    if user.role_name == PROJECT_MANAGER:
        return project.project_manager_id == user.id
    return False


def can_operate_site(user: User, project: Project) -> bool:
    """Site Engineer operates assigned projects; Admin/PM may also operate."""
    if user.role_name == ADMINISTRATOR:
        return True
    if user.role_name == PROJECT_MANAGER and project.project_manager_id == user.id:
        return True
    if user.role_name == SITE_ENGINEER and project.site_engineer_id == user.id:
        return True
    return False


def assert_can_manage(user: User, project: Project) -> None:
    if not can_manage_project(user, project):
        raise ProjectAccessError("You can only manage projects you are responsible for.")


def assert_can_operate_site(user: User, project: Project) -> None:
    if not can_operate_site(user, project):
        raise ProjectAccessError("You can only manage site activities on assigned projects.")


def assert_project_editable(project: Project) -> None:
    if project.status == "Completed":
        raise ProjectAccessError(
            "Completed projects are protected. Reopen the project before editing.",
            status_code=400,
        )
