"""add customer imports

Revision ID: 8b27cf3ad9f1
Revises: 316c04d1b8a0
Create Date: 2026-06-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8b27cf3ad9f1"
down_revision: Union[str, Sequence[str], None] = "316c04d1b8a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customer_imports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("uploaded_at", sa.DateTime(), nullable=True),
        sa.Column("storage_key", sa.String(), nullable=True),
        sa.Column("filename", sa.String(), nullable=True),
        sa.Column("total_rows", sa.Integer(), nullable=True),
        sa.Column("created_rows", sa.Integer(), nullable=True),
        sa.Column("updated_rows", sa.Integer(), nullable=True),
        sa.Column("review_rows", sa.Integer(), nullable=True),
        sa.Column("skipped_rows", sa.Integer(), nullable=True),
        sa.Column("preview_rows", sa.Text(), nullable=True),
    )
    op.create_table(
        "customer_contacts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("import_id", sa.Integer(), nullable=True),
        sa.Column("imported_at", sa.DateTime(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("first_name", sa.String(), nullable=True),
        sa.Column("last_name", sa.String(), nullable=True),
        sa.Column("company", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("address", sa.String(), nullable=True),
        sa.Column("address_2", sa.String(), nullable=True),
        sa.Column("city", sa.String(), nullable=True),
        sa.Column("state_province", sa.String(), nullable=True),
        sa.Column("postal_code", sa.String(), nullable=True),
        sa.Column("country", sa.String(), nullable=True),
        sa.Column("tags", sa.String(), nullable=True),
        sa.Column("source_status", sa.String(), nullable=True),
    )
    op.create_index("ix_customer_contacts_import_id", "customer_contacts", ["import_id"])
    op.create_index("ix_customer_contacts_email", "customer_contacts", ["email"])
    op.create_index("ix_customer_contacts_company", "customer_contacts", ["company"])


def downgrade() -> None:
    op.drop_index("ix_customer_contacts_company", table_name="customer_contacts")
    op.drop_index("ix_customer_contacts_email", table_name="customer_contacts")
    op.drop_index("ix_customer_contacts_import_id", table_name="customer_contacts")
    op.drop_table("customer_contacts")
    op.drop_table("customer_imports")
