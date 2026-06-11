from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import QaMessage, QaSession
from app.schemas.qa import AskRequest, AskResponse, QaMessageRead, QaSessionDetail, QaSessionRead
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


@router.get("/sessions", response_model=list[QaSessionRead])
def list_sessions(db: Session = Depends(get_db)) -> list[QaSessionRead]:
    sessions = db.scalars(
        select(QaSession).order_by(QaSession.updated_at.desc(), QaSession.id.desc())
    ).all()
    return [_session_summary(db, session) for session in sessions]


@router.get("/sessions/{session_id}", response_model=QaSessionDetail)
def get_session(session_id: int, db: Session = Depends(get_db)) -> QaSessionDetail:
    session = db.get(QaSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="QA session not found")

    messages = _messages_for_session(db, session.id)
    return QaSessionDetail(
        id=session.id,
        title=session.title,
        selected_document_ids=session.selected_document_ids,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[_message_read(message) for message in messages],
    )


def _session_summary(db: Session, session: QaSession) -> QaSessionRead:
    messages = _messages_for_session(db, session.id)
    last_message = messages[-1].content if messages else None
    return QaSessionRead(
        id=session.id,
        title=session.title,
        selected_document_ids=session.selected_document_ids,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=len(messages),
        last_message=last_message,
    )


def _messages_for_session(db: Session, session_id: int) -> list[QaMessage]:
    return list(
        db.scalars(
            select(QaMessage)
            .where(QaMessage.session_id == session_id)
            .order_by(QaMessage.created_at.asc(), QaMessage.id.asc())
        ).all()
    )


def _message_read(message: QaMessage) -> QaMessageRead:
    return QaMessageRead(
        id=message.id,
        session_id=message.session_id,
        role=message.role,
        content=message.content,
        citations=message.citations,
        confidence_notes=message.confidence_notes,
        created_at=message.created_at,
    )
