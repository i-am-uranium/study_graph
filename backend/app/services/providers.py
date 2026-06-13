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
            raise ValueError(
                "Provider API key is not configured. "
                "Set OPENAI_API_KEY in .env and restart the API and worker."
            )

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
        batch_size = 100
        embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            payload = {"model": self.settings.embedding_model, "input": batch}
            response = self._client().post("/embeddings", json=payload)
            response.raise_for_status()
            data = response.json()["data"]
            sorted_data = sorted(data, key=lambda item: item["index"])
            embeddings.extend([item["embedding"] for item in sorted_data])
        return embeddings

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
