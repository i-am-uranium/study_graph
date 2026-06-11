from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base


class PrintableStatus(StrEnum):
    generating = "generating"
    draft_ready = "draft_ready"
    exporting = "exporting"
    export_ready = "export_ready"
    failed = "failed"


class PrintableJobStatus(StrEnum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class PrintableJobType(StrEnum):
    generate_draft = "generate_draft"
    export_pdf = "export_pdf"


class PrintableSet(Base):
    __tablename__ = "printable_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    output_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    template: Mapped[str] = mapped_column(String(64), nullable=False, default="formal_exam")
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=PrintableStatus.generating.value,
        index=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    config: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    content: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        default=dict,
        nullable=False,
    )
    source_refs: Mapped[list[dict]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        default=list,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    jobs: Mapped[list["PrintableJob"]] = relationship(
        back_populates="printable_set",
        cascade="all, delete-orphan",
    )
    exports: Mapped[list["PrintableExport"]] = relationship(
        back_populates="printable_set",
        cascade="all, delete-orphan",
    )


class PrintableJob(Base):
    __tablename__ = "printable_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    printable_set_id: Mapped[int] = mapped_column(
        ForeignKey("printable_sets.id", ondelete="CASCADE"),
        index=True,
    )
    job_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=PrintableJobStatus.queued.value,
        index=True,
    )
    payload: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        default=dict,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    printable_set: Mapped[PrintableSet] = relationship(back_populates="jobs")


class PrintableExport(Base):
    __tablename__ = "printable_exports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    printable_set_id: Mapped[int] = mapped_column(
        ForeignKey("printable_sets.id", ondelete="CASCADE"),
        index=True,
    )
    export_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    printable_set: Mapped[PrintableSet] = relationship(back_populates="exports")
