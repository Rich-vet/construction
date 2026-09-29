"""Filtered operational reports with print/PDF support."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import (
    Attendance,
    BudgetLine,
    Delivery,
    Equipment,
    Expense,
    Material,
    MaterialRequest,
    MaterialTransaction,
    ProgressUpdate,
    Project,
    PurchaseOrder,
    Quotation,
    SiteReport,
    Task,
    User,
)
from app.utils.project_access import projects_query_for

REPORT_TYPES = (
    {
        "id": "project_progress",
        "title": "Project Progress Report",
        "description": "Project status, progress %, and open tasks.",
    },
    {
        "id": "financial",
        "title": "Financial Report",
        "description": "Budgets and expenses by project.",
    },
    {
        "id": "budget_vs_actual",
        "title": "Budget vs Actual Report",
        "description": "Category budget compared with actual spend.",
    },
    {
        "id": "material_usage",
        "title": "Material Usage Report",
        "description": "Material transactions on projects.",
    },
    {
        "id": "inventory",
        "title": "Inventory Report",
        "description": "Current stock levels and low-stock items.",
    },
    {
        "id": "attendance",
        "title": "Employee / Attendance Report",
        "description": "Attendance records by project and date.",
    },
    {
        "id": "equipment",
        "title": "Equipment Report",
        "description": "Fleet status and active allocations.",
    },
    {
        "id": "procurement",
        "title": "Procurement Report",
        "description": "Requests, quotations, purchase orders, and deliveries.",
    },
    {
        "id": "site_activity",
        "title": "Site Activity Report",
        "description": "Progress updates and daily site reports.",
    },
)


class ReportServiceError(Exception):
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
        raise ReportServiceError("Invalid date. Use YYYY-MM-DD.") from exc


def _project_ids(actor: User, project_id: int | None = None) -> list[int]:
    ids = [p.id for p in db.session.scalars(projects_query_for(actor))]
    if project_id is None:
        return ids
    if project_id not in ids:
        raise ReportServiceError("You do not have access to this project.", status_code=403)
    return [project_id]


def list_report_types(actor: User) -> dict:
    projects = [
        {"id": p.id, "name": p.name}
        for p in db.session.scalars(projects_query_for(actor).order_by(Project.name))
    ]
    return {
        "types": list(REPORT_TYPES),
        "projects": projects,
        "currency": "ZMW",
        "currency_symbol": "K",
    }


def generate_report(
    actor: User,
    report_id: str,
    *,
    project_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    meta = next((t for t in REPORT_TYPES if t["id"] == report_id), None)
    if meta is None:
        raise ReportServiceError("Unknown report type.", status_code=404)

    d_from = _parse_date(date_from)
    d_to = _parse_date(date_to)
    if d_from and d_to and d_to < d_from:
        raise ReportServiceError("End date must be on or after start date.")

    ids = _project_ids(actor, project_id)
    builders = {
        "project_progress": _project_progress,
        "financial": _financial,
        "budget_vs_actual": _budget_vs_actual,
        "material_usage": _material_usage,
        "inventory": _inventory,
        "attendance": _attendance,
        "equipment": _equipment,
        "procurement": _procurement,
        "site_activity": _site_activity,
    }
    columns, rows, summary = builders[report_id](ids, d_from, d_to)
    return {
        "report_id": report_id,
        "title": meta["title"],
        "description": meta["description"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filters": {
            "project_id": project_id,
            "date_from": d_from.isoformat() if d_from else None,
            "date_to": d_to.isoformat() if d_to else None,
        },
        "summary": summary,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


def _project_progress(ids: list[int], d_from, d_to):
    columns = ["Project", "Client", "Status", "Progress %", "Open tasks", "Start", "Expected end"]
    if not ids:
        return columns, [], {"projects": 0}
    projects = db.session.scalars(select(Project).where(Project.id.in_(ids)).order_by(Project.name))
    rows = []
    for p in projects:
        open_tasks = (
            db.session.scalar(
                select(func.count())
                .select_from(Task)
                .where(
                    Task.project_id == p.id,
                    Task.status.in_(["Pending", "In Progress"]),
                )
            )
            or 0
        )
        rows.append(
            [
                p.name,
                p.client_name,
                p.status,
                f"{float(p.progress or 0):.0f}",
                str(open_tasks),
                p.start_date.isoformat() if p.start_date else "—",
                p.expected_completion.isoformat() if p.expected_completion else "—",
            ]
        )
    return columns, rows, {"projects": len(rows)}


def _financial(ids: list[int], d_from, d_to):
    columns = ["Project", "Budget (K)", "Expenses (K)", "Remaining (K)"]
    if not ids:
        return columns, [], {"total_budget": 0, "total_expenses": 0}
    rows = []
    total_budget = Decimal("0")
    total_expenses = Decimal("0")
    for p in db.session.scalars(select(Project).where(Project.id.in_(ids)).order_by(Project.name)):
        budget = Decimal(
            str(
                db.session.scalar(
                    select(func.coalesce(func.sum(BudgetLine.amount), 0)).where(
                        BudgetLine.project_id == p.id
                    )
                )
                or p.budget
                or 0
            )
        )
        exp_stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.project_id == p.id,
            Expense.status == "Approved",
        )
        if d_from:
            exp_stmt = exp_stmt.where(Expense.expense_date >= d_from)
        if d_to:
            exp_stmt = exp_stmt.where(Expense.expense_date <= d_to)
        expenses = Decimal(str(db.session.scalar(exp_stmt) or 0))
        total_budget += budget
        total_expenses += expenses
        rows.append(
            [
                p.name,
                f"{float(budget):,.2f}",
                f"{float(expenses):,.2f}",
                f"{float(budget - expenses):,.2f}",
            ]
        )
    return columns, rows, {
        "total_budget": float(total_budget),
        "total_expenses": float(total_expenses),
        "remaining": float(total_budget - total_expenses),
    }


def _budget_vs_actual(ids: list[int], d_from, d_to):
    columns = ["Project", "Category", "Budget (K)", "Actual (K)", "Variance (K)"]
    if not ids:
        return columns, [], {}
    rows = []
    for p in db.session.scalars(select(Project).where(Project.id.in_(ids)).order_by(Project.name)):
        lines = db.session.scalars(select(BudgetLine).where(BudgetLine.project_id == p.id))
        categories = {l.category: float(l.amount or 0) for l in lines}
        expenses = db.session.scalars(
            select(Expense).where(Expense.project_id == p.id, Expense.status == "Approved")
        )
        actuals: dict[str, float] = {}
        for e in expenses:
            if d_from and e.expense_date and e.expense_date < d_from:
                continue
            if d_to and e.expense_date and e.expense_date > d_to:
                continue
            actuals[e.category] = actuals.get(e.category, 0) + float(e.amount or 0)
        for category in sorted(set(categories) | set(actuals)):
            budget = categories.get(category, 0)
            actual = actuals.get(category, 0)
            rows.append(
                [
                    p.name,
                    category,
                    f"{budget:,.2f}",
                    f"{actual:,.2f}",
                    f"{actual - budget:,.2f}",
                ]
            )
    return columns, rows, {"lines": len(rows)}


def _material_usage(ids: list[int], d_from, d_to):
    columns = ["Date", "Project", "Material", "Type", "Qty", "Recorded by"]
    if not ids:
        return columns, [], {"transactions": 0}
    stmt = (
        select(MaterialTransaction)
        .options(
            joinedload(MaterialTransaction.material),
            joinedload(MaterialTransaction.project),
            joinedload(MaterialTransaction.recorded_by),
        )
        .where(MaterialTransaction.project_id.in_(ids))
        .order_by(MaterialTransaction.transaction_date.desc())
    )
    if d_from:
        stmt = stmt.where(MaterialTransaction.transaction_date >= d_from)
    if d_to:
        stmt = stmt.where(MaterialTransaction.transaction_date <= d_to)
    rows = [
        [
            t.transaction_date.isoformat() if t.transaction_date else "—",
            t.project.name if t.project else "—",
            t.material.name if t.material else "—",
            t.transaction_type,
            f"{float(t.quantity or 0):.2f}",
            t.recorded_by.full_name if t.recorded_by else "—",
        ]
        for t in db.session.scalars(stmt).unique()
    ]
    return columns, rows, {"transactions": len(rows)}


def _inventory(ids: list[int], d_from, d_to):
    _ = (ids, d_from, d_to)
    columns = ["Material", "Category", "Qty", "Unit", "Minimum", "Status"]
    rows = []
    low = 0
    for m in db.session.scalars(select(Material).order_by(Material.name)):
        qty = float(m.quantity or 0)
        minimum = float(m.minimum_stock or 0)
        is_low = qty <= minimum
        if is_low:
            low += 1
        rows.append(
            [
                m.name,
                m.category or "—",
                f"{qty:.2f}",
                m.unit or "unit",
                f"{minimum:.2f}",
                "Low" if is_low else "OK",
            ]
        )
    return columns, rows, {"materials": len(rows), "low_stock": low}


def _attendance(ids: list[int], d_from, d_to):
    columns = ["Date", "Project", "Worker", "Status", "Check in", "Check out"]
    if not ids:
        return columns, [], {"records": 0}
    stmt = (
        select(Attendance)
        .options(joinedload(Attendance.project), joinedload(Attendance.worker))
        .where(Attendance.project_id.in_(ids))
        .order_by(Attendance.attendance_date.desc())
    )
    if d_from:
        stmt = stmt.where(Attendance.attendance_date >= d_from)
    if d_to:
        stmt = stmt.where(Attendance.attendance_date <= d_to)
    rows = [
        [
            a.attendance_date.isoformat() if a.attendance_date else "—",
            a.project.name if a.project else "—",
            a.worker.full_name if a.worker else "—",
            a.status,
            a.check_in or "—",
            a.check_out or "—",
        ]
        for a in db.session.scalars(stmt).unique()
    ]
    return columns, rows, {"records": len(rows)}


def _equipment(ids: list[int], d_from, d_to):
    _ = (d_from, d_to)
    columns = ["Asset", "Name", "Type", "Condition", "Status", "Current project"]
    rows = []
    for e in db.session.scalars(
        select(Equipment).options(joinedload(Equipment.allocations)).order_by(Equipment.name)
    ).unique():
        current = next((a for a in e.allocations if a.returned_at is None), None)
        if ids and current and current.project_id not in ids and e.status == "Allocated":
            continue
        rows.append(
            [
                e.asset_id,
                e.name,
                e.equipment_type or "—",
                e.condition,
                e.status,
                current.project.name if current and current.project else "—",
            ]
        )
    return columns, rows, {"equipment": len(rows)}


def _procurement(ids: list[int], d_from, d_to):
    columns = ["Type", "Date", "Project", "Material", "Qty", "Status / notes"]
    if not ids:
        return columns, [], {}
    rows = []
    reqs = db.session.scalars(
        select(MaterialRequest)
        .options(joinedload(MaterialRequest.project), joinedload(MaterialRequest.material))
        .where(MaterialRequest.project_id.in_(ids))
        .order_by(MaterialRequest.request_date.desc())
    ).unique()
    for r in reqs:
        if d_from and r.request_date and r.request_date < d_from:
            continue
        if d_to and r.request_date and r.request_date > d_to:
            continue
        rows.append(
            [
                "Request",
                r.request_date.isoformat() if r.request_date else "—",
                r.project.name if r.project else "—",
                r.material.name if r.material else "—",
                f"{float(r.quantity or 0):.2f}",
                r.status,
            ]
        )
    quotes = db.session.scalars(
        select(Quotation)
        .options(
            joinedload(Quotation.project),
            joinedload(Quotation.material),
            joinedload(Quotation.supplier),
        )
        .where(Quotation.project_id.in_(ids))
    ).unique()
    for q in quotes:
        created = q.created_at.date() if q.created_at else None
        if d_from and created and created < d_from:
            continue
        if d_to and created and created > d_to:
            continue
        rows.append(
            [
                "Quotation",
                created.isoformat() if created else "—",
                q.project.name if q.project else "—",
                q.material.name if q.material else "—",
                f"{float(q.quantity or 0):.2f}",
                f"{q.supplier.name if q.supplier else '—'} · K{float(q.total_price or 0):,.2f}"
                + (" · selected" if q.is_selected else ""),
            ]
        )
    pos = db.session.scalars(
        select(PurchaseOrder)
        .options(joinedload(PurchaseOrder.project), joinedload(PurchaseOrder.material))
        .where(PurchaseOrder.project_id.in_(ids))
    ).unique()
    for po in pos:
        created = po.created_at.date() if po.created_at else None
        if d_from and created and created < d_from:
            continue
        if d_to and created and created > d_to:
            continue
        rows.append(
            [
                "PO",
                created.isoformat() if created else "—",
                po.project.name if po.project else "—",
                po.material.name if po.material else "—",
                f"{float(po.quantity or 0):.2f}",
                po.status,
            ]
        )
    deliveries = db.session.scalars(
        select(Delivery)
        .options(joinedload(Delivery.purchase_order).joinedload(PurchaseOrder.project))
        .join(PurchaseOrder)
        .where(PurchaseOrder.project_id.in_(ids))
        .order_by(Delivery.delivery_date.desc())
    ).unique()
    for d in deliveries:
        if d_from and d.delivery_date and d.delivery_date < d_from:
            continue
        if d_to and d.delivery_date and d.delivery_date > d_to:
            continue
        po = d.purchase_order
        rows.append(
            [
                "Delivery",
                d.delivery_date.isoformat() if d.delivery_date else "—",
                po.project.name if po and po.project else "—",
                po.material.name if po and po.material else "—",
                f"{float(d.quantity_received or 0):.2f}",
                d.delivery_note or "Received",
            ]
        )
    return columns, rows, {"entries": len(rows)}


def _site_activity(ids: list[int], d_from, d_to):
    columns = ["Kind", "Date", "Project", "Summary", "By"]
    if not ids:
        return columns, [], {}
    rows = []
    updates = db.session.scalars(
        select(ProgressUpdate)
        .options(joinedload(ProgressUpdate.project), joinedload(ProgressUpdate.created_by))
        .where(ProgressUpdate.project_id.in_(ids))
        .order_by(ProgressUpdate.update_date.desc())
    ).unique()
    for u in updates:
        if d_from and u.update_date and u.update_date < d_from:
            continue
        if d_to and u.update_date and u.update_date > d_to:
            continue
        rows.append(
            [
                "Progress",
                u.update_date.isoformat() if u.update_date else "—",
                u.project.name if u.project else "—",
                f"{float(u.percentage or 0):.0f}% — {(u.work_completed or '')[:80]}",
                u.created_by.full_name if u.created_by else "—",
            ]
        )
    reports = db.session.scalars(
        select(SiteReport)
        .options(joinedload(SiteReport.project), joinedload(SiteReport.created_by))
        .where(SiteReport.project_id.in_(ids))
        .order_by(SiteReport.report_date.desc())
    ).unique()
    for r in reports:
        if d_from and r.report_date and r.report_date < d_from:
            continue
        if d_to and r.report_date and r.report_date > d_to:
            continue
        rows.append(
            [
                "Site report",
                r.report_date.isoformat() if r.report_date else "—",
                r.project.name if r.project else "—",
                (r.activities_completed or r.problems or "—")[:100],
                r.created_by.full_name if r.created_by else "—",
            ]
        )
    return columns, rows, {"entries": len(rows)}


def render_pdf(report: dict) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    story = [
        Paragraph("CCMS — Construction Company Management System", styles["Heading2"]),
        Paragraph(report["title"], styles["Heading1"]),
        Paragraph(f"Generated: {report['generated_at']}", styles["Normal"]),
    ]
    filters = report.get("filters") or {}
    filt_bits = []
    if filters.get("project_id"):
        filt_bits.append(f"Project ID: {filters['project_id']}")
    if filters.get("date_from"):
        filt_bits.append(f"From: {filters['date_from']}")
    if filters.get("date_to"):
        filt_bits.append(f"To: {filters['date_to']}")
    if filt_bits:
        story.append(Paragraph(" · ".join(filt_bits), styles["Normal"]))
    summary = report.get("summary") or {}
    if summary:
        story.append(
            Paragraph(
                "Summary: "
                + ", ".join(f"{k.replace('_', ' ')}={v}" for k, v in summary.items()),
                styles["Normal"],
            )
        )
    story.append(Spacer(1, 0.4 * cm))

    columns = report.get("columns") or []
    rows = report.get("rows") or []
    table_data = [columns] + rows if columns else [["No data"]]
    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f252e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f6f8")]),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    return buffer.getvalue()
