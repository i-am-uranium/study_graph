import json
import os
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    Document,
    DocumentStatus,
    PrintableExport,
    PrintableJob,
    PrintableJobStatus,
    PrintableJobType,
    PrintableSet,
    PrintableStatus,
)
from app.repositories.document import DocumentRepository
from app.repositories.printable import PrintableRepository
from app.schemas.printables import PrintableContent
from app.services.providers import OpenAICompatibleProvider, default_provider


def create_printable_set(db: Session, data: dict) -> tuple[PrintableSet, PrintableJob]:
    doc_repo = DocumentRepository(db)
    print_repo = PrintableRepository(db)

    document = _ready_document_or_raise(db, int(data["document_id"]))
    
    printable = PrintableSet(
        document_id=document.id,
        title=data["title"],
        output_type=data.get("output_type", "teacher_pack"),
        template=data.get("template", "formal_exam"),
        status=PrintableStatus.generating.value,
        error_message=None,
        config=data.get("config") or {},
        content={},
        source_refs=[],
    )
    
    job = PrintableJob(
        printable_set_id=None,  # Set by repository
        job_type=PrintableJobType.generate_draft.value,
        status=PrintableJobStatus.queued.value,
        payload={},
    )
    
    print_repo.create_printable_set_and_job(printable, job)
    return printable, job


def update_printable_content(
    db: Session,
    printable_set_id: int,
    content: dict,
) -> PrintableSet:
    print_repo = PrintableRepository(db)
    printable = _printable_or_raise(db, printable_set_id)
    
    validated = PrintableContent.model_validate(content)
    source_refs = _collect_source_refs(validated.model_dump())
    
    print_repo.update_content(
        printable,
        content=validated.model_dump(),
        source_refs=source_refs,
        status=PrintableStatus.draft_ready.value,
    )
    return printable


def queue_printable_export(
    db: Session,
    printable_set_id: int,
    *,
    export_type: str,
) -> PrintableJob:
    print_repo = PrintableRepository(db)
    printable = _printable_or_raise(db, printable_set_id)
    
    exportable_statuses = {
        PrintableStatus.draft_ready.value,
        PrintableStatus.export_ready.value,
    }
    if printable.status not in exportable_statuses:
        raise ValueError("Printable draft is not ready for export")

    job = PrintableJob(
        printable_set_id=printable.id,
        job_type=PrintableJobType.export_pdf.value,
        status=PrintableJobStatus.queued.value,
        payload={"export_type": export_type},
    )
    
    print_repo.queue_export_job(printable, job, status=PrintableStatus.exporting.value)
    return job


def next_queued_printable_job(db: Session) -> PrintableJob | None:
    print_repo = PrintableRepository(db)
    return print_repo.next_queued_printable_job()


def claim_next_printable_job(db: Session) -> PrintableJob | None:
    print_repo = PrintableRepository(db)
    return print_repo.claim_next_printable_job()


def run_printable_job(
    db: Session,
    job_id: int,
    *,
    provider: OpenAICompatibleProvider | None = None,
) -> PrintableJob:
    print_repo = PrintableRepository(db)

    job = print_repo.get_job(job_id)
    if job is None:
        raise ValueError(f"Printable job {job_id} does not exist")

    print_repo.update_job_status(
        job_id,
        status=PrintableJobStatus.running.value,
        started_at=datetime.now(UTC),
    )

    try:
        if job.job_type == PrintableJobType.generate_draft.value:
            _run_generation_job(db, job, provider=provider)
        elif job.job_type == PrintableJobType.export_pdf.value:
            _run_export_job(db, job)
        else:
            raise ValueError(f"Unsupported printable job type {job.job_type}")
        
        return print_repo.update_job_status(
            job_id,
            status=PrintableJobStatus.completed.value,
            completed_at=datetime.now(UTC),
        )
    except Exception as exc:
        print_repo.rollback()
        job = print_repo.get_job(job_id)
        if job is None:
            raise
        printable = print_repo.get(job.printable_set_id)
        
        print_repo.mark_failed(job, error_message=str(exc), printable=printable)
        return job


def _run_generation_job(
    db: Session,
    job: PrintableJob,
    *,
    provider: OpenAICompatibleProvider | None,
) -> None:
    provider = provider or default_provider()
    print_repo = PrintableRepository(db)
    doc_repo = DocumentRepository(db)
    
    printable = _printable_or_raise(db, job.printable_set_id)
    document = _ready_document_or_raise(db, printable.document_id)
    
    chunks = sorted(document.chunks, key=lambda chunk: chunk.chunk_index)
    if not chunks:
        raise ValueError("Document has no ingested chunks")

    context = "\n\n".join(
        f"[chunk {chunk.chunk_index}]\n{chunk.text}" for chunk in chunks[:20]
    )
    config = printable.config or {}
    raw = provider.chat(
        (
            "Return strict JSON for a printable school paper. The top-level object must contain "
            "a sections array. Each section has title, marks, and questions. Each question has "
            "id, type, prompt, options, answer, marks, answer_space_lines, and source_refs.\n"
            "CRITICAL: Each item in 'source_refs' must be a JSON object (NOT a string) containing "
            "'document_id' (integer) and 'chunk_index' (integer matching the chunk index from the "
            "[chunk {index}] headings in the source material)."
        ),
        (
            f"Create an editable formal school paper draft.\n"
            f"Title: {printable.title}\n"
            f"Output type: {printable.output_type}\n"
            f"Document ID: {printable.document_id}\n"
            f"Config JSON: {json.dumps(config)}\n\n"
            f"Source material:\n{context}"
        ),
        expect_json=True,
    )
    parsed = json.loads(raw)
    validated = PrintableContent.model_validate(parsed)
    
    print_repo.update_content(
        printable,
        content=validated.model_dump(),
        source_refs=_collect_source_refs(validated.model_dump()),
        status=PrintableStatus.draft_ready.value,
    )


def _run_export_job(db: Session, job: PrintableJob) -> None:
    print_repo = PrintableRepository(db)
    printable = _printable_or_raise(db, job.printable_set_id)
    if not printable.content.get("sections"):
        raise ValueError("Printable draft has no questions to export")

    export_type = str((job.payload or {}).get("export_type") or "teacher_pack")
    export_dir = Path(
        os.environ.get("STUDYGRAPH_EXPORT_DIR")
        or get_settings().upload_dir.parent / "exports"
    )
    export_dir.mkdir(parents=True, exist_ok=True)
    path = export_dir / f"printable-{printable.id}-{export_type}-{uuid4().hex}.pdf"
    _write_formal_exam_pdf(printable, path, export_type=export_type)

    export = PrintableExport(
        printable_set_id=printable.id,
        export_type=export_type,
        file_path=str(path),
    )
    print_repo.add_export(export, printable, status=PrintableStatus.export_ready.value)


def _write_formal_exam_pdf(printable: PrintableSet, path: Path, *, export_type: str) -> None:
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=42,
        rightMargin=42,
        topMargin=42,
        bottomMargin=42,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ExamTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        alignment=1,
        spaceAfter=8,
    )
    normal = styles["BodyText"]
    normal.fontName = "Helvetica"
    normal.fontSize = 10
    normal.leading = 13
    heading = ParagraphStyle(
        "SectionHeading",
        parent=normal,
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        spaceBefore=10,
        spaceAfter=6,
    )
    config = printable.config or {}
    story: list = []

    story.extend(_paper_header(printable, config, title_style, normal))
    _append_student_questions(story, printable.content, normal, heading)
    if export_type in {"answer_key", "teacher_pack"}:
        story.append(Spacer(1, 18))
        story.append(Paragraph("ANSWER KEY", title_style))
        _append_answer_key(story, printable.content, normal, heading)
    doc.build(story)


def _paper_header(
    printable: PrintableSet,
    config: dict,
    title_style: ParagraphStyle,
    normal: ParagraphStyle,
) -> list:
    subject = config.get("subject", "Subject")
    class_name = config.get("class_name", "Class")
    time_limit = config.get("time_limit", "")
    maximum_marks = config.get("maximum_marks", "")
    rows = [
        ["Name: ____________________", "Roll No: ____________________"],
        [f"Time: {time_limit}", f"Maximum Marks: {maximum_marks}"],
    ]
    table = Table(rows, colWidths=[250, 250])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return [
        Paragraph(printable.title, title_style),
        Paragraph(f"{subject} - {class_name}", normal),
        Spacer(1, 8),
        table,
        Spacer(1, 8),
        Table(
            [
                [
                    Paragraph(
                        "<b>Instructions:</b> Answer all questions. Marks are shown on the right.",
                        normal,
                    )
                ]
            ],
            colWidths=[500],
            style=[
                ("BOX", (0, 0), (-1, -1), 0.75, colors.black),
                ("PADDING", (0, 0), (-1, -1), 6),
            ],
        ),
        Spacer(1, 10),
    ]


def _append_student_questions(
    story: list,
    content: dict,
    normal: ParagraphStyle,
    heading: ParagraphStyle,
) -> None:
    question_number = 1
    for section in content.get("sections", []):
        section_title = f"{section.get('title', 'Section')} ({section.get('marks', 0)} marks)"
        story.append(Paragraph(section_title, heading))
        for question in section.get("questions", []):
            prompt = question.get("prompt", "")
            marks = question.get("marks", 0)
            story.append(Paragraph(f"<b>{question_number}.</b> {prompt} [{marks}]", normal))
            options = question.get("options") or []
            if options:
                story.append(Paragraph(" &nbsp; ".join(options), normal))
            for _ in range(int(question.get("answer_space_lines") or 0)):
                story.append(Paragraph("______________________________________________", normal))
            story.append(Spacer(1, 6))
            question_number += 1


def _append_answer_key(
    story: list,
    content: dict,
    normal: ParagraphStyle,
    heading: ParagraphStyle,
) -> None:
    question_number = 1
    for section in content.get("sections", []):
        story.append(Paragraph(section.get("title", "Section"), heading))
        for question in section.get("questions", []):
            answer = question.get("answer") or "No answer provided."
            story.append(Paragraph(f"<b>{question_number}.</b> {answer}", normal))
            question_number += 1


def _collect_source_refs(content: dict) -> list[dict]:
    refs: list[dict] = []
    seen: set[tuple[int | None, int | None]] = set()
    for section in content.get("sections", []):
        for question in section.get("questions", []):
            for ref in question.get("source_refs", []):
                key = (ref.get("document_id"), ref.get("chunk_index"))
                if key not in seen:
                    refs.append(ref)
                    seen.add(key)
    return refs


def _ready_document_or_raise(db: Session, document_id: int) -> Document:
    doc_repo = DocumentRepository(db)
    document = doc_repo.get(document_id)
    if document is None:
        raise ValueError(f"Document {document_id} does not exist")
    if document.status != DocumentStatus.ready.value:
        raise ValueError("Document must be ingested before generating printables")
    return document


def _printable_or_raise(db: Session, printable_set_id: int) -> PrintableSet:
    print_repo = PrintableRepository(db)
    printable = print_repo.get(printable_set_id)
    if printable is None:
        raise ValueError(f"Printable set {printable_set_id} does not exist")
    return printable
