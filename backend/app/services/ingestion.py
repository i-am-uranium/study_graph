from datetime import UTC, datetime
from pathlib import Path
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    Document,
    DocumentChunk,
    DocumentIngestionJob,
    DocumentStatus,
    IngestionJobStatus,
)
from app.repositories.document import DocumentRepository
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
    repo = DocumentRepository(db)

    document = repo.get(document_id)
    if document is None:
        raise ValueError(f"Document {document_id} does not exist")

    repo.update_status(document_id, DocumentStatus.ingesting.value)

    try:
        parsed = parse_document(Path(document.file_path), document.content_type)
        chunks = chunk_text(
            parsed.text,
            document_id=document.id,
            source=parsed.metadata,
            provider=provider,
        )
        if not chunks:
            raise ValueError("No extractable text was found in the document")

        embeddings = provider.embed_texts([chunk.text for chunk in chunks])
        _validate_embeddings(embeddings)

        repo.delete_chunks(document.id)
        repo.save_chunks(document.id, chunks, embeddings)

        return repo.update_status(document_id, DocumentStatus.ready.value)
    except Exception as exc:
        repo.rollback()
        try:
            return repo.update_status(document_id, DocumentStatus.failed.value, error_message=str(exc))
        except Exception:
            raise exc


def create_ingestion_job(db: Session, document_id: int) -> DocumentIngestionJob:
    repo = DocumentRepository(db)

    document = repo.get(document_id)
    if document is None:
        raise ValueError(f"Document {document_id} does not exist")

    active_job = repo.get_active_ingestion_job(document_id)
    if active_job is not None:
        return active_job

    repo.update_status(document_id, DocumentStatus.queued.value)
    return repo.create_ingestion_job(document_id)


def run_ingestion_job(
    db: Session,
    job_id: int,
    *,
    provider: OpenAICompatibleProvider | None = None,
) -> DocumentIngestionJob:
    repo = DocumentRepository(db)

    job = repo.get_ingestion_job(job_id)
    if job is None:
        raise ValueError(f"Ingestion job {job_id} does not exist")

    repo.update_ingestion_job(
        job_id,
        status=IngestionJobStatus.running.value,
        started_at=datetime.now(UTC),
    )

    document = ingest_document(db, job.document_id, provider=provider)
    job = repo.get_ingestion_job(job_id)
    if job is None:
        raise ValueError(f"Ingestion job {job_id} does not exist")

    completed_at = datetime.now(UTC)
    if document.status == DocumentStatus.ready.value:
        return repo.update_ingestion_job(
            job_id,
            status=IngestionJobStatus.completed.value,
            completed_at=completed_at,
        )
    else:
        return repo.update_ingestion_job(
            job_id,
            status=IngestionJobStatus.failed.value,
            error_message=document.error_message,
            completed_at=completed_at,
        )


def next_queued_ingestion_job(db: Session) -> DocumentIngestionJob | None:
    repo = DocumentRepository(db)
    return repo.next_queued_ingestion_job()


def next_queued_document(db: Session) -> Document | None:
    repo = DocumentRepository(db)
    return repo.next_queued_document()


def _validate_embeddings(embeddings: list[list[float]]) -> None:
    expected_dimensions = get_settings().embedding_dimensions
    for index, embedding in enumerate(embeddings):
        if len(embedding) != expected_dimensions:
            raise ValueError(
                f"Provider returned {len(embedding)} embedding dimensions for item {index}; "
                f"expected {expected_dimensions} embedding dimensions"
            )
