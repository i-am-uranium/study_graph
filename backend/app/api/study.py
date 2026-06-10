from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import StudyArtifact
from app.schemas.study import FlashcardRequest, StudyArtifactRead, SummaryRequest
from app.services.generation import generate_flashcards, generate_summary

router = APIRouter(prefix="/api/study", tags=["study"])


@router.get("/artifacts", response_model=list[StudyArtifactRead])
def list_artifacts(db: Session = Depends(get_db)) -> list[StudyArtifact]:
    return list(db.scalars(select(StudyArtifact).order_by(StudyArtifact.created_at.desc())).all())


@router.post("/summaries", response_model=StudyArtifactRead)
def create_summary(request: SummaryRequest, db: Session = Depends(get_db)) -> StudyArtifact:
    try:
        return generate_summary(db, request.document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/flashcards", response_model=StudyArtifactRead)
def create_flashcards(request: FlashcardRequest, db: Session = Depends(get_db)) -> StudyArtifact:
    try:
        return generate_flashcards(db, request.document_id, count=request.count)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/artifacts/{artifact_id}", status_code=204)
def delete_artifact(artifact_id: int, db: Session = Depends(get_db)) -> None:
    artifact = db.get(StudyArtifact, artifact_id)
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    db.delete(artifact)
    db.commit()
