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
