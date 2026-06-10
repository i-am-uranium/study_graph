from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.qa import AskRequest, AskResponse
from app.services.generation import answer_question

router = APIRouter(prefix="/api/qa", tags=["qa"])


@router.post("/ask", response_model=AskResponse)
def ask_question(request: AskRequest, db: Session = Depends(get_db)) -> AskResponse:
    try:
        return answer_question(
            db,
            request.question,
            document_ids=request.document_ids,
            session_id=request.session_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
