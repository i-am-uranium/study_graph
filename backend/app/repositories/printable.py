from datetime import UTC, datetime
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    PrintableExport,
    PrintableJob,
    PrintableJobStatus,
    PrintableSet,
)


class PrintableRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, printable_set_id: int) -> PrintableSet | None:
        return self.db.get(PrintableSet, printable_set_id)

    def get_job(self, job_id: int) -> PrintableJob | None:
        return self.db.get(PrintableJob, job_id)

    def create_printable_set_and_job(self, printable: PrintableSet, job: PrintableJob) -> None:
        self.db.add(printable)
        self.db.flush()
        job.printable_set_id = printable.id
        self.db.add(job)
        self.db.commit()
        self.db.refresh(printable)
        self.db.refresh(job)

    def update_content(self, printable: PrintableSet, content: dict, source_refs: list, status: str) -> None:
        printable.content = content
        printable.source_refs = source_refs
        printable.status = status
        printable.error_message = None
        self.db.commit()
        self.db.refresh(printable)

    def queue_export_job(self, printable: PrintableSet, job: PrintableJob, status: str) -> None:
        printable.status = status
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

    def next_queued_printable_job(self) -> PrintableJob | None:
        return self.db.scalars(
            select(PrintableJob)
            .where(PrintableJob.status == PrintableJobStatus.queued.value)
            .order_by(PrintableJob.created_at.asc())
            .limit(1)
        ).first()

    def claim_next_printable_job(self) -> PrintableJob | None:
        """Atomically claim the oldest queued printable job.

        Mirrors ``DocumentRepository.claim_next_ingestion_job`` — ``FOR UPDATE
        SKIP LOCKED`` keeps concurrent workers from grabbing the same job.
        """
        job = self.db.scalars(
            select(PrintableJob)
            .where(PrintableJob.status == PrintableJobStatus.queued.value)
            .order_by(PrintableJob.created_at.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        ).first()
        if job is None:
            return None

        job.status = PrintableJobStatus.running.value
        job.started_at = datetime.now(UTC)
        self.db.commit()
        self.db.refresh(job)
        return job

    def update_job_status(
        self,
        job_id: int,
        status: str,
        error_message: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
    ) -> PrintableJob:
        job = self.get_job(job_id)
        if job is None:
            raise ValueError(f"Printable job {job_id} does not exist")

        job.status = status
        if error_message is not None:
            job.error_message = error_message
        if started_at is not None:
            job.started_at = started_at
        if completed_at is not None:
            job.completed_at = completed_at

        self.db.commit()
        self.db.refresh(job)
        return job

    def add_export(self, export: PrintableExport, printable: PrintableSet, status: str) -> None:
        self.db.add(export)
        printable.status = status
        printable.error_message = None
        self.db.commit()

    def mark_failed(self, job: PrintableJob, error_message: str, printable: PrintableSet | None = None) -> None:
        job.status = PrintableJobStatus.failed.value
        job.error_message = error_message
        job.completed_at = datetime.now(UTC)
        if printable is not None:
            printable.status = PrintableJobStatus.failed.value
            printable.error_message = error_message
        self.db.commit()
        self.db.refresh(job)

    def rollback(self) -> None:
        self.db.rollback()
