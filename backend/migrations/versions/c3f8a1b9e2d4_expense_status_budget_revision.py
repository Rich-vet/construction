"""expense status and budget revision SoD

Revision ID: c3f8a1b9e2d4
Revises: bbe41898ecb5
Create Date: 2026-09-29 14:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "c3f8a1b9e2d4"
down_revision = "bbe41898ecb5"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("budget_lines", schema=None) as batch_op:
        batch_op.add_column(sa.Column("pending_amount", sa.Numeric(precision=14, scale=2), nullable=True))
        batch_op.add_column(sa.Column("pending_by_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_budget_lines_pending_by_id_users",
            "users",
            ["pending_by_id"],
            ["id"],
        )

    with op.batch_alter_table("expenses", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("status", sa.String(length=40), nullable=False, server_default="Approved")
        )
        batch_op.add_column(sa.Column("reviewed_by_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("review_notes", sa.String(length=500), nullable=True))
        batch_op.create_index(batch_op.f("ix_expenses_status"), ["status"], unique=False)
        batch_op.create_foreign_key(
            "fk_expenses_reviewed_by_id_users",
            "users",
            ["reviewed_by_id"],
            ["id"],
        )

    # Existing rows were already booked as spend; keep them as Approved.
    op.execute("UPDATE expenses SET status = 'Approved' WHERE status IS NULL OR status = ''")


def downgrade():
    with op.batch_alter_table("expenses", schema=None) as batch_op:
        batch_op.drop_constraint("fk_expenses_reviewed_by_id_users", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_expenses_status"))
        batch_op.drop_column("review_notes")
        batch_op.drop_column("reviewed_by_id")
        batch_op.drop_column("status")

    with op.batch_alter_table("budget_lines", schema=None) as batch_op:
        batch_op.drop_constraint("fk_budget_lines_pending_by_id_users", type_="foreignkey")
        batch_op.drop_column("pending_by_id")
        batch_op.drop_column("pending_amount")
