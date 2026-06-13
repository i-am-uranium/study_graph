from datetime import datetime
from pathlib import Path

from app.models import (
    Document,
    DocumentChunk,
    DocumentIngestionJob,
    DocumentStatus,
    IngestionJobStatus,
)
from sqlalchemy import delete, select
from sqlalchemy.orm import Session


class DocumentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, document_id: int) -> Document | None:
        return self.db.get(Document, document_id)

    def update_status(
        self,
        document_id: int,
        status: str,
        error_message: str | None = None,
    ) -> Document:
        document = self.get(document_id)
        if document is None:
            raise ValueError(f"Document {document_id} does not exist")
        document.status = status
        document.error_message = error_message
        self.db.commit()
        self.db.refresh(document)
        return document

    def rollback(self) -> None:
        self.db.rollback()

    def delete_chunks(self, document_id: int) -> None:
        self.db.execute(
            delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
        )

    def save_chunks(
        self,
        document_id: int,
        chunks: list,
        embeddings: list[list[float]],
    ) -> None:
        for chunk, embedding in zip(chunks, embeddings, strict=True):
            self.db.add(
                DocumentChunk(
                    document_id=document_id,
                    chunk_index=chunk.chunk_index,
                    text=chunk.text,
                    source_metadata=chunk.metadata,
                    embedding=embedding,
                )
            )
        self.db.commit()

    def get_active_ingestion_job(self, document_id: int) -> DocumentIngestionJob | None:
        return self.db.scalars(
            select(DocumentIngestionJob)
            .where(DocumentIngestionJob.document_id == document_id)
            .where(
                DocumentIngestionJob.status.in_(
                    [IngestionJobStatus.queued.value, IngestionJobStatus.running.value]
                )
            )
            .order_by(DocumentIngestionJob.created_at.asc())
            .limit(1)
        ).first()

    def create_ingestion_job(self, document_id: int) -> DocumentIngestionJob:
        job = DocumentIngestionJob(
            document_id=document_id,
            status=IngestionJobStatus.queued.value,
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def get_ingestion_job(self, job_id: int) -> DocumentIngestionJob | None:
        return self.db.get(DocumentIngestionJob, job_id)

    def update_ingestion_job(
        self,
        job_id: int,
        status: str,
        error_message: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
    ) -> DocumentIngestionJob:
        job = self.get_ingestion_job(job_id)
        if job is None:
            raise ValueError(f"Ingestion job {job_id} does not exist")

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

    def next_queued_ingestion_job(self) -> DocumentIngestionJob | None:
        return self.db.scalars(
            select(DocumentIngestionJob)
            .where(DocumentIngestionJob.status == IngestionJobStatus.queued.value)
            .order_by(DocumentIngestionJob.created_at.asc())
            .limit(1)
        ).first()

    def next_queued_document(self) -> Document | None:
        return self.db.scalars(
            select(Document)
            .where(Document.status == DocumentStatus.queued.value)
            .order_by(Document.created_at.asc())
            .limit(1)
        ).first()
