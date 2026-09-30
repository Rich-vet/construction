"""Site Engineer operations: attendance, materials usage, equipment, progress, documents."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

from flask import current_app
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload
from werkzeug.datastructures import FileStorage

from app.extensions import db
from app.models import (
    Attendance,
    Document,
    Equipment,
    EquipmentAllocation,
    MaintenanceRecord,
    Material,
    MaterialRequest,
    MaterialTransaction,
    ProgressUpdate,
    Project,
    ProjectMember,
    SiteReport,
    Task,
    User,
)
from app.models.site import (
    ATTENDANCE_STATUSES,
    EQUIPMENT_CONDITIONS,
    EQUIPMENT_STATUSES,
    TRANSACTION_TYPES,
)
from app.services.activity_service import log_activity
from app.services.notification_service import notify_user
from app.utils.project_access import (
    ProjectAccessError,
    assert_can_operate_site,
    assert_project_editable,
    get_accessible_project,
    projects_query_for,
)
from app.utils.roles import ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER
from app.utils.uploads import UploadError, save_project_document


class SiteServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _parse_date(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError as exc:
        raise SiteServiceError("Invalid date format. Use YYYY-MM-DD.") from exc


def _as_qty(value) -> Decimal:
    try:
        qty = Decimal(str(value))
    except (InvalidOperation, TypeError) as exc:
        raise SiteServiceError("Quantity must be a valid number.") from exc
    return qty


def _assigned_project_ids(actor: User) -> list[int]:
    return list(db.session.scalars(select(Project.id).select_from(projects_query_for(actor))))


def _require_site_project(actor: User, project_id: int) -> Project:
    project = get_accessible_project(actor, project_id)
    assert_can_operate_site(actor, project)
    assert_project_editable(project)
    return project


def se_dashboard(actor: User) -> dict:
    projects = list(
        db.session.scalars(
            projects_query_for(actor).order_by(Project.expected_completion.asc())
        )
    )
    project_ids = [p.id for p in projects]
    today = date.today()

    today_tasks = []
    workers_on_site = 0
    attendance_today = []
    pending_requests = []
    low_stock = []
    equipment_on_site = []

    if project_ids:
        today_tasks = [
            t.to_dict()
            for t in db.session.scalars(
                select(Task)
                .options(joinedload(Task.assigned_user), joinedload(Task.project))
                .where(
                    Task.project_id.in_(project_ids),
                    Task.status.in_(["Pending", "In Progress"]),
                    Task.due_date == today,
                )
                .order_by(Task.priority.desc())
                .limit(20)
            ).unique()
        ]

        attendance_today = [
            a.to_dict()
            for a in db.session.scalars(
                select(Attendance)
                .options(joinedload(Attendance.worker), joinedload(Attendance.project))
                .where(
                    Attendance.project_id.in_(project_ids),
                    Attendance.attendance_date == today,
                )
                .order_by(Attendance.id.desc())
            ).unique()
        ]
        workers_on_site = sum(1 for a in attendance_today if a["status"] in {"Present", "Late"})

        pending_requests = [
            r.to_dict()
            for r in db.session.scalars(
                select(MaterialRequest)
                .options(
                    joinedload(MaterialRequest.material),
                    joinedload(MaterialRequest.project),
                    joinedload(MaterialRequest.requested_by),
                )
                .where(
                    MaterialRequest.project_id.in_(project_ids),
                    MaterialRequest.status == "Pending",
                )
                .order_by(MaterialRequest.created_at.desc())
                .limit(10)
            ).unique()
        ]

        equipment_on_site = [
            a.to_dict()
            for a in db.session.scalars(
                select(EquipmentAllocation)
                .options(
                    joinedload(EquipmentAllocation.equipment),
                    joinedload(EquipmentAllocation.project),
                    joinedload(EquipmentAllocation.operator),
                )
                .where(
                    EquipmentAllocation.project_id.in_(project_ids),
                    EquipmentAllocation.returned_at.is_(None),
                )
                .order_by(EquipmentAllocation.allocated_at.desc())
            ).unique()
        ]

    low_stock = [
        m.to_dict()
        for m in db.session.scalars(select(Material).order_by(Material.name)).all()
        if float(m.quantity or 0) <= float(m.minimum_stock or 0)
    ][:10]

    open_tasks = (
        db.session.scalar(
            select(func.count())
            .select_from(Task)
            .where(
                Task.project_id.in_(project_ids) if project_ids else False,
                Task.status.in_(["Pending", "In Progress"]),
            )
        )
        if project_ids
        else 0
    )

    return {
        "cards": {
            "assigned_projects": len(projects),
            "active_projects": sum(1 for p in projects if p.status == "Active"),
            "today_tasks": len(today_tasks),
            "open_tasks": int(open_tasks or 0),
            "workers_on_site": workers_on_site,
            "pending_material_requests": len(pending_requests),
            "equipment_on_site": len(equipment_on_site),
            "low_stock_materials": len(low_stock),
        },
        "projects": [p.to_dict() for p in projects],
        "today_tasks": today_tasks,
        "attendance_today": attendance_today,
        "pending_material_requests": pending_requests,
        "low_stock_materials": low_stock,
        "equipment_on_site": equipment_on_site,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def list_project_workers(actor: User, project_id: int) -> list[dict]:
    project = get_accessible_project(actor, project_id)
    assert_can_operate_site(actor, project)
    members = db.session.scalars(
        select(ProjectMember)
        .options(joinedload(ProjectMember.user).joinedload(User.role))
        .where(ProjectMember.project_id == project.id)
    ).unique()
    return [
        {
            "user_id": m.user_id,
            "full_name": m.user.full_name if m.user else None,
            "email": m.user.email if m.user else None,
            "role": m.user.role_name if m.user else None,
            "member_role": m.member_role,
        }
        for m in members
        if m.user is not None
    ]


def list_attendance(
    actor: User,
    *,
    project_id: int | None = None,
    attendance_date: date | None = None,
) -> list[dict]:
    ids = _assigned_project_ids(actor)
    if not ids:
        return []
    stmt = (
        select(Attendance)
        .options(joinedload(Attendance.worker), joinedload(Attendance.project))
        .where(Attendance.project_id.in_(ids))
        .order_by(Attendance.attendance_date.desc(), Attendance.id.desc())
    )
    if project_id is not None:
        if project_id not in ids:
            raise ProjectAccessError("You do not have access to this project.")
        stmt = stmt.where(Attendance.project_id == project_id)
    if attendance_date is not None:
        stmt = stmt.where(Attendance.attendance_date == attendance_date)
    return [a.to_dict() for a in db.session.scalars(stmt).unique()]


def record_attendance(actor: User, data: dict) -> Attendance:
    project = _require_site_project(actor, int(data.get("project_id")))
    worker_id = int(data.get("worker_user_id") or 0)
    worker = db.session.get(User, worker_id)
    if worker is None or not worker.is_active:
        raise SiteServiceError("Worker not found or inactive.")
    member = db.session.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == worker_id,
        )
    )
    if member is None and worker_id not in {
        project.site_engineer_id,
        project.project_manager_id,
    }:
        raise SiteServiceError("Worker must be assigned to the project team.")

    status = (data.get("status") or "Present").strip()
    if status not in ATTENDANCE_STATUSES:
        raise SiteServiceError("Invalid attendance status.")

    att_date = _parse_date(data.get("attendance_date")) or date.today()
    existing = db.session.scalar(
        select(Attendance).where(
            Attendance.project_id == project.id,
            Attendance.worker_user_id == worker_id,
            Attendance.attendance_date == att_date,
        )
    )
    if existing:
        existing.check_in = (data.get("check_in") or "").strip() or existing.check_in
        existing.check_out = (data.get("check_out") or "").strip() or existing.check_out
        existing.status = status
        existing.notes = (data.get("notes") or "").strip() or None
        existing.recorded_by_id = actor.id
        record = existing
    else:
        record = Attendance(
            project_id=project.id,
            worker_user_id=worker_id,
            attendance_date=att_date,
            check_in=(data.get("check_in") or "").strip() or None,
            check_out=(data.get("check_out") or "").strip() or None,
            status=status,
            notes=(data.get("notes") or "").strip() or None,
            recorded_by_id=actor.id,
        )
        db.session.add(record)

    db.session.flush()
    log_activity(
        actor=actor,
        action="attendance_recorded",
        entity_type="attendance",
        entity_id=record.id,
        details=f"{worker.full_name} — {status} on {att_date.isoformat()}",
    )
    db.session.commit()
    return record


def list_materials_stock(actor: User) -> list[dict]:
    # Inventory is company-wide; SE can view stock levels for planning.
    _ = actor
    return [m.to_dict() for m in db.session.scalars(select(Material).order_by(Material.name))]


def list_material_transactions(
    actor: User,
    *,
    project_id: int | None = None,
) -> list[dict]:
    ids = _assigned_project_ids(actor)
    stmt = (
        select(MaterialTransaction)
        .options(
            joinedload(MaterialTransaction.material),
            joinedload(MaterialTransaction.project),
            joinedload(MaterialTransaction.recorded_by),
        )
        .order_by(MaterialTransaction.transaction_date.desc(), MaterialTransaction.id.desc())
        .limit(200)
    )
    if actor.role_name != ADMINISTRATOR:
        if not ids:
            return []
        stmt = stmt.where(
            (MaterialTransaction.project_id.in_(ids))
            | (MaterialTransaction.project_id.is_(None))
        )
    if project_id is not None:
        if actor.role_name != ADMINISTRATOR and project_id not in ids:
            raise ProjectAccessError("You do not have access to this project.")
        stmt = stmt.where(MaterialTransaction.project_id == project_id)
    return [t.to_dict() for t in db.session.scalars(stmt).unique()]


def record_material_usage(actor: User, data: dict) -> MaterialTransaction:
    tx_type = (data.get("transaction_type") or "USAGE").strip().upper()
    if tx_type not in TRANSACTION_TYPES:
        raise SiteServiceError("Invalid transaction type.")

    project = None
    project_id_raw = data.get("project_id")
    if tx_type in {"USAGE", "RETURN"}:
        if not project_id_raw:
            raise SiteServiceError("Project is required for usage and returns.")
        project = _require_site_project(actor, int(project_id_raw))
    elif project_id_raw not in (None, ""):
        project = get_accessible_project(actor, int(project_id_raw))
        assert_can_operate_site(actor, project)
    elif actor.role_name not in {ADMINISTRATOR, PROJECT_MANAGER}:
        raise SiteServiceError("Project is required for this transaction.", status_code=403)

    material = db.session.get(Material, int(data.get("material_id") or 0))
    if material is None:
        raise SiteServiceError("Material not found.")

    qty = _as_qty(data.get("quantity"))
    if tx_type != "ADJUSTMENT" and qty <= 0:
        raise SiteServiceError("Quantity must be greater than zero.")

    current = Decimal(str(material.quantity or 0))
    if tx_type == "USAGE":
        if qty > current:
            raise SiteServiceError("Insufficient stock. Usage cannot exceed available quantity.")
        material.quantity = current - qty
    elif tx_type == "RETURN":
        material.quantity = current + qty
    elif tx_type == "ADJUSTMENT":
        # Signed quantity: negative decreases, positive increases.
        signed = _as_qty(data.get("quantity"))
        new_qty = current + signed
        if new_qty < 0:
            raise SiteServiceError("Adjustment would result in negative stock.")
        material.quantity = new_qty
        qty = abs(signed)
    elif tx_type == "PURCHASE":
        material.quantity = current + qty

    task_id = data.get("task_id")
    task = None
    if task_id:
        if project is None:
            raise SiteServiceError("Project is required when linking a task.")
        task = db.session.get(Task, int(task_id))
        if task is None or task.project_id != project.id:
            raise SiteServiceError("Task not found on this project.")

    txn = MaterialTransaction(
        material_id=material.id,
        project_id=project.id if project else None,
        task_id=task.id if task else None,
        transaction_type=tx_type,
        quantity=qty,
        unit_price=_as_qty(data["unit_price"]) if data.get("unit_price") not in (None, "") else None,
        notes=(data.get("notes") or "").strip() or None,
        transaction_date=_parse_date(data.get("transaction_date")) or date.today(),
        recorded_by_id=actor.id,
    )
    db.session.add(txn)
    db.session.flush()
    log_activity(
        actor=actor,
        action="material_transaction",
        entity_type="material",
        entity_id=material.id,
        details=f"{tx_type} {qty} {material.unit or ''} of {material.name}",
    )
    if (
        float(material.quantity or 0) <= float(material.minimum_stock or 0)
        and project
        and project.project_manager_id
    ):
        notify_user(
            user_id=project.project_manager_id,
            title="Low stock alert",
            message=f"{material.name} is at or below minimum stock ({material.quantity} {material.unit or ''}).",
            link="/materials",
        )
    db.session.commit()
    return txn


def _catalog_name_key(name: str) -> str:
    return " ".join((name or "").lower().split())


def _catalog_name_exists(catalog_name: str, existing_names: list[str]) -> bool:
    """True when a stored asset already represents this catalog item."""
    key = _catalog_name_key(catalog_name)
    for existing in existing_names:
        if existing == key or existing.startswith(key + " "):
            return True
    return False


def ensure_demo_equipment() -> None:
    """Insert missing fleet catalog rows. Never updates or deletes existing equipment."""
    from app.equipment_catalog import EQUIPMENT_CATALOG
    from app.models.site import EQUIPMENT_CONDITIONS, EQUIPMENT_STATUSES

    existing = list(db.session.scalars(select(Equipment)))
    asset_ids = {row.asset_id for row in existing}
    names = [_catalog_name_key(row.name) for row in existing]
    added = False
    for item in EQUIPMENT_CATALOG:
        if item["condition"] not in EQUIPMENT_CONDITIONS or item["status"] not in EQUIPMENT_STATUSES:
            continue
        if item["asset_id"] in asset_ids or _catalog_name_exists(item["name"], names):
            continue
        db.session.add(
            Equipment(
                name=item["name"],
                asset_id=item["asset_id"],
                equipment_type=item["equipment_type"],
                quantity=int(item["quantity"]),
                condition=item["condition"],
                status=item["status"],
            )
        )
        asset_ids.add(item["asset_id"])
        names.append(_catalog_name_key(item["name"]))
        added = True
    if added:
        db.session.commit()


def list_equipment(actor: User) -> list[dict]:
    _ = actor
    ensure_demo_equipment()
    return [
        e.to_dict()
        for e in db.session.scalars(
            select(Equipment).options(joinedload(Equipment.allocations)).order_by(Equipment.name)
        ).unique()
    ]


def list_allocations(actor: User, *, project_id: int | None = None) -> list[dict]:
    ids = _assigned_project_ids(actor)
    if not ids and actor.role_name != ADMINISTRATOR:
        return []
    stmt = (
        select(EquipmentAllocation)
        .options(
            joinedload(EquipmentAllocation.equipment),
            joinedload(EquipmentAllocation.project),
            joinedload(EquipmentAllocation.operator),
        )
        .order_by(EquipmentAllocation.allocated_at.desc())
    )
    if actor.role_name != ADMINISTRATOR:
        stmt = stmt.where(EquipmentAllocation.project_id.in_(ids or [-1]))
    if project_id is not None:
        get_accessible_project(actor, project_id)
        stmt = stmt.where(EquipmentAllocation.project_id == project_id)
    return [a.to_dict() for a in db.session.scalars(stmt).unique()]


def _positive_units(value, *, default: int = 1) -> int:
    from app.services.inventory_service import InventoryServiceError, parse_positive_int

    try:
        return parse_positive_int(value, default=default, field="Quantity")
    except InventoryServiceError as exc:
        raise SiteServiceError(exc.message, status_code=exc.status_code) from exc


def _open_allocated_units(equipment: Equipment) -> int:
    total = db.session.scalar(
        select(func.coalesce(func.sum(EquipmentAllocation.quantity), 0)).where(
            EquipmentAllocation.equipment_id == equipment.id,
            EquipmentAllocation.returned_at.is_(None),
        )
    )
    return int(total or 0)


def _refresh_availability(equipment: Equipment) -> None:
    """Sync Available/Allocated from remaining units. Leave maintenance and unavailable alone."""
    if equipment.status in {"Under Maintenance", "Unavailable"}:
        return
    total = int(equipment.quantity or 1)
    equipment.status = "Allocated" if _open_allocated_units(equipment) >= total else "Available"


def allocate_equipment(actor: User, data: dict) -> EquipmentAllocation:
    project = _require_site_project(actor, int(data.get("project_id")))
    equipment = db.session.get(Equipment, int(data.get("equipment_id") or 0))
    if equipment is None:
        raise SiteServiceError("Equipment not found.")
    if equipment.status in {"Under Maintenance", "Unavailable"}:
        raise SiteServiceError("Equipment is not available for allocation.")

    units = _positive_units(data.get("quantity"), default=1)
    if units > equipment.available_unit_count():
        raise SiteServiceError(
            "Not enough units are free. Return allocated units before assigning more."
            if equipment.available_unit_count() <= 0
            else f"Only {equipment.available_unit_count()} unit(s) are available to allocate."
        )

    operator_id = data.get("operator_user_id")
    operator = None
    if operator_id:
        operator = db.session.get(User, int(operator_id))
        if operator is None:
            raise SiteServiceError("Operator not found.")

    allocation = EquipmentAllocation(
        equipment_id=equipment.id,
        project_id=project.id,
        operator_user_id=operator.id if operator else None,
        allocated_at=_parse_date(data.get("allocated_at")) or date.today(),
        expected_return=_parse_date(data.get("expected_return")),
        notes=(data.get("notes") or "").strip() or None,
        quantity=units,
    )
    db.session.add(allocation)
    db.session.flush()
    _refresh_availability(equipment)
    log_activity(
        actor=actor,
        action="equipment_allocated",
        entity_type="equipment",
        entity_id=equipment.id,
        details=f"{equipment.name} → {project.name}",
    )
    db.session.commit()
    return allocation


def return_equipment(actor: User, allocation_id: int, data: dict | None = None) -> EquipmentAllocation:
    data = data or {}
    allocation = db.session.get(EquipmentAllocation, allocation_id)
    if allocation is None:
        raise SiteServiceError("Allocation not found.", status_code=404)
    project = get_accessible_project(actor, allocation.project_id)
    assert_can_operate_site(actor, project)
    if allocation.returned_at is not None:
        raise SiteServiceError("Equipment already returned.")

    allocation.returned_at = _parse_date(data.get("returned_at")) or date.today()
    if data.get("notes"):
        allocation.notes = (data.get("notes") or "").strip()
    if allocation.equipment:
        condition = (data.get("condition") or "").strip()
        if condition:
            if condition not in EQUIPMENT_CONDITIONS:
                raise SiteServiceError("Invalid equipment condition.")
            allocation.equipment.condition = condition
        if allocation.equipment.status in {"Available", "Allocated"}:
            _refresh_availability(allocation.equipment)
    db.session.flush()
    log_activity(
        actor=actor,
        action="equipment_returned",
        entity_type="equipment",
        entity_id=allocation.equipment_id,
        details=f"Returned from {project.name}",
    )
    db.session.commit()
    return allocation


def log_maintenance(actor: User, data: dict) -> MaintenanceRecord:
    if actor.role_name not in {ADMINISTRATOR, PROJECT_MANAGER, SITE_ENGINEER}:
        raise SiteServiceError("Not allowed.", status_code=403)
    equipment = db.session.get(Equipment, int(data.get("equipment_id") or 0))
    if equipment is None:
        raise SiteServiceError("Equipment not found.")
    mtype = (data.get("maintenance_type") or "").strip()
    if not mtype:
        raise SiteServiceError("Maintenance type is required.")
    record = MaintenanceRecord(
        equipment_id=equipment.id,
        maintenance_date=_parse_date(data.get("maintenance_date")) or date.today(),
        maintenance_type=mtype,
        description=(data.get("description") or "").strip() or None,
        cost=_as_qty(data.get("cost") or 0),
        service_provider=(data.get("service_provider") or "").strip() or None,
        next_maintenance_date=_parse_date(data.get("next_maintenance_date")),
    )
    equipment.status = "Under Maintenance"
    db.session.add(record)
    db.session.flush()
    log_activity(
        actor=actor,
        action="equipment_maintenance",
        entity_type="equipment",
        entity_id=equipment.id,
        details=mtype,
    )
    db.session.commit()
    return record


def list_progress_updates(actor: User, project_id: int | None = None) -> list[dict]:
    ids = _assigned_project_ids(actor)
    if not ids:
        return []
    stmt = (
        select(ProgressUpdate)
        .options(joinedload(ProgressUpdate.project), joinedload(ProgressUpdate.created_by))
        .where(ProgressUpdate.project_id.in_(ids))
        .order_by(ProgressUpdate.update_date.desc(), ProgressUpdate.id.desc())
    )
    if project_id is not None:
        if project_id not in ids:
            raise ProjectAccessError("You do not have access to this project.")
        stmt = stmt.where(ProgressUpdate.project_id == project_id)
    return [p.to_dict() for p in db.session.scalars(stmt).unique()]


def create_progress_update(actor: User, data: dict) -> ProgressUpdate:
    project = _require_site_project(actor, int(data.get("project_id")))
    work = (data.get("work_completed") or "").strip()
    if not work:
        raise SiteServiceError("Work completed description is required.")
    percentage = float(data.get("percentage") or 0)
    if percentage < 0 or percentage > 100:
        raise SiteServiceError("Percentage must be between 0 and 100.")

    update = ProgressUpdate(
        project_id=project.id,
        update_date=_parse_date(data.get("update_date")) or date.today(),
        work_completed=work,
        percentage=percentage,
        problems=(data.get("problems") or "").strip() or None,
        next_activities=(data.get("next_activities") or "").strip() or None,
        created_by_id=actor.id,
    )
    # SE progress updates also nudge project progress when higher.
    if percentage > float(project.progress or 0):
        project.progress = percentage
    db.session.add(update)
    db.session.flush()
    log_activity(
        actor=actor,
        action="progress_update",
        entity_type="project",
        entity_id=project.id,
        details=f"{percentage}% — {work[:80]}",
    )
    if project.project_manager_id and project.project_manager_id != actor.id:
        notify_user(
            user_id=project.project_manager_id,
            title="Progress update submitted",
            message=f"{actor.full_name} updated {project.name} to {percentage}%.",
            link=f"/projects/{project.id}",
        )
    db.session.commit()
    return update


def create_site_diary(actor: User, data: dict) -> dict:
    """Authoritative Site Diary write: one entry dual-writes SiteReport + ProgressUpdate.

    Avoids engineers filling two overlapping forms. Uses a single commit.
    """
    project = _require_site_project(actor, int(data.get("project_id")))
    diary_date = _parse_date(data.get("diary_date") or data.get("report_date") or data.get("update_date")) or date.today()
    activities = (data.get("activities_completed") or data.get("work_completed") or "").strip()
    problems = (data.get("problems") or "").strip() or None
    next_activities = (data.get("next_activities") or "").strip() or None
    materials_used = (data.get("materials_used") or "").strip() or None
    equipment_used = (data.get("equipment_used") or "").strip() or None
    safety = (data.get("safety_observations") or "").strip() or None
    workers_raw = data.get("workers_present")
    workers_present = int(workers_raw) if workers_raw not in (None, "") else None

    percentage = float(data.get("percentage") or 0)
    if percentage < 0 or percentage > 100:
        raise SiteServiceError("Percentage must be between 0 and 100.")

    if not activities and not any([materials_used, equipment_used, problems, safety, next_activities]):
        raise SiteServiceError("Enter activities completed or at least one diary section.")

    work_text = activities or "Site diary entry"
    report = SiteReport(
        project_id=project.id,
        report_date=diary_date,
        workers_present=workers_present,
        activities_completed=activities or None,
        materials_used=materials_used,
        equipment_used=equipment_used,
        problems=problems,
        safety_observations=safety,
        next_activities=next_activities,
        created_by_id=actor.id,
    )
    update = ProgressUpdate(
        project_id=project.id,
        update_date=diary_date,
        work_completed=work_text,
        percentage=percentage,
        problems=problems,
        next_activities=next_activities,
        created_by_id=actor.id,
    )
    if percentage > float(project.progress or 0):
        project.progress = percentage

    db.session.add(report)
    db.session.add(update)
    db.session.flush()
    log_activity(
        actor=actor,
        action="site_diary",
        entity_type="project",
        entity_id=project.id,
        details=f"{diary_date.isoformat()} · {percentage}% — {work_text[:80]}",
    )
    if project.project_manager_id and project.project_manager_id != actor.id:
        notify_user(
            user_id=project.project_manager_id,
            title="Site diary submitted",
            message=f"{actor.full_name} submitted a site diary for {project.name} ({percentage}%).",
            link=f"/projects/{project.id}?tab=site",
        )
    db.session.commit()
    return {
        "report": report.to_dict(),
        "progress_update": update.to_dict(),
    }


def list_site_reports(actor: User, project_id: int | None = None) -> list[dict]:
    ids = _assigned_project_ids(actor)
    if not ids:
        return []
    stmt = (
        select(SiteReport)
        .options(joinedload(SiteReport.project), joinedload(SiteReport.created_by))
        .where(SiteReport.project_id.in_(ids))
        .order_by(SiteReport.report_date.desc(), SiteReport.id.desc())
    )
    if project_id is not None:
        if project_id not in ids:
            raise ProjectAccessError("You do not have access to this project.")
        stmt = stmt.where(SiteReport.project_id == project_id)
    return [r.to_dict() for r in db.session.scalars(stmt).unique()]


def create_site_report(actor: User, data: dict) -> SiteReport:
    project = _require_site_project(actor, int(data.get("project_id")))
    report = SiteReport(
        project_id=project.id,
        report_date=_parse_date(data.get("report_date")) or date.today(),
        workers_present=int(data["workers_present"]) if data.get("workers_present") not in (None, "") else None,
        activities_completed=(data.get("activities_completed") or "").strip() or None,
        materials_used=(data.get("materials_used") or "").strip() or None,
        equipment_used=(data.get("equipment_used") or "").strip() or None,
        problems=(data.get("problems") or "").strip() or None,
        safety_observations=(data.get("safety_observations") or "").strip() or None,
        next_activities=(data.get("next_activities") or "").strip() or None,
        created_by_id=actor.id,
    )
    if not any(
        [
            report.activities_completed,
            report.materials_used,
            report.equipment_used,
            report.problems,
            report.safety_observations,
            report.next_activities,
        ]
    ):
        raise SiteServiceError("Please enter at least one report section.")
    db.session.add(report)
    db.session.flush()
    log_activity(
        actor=actor,
        action="site_report",
        entity_type="project",
        entity_id=project.id,
        details=f"Site report for {report.report_date.isoformat()}",
    )
    if project.project_manager_id and project.project_manager_id != actor.id:
        notify_user(
            user_id=project.project_manager_id,
            title="New site report",
            message=f"{actor.full_name} submitted a site report for {project.name}.",
            link=f"/projects/{project.id}",
        )
    db.session.commit()
    return report


def list_documents(actor: User, project_id: int | None = None) -> list[dict]:
    ids = _assigned_project_ids(actor)
    if not ids and actor.role_name != ADMINISTRATOR:
        return []
    stmt = (
        select(Document)
        .options(joinedload(Document.project), joinedload(Document.uploaded_by))
        .order_by(Document.created_at.desc())
    )
    if actor.role_name != ADMINISTRATOR:
        stmt = stmt.where(Document.project_id.in_(ids or [-1]))
    if project_id is not None:
        get_accessible_project(actor, project_id)
        stmt = stmt.where(Document.project_id == project_id)
    return [d.to_dict() for d in db.session.scalars(stmt).unique()]


def upload_document(actor: User, data: dict, file: FileStorage) -> Document:
    project_id = data.get("project_id")
    if not project_id:
        raise SiteServiceError("Project is required for document upload.")
    project = _require_site_project(actor, int(project_id))
    name = (data.get("name") or "").strip() or (file.filename or "Document")
    try:
        relative, original, mime = save_project_document(file)
    except UploadError as exc:
        raise SiteServiceError(exc.message) from exc

    doc = Document(
        name=name[:200],
        document_type=(data.get("document_type") or "Photo").strip() or "Photo",
        project_id=project.id,
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
        action="document_uploaded",
        entity_type="document",
        entity_id=doc.id,
        details=doc.name,
    )
    db.session.commit()
    return doc


def get_document_for_download(actor: User, document_id: int) -> tuple[Document, Path]:
    doc = db.session.get(Document, document_id)
    if doc is None:
        raise SiteServiceError("Document not found.", status_code=404)
    if doc.project_id is None:
        raise SiteServiceError("Document not found.", status_code=404)
    get_accessible_project(actor, doc.project_id)
    path = Path(current_app.config["UPLOAD_FOLDER"]) / doc.file_path
    if not path.is_file():
        raise SiteServiceError("Document file is missing.", status_code=404)
    return doc, path


def site_meta(actor: User) -> dict:
    ensure_demo_equipment()
    projects = [p.to_dict() for p in db.session.scalars(projects_query_for(actor).order_by(Project.name))]
    materials = [m.to_dict() for m in db.session.scalars(select(Material).order_by(Material.name))]
    tx_types = ["USAGE", "RETURN"]
    if actor.role_name in {ADMINISTRATOR, PROJECT_MANAGER}:
        tx_types = ["USAGE", "RETURN", "PURCHASE", "ADJUSTMENT"]
    return {
        "projects": projects,
        "materials": materials,
        "attendance_statuses": list(ATTENDANCE_STATUSES),
        "transaction_types": tx_types,
        "equipment_statuses": list(EQUIPMENT_STATUSES),
        "equipment_conditions": list(EQUIPMENT_CONDITIONS),
        "document_types": ["Photo", "Drawing", "Permit", "Report", "Work Evidence", "Other"],
        "can_manage_catalog": actor.role_name in {ADMINISTRATOR, PROJECT_MANAGER},
        "can_operate_site": actor.role_name in {PROJECT_MANAGER, SITE_ENGINEER},
    }
