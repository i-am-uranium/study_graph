import logging
import time

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.ingestion import next_queued_ingestion_job, run_ingestion_job
from app.services.printables import next_queued_printable_job, run_printable_job

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("studygraph.worker")


def run_worker() -> None:
    settings = get_settings()
    logger.info("StudyGraph worker started")
    while True:
        with SessionLocal() as db:
            job = next_queued_ingestion_job(db)
            if job is not None:
                logger.info(
                    "Running ingestion job %s for document %s", job.id, job.document_id
                )
                run_ingestion_job(db, job.id)
            else:
                printable_job = next_queued_printable_job(db)
                if printable_job is not None:
                    logger.info(
                        "Running printable job %s for printable set %s",
                        printable_job.id,
                        printable_job.printable_set_id,
                    )
                    run_printable_job(db, printable_job.id)
                else:
                    time.sleep(settings.worker_poll_seconds)


if __name__ == "__main__":
    run_worker()
