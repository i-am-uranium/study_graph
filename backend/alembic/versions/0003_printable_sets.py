"""add printable paper builder tables

Revision ID: 0003_printable_sets
Revises: 0002_document_ingestion_jobs
Create Date: 2026-06-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003_printable_sets"
down_revision: str | None = "0002_document_ingestion_jobs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "printable_sets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("output_type", sa.String(length=64), nullable=False),
        sa.Column("template", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("source_refs", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_printable_sets_document_id", "printable_sets", ["document_id"])
    op.create_index("ix_printable_sets_output_type", "printable_sets", ["output_type"])
    op.create_index("ix_printable_sets_status", "printable_sets", ["status"])

    op.create_table(
        "printable_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "printable_set_id",
            sa.Integer(),
            sa.ForeignKey("printable_sets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_printable_jobs_printable_set_id", "printable_jobs", ["printable_set_id"])
    op.create_index("ix_printable_jobs_job_type", "printable_jobs", ["job_type"])
    op.create_index("ix_printable_jobs_status", "printable_jobs", ["status"])

    op.create_table(
        "printable_exports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "printable_set_id",
            sa.Integer(),
            sa.ForeignKey("printable_sets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("export_type", sa.String(length=64), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_printable_exports_printable_set_id",
        "printable_exports",
        ["printable_set_id"],
    )
    op.create_index("ix_printable_exports_export_type", "printable_exports", ["export_type"])


def downgrade() -> None:
    op.drop_index("ix_printable_exports_export_type", table_name="printable_exports")
    op.drop_index("ix_printable_exports_printable_set_id", table_name="printable_exports")
    op.drop_table("printable_exports")
    op.drop_index("ix_printable_jobs_status", table_name="printable_jobs")
    op.drop_index("ix_printable_jobs_job_type", table_name="printable_jobs")
    op.drop_index("ix_printable_jobs_printable_set_id", table_name="printable_jobs")
    op.drop_table("printable_jobs")
    op.drop_index("ix_printable_sets_status", table_name="printable_sets")
    op.drop_index("ix_printable_sets_output_type", table_name="printable_sets")
    op.drop_index("ix_printable_sets_document_id", table_name="printable_sets")
    op.drop_table("printable_sets")
