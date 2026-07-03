from pathlib import Path

from app.models import Document, DocumentIngestionJob, DocumentStatus, IngestionJobStatus
from app.services.ingestion import (
    create_ingestion_job,
    next_queued_ingestion_job,
    run_ingestion_job,
)


class FakeProvider:
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [[1.0, *([0.0] * 1023)] for _ in texts]


def test_create_ingestion_job_tracks_document_request(db_session, tmp_path: Path) -> None:
    path = tmp_path / "biology.md"
    path.write_text("ATP is the cellular energy currency.", encoding="utf-8")
    document = Document(
        filename="biology.md",
        content_type="text/markdown",
        file_path=str(path),
        status=DocumentStatus.ready.value,
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)

    job = create_ingestion_job(db_session, document.id)

    assert job.id is not None
    assert job.document_id == document.id
    assert job.status == IngestionJobStatus.queued.value
    assert job.started_at is None
    assert job.completed_at is None
    assert db_session.get(Document, document.id).status == DocumentStatus.queued.value


def test_next_queued_ingestion_job_returns_oldest_queued_job(db_session, tmp_path: Path) -> None:
    first_path = tmp_path / "first.md"
    second_path = tmp_path / "second.md"
    first_path.write_text("First document", encoding="utf-8")
    second_path.write_text("Second document", encoding="utf-8")
    first = Document(filename="first.md", content_type="text/markdown", file_path=str(first_path))
    second = Document(
        filename="second.md",
        content_type="text/markdown",
        file_path=str(second_path),
    )
    db_session.add_all([first, second])
    db_session.commit()

    first_job = create_ingestion_job(db_session, first.id)
    create_ingestion_job(db_session, second.id)

    queued_job = next_queued_ingestion_job(db_session)

    assert queued_job is not None
    assert queued_job.id == first_job.id


def test_run_ingestion_job_marks_job_completed_with_ready_document(
    db_session,
    tmp_path: Path,
) -> None:
    path = tmp_path / "biology.md"
    path.write_text("ATP is the cellular energy currency.", encoding="utf-8")
    document = Document(
        filename="biology.md",
        content_type="text/markdown",
        file_path=str(path),
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)
    job = create_ingestion_job(db_session, document.id)

    completed_job = run_ingestion_job(db_session, job.id, provider=FakeProvider())

    assert completed_job.status == IngestionJobStatus.completed.value
    assert completed_job.started_at is not None
    assert completed_job.completed_at is not None
    assert completed_job.error_message is None
    assert db_session.get(Document, document.id).status == DocumentStatus.ready.value


def test_create_ingestion_job_reuses_active_job(db_session, tmp_path: Path) -> None:
    path = tmp_path / "biology.md"
    path.write_text("ATP is the cellular energy currency.", encoding="utf-8")
    document = Document(
        filename="biology.md",
        content_type="text/markdown",
        file_path=str(path),
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)

    first_job = create_ingestion_job(db_session, document.id)
    second_job = create_ingestion_job(db_session, document.id)

    assert second_job.id == first_job.id
    assert db_session.query(DocumentIngestionJob).filter_by(document_id=document.id).count() == 1
