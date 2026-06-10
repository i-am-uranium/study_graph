from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.settings import SettingsRead, SettingsValidationResponse
from app.services.providers import default_provider

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingsRead)
def read_settings() -> SettingsRead:
    settings = get_settings()
    return SettingsRead(
        provider="openai-compatible",
        base_url=settings.openai_base_url,
        chat_model=settings.chat_model,
        embedding_model=settings.embedding_model,
        api_key_configured=bool(settings.openai_api_key),
        embedding_dimensions=settings.embedding_dimensions,
    )


@router.post("/validate", response_model=SettingsValidationResponse)
def validate_settings() -> SettingsValidationResponse:
    try:
        default_provider().ensure_configured()
    except ValueError as exc:
        return SettingsValidationResponse(ok=False, message=str(exc))
    return SettingsValidationResponse(ok=True, message="Provider configuration is present")
