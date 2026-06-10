from app.services.chunking import chunk_text


def test_chunk_text_preserves_source_metadata_and_overlap() -> None:
    text = " ".join(f"token{i}" for i in range(80))

    chunks = chunk_text(text, document_id=7, source={"page": 2}, chunk_size=20, overlap=5)

    assert len(chunks) > 1
    assert chunks[0].document_id == 7
    assert chunks[0].metadata["page"] == 2
    assert chunks[0].chunk_index == 0
    assert chunks[1].text.startswith("token15")


def test_chunk_text_rejects_overlap_larger_than_chunk_size() -> None:
    try:
        chunk_text("hello world", document_id=1, chunk_size=10, overlap=10)
    except ValueError as exc:
        assert "overlap" in str(exc)
    else:
        raise AssertionError("expected ValueError")
