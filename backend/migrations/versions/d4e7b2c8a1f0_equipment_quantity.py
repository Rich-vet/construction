"""equipment stock quantity

Revision ID: d4e7b2c8a1f0
Revises: c3f8a1b9e2d4
Create Date: 2026-09-30 05:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "d4e7b2c8a1f0"
down_revision = "c3f8a1b9e2d4"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("equipment", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1")
        )
    with op.batch_alter_table("equipment_allocations", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1")
        )


def downgrade():
    with op.batch_alter_table("equipment_allocations", schema=None) as batch_op:
        batch_op.drop_column("quantity")
    with op.batch_alter_table("equipment", schema=None) as batch_op:
        batch_op.drop_column("quantity")
