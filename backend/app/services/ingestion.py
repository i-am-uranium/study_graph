from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Document, DocumentChunk, DocumentStatus
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
        document.status = DocumentStatus.failed.value
        document.error_message = str(exc)
        db.commit()
        db.refresh(document)
        return document


def next_queued_document(db: Session) -> Document | None:
    return db.scalars(
        select(Document)
        .where(Document.status == DocumentStatus.queued.value)
        .order_by(Document.created_at.asc())
        .limit(1)
    ).first()
