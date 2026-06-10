from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base


class AppSetting(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    provider: Mapped[str] = mapped_column(String(80), default="openai-compatible")
    chat_model: Mapped[str] = mapped_column(String(160), nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(160), nullable=False)
    settings: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
