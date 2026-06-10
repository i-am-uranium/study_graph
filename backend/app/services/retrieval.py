from dataclasses import dataclass
from math import sqrt

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Document, DocumentChunk
from app.schemas.qa import Citation
from app.services.providers import OpenAICompatibleProvider


@dataclass(frozen=True)
class RetrievedChunk:
    chunk: DocumentChunk
    document: Document
    score: float


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = sqrt(sum(a * a for a in left))
    right_norm = sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def retrieve_chunks(
    db: Session,
    provider: OpenAICompatibleProvider,
    question: str,
    *,
    document_ids: list[int] | None = None,
    limit: int = 8,
) -> list[RetrievedChunk]:
    query_embedding = provider.embed_texts([question])[0]
    statement = select(DocumentChunk, Document).join(
        Document,
        DocumentChunk.document_id == Document.id,
    )
    if document_ids:
        statement = statement.where(DocumentChunk.document_id.in_(document_ids))

    candidates = db.execute(statement).all()
    ranked = [
        RetrievedChunk(
            chunk=chunk,
            document=document,
            score=cosine_similarity(query_embedding, list(chunk.embedding)),
        )
        for chunk, document in candidates
    ]
    ranked.sort(key=lambda item: item.score, reverse=True)
    return ranked[:limit]


def to_citations(chunks: list[RetrievedChunk]) -> list[Citation]:
    return [
        Citation(
            document_id=item.document.id,
            chunk_id=item.chunk.id,
            chunk_index=item.chunk.chunk_index,
            filename=item.document.filename,
            text=item.chunk.text[:800],
            metadata=item.chunk.source_metadata,
            score=item.score,
        )
        for item in chunks
    ]
