import logging
import time

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.ingestion import ingest_document, next_queued_document

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("studygraph.worker")


def run_worker() -> None:
    settings = get_settings()
    logger.info("StudyGraph worker started")
    while True:
        with SessionLocal() as db:
            document = next_queued_document(db)
            if document is not None:
                logger.info("Ingesting document %s (%s)", document.id, document.filename)
                ingest_document(db, document.id)
            else:
                time.sleep(settings.worker_poll_seconds)


if __name__ == "__main__":
    run_worker()
