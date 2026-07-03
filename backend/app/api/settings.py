from urllib.parse import urlparse

from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.settings import SettingsRead, SettingsValidationResponse
from app.services.providers import default_provider

router = APIRouter(prefix="/api/settings", tags=["settings"])

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "ollama"}


def _is_local_provider(base_url: str) -> bool:
    host = urlparse(base_url).hostname or ""
    return host in _LOCAL_HOSTS or host.endswith(".local")


@router.get("", response_model=SettingsRead)
def read_settings() -> SettingsRead:
    settings = get_settings()
    api_key_configured = bool(settings.openai_api_key)
    # The local Ollama stack needs no API key, so it is ready as soon as it is
    # reachable. A remote provider is considered ready only once a key is set.
    provider_ready = api_key_configured or _is_local_provider(settings.openai_base_url)
    return SettingsRead(
        provider="openai-compatible",
        base_url=settings.openai_base_url,
        chat_model=settings.chat_model,
        embedding_model=settings.embedding_model,
        api_key_configured=api_key_configured,
        provider_ready=provider_ready,
        embedding_dimensions=settings.embedding_dimensions,
    )


@router.post("/validate", response_model=SettingsValidationResponse)
def validate_settings() -> SettingsValidationResponse:
    """Confirm the embedding provider is reachable with the current configuration."""
    try:
        default_provider().embed_texts(["healthcheck"])
    except Exception as exc:  # noqa: BLE001 - surface any connection/config error to the caller
        return SettingsValidationResponse(
            ok=False,
            message=f"Embedding provider unreachable: {exc}",
        )
    return SettingsValidationResponse(ok=True, message="Embedding provider reachable")
