from collections import defaultdict
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Document, PrintableSet, QaMessage, QaSession, StudyArtifact
from app.schemas.dashboard import (
    DashboardCounts,
    DashboardNextMove,
    DashboardRead,
    DashboardReadiness,
    DashboardSession,
    DashboardSource,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

_READY = "ready"
_PREPARING = {"queued", "ingesting"}
_DRAFT_PAPER_STATUSES = {"draft_ready", "export_ready"}


@router.get("", response_model=DashboardRead)
def get_dashboard(db: Session = Depends(get_db)) -> DashboardRead:
    documents = list(db.scalars(select(Document)).all())
    artifacts = list(db.scalars(select(StudyArtifact)).all())
    printables = list(db.scalars(select(PrintableSet)).all())
    sessions = list(db.scalars(select(QaSession).order_by(QaSession.updated_at.desc())).all())
    messages = list(db.scalars(select(QaMessage)).all())

    status_by_doc = {doc.id: doc.status for doc in documents}

    # Real signals only: citations, sessions, and outputs are derived from
    # stored data — no fabricated mastery scores.
    citation_count: dict[int, int] = defaultdict(int)
    message_count_by_session: dict[int, int] = defaultdict(int)
    for message in messages:
        message_count_by_session[message.session_id] += 1
        for citation in message.citations or []:
            doc_id = citation.get("document_id")
            if isinstance(doc_id, int):
                citation_count[doc_id] += 1

    session_count_by_doc: dict[int, int] = defaultdict(int)
    for session in sessions:
        for doc_id in session.selected_document_ids or []:
            session_count_by_doc[doc_id] += 1

    output_count_by_doc: dict[int, int] = defaultdict(int)
    for artifact in artifacts:
        output_count_by_doc[artifact.document_id] += 1
    for printable in printables:
        output_count_by_doc[printable.document_id] += 1

    ready_docs = [doc for doc in documents if doc.status == _READY]
    preparing_docs = [doc for doc in documents if doc.status in _PREPARING]
    total = len(documents)
    score = round(100 * len(ready_docs) / total) if total else 0

    sources = [
        DashboardSource(
            document_id=doc.id,
            filename=doc.filename,
            status=doc.status,
            citation_count=citation_count.get(doc.id, 0),
            session_count=session_count_by_doc.get(doc.id, 0),
            output_count=output_count_by_doc.get(doc.id, 0),
        )
        for doc in documents
    ]
    sources.sort(
        key=lambda src: (src.citation_count, src.session_count, src.output_count),
        reverse=True,
    )

    recent_sessions = [
        DashboardSession(
            id=session.id,
            title=session.title,
            message_count=message_count_by_session.get(session.id, 0),
            source_count=len(session.selected_document_ids or []),
            ready_source_count=sum(
                1
                for doc_id in session.selected_document_ids or []
                if status_by_doc.get(doc_id) == _READY
            ),
            updated_at=session.updated_at,
        )
        for session in sessions[:5]
    ]

    counts = DashboardCounts(
        documents=total,
        ready_documents=len(ready_docs),
        preparing_documents=len(preparing_docs),
        summaries=sum(1 for artifact in artifacts if artifact.artifact_type == "summary"),
        flashcards=sum(1 for artifact in artifacts if artifact.artifact_type == "flashcards"),
        sessions=len(sessions),
        draft_papers=sum(1 for p in printables if p.status in _DRAFT_PAPER_STATUSES),
    )

    return DashboardRead(
        counts=counts,
        readiness=DashboardReadiness(
            score=score,
            ready_sources=len(ready_docs),
            total_sources=total,
        ),
        recent_sessions=recent_sessions,
        sources=sources[:6],
        next_move=_next_move(documents, ready_docs, preparing_docs, output_count_by_doc, sessions),
        generated_at=datetime.now(UTC),
    )


def _next_move(
    documents: list[Document],
    ready_docs: list[Document],
    preparing_docs: list[Document],
    output_count_by_doc: dict[int, int],
    sessions: list[QaSession],
) -> DashboardNextMove:
    if not documents:
        return DashboardNextMove(
            kind="empty",
            title="Add your first source",
            detail="Bring one file — StudyGraph keeps every answer tied to it.",
        )
    if preparing_docs:
        count = len(preparing_docs)
        noun = "source" if count == 1 else "sources"
        return DashboardNextMove(
            kind="prepare",
            title=f"{count} {noun} still indexing",
            detail="They'll be ready to study in a moment.",
        )
    unused = [doc for doc in ready_docs if output_count_by_doc.get(doc.id, 0) == 0]
    if unused:
        newest = max(unused, key=lambda doc: doc.created_at)
        return DashboardNextMove(
            kind="summarize",
            title=f"Summarize {newest.filename}",
            detail="Turn your newest ready source into a study summary.",
            document_id=newest.id,
        )
    if sessions:
        latest = sessions[0]
        return DashboardNextMove(
            kind="continue",
            title=f"Continue · {latest.title}",
            detail="Pick up your most recent study session.",
            session_id=latest.id,
        )
    return DashboardNextMove(
        kind="ask",
        title="Ask your sources a question",
        detail="Start a new study session grounded in your library.",
    )
