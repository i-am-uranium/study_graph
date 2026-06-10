from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    frontend_origins_raw: str = Field(
        default="http://localhost:5173,http://localhost:8080",
        alias="FRONTEND_ORIGINS",
    )

    database_url: str = "postgresql+psycopg://studygraph:studygraph@localhost:5432/studygraph"
    upload_dir: Path = Path("storage/uploads")
    embedding_dimensions: int = 1536

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    chat_model: str = "gpt-4.1-mini"
    embedding_model: str = "text-embedding-3-small"

    worker_poll_seconds: float = 5.0

    @field_validator("upload_dir", mode="before")
    @classmethod
    def parse_upload_dir(cls, value: str | Path) -> Path:
        return Path(value)

    @property
    def frontend_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins_raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    return settings
