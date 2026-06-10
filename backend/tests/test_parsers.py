from pathlib import Path

from app.services.parsers import parse_document


def test_parse_markdown_file_returns_text_and_metadata(tmp_path: Path) -> None:
    path = tmp_path / "notes.md"
    path.write_text("# Photosynthesis\n\nPlants convert light into energy.", encoding="utf-8")

    parsed = parse_document(path, "text/markdown")

    assert "Photosynthesis" in parsed.text
    assert parsed.metadata["source_type"] == "markdown"


def test_parse_unsupported_type_fails(tmp_path: Path) -> None:
    path = tmp_path / "archive.zip"
    path.write_bytes(b"zip")

    try:
        parse_document(path, "application/zip")
    except ValueError as exc:
        assert "Unsupported" in str(exc)
    else:
        raise AssertionError("expected ValueError")
