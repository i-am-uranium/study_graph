from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SummaryRequest(BaseModel):
    document_id: int


class FlashcardRequest(BaseModel):
    document_id: int
    count: int = Field(default=8, ge=1, le=30)


class Flashcard(BaseModel):
    front: str = Field(min_length=1)
    back: str = Field(min_length=1)
    source_refs: list[dict] = Field(default_factory=list)


class StudyArtifactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    artifact_type: str
    title: str
    content: dict
    source_refs: list[dict]
    created_at: datetime
    updated_at: datetime
