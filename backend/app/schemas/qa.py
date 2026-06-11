from datetime import datetime

from pydantic import BaseModel, Field


class Citation(BaseModel):
    document_id: int
    chunk_id: int
    chunk_index: int
    filename: str
    text: str
    metadata: dict = Field(default_factory=dict)
    score: float


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    document_ids: list[int] = Field(default_factory=list)
    session_id: int | None = None


class AskResponse(BaseModel):
    session_id: int
    answer: str
    citations: list[Citation]
    confidence_notes: list[str]


class QaMessageRead(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    citations: list[dict] = Field(default_factory=list)
    confidence_notes: list[str] = Field(default_factory=list)
    created_at: datetime


class QaSessionRead(BaseModel):
    id: int
    title: str
    selected_document_ids: list[int]
    created_at: datetime
    updated_at: datetime
    message_count: int
    last_message: str | None = None


class QaSessionDetail(BaseModel):
    id: int
    title: str
    selected_document_ids: list[int]
    created_at: datetime
    updated_at: datetime
    messages: list[QaMessageRead]
