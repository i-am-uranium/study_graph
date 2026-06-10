from pydantic import BaseModel


class SettingsRead(BaseModel):
    provider: str
    base_url: str
    chat_model: str
    embedding_model: str
    api_key_configured: bool
    embedding_dimensions: int


class SettingsValidationResponse(BaseModel):
    ok: bool
    message: str
