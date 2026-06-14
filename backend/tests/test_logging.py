import json
import logging
from app.core.logging import JSONFormatter


def test_json_formatter_basic() -> None:
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test_path.py",
        lineno=10,
        msg="Hello %s",
        args=("World",),
        exc_info=None,
    )
    formatted = formatter.format(record)
    data = json.loads(formatted)

    assert data["level"] == "INFO"
    assert data["logger"] == "test_logger"
    assert data["message"] == "Hello World"
    assert "timestamp" in data


def test_json_formatter_with_extra() -> None:
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.WARNING,
        pathname="test_path.py",
        lineno=12,
        msg="Warning message",
        args=(),
        exc_info=None,
    )
    # Inject extra attributes
    record.__dict__["custom_key"] = "custom_value"
    record.__dict__["another_key"] = 123

    formatted = formatter.format(record)
    data = json.loads(formatted)

    assert data["level"] == "WARNING"
    assert data["message"] == "Warning message"
    assert "extra" in data
    assert data["extra"]["custom_key"] == "custom_value"
    assert data["extra"]["another_key"] == 123
