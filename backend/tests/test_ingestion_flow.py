from pathlib import Path

from app.models import Document, DocumentChunk, DocumentStatus
from app.services.generation import answer_question, generate_flashcards, generate_summary
from app.services.ingestion import ingest_document


class FakeProvider:
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [[float(index + 1), *([0.0] * 1023)] for index, _ in enumerate(texts)]

    def chat(self, system_prompt: str, user_prompt: str, *, expect_json: bool = False) -> str:
        if expect_json:
            return '{"flashcards":[{"front":"What is ATP?","back":"Cellular energy currency."}]}'
        if "Summarize" in user_prompt:
            return "Cells use ATP to transfer energy."
        return "ATP is described as the cellular energy currency. [1]"


def test_ingest_document_persists_chunks_with_embeddings(db_session, tmp_path: Path) -> None:
    path = tmp_path / "biology.md"
    path.write_text("# Cells\n\nATP is the cellular energy currency.", encoding="utf-8")
    document = Document(
        filename="biology.md",
        content_type="text/markdown",
        file_path=str(path),
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)

    updated = ingest_document(db_session, document.id, provider=FakeProvider())

    assert updated.status == DocumentStatus.ready.value
    chunks = db_session.query(DocumentChunk).filter_by(document_id=document.id).all()
    assert len(chunks) == 1
    assert chunks[0].text.startswith("# Cells")
    assert list(chunks[0].embedding)[:3] == [1.0, 0.0, 0.0]


def test_answer_summary_and_flashcards_use_saved_chunks(db_session, tmp_path: Path) -> None:
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
    ingest_document(db_session, document.id, provider=FakeProvider())

    answer = answer_question(
        db_session,
        "What is ATP?",
        document_ids=[document.id],
        provider=FakeProvider(),
    )
    summary = generate_summary(db_session, document.id, provider=FakeProvider())
    flashcards = generate_flashcards(db_session, document.id, count=1, provider=FakeProvider())

    assert answer.citations[0].filename == "biology.md"
    assert "ATP" in summary.content["summary"]
    assert flashcards.content["flashcards"][0]["front"] == "What is ATP?"


def test_ingest_document_marks_failed_when_provider_returns_wrong_dimensions(
    db_session,
    tmp_path: Path,
) -> None:
    class BadEmbeddingProvider(FakeProvider):
        def embed_texts(self, texts: list[str]) -> list[list[float]]:
            return [[1.0, 0.0, 0.0] for _ in texts]

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

    updated = ingest_document(db_session, document.id, provider=BadEmbeddingProvider())

    assert updated.status == DocumentStatus.failed.value
    assert "embedding dimensions" in updated.error_message
