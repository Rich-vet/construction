"""Task inspection workflow and equipment requests.

Revision ID: e5a1c9d7b2f4
Revises: d4e7b2c8a1f0
Create Date: 2026-11-04 05:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "e5a1c9d7b2f4"
down_revision = "d4e7b2c8a1f0"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("tasks", schema=None) as batch_op:
        batch_op.add_column(sa.Column("instructions", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("checklist_json", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("due_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("progress_percent", sa.Float(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("completion_report", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("approved_by_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("rework_count", sa.Integer(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("rework_notes", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("require_evidence", sa.Boolean(), nullable=False, server_default="0"))
        batch_op.create_foreign_key("fk_tasks_approved_by", "users", ["approved_by_id"], ["id"])

    op.create_table(
        "task_progress_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("percentage", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("work_performed", sa.Text(), nullable=True),
        sa.Column("challenges", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_progress_reports_task_id", "task_progress_reports", ["task_id"])
    op.create_index("ix_task_progress_reports_user_id", "task_progress_reports", ["user_id"])

    op.create_table(
        "task_inspections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("inspector_id", sa.Integer(), nullable=False),
        sa.Column("outcome", sa.String(length=40), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("correction_instructions", sa.Text(), nullable=True),
        sa.Column("completion_report", sa.Text(), nullable=True),
        sa.Column("new_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["inspector_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_inspections_task_id", "task_inspections", ["task_id"])

    op.create_table(
        "task_reminders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reminder_key", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id", "reminder_key", name="uq_task_reminder_key"),
    )
    op.create_index("ix_task_reminders_task_id", "task_reminders", ["task_id"])
    op.create_index("ix_task_reminders_user_id", "task_reminders", ["user_id"])

    with op.batch_alter_table("equipment", schema=None) as batch_op:
        batch_op.add_column(sa.Column("maintenance_hold", sa.Integer(), nullable=False, server_default="0"))

    with op.batch_alter_table("equipment_allocations", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("allocation_state", sa.String(length=40), nullable=False, server_default="Issued")
        )
        batch_op.add_column(sa.Column("issued_by_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("received_by_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("condition_at_issue", sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column("return_condition", sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column("damage_notes", sa.Text(), nullable=True))

    with op.batch_alter_table("maintenance_records", schema=None) as batch_op:
        batch_op.add_column(sa.Column("priority", sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column("reported_by_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("completed_at", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("inspection_result", sa.String(length=40), nullable=True))

    op.create_table(
        "equipment_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("equipment_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column("requested_issue_date", sa.Date(), nullable=True),
        sa.Column("expected_return", sa.Date(), nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("requested_by_id", sa.Integer(), nullable=False),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("allocation_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["allocation_id"], ["equipment_allocations.id"]),
        sa.ForeignKeyConstraint(["equipment_id"], ["equipment.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_equipment_requests_equipment_id", "equipment_requests", ["equipment_id"])
    op.create_index("ix_equipment_requests_project_id", "equipment_requests", ["project_id"])
    op.create_index("ix_equipment_requests_status", "equipment_requests", ["status"])


def downgrade():
    op.drop_index("ix_equipment_requests_status", table_name="equipment_requests")
    op.drop_index("ix_equipment_requests_project_id", table_name="equipment_requests")
    op.drop_index("ix_equipment_requests_equipment_id", table_name="equipment_requests")
    op.drop_table("equipment_requests")
    with op.batch_alter_table("maintenance_records", schema=None) as batch_op:
        batch_op.drop_column("inspection_result")
        batch_op.drop_column("completed_at")
        batch_op.drop_column("reported_by_id")
        batch_op.drop_column("priority")
    with op.batch_alter_table("equipment_allocations", schema=None) as batch_op:
        batch_op.drop_column("damage_notes")
        batch_op.drop_column("return_condition")
        batch_op.drop_column("condition_at_issue")
        batch_op.drop_column("received_by_id")
        batch_op.drop_column("issued_by_id")
        batch_op.drop_column("allocation_state")
    with op.batch_alter_table("equipment", schema=None) as batch_op:
        batch_op.drop_column("maintenance_hold")
    op.drop_index("ix_task_reminders_user_id", table_name="task_reminders")
    op.drop_index("ix_task_reminders_task_id", table_name="task_reminders")
    op.drop_table("task_reminders")
    op.drop_index("ix_task_inspections_task_id", table_name="task_inspections")
    op.drop_table("task_inspections")
    op.drop_index("ix_task_progress_reports_user_id", table_name="task_progress_reports")
    op.drop_index("ix_task_progress_reports_task_id", table_name="task_progress_reports")
    op.drop_table("task_progress_reports")
    with op.batch_alter_table("tasks", schema=None) as batch_op:
        batch_op.drop_constraint("fk_tasks_approved_by", type_="foreignkey")
        batch_op.drop_column("require_evidence")
        batch_op.drop_column("rework_notes")
        batch_op.drop_column("rework_count")
        batch_op.drop_column("approved_by_id")
        batch_op.drop_column("approved_at")
        batch_op.drop_column("submitted_at")
        batch_op.drop_column("completion_report")
        batch_op.drop_column("progress_percent")
        batch_op.drop_column("due_at")
        batch_op.drop_column("checklist_json")
        batch_op.drop_column("instructions")
