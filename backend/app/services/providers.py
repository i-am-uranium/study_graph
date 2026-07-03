import logging
from dataclasses import dataclass
from typing import Any

import httpx
from app.core.config import get_settings

logger = logging.getLogger("studygraph.providers")


@dataclass(frozen=True)
class ProviderSettings:
    api_key: str
    base_url: str
    chat_model: str
    embedding_model: str
    embedding_dimensions: int = 1024
    send_embedding_dimensions: bool = False
    disable_thinking: bool = True
    rerank_enabled: bool = True
    rerank_base_url: str = "http://localhost:7997"
    rerank_model: str = "BAAI/bge-reranker-v2-m3"


class OpenAICompatibleProvider:
    def __init__(self, settings: ProviderSettings | None = None) -> None:
        if settings is None:
            app_settings = get_settings()
            settings = ProviderSettings(
                api_key=app_settings.openai_api_key,
                base_url=app_settings.openai_base_url,
                chat_model=app_settings.chat_model,
                embedding_model=app_settings.embedding_model,
                embedding_dimensions=app_settings.embedding_dimensions,
                send_embedding_dimensions=app_settings.send_embedding_dimensions,
                disable_thinking=app_settings.disable_thinking,
                rerank_enabled=app_settings.rerank_enabled,
                rerank_base_url=app_settings.rerank_base_url,
                rerank_model=app_settings.rerank_model,
            )
        self.settings = settings

    def chat_payload(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        # Qwen3 is a hybrid reasoning model; /no_think suppresses its <think> traces
        # so the deterministic RAG/summary/flashcard calls return clean output.
        if self.settings.disable_thinking:
            system_prompt = f"{system_prompt} /no_think"
        return {
            "model": self.settings.chat_model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        batch_size = 100
        embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            payload: dict[str, Any] = {
                "model": self.settings.embedding_model,
                "input": batch,
            }
            # Ollama's /v1/embeddings ignores/rejects the OpenAI `dimensions` param;
            # only send it for providers that support dimension truncation.
            if self.settings.send_embedding_dimensions:
                payload["dimensions"] = self.settings.embedding_dimensions
            response = self._client().post("/embeddings", json=payload)
            response.raise_for_status()
            response_json = response.json()
            data = response_json["data"]
            sorted_data = sorted(data, key=lambda item: item["index"])
            embeddings.extend([item["embedding"] for item in sorted_data])

            usage = response_json.get("usage", {})
            logger.info(
                "Embeddings generated",
                extra={
                    "model": self.settings.embedding_model,
                    "batch_size": len(batch),
                    "prompt_tokens": usage.get("prompt_tokens"),
                    "total_tokens": usage.get("total_tokens"),
                },
            )
        return embeddings

    def chat(
        self, system_prompt: str, user_prompt: str, *, expect_json: bool = False
    ) -> str:
        payload = self.chat_payload(system_prompt, user_prompt)
        if expect_json:
            payload["response_format"] = {"type": "json_object"}
        response = self._client().post("/chat/completions", json=payload)
        response.raise_for_status()
        response_json = response.json()

        usage = response_json.get("usage", {})
        logger.info(
            "Chat completion completed",
            extra={
                "model": self.settings.chat_model,
                "prompt_tokens": usage.get("prompt_tokens"),
                "completion_tokens": usage.get("completion_tokens"),
                "total_tokens": usage.get("total_tokens"),
            },
        )
        return response_json["choices"][0]["message"]["content"]

    def rerank(self, query: str, documents: list[str]) -> list[tuple[int, float]]:
        """Score documents against the query via the Infinity reranker sidecar.

        Returns (original_index, relevance_score) pairs ordered most relevant first.
        """
        if not documents:
            return []
        payload = {
            "model": self.settings.rerank_model,
            "query": query,
            "documents": documents,
        }
        client = httpx.Client(
            base_url=self.settings.rerank_base_url.rstrip("/"), timeout=60
        )
        try:
            response = client.post("/rerank", json=payload)
            response.raise_for_status()
            results = response.json()["results"]
        finally:
            client.close()
        return [(item["index"], item["relevance_score"]) for item in results]

    def _client(self) -> httpx.Client:
        headers: dict[str, str] = {}
        # Local Ollama needs no auth; only send a bearer token when one is set
        # (i.e. for a remote OpenAI-compatible provider).
        if self.settings.api_key:
            headers["Authorization"] = f"Bearer {self.settings.api_key}"
        return httpx.Client(
            base_url=self.settings.base_url.rstrip("/"),
            timeout=60,
            headers=headers,
        )


def default_provider() -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider()
