from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 9000
    frontend_origins_raw: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080",
        alias="FRONTEND_ORIGINS",
    )

    database_url: str = (
        "postgresql+psycopg://studygraph:studygraph@localhost:5432/studygraph"
    )
    upload_dir: Path = Path("storage/uploads")
    embedding_dimensions: int = 512
    unstructured_api_url: str = "http://localhost:8001/general/v0/general"

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    chat_model: str = "gpt-4.1-mini"
    embedding_model: str = "text-embedding-3-small"

    worker_poll_seconds: float = 5.0
    worker_concurrency: int = 4
    log_level: str = "INFO"

    @field_validator("upload_dir", mode="before")
    @classmethod
    def parse_upload_dir(cls, value: str | Path) -> Path:
        return Path(value)

    @property
    def frontend_origins(self) -> list[str]:
        configured_origins = [
            origin.strip()
            for origin in self.frontend_origins_raw.split(",")
            if origin.strip()
        ]
        return expand_loopback_origins(configured_origins)


def expand_loopback_origins(origins: list[str]) -> list[str]:
    expanded: list[str] = []
    seen: set[str] = set()

    for origin in origins:
        for candidate in (origin, loopback_origin_alias(origin)):
            if candidate and candidate not in seen:
                expanded.append(candidate)
                seen.add(candidate)

    return expanded


def loopback_origin_alias(origin: str) -> str | None:
    parsed = urlparse(origin)
    if parsed.hostname == "localhost":
        return urlunparse(parsed._replace(netloc=parsed.netloc.replace("localhost", "127.0.0.1", 1)))
    if parsed.hostname == "127.0.0.1":
        return urlunparse(parsed._replace(netloc=parsed.netloc.replace("127.0.0.1", "localhost", 1)))
    return None


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    return settings
