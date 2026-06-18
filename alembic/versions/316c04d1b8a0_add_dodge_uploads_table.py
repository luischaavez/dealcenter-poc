"""add dodge_uploads table

Revision ID: 316c04d1b8a0
Revises: c7710e5353d8
Create Date: 2026-06-17 17:21:09.009384

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '316c04d1b8a0'
down_revision: Union[str, Sequence[str], None] = 'c7710e5353d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dodge_uploads",
        sa.Column("id",          sa.Integer(),  primary_key=True, autoincrement=True),
        sa.Column("file_date",   sa.String(),   nullable=True),
        sa.Column("uploaded_at", sa.DateTime(), nullable=True),
        sa.Column("storage_key", sa.String(),   nullable=True),
        sa.Column("filename",    sa.String(),   nullable=True),
    )
    op.create_index("ix_dodge_uploads_file_date", "dodge_uploads", ["file_date"])


def downgrade() -> None:
    op.drop_index("ix_dodge_uploads_file_date", table_name="dodge_uploads")
    op.drop_table("dodge_uploads")
