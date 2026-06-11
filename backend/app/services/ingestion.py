from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    Document,
    DocumentChunk,
    DocumentIngestionJob,
    DocumentStatus,
    IngestionJobStatus,
)
from app.services.chunking import chunk_text
from app.services.parsers import parse_document
from app.services.providers import OpenAICompatibleProvider, default_provider


def ingest_document(
    db: Session,
    document_id: int,
    *,
    provider: OpenAICompatibleProvider | None = None,
) -> Document:
    provider = provider or default_provider()
    document = db.get(Document, document_id)
    if document is None:
        raise ValueError(f"Document {document_id} does not exist")

    document.status = DocumentStatus.ingesting.value
    document.error_message = None
    db.commit()
    db.refresh(document)

    try:
        parsed = parse_document(Path(document.file_path), document.content_type)
        chunks = chunk_text(parsed.text, document_id=document.id, source=parsed.metadata)
        if not chunks:
            raise ValueError("No extractable text was found in the document")

        embeddings = provider.embed_texts([chunk.text for chunk in chunks])
        _validate_embeddings(embeddings)
        db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
        for chunk, embedding in zip(chunks, embeddings, strict=True):
            db.add(
                DocumentChunk(
                    document_id=document.id,
                    chunk_index=chunk.chunk_index,
                    text=chunk.text,
                    source_metadata=chunk.metadata,
                    embedding=embedding,
                )
            )
        document.status = DocumentStatus.ready.value
        db.commit()
        db.refresh(document)
        return document
    except Exception as exc:
        db.rollback()
        document = db.get(Document, document_id)
        if document is None:
            raise
        document.status = DocumentStatus.failed.value
        document.error_message = str(exc)
        db.commit()
        db.refresh(document)
        return document


def create_ingestion_job(db: Session, document_id: int) -> DocumentIngestionJob:
    document = db.get(Document, document_id)
    if document is None:
        raise ValueError(f"Document {document_id} does not exist")

    active_job = db.scalars(
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
    if active_job is not None:
        return active_job

    document.status = DocumentStatus.queued.value
    document.error_message = None
    job = DocumentIngestionJob(
        document_id=document_id,
        status=IngestionJobStatus.queued.value,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def run_ingestion_job(
    db: Session,
    job_id: int,
    *,
    provider: OpenAICompatibleProvider | None = None,
) -> DocumentIngestionJob:
    job = db.get(DocumentIngestionJob, job_id)
    if job is None:
        raise ValueError(f"Ingestion job {job_id} does not exist")

    job.status = IngestionJobStatus.running.value
    job.error_message = None
    job.started_at = datetime.now(UTC)
    db.commit()
    db.refresh(job)

    document = ingest_document(db, job.document_id, provider=provider)
    job = db.get(DocumentIngestionJob, job_id)
    if job is None:
        raise ValueError(f"Ingestion job {job_id} does not exist")

    job.completed_at = datetime.now(UTC)
    if document.status == DocumentStatus.ready.value:
        job.status = IngestionJobStatus.completed.value
        job.error_message = None
    else:
        job.status = IngestionJobStatus.failed.value
        job.error_message = document.error_message
    db.commit()
    db.refresh(job)
    return job


def next_queued_ingestion_job(db: Session) -> DocumentIngestionJob | None:
    return db.scalars(
        select(DocumentIngestionJob)
        .where(DocumentIngestionJob.status == IngestionJobStatus.queued.value)
        .order_by(DocumentIngestionJob.created_at.asc())
        .limit(1)
    ).first()


def next_queued_document(db: Session) -> Document | None:
    return db.scalars(
        select(Document)
        .where(Document.status == DocumentStatus.queued.value)
        .order_by(Document.created_at.asc())
        .limit(1)
    ).first()


def _validate_embeddings(embeddings: list[list[float]]) -> None:
    expected_dimensions = get_settings().embedding_dimensions
    for index, embedding in enumerate(embeddings):
        if len(embedding) != expected_dimensions:
            raise ValueError(
                f"Provider returned {len(embedding)} embedding dimensions for item {index}; "
                f"expected {expected_dimensions} embedding dimensions"
            )
