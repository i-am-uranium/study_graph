from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api.documents import delete_document
from app.api.qa import delete_session, list_sessions
from app.models import (
    Document,
    DocumentChunk,
    DocumentIngestionJob,
    QaMessage,
    QaSession,
)


def test_delete_document_removes_row_chunks_jobs_and_file(tmp_path, db_session) -> None:
    stored = tmp_path / "lesson.md"
    stored.write_text("photosynthesis notes")
    document = Document(
        filename="lesson.md",
        content_type="text/markdown",
        file_path=str(stored),
        status="ready",
    )
    db_session.add(document)
    db_session.flush()
    db_session.add(
        DocumentChunk(
            document_id=document.id,
            chunk_index=0,
            text="chunk",
            source_metadata={},
            embedding=[0.0] * 1536,
        )
    )
    db_session.add(DocumentIngestionJob(document_id=document.id, status="completed"))
    db_session.commit()
    document_id = document.id

    result = delete_document(document_id, db_session)

    assert result is None
    assert db_session.get(Document, document_id) is None
    assert db_session.query(DocumentChunk).filter_by(document_id=document_id).count() == 0
    assert (
        db_session.query(DocumentIngestionJob).filter_by(document_id=document_id).count() == 0
    )
    assert not stored.exists()


def test_delete_document_missing_raises_404(db_session) -> None:
    with pytest.raises(HTTPException) as exc:
        delete_document(999, db_session)
    assert exc.value.status_code == 404


def test_delete_document_tolerates_missing_file(db_session) -> None:
    document = Document(
        filename="gone.md",
        content_type="text/markdown",
        file_path=str(Path("/tmp/does-not-exist-studygraph.md")),
        status="ready",
    )
    db_session.add(document)
    db_session.commit()
    document_id = document.id

    delete_document(document_id, db_session)

    assert db_session.get(Document, document_id) is None


def test_delete_qa_session_removes_session_and_messages(db_session) -> None:
    session = QaSession(title="What is RAG?", selected_document_ids=[1])
    db_session.add(session)
    db_session.flush()
    db_session.add(QaMessage(session_id=session.id, role="user", content="What is RAG?"))
    db_session.add(
        QaMessage(
            session_id=session.id,
            role="assistant",
            content="Retrieval augmented generation.",
        )
    )
    db_session.commit()
    session_id = session.id

    delete_session(session_id, db_session)

    assert db_session.get(QaSession, session_id) is None
    assert db_session.query(QaMessage).filter_by(session_id=session_id).count() == 0
    assert list_sessions(db_session) == []


def test_delete_qa_session_missing_raises_404(db_session) -> None:
    with pytest.raises(HTTPException) as exc:
        delete_session(404, db_session)
    assert exc.value.status_code == 404
