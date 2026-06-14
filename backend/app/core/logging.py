import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any


class JSONFormatter(logging.Formatter):
    """Custom log formatter that outputs logs as a single line JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Include exception details if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Include stack trace details if present
        if record.stack_info:
            log_data["stack"] = self.formatStack(record.stack_info)

        # Extract extra fields added via `extra={...}` in logging calls
        standard_attributes = {
            "name",
            "msg",
            "args",
            "levelname",
            "levelno",
            "pathname",
            "filename",
            "module",
            "exc_info",
            "exc_text",
            "stack_info",
            "lineno",
            "funcName",
            "created",
            "msecs",
            "relativeCreated",
            "thread",
            "threadName",
            "processName",
            "process",
        }
        extra = {
            key: value
            for key, value in record.__dict__.items()
            if key not in standard_attributes and not key.startswith("_")
        }
        if extra:
            log_data["extra"] = extra

        return json.dumps(log_data)


def setup_logging(log_level: str = "INFO") -> None:
    """Configures the root logger to output JSON structured logs to stdout."""
    level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Remove existing handlers to prevent duplicate logging
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    # Setup the stream handler with the JSON formatter
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(stdout_handler)

    # Re-route uvicorn error/access and sqlalchemy log handlers to propagate to root
    for logger_name in (
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "sqlalchemy.engine",
    ):
        logger = logging.getLogger(logger_name)
        # Clear existing handlers from uvicorn's default setup
        for handler in list(logger.handlers):
            logger.removeHandler(handler)
        logger.propagate = True
