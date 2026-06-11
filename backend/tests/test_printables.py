from pathlib import Path

from app.api.printables import (
    create_printable,
    list_printable_jobs,
    list_printables,
    update_printable,
)
from app.models import (
    Document,
    PrintableExport,
    PrintableJobStatus,
    PrintableJobType,
    PrintableSet,
    PrintableStatus,
)
from app.schemas.printables import PrintableCreateRequest, PrintableUpdateRequest
from app.services.ingestion import ingest_document
from app.services.printables import (
    create_printable_set,
    queue_printable_export,
    run_printable_job,
    update_printable_content,
)


class FakeProvider:
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [[1.0, *([0.0] * 1535)] for _ in texts]

    def chat(self, system_prompt: str, user_prompt: str, *, expect_json: bool = False) -> str:
        return """
        {
          "sections": [
            {
              "title": "Section A - Short Answer",
              "marks": 10,
              "questions": [
                {
                  "id": "q1",
                  "type": "short_answer",
                  "prompt": "What is photosynthesis?",
                  "options": [],
                  "answer": "Photosynthesis is how green plants make food using sunlight.",
                  "marks": 2,
                  "answer_space_lines": 3,
                  "source_refs": [{"document_id": 1, "chunk_index": 0}]
                }
              ]
            }
          ]
        }
        """


def ready_document(db_session, tmp_path: Path) -> Document:
    path = tmp_path / "science.md"
    path.write_text("Photosynthesis helps green plants make food.", encoding="utf-8")
    document = Document(
        filename="science.md",
        content_type="text/markdown",
        file_path=str(path),
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)
    ingest_document(db_session, document.id, provider=FakeProvider())
    return document


def test_create_printable_set_queues_generation_job(db_session, tmp_path: Path) -> None:
    document = ready_document(db_session, tmp_path)

    printable, job = create_printable_set(
        db_session,
        {
            "document_id": document.id,
            "title": "Science Practice Paper",
            "output_type": "teacher_pack",
            "template": "formal_exam",
            "config": {
                "source_scope": {"mode": "whole_book"},
                "class_name": "Class VI",
                "subject": "Science",
                "question_counts": {"short_answer": 1},
            },
        },
    )

    assert printable.id is not None
    assert printable.status == PrintableStatus.generating.value
    assert printable.content == {}
    assert job.printable_set_id == printable.id
    assert job.job_type == PrintableJobType.generate_draft.value
    assert job.status == PrintableJobStatus.queued.value


def test_run_generation_job_persists_editable_draft(db_session, tmp_path: Path) -> None:
    document = ready_document(db_session, tmp_path)
    printable, job = create_printable_set(
        db_session,
        {
            "document_id": document.id,
            "title": "Science Practice Paper",
            "output_type": "teacher_pack",
            "template": "formal_exam",
            "config": {"source_scope": {"mode": "whole_book"}},
        },
    )

    completed = run_printable_job(db_session, job.id, provider=FakeProvider())
    updated = db_session.get(PrintableSet, printable.id)

    assert completed.status == PrintableJobStatus.completed.value
    assert updated.status == PrintableStatus.draft_ready.value
    assert updated.content["sections"][0]["questions"][0]["prompt"] == "What is photosynthesis?"
    assert updated.source_refs == [{"document_id": 1, "chunk_index": 0}]


def test_update_printable_content_preserves_teacher_edits(db_session, tmp_path: Path) -> None:
    document = ready_document(db_session, tmp_path)
    printable, job = create_printable_set(
        db_session,
        {
            "document_id": document.id,
            "title": "Science Practice Paper",
            "output_type": "teacher_pack",
            "template": "formal_exam",
            "config": {"source_scope": {"mode": "whole_book"}},
        },
    )
    run_printable_job(db_session, job.id, provider=FakeProvider())

    edited = update_printable_content(
        db_session,
        printable.id,
        {
            "sections": [
                {
                    "title": "Edited Section",
                    "marks": 2,
                    "questions": [
                        {
                            "id": "q1",
                            "type": "short_answer",
                            "prompt": "Define photosynthesis.",
                            "options": [],
                            "answer": "Plants make food using sunlight.",
                            "marks": 2,
                            "answer_space_lines": 3,
                            "source_refs": [{"document_id": document.id, "chunk_index": 0}],
                        }
                    ],
                }
            ]
        },
    )

    assert edited.content["sections"][0]["title"] == "Edited Section"
    assert edited.content["sections"][0]["questions"][0]["prompt"] == "Define photosynthesis."


def test_export_job_writes_pdf_and_export_record(db_session, tmp_path: Path, monkeypatch) -> None:
    document = ready_document(db_session, tmp_path)
    printable, job = create_printable_set(
        db_session,
        {
            "document_id": document.id,
            "title": "Science Practice Paper",
            "output_type": "teacher_pack",
            "template": "formal_exam",
            "config": {
                "class_name": "Class VI",
                "subject": "Science",
                "time_limit": "45 minutes",
                "maximum_marks": 10,
                "source_scope": {"mode": "whole_book"},
            },
        },
    )
    run_printable_job(db_session, job.id, provider=FakeProvider())
    monkeypatch.setenv("STUDYGRAPH_EXPORT_DIR", str(tmp_path / "exports"))

    export_job = queue_printable_export(db_session, printable.id, export_type="teacher_pack")
    completed = run_printable_job(db_session, export_job.id, provider=FakeProvider())
    export = db_session.query(PrintableExport).filter_by(printable_set_id=printable.id).one()

    assert completed.status == PrintableJobStatus.completed.value
    assert export.export_type == "teacher_pack"
    assert Path(export.file_path).exists()
    assert Path(export.file_path).read_bytes().startswith(b"%PDF")


def test_printable_api_creates_lists_and_updates_draft(db_session, tmp_path: Path) -> None:
    document = ready_document(db_session, tmp_path)

    response = create_printable(
        PrintableCreateRequest(
            document_id=document.id,
            title="Science Practice Paper",
            output_type="teacher_pack",
            template="formal_exam",
            config={"source_scope": {"mode": "whole_book"}},
        ),
        db_session,
    )
    updated = update_printable(
        response.printable.id,
        PrintableUpdateRequest(
            content={
                "sections": [
                    {
                        "title": "Section A",
                        "marks": 2,
                        "questions": [
                            {
                                "id": "q1",
                                "type": "short_answer",
                                "prompt": "Define photosynthesis.",
                                "options": [],
                                "answer": "Plants make food using sunlight.",
                                "marks": 2,
                                "answer_space_lines": 3,
                                "source_refs": [],
                            }
                        ],
                    }
                ]
            }
        ),
        db_session,
    )

    assert list_printables(db_session)[0].id == response.printable.id
    assert list_printable_jobs(db_session)[0].printable_set_id == response.printable.id
    assert updated.content["sections"][0]["questions"][0]["prompt"] == "Define photosynthesis."
