"""initial schema

Revision ID: c7710e5353d8
Revises: 
Create Date: 2026-06-17 16:22:54.373165

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7710e5353d8'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("project_id",        sa.String(),  primary_key=True),
        sa.Column("title",             sa.String(),  nullable=True),
        sa.Column("first_seen",        sa.DateTime(), nullable=True),
        sa.Column("last_seen",         sa.DateTime(), nullable=True),
        sa.Column("last_run_id",       sa.String(),  nullable=True),
        sa.Column("last_status",       sa.String(),  nullable=True),
        sa.Column("last_score",        sa.Float(),   nullable=True),
        sa.Column("field_hash",        sa.String(),  nullable=True),
        sa.Column("qualifies",         sa.Boolean(), nullable=True),
        sa.Column("alert",             sa.String(),  nullable=True),
        sa.Column("alert_detail",      sa.String(),  nullable=True),
        sa.Column("confidence_score",  sa.Float(),   nullable=True),
        sa.Column("status_history",    sa.Text(),    nullable=True),
        sa.Column("last_ai_result",    sa.Text(),    nullable=True),
        sa.Column("last_score_result", sa.Text(),    nullable=True),
        if_not_exists=True,
    )
    op.create_table(
        "runs",
        sa.Column("id",        sa.String(),  primary_key=True),
        sa.Column("run_at",    sa.DateTime(), nullable=True),
        sa.Column("states",    sa.Text(),    nullable=True),
        sa.Column("days_back", sa.Integer(), nullable=True),
        sa.Column("ingested",  sa.Integer(), nullable=True),
        sa.Column("filtered",  sa.Integer(), nullable=True),
        sa.Column("qualified", sa.Integer(), nullable=True),
        sa.Column("surfaced",  sa.Integer(), nullable=True),
        if_not_exists=True,
    )
    op.create_table(
        "leads",
        sa.Column("id",                sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("run_id",            sa.String(),  nullable=True,  index=True),
        sa.Column("project_id",        sa.String(),  nullable=True,  index=True),
        sa.Column("rank",              sa.Integer(), nullable=True),
        sa.Column("score",             sa.Float(),   nullable=True),
        sa.Column("alert",             sa.String(),  nullable=True),
        sa.Column("alert_detail",      sa.String(),  nullable=True),
        sa.Column("ai_result",         sa.Text(),    nullable=True),
        sa.Column("score_result",      sa.Text(),    nullable=True),
        sa.Column("narrative_summary", sa.Text(),    nullable=True),
        sa.Column("project_snapshot",  sa.Text(),    nullable=True),
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_table("leads")
    op.drop_table("runs")
    op.drop_table("projects")
