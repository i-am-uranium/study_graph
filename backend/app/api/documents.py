from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models import Document, DocumentChunk, DocumentIngestionJob
from app.schemas.documents import DocumentChunkRead, DocumentRead, IngestionJobRead, UploadResponse
from app.services.ingestion import create_ingestion_job

router = APIRouter(prefix="/api/documents", tags=["documents"])

SUPPORTED_SUFFIXES = {".pdf", ".docx", ".txt", ".md", ".markdown"}


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UploadResponse:
    filename = Path(file.filename or "").name
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    settings = get_settings()
    target = settings.upload_dir / f"{uuid4().hex}{suffix}"
    with target.open("wb") as output:
        while chunk := file.file.read(1024 * 1024):
            output.write(chunk)

    document = Document(
        filename=filename,
        content_type=file.content_type or _content_type_for_suffix(suffix),
        file_path=str(target),
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return UploadResponse(document=document)


@router.get("", response_model=list[DocumentRead])
def list_documents(db: Session = Depends(get_db)) -> list[Document]:
    return list(db.scalars(select(Document).order_by(Document.created_at.desc())).all())


@router.get("/ingestion-jobs", response_model=list[IngestionJobRead])
def list_ingestion_jobs(db: Session = Depends(get_db)) -> list[DocumentIngestionJob]:
    return list(
        db.scalars(select(DocumentIngestionJob).order_by(DocumentIngestionJob.created_at.desc())).all()
    )


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(document_id: int, db: Session = Depends(get_db)) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.get("/{document_id}/chunks", response_model=list[DocumentChunkRead])
def list_chunks(document_id: int, db: Session = Depends(get_db)) -> list[DocumentChunkRead]:
    chunks = db.scalars(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index.asc())
    ).all()
    return [
        DocumentChunkRead(
            id=chunk.id,
            document_id=chunk.document_id,
            chunk_index=chunk.chunk_index,
            text=chunk.text,
            metadata=chunk.source_metadata,
        )
        for chunk in chunks
    ]


@router.post(
    "/{document_id}/ingest",
    response_model=IngestionJobRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def run_ingestion(document_id: int, db: Session = Depends(get_db)) -> DocumentIngestionJob:
    try:
        return create_ingestion_job(db, document_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{document_id}/stats")
def document_stats(document_id: int, db: Session = Depends(get_db)) -> dict[str, int]:
    chunk_count = db.scalar(
        select(func.count())
        .select_from(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
    )
    return {"chunk_count": int(chunk_count or 0)}


def _content_type_for_suffix(suffix: str) -> str:
    return {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".markdown": "text/markdown",
    }[suffix]
