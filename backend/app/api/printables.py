from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import PrintableExport, PrintableJob, PrintableSet
from app.schemas.printables import (
    PrintableCreateRequest,
    PrintableCreateResponse,
    PrintableExportRead,
    PrintableExportRequest,
    PrintableJobRead,
    PrintableSetRead,
    PrintableUpdateRequest,
)
from app.services.printables import (
    create_printable_set,
    queue_printable_export,
    update_printable_content,
)

router = APIRouter(prefix="/api/printables", tags=["printables"])


@router.get("", response_model=list[PrintableSetRead])
def list_printables(db: Session = Depends(get_db)) -> list[PrintableSet]:
    return list(db.scalars(select(PrintableSet).order_by(PrintableSet.created_at.desc())).all())


@router.post("", response_model=PrintableCreateResponse, status_code=status.HTTP_202_ACCEPTED)
def create_printable(
    request: PrintableCreateRequest,
    db: Session = Depends(get_db),
) -> PrintableCreateResponse:
    try:
        printable, job = create_printable_set(db, request.model_dump())
        return PrintableCreateResponse(printable=printable, job=job)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/jobs", response_model=list[PrintableJobRead])
def list_printable_jobs(db: Session = Depends(get_db)) -> list[PrintableJob]:
    return list(db.scalars(select(PrintableJob).order_by(PrintableJob.created_at.desc())).all())


@router.get("/{printable_id}", response_model=PrintableSetRead)
def get_printable(printable_id: int, db: Session = Depends(get_db)) -> PrintableSet:
    printable = db.get(PrintableSet, printable_id)
    if printable is None:
        raise HTTPException(status_code=404, detail="Printable set not found")
    return printable


@router.patch("/{printable_id}", response_model=PrintableSetRead)
def update_printable(
    printable_id: int,
    request: PrintableUpdateRequest,
    db: Session = Depends(get_db),
) -> PrintableSet:
    printable = db.get(PrintableSet, printable_id)
    if printable is None:
        raise HTTPException(status_code=404, detail="Printable set not found")

    payload = request.model_dump(exclude_unset=True)
    if "title" in payload:
        printable.title = payload["title"]
    if "config" in payload:
        printable.config = payload["config"]
    if "content" in payload:
        return update_printable_content(db, printable_id, payload["content"])
    db.commit()
    db.refresh(printable)
    return printable


@router.post("/{printable_id}/export", response_model=PrintableJobRead, status_code=202)
def export_printable(
    printable_id: int,
    request: PrintableExportRequest,
    db: Session = Depends(get_db),
) -> PrintableJob:
    try:
        return queue_printable_export(db, printable_id, export_type=request.export_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{printable_id}/exports", response_model=list[PrintableExportRead])
def list_printable_exports(
    printable_id: int,
    db: Session = Depends(get_db),
) -> list[PrintableExport]:
    return list(
        db.scalars(
            select(PrintableExport)
            .where(PrintableExport.printable_set_id == printable_id)
            .order_by(PrintableExport.created_at.desc())
        ).all()
    )


@router.get("/{printable_id}/exports/{export_id}")
def download_printable_export(
    printable_id: int,
    export_id: int,
    db: Session = Depends(get_db),
) -> FileResponse:
    export = db.get(PrintableExport, export_id)
    if export is None or export.printable_set_id != printable_id:
        raise HTTPException(status_code=404, detail="Printable export not found")
    path = Path(export.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Printable export file not found")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=path.name,
    )
