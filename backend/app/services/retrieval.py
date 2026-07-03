import logging
from dataclasses import dataclass, replace
from math import sqrt

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Document, DocumentChunk
from app.schemas.qa import Citation
from app.services.providers import OpenAICompatibleProvider

logger = logging.getLogger("studygraph.retrieval")


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
    limit: int | None = None,
) -> list[RetrievedChunk]:
    settings = get_settings()
    top_k = limit if limit is not None else settings.retrieval_top_k
    candidate_k = max(settings.retrieval_candidate_k, top_k)

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
    pool = ranked[:candidate_k]

    if settings.rerank_enabled:
        pool = rerank_chunks(provider, question, pool)
    return pool[:top_k]


def rerank_chunks(
    provider: OpenAICompatibleProvider,
    question: str,
    chunks: list[RetrievedChunk],
) -> list[RetrievedChunk]:
    """Reorder candidates with the reranker sidecar, replacing the vector score.

    Falls back to the incoming vector order if the reranker is unavailable (sidecar
    down, provider without rerank support, or a malformed response), so Q&A keeps
    working even when reranking is degraded.
    """
    if not chunks:
        return chunks
    try:
        results = provider.rerank(question, [item.chunk.text for item in chunks])
    except Exception as exc:  # noqa: BLE001 - degrade gracefully, never fail the query
        logger.warning("Reranker unavailable; using vector order", extra={"error": str(exc)})
        return chunks
    if not results:
        return chunks

    reordered = [
        replace(chunks[index], score=score)
        for index, score in results
        if 0 <= index < len(chunks)
    ]
    return reordered or chunks


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
