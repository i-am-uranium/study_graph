from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PrintableQuestion(BaseModel):
    id: str
    type: str
    prompt: str = Field(min_length=1)
    options: list[str] = Field(default_factory=list)
    answer: str = ""
    marks: int = Field(default=1, ge=0)
    answer_space_lines: int = Field(default=0, ge=0)
    source_refs: list[dict] = Field(default_factory=list)


class PrintableSection(BaseModel):
    title: str = Field(min_length=1)
    marks: int = Field(default=0, ge=0)
    questions: list[PrintableQuestion] = Field(default_factory=list)


class PrintableContent(BaseModel):
    sections: list[PrintableSection] = Field(default_factory=list)


class PrintableCreateRequest(BaseModel):
    document_id: int
    title: str = Field(min_length=1, max_length=255)
    output_type: str = "teacher_pack"
    template: str = "formal_exam"
    config: dict = Field(default_factory=dict)


class PrintableUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    config: dict | None = None
    content: PrintableContent | None = None


class PrintableExportRequest(BaseModel):
    export_type: Literal["student", "answer_key", "teacher_pack"] = "teacher_pack"


class PrintableSetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    title: str
    output_type: str
    template: str
    status: str
    error_message: str | None = None
    config: dict
    content: dict
    source_refs: list[dict]
    created_at: datetime
    updated_at: datetime


class PrintableJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    printable_set_id: int
    job_type: str
    status: str
    payload: dict
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None


class PrintableExportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    printable_set_id: int
    export_type: str
    file_path: str
    created_at: datetime


class PrintableCreateResponse(BaseModel):
    printable: PrintableSetRead
    job: PrintableJobRead
