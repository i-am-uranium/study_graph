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


def test_parse_pdf_with_unstructured_api(tmp_path: Path) -> None:
    path = tmp_path / "test.pdf"
    path.write_bytes(b"pdf content")

    mock_elements = [
        {
            "text": "Header Title",
            "metadata": {"page_number": 1}
        },
        {
            "text": "This is paragraph 1 on page 1.",
            "metadata": {"page_number": 1}
        },
        {
            "text": "This is page 2 content.",
            "metadata": {"page_number": 2}
        }
    ]

    from unittest.mock import patch

    class MockResponse:
        def __init__(self, json_data, status_code=200):
            self.json_data = json_data
            self.status_code = status_code

        def json(self):
            return self.json_data

        def raise_for_status(self):
            if self.status_code >= 400:
                raise Exception("HTTP Error")

    with patch("app.services.parsers.split_pdf_to_batches") as mock_split, patch("httpx.post") as mock_post:
        mock_split.return_value = [(0, b"pdf content")]
        mock_post.return_value = MockResponse(mock_elements)

        parsed = parse_document(path, "application/pdf")

        mock_split.assert_called_once_with(path, batch_size=10)
        mock_post.assert_called_once()
        _, kwargs = mock_post.call_args
        assert "files" in kwargs
        assert kwargs["files"]["files"][0] == "batch_0.pdf"

        assert "[Page 1]" in parsed.text
        assert "Header Title" in parsed.text
        assert "This is paragraph 1 on page 1." in parsed.text
        assert "[Page 2]" in parsed.text
        assert "This is page 2 content." in parsed.text
        assert parsed.metadata["source_type"] == "pdf"
        assert parsed.metadata["page_count"] == 2

