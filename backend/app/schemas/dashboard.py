from datetime import datetime

from pydantic import BaseModel


class DashboardCounts(BaseModel):
    documents: int
    ready_documents: int
    preparing_documents: int
    summaries: int
    flashcards: int
    sessions: int
    draft_papers: int


class DashboardReadiness(BaseModel):
    score: int
    ready_sources: int
    total_sources: int


class DashboardSource(BaseModel):
    document_id: int
    filename: str
    status: str
    citation_count: int
    session_count: int
    output_count: int


class DashboardSession(BaseModel):
    id: int
    title: str
    message_count: int
    source_count: int
    ready_source_count: int
    updated_at: datetime


class DashboardNextMove(BaseModel):
    kind: str
    title: str
    detail: str
    document_id: int | None = None
    session_id: int | None = None


class DashboardRead(BaseModel):
    counts: DashboardCounts
    readiness: DashboardReadiness
    recent_sessions: list[DashboardSession]
    sources: list[DashboardSource]
    next_move: DashboardNextMove
    generated_at: datetime
