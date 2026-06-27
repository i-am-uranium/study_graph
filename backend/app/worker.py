import asyncio
import logging

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.session import SessionLocal
from app.services.ingestion import claim_next_ingestion_job, run_ingestion_job
from app.services.printables import claim_next_printable_job, run_printable_job

setup_logging(get_settings().log_level)
logger = logging.getLogger("studygraph.worker")


def _claim_next_job() -> tuple[str, int] | None:
    """Atomically claim the next queued job and mark it running.

    Runs in its own short-lived session so concurrent worker tasks never claim
    the same row (Postgres ``FOR UPDATE SKIP LOCKED``). Ingestion is drained
    before printable work so documents become answerable as quickly as possible.
    """
    with SessionLocal() as db:
        job = claim_next_ingestion_job(db)
        if job is not None:
            return ("ingestion", job.id)
        printable_job = claim_next_printable_job(db)
        if printable_job is not None:
            return ("printable", printable_job.id)
    return None


def _run_job(kind: str, job_id: int) -> None:
    """Run a single claimed job to completion in its own DB session.

    Sessions are not thread-safe, so each job that runs in a worker thread opens
    its own. The job is already marked ``running`` by the claim step.
    """
    with SessionLocal() as db:
        if kind == "ingestion":
            run_ingestion_job(db, job_id)
        else:
            run_printable_job(db, job_id)


async def _process_job(kind: str, job_id: int) -> None:
    # The heavy work (parsing, embedding, LLM/PDF calls) is synchronous and
    # blocking, so offload it to a thread to keep the event loop responsive
    # while other jobs run concurrently.
    await asyncio.to_thread(_run_job, kind, job_id)


async def run_worker_async() -> None:
    settings = get_settings()
    concurrency = max(1, settings.worker_concurrency)
    logger.info("StudyGraph worker started (concurrency=%s)", concurrency)

    inflight: set[asyncio.Task[None]] = set()
    while True:
        # Fill any idle slots by claiming queued jobs.
        while len(inflight) < concurrency:
            claimed = await asyncio.to_thread(_claim_next_job)
            if claimed is None:
                break
            kind, job_id = claimed
            logger.info("Running %s job %s", kind, job_id)
            inflight.add(asyncio.create_task(_process_job(kind, job_id)))

        if not inflight:
            # Nothing queued and nothing running — idle until new work arrives.
            await asyncio.sleep(settings.worker_poll_seconds)
            continue

        # Wait for at least one slot to free up before claiming more work.
        done, inflight = await asyncio.wait(
            inflight, return_when=asyncio.FIRST_COMPLETED
        )
        for task in done:
            if not task.cancelled() and task.exception() is not None:
                logger.error("Worker task crashed", exc_info=task.exception())


def run_worker() -> None:
    asyncio.run(run_worker_async())


if __name__ == "__main__":
    run_worker()
