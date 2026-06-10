from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    content_type: str
    status: str
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class DocumentChunkRead(BaseModel):
    id: int
    document_id: int
    chunk_index: int
    text: str
    metadata: dict


class UploadResponse(BaseModel):
    document: DocumentRead
