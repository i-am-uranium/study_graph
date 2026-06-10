from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings


@dataclass(frozen=True)
class ProviderSettings:
    api_key: str
    base_url: str
    chat_model: str
    embedding_model: str


class OpenAICompatibleProvider:
    def __init__(self, settings: ProviderSettings | None = None) -> None:
        if settings is None:
            app_settings = get_settings()
            settings = ProviderSettings(
                api_key=app_settings.openai_api_key,
                base_url=app_settings.openai_base_url,
                chat_model=app_settings.chat_model,
                embedding_model=app_settings.embedding_model,
            )
        self.settings = settings

    def ensure_configured(self) -> None:
        if not self.settings.api_key:
            raise ValueError("Provider API key is not configured")

    def chat_payload(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        return {
            "model": self.settings.chat_model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        self.ensure_configured()
        payload = {"model": self.settings.embedding_model, "input": texts}
        response = self._client().post("/embeddings", json=payload)
        response.raise_for_status()
        data = response.json()["data"]
        return [item["embedding"] for item in sorted(data, key=lambda item: item["index"])]

    def chat(self, system_prompt: str, user_prompt: str, *, expect_json: bool = False) -> str:
        self.ensure_configured()
        payload = self.chat_payload(system_prompt, user_prompt)
        if expect_json:
            payload["response_format"] = {"type": "json_object"}
        response = self._client().post("/chat/completions", json=payload)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

    def _client(self) -> httpx.Client:
        return httpx.Client(
            base_url=self.settings.base_url.rstrip("/"),
            timeout=60,
            headers={"Authorization": f"Bearer {self.settings.api_key}"},
        )


def default_provider() -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider()
