from app.api.qa import get_session, list_sessions
from app.models import QaMessage, QaSession


def test_lists_saved_qa_sessions(db_session) -> None:
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

    response = list_sessions(db_session)

    assert response[0].id == session.id
    assert response[0].title == "What is RAG?"
    assert response[0].message_count == 2
    assert response[0].last_message == "Retrieval augmented generation."


def test_reads_saved_qa_session_messages(db_session) -> None:
    session = QaSession(title="RAG follow-up", selected_document_ids=[1])
    db_session.add(session)
    db_session.flush()
    db_session.add(QaMessage(session_id=session.id, role="user", content="What is hybrid search?"))
    db_session.add(
        QaMessage(
            session_id=session.id,
            role="assistant",
            content="It combines dense and sparse retrieval.",
            citations=[{"filename": "rag.pdf", "chunk_index": 2}],
            confidence_notes=["Answer generated from retrieved document chunks."],
        )
    )
    db_session.commit()

    response = get_session(session.id, db_session)

    assert response.id == session.id
    assert response.selected_document_ids == [1]
    assert [message.role for message in response.messages] == ["user", "assistant"]
    assert response.messages[1].citations[0]["filename"] == "rag.pdf"
