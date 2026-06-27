from app.api.dashboard import get_dashboard
from app.models import Document, QaMessage, QaSession, StudyArtifact


def _document(db_session, filename: str, status: str = "ready") -> Document:
    document = Document(
        filename=filename,
        content_type="text/markdown",
        file_path=f"/tmp/{filename}",
        status=status,
    )
    db_session.add(document)
    db_session.flush()
    return document


def test_dashboard_empty_state(db_session) -> None:
    response = get_dashboard(db_session)

    assert response.counts.documents == 0
    assert response.readiness.score == 0
    assert response.recent_sessions == []
    assert response.sources == []
    assert response.next_move.kind == "empty"


def test_dashboard_aggregates_real_signals(db_session) -> None:
    cited = _document(db_session, "photosynthesis.md")
    fresh = _document(db_session, "leaf-anatomy.md")
    db_session.commit()

    # An output exists for the cited source but not the fresh one.
    db_session.add(
        StudyArtifact(
            document_id=cited.id,
            artifact_type="summary",
            title="Summary",
            content={},
            source_refs=[],
        )
    )
    session = QaSession(title="Carbon fixation", selected_document_ids=[cited.id, fresh.id])
    db_session.add(session)
    db_session.flush()
    db_session.add(QaMessage(session_id=session.id, role="user", content="why?"))
    db_session.add(
        QaMessage(
            session_id=session.id,
            role="assistant",
            content="because...",
            citations=[{"document_id": cited.id, "filename": "photosynthesis.md"}],
        )
    )
    db_session.commit()

    response = get_dashboard(db_session)

    assert response.counts.documents == 2
    assert response.counts.ready_documents == 2
    assert response.counts.summaries == 1
    assert response.counts.sessions == 1
    assert response.readiness.score == 100

    # Most-used source ranks first.
    assert response.sources[0].document_id == cited.id
    assert response.sources[0].citation_count == 1
    assert response.sources[0].session_count == 1
    assert response.sources[0].output_count == 1

    assert response.recent_sessions[0].source_count == 2
    assert response.recent_sessions[0].ready_source_count == 2
    assert response.recent_sessions[0].message_count == 2

    # The ready source with no outputs is the suggested next move.
    assert response.next_move.kind == "summarize"
    assert response.next_move.document_id == fresh.id
