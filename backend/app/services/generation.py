import json

from sqlalchemy.orm import Session

from app.models import Document, QaMessage, QaSession, StudyArtifact, StudyArtifactType
from app.schemas.qa import AskResponse
from app.schemas.study import Flashcard
from app.services.providers import OpenAICompatibleProvider, default_provider
from app.services.retrieval import retrieve_chunks, to_citations


def answer_question(
    db: Session,
    question: str,
    *,
    document_ids: list[int],
    session_id: int | None = None,
    provider: OpenAICompatibleProvider | None = None,
) -> AskResponse:
    provider = provider or default_provider()
    retrieved = retrieve_chunks(db, provider, question, document_ids=document_ids)
    citations = to_citations(retrieved)
    if not citations:
        answer = "I could not find relevant uploaded material to answer that question."
        confidence_notes = ["No matching chunks were retrieved from the selected documents."]
    else:
        context = "\n\n".join(
            (
                f"[{index + 1}] {item.document.filename} "
                f"chunk {item.chunk.chunk_index}\n{item.chunk.text}"
            )
            for index, item in enumerate(retrieved)
        )
        answer = provider.chat(
            "You answer only from the provided study context. Cite bracket numbers when useful.",
            f"Question: {question}\n\nStudy context:\n{context}",
        )
        confidence_notes = ["Answer generated from retrieved document chunks."]

    session = db.get(QaSession, session_id) if session_id else None
    if session is None:
        session = QaSession(
            title=question[:120],
            selected_document_ids=document_ids,
        )
        db.add(session)
        db.flush()

    db.add(QaMessage(session_id=session.id, role="user", content=question))
    db.add(
        QaMessage(
            session_id=session.id,
            role="assistant",
            content=answer,
            citations=[citation.model_dump() for citation in citations],
            confidence_notes=confidence_notes,
        )
    )
    db.commit()
    return AskResponse(
        session_id=session.id,
        answer=answer,
        citations=citations,
        confidence_notes=confidence_notes,
    )


def generate_summary(
    db: Session,
    document_id: int,
    *,
    provider: OpenAICompatibleProvider | None = None,
) -> StudyArtifact:
    provider = provider or default_provider()
    document = _document_or_raise(db, document_id)
    chunks = sorted(document.chunks, key=lambda chunk: chunk.chunk_index)
    context = "\n\n".join(chunk.text for chunk in chunks[:20])
    summary = provider.chat(
        "Create concise, accurate study summaries from provided document excerpts.",
        f"Summarize this document for study preparation:\n\n{context}",
    )
    artifact = StudyArtifact(
        document_id=document.id,
        artifact_type=StudyArtifactType.summary.value,
        title=f"Summary: {document.filename}",
        content={"summary": summary},
        source_refs=[
            {"document_id": document.id, "chunk_index": chunk.chunk_index}
            for chunk in chunks[:20]
        ],
    )
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    return artifact


def generate_flashcards(
    db: Session,
    document_id: int,
    *,
    count: int,
    provider: OpenAICompatibleProvider | None = None,
) -> StudyArtifact:
    provider = provider or default_provider()
    document = _document_or_raise(db, document_id)
    chunks = sorted(document.chunks, key=lambda chunk: chunk.chunk_index)
    context = "\n\n".join(chunk.text for chunk in chunks[:20])
    raw = provider.chat(
        "Return strict JSON with a top-level flashcards array. Each item has front and back.",
        f"Create {count} study flashcards from this material:\n\n{context}",
        expect_json=True,
    )
    parsed = json.loads(raw)
    cards = [Flashcard.model_validate(card).model_dump() for card in parsed.get("flashcards", [])]
    if not cards:
        raise ValueError("Provider returned no valid flashcards")

    artifact = StudyArtifact(
        document_id=document.id,
        artifact_type=StudyArtifactType.flashcards.value,
        title=f"Flashcards: {document.filename}",
        content={"flashcards": cards},
        source_refs=[
            {"document_id": document.id, "chunk_index": chunk.chunk_index}
            for chunk in chunks[:20]
        ],
    )
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    return artifact


def _document_or_raise(db: Session, document_id: int) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise ValueError(f"Document {document_id} does not exist")
    return document
