import asyncio
import contextlib
from pathlib import Path
from types import SimpleNamespace

import app.worker as worker_module
from app.models import Document, DocumentStatus, IngestionJobStatus
from app.services.ingestion import (
    claim_next_ingestion_job,
    create_ingestion_job,
    run_ingestion_job,
)


class FakeProvider:
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [[1.0, *([0.0] * 1023)] for _ in texts]


def _queued_document(db_session, tmp_path: Path, name: str) -> Document:
    path = tmp_path / name
    path.write_text(f"Content for {name}", encoding="utf-8")
    document = Document(
        filename=name,
        content_type="text/markdown",
        file_path=str(path),
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)
    create_ingestion_job(db_session, document.id)
    return document


def test_claim_marks_running_and_never_returns_the_same_job(
    db_session, tmp_path: Path
) -> None:
    first = _queued_document(db_session, tmp_path, "first.md")
    second = _queued_document(db_session, tmp_path, "second.md")

    claimed_first = claim_next_ingestion_job(db_session)
    claimed_second = claim_next_ingestion_job(db_session)
    claimed_third = claim_next_ingestion_job(db_session)

    assert claimed_first is not None and claimed_second is not None
    # Two concurrent claims must hand back distinct jobs, oldest first.
    assert {claimed_first.document_id, claimed_second.document_id} == {
        first.id,
        second.id,
    }
    assert claimed_first.document_id == first.id
    # Both are removed from the queued pool and stamped as started.
    assert claimed_first.status == IngestionJobStatus.running.value
    assert claimed_second.status == IngestionJobStatus.running.value
    assert claimed_first.started_at is not None
    # No queued work left to claim.
    assert claimed_third is None


def test_claimed_job_still_runs_to_completion(db_session, tmp_path: Path) -> None:
    document = _queued_document(db_session, tmp_path, "biology.md")

    claimed = claim_next_ingestion_job(db_session)
    assert claimed is not None

    completed = run_ingestion_job(db_session, claimed.id, provider=FakeProvider())

    assert completed.status == IngestionJobStatus.completed.value
    assert db_session.get(Document, document.id).status == DocumentStatus.ready.value


def test_worker_runs_jobs_concurrently_within_the_limit(monkeypatch) -> None:
    jobs = [("ingestion", job_id) for job_id in range(1, 6)]
    pending = iter(jobs)
    monkeypatch.setattr(
        worker_module, "_claim_next_job", lambda: next(pending, None)
    )
    monkeypatch.setattr(
        worker_module,
        "get_settings",
        lambda: SimpleNamespace(worker_concurrency=2, worker_poll_seconds=0.01),
    )

    processed: list[tuple[str, int]] = []
    active = 0
    peak = 0

    async def fake_process(kind: str, job_id: int) -> None:
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.01)
        processed.append((kind, job_id))
        active -= 1

    monkeypatch.setattr(worker_module, "_process_job", fake_process)

    async def drive() -> None:
        task = asyncio.create_task(worker_module.run_worker_async())
        for _ in range(200):
            if len(processed) == len(jobs) and active == 0:
                break
            await asyncio.sleep(0.005)
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

    asyncio.run(drive())

    assert sorted(processed) == sorted(jobs)
    # Bounded by worker_concurrency, but does run more than one at a time.
    assert peak == 2
