from unittest.mock import MagicMock, patch

import httpx
from app.services.providers import OpenAICompatibleProvider, ProviderSettings


def _settings(**overrides) -> ProviderSettings:
    base = dict(
        api_key="",
        base_url="http://localhost:11434/v1",
        chat_model="qwen3:8b",
        embedding_model="qwen3-embedding:0.6b",
    )
    base.update(overrides)
    return ProviderSettings(**base)


def test_provider_omits_auth_header_without_api_key() -> None:
    provider = OpenAICompatibleProvider(_settings(api_key=""))
    client = provider._client()
    try:
        assert "authorization" not in client.headers
    finally:
        client.close()


def test_provider_sends_bearer_when_api_key_set() -> None:
    provider = OpenAICompatibleProvider(_settings(api_key="sk-test"))
    client = provider._client()
    try:
        assert client.headers["authorization"] == "Bearer sk-test"
    finally:
        client.close()


def test_provider_builds_chat_payload_appends_no_think_by_default() -> None:
    provider = OpenAICompatibleProvider(_settings(chat_model="study-chat"))

    payload = provider.chat_payload("system", "question")

    assert payload["model"] == "study-chat"
    assert payload["messages"][0]["role"] == "system"
    assert payload["messages"][0]["content"].endswith("/no_think")
    assert payload["messages"][1]["content"] == "question"


def test_provider_chat_payload_keeps_system_prompt_when_thinking_enabled() -> None:
    provider = OpenAICompatibleProvider(_settings(disable_thinking=False))

    payload = provider.chat_payload("system", "question")

    assert payload["messages"][0]["content"] == "system"


def test_provider_embed_texts_omits_dimensions_by_default() -> None:
    provider = OpenAICompatibleProvider(_settings(embedding_dimensions=1024))

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "data": [{"embedding": [0.1] * 1024, "index": 0}],
        "usage": {"prompt_tokens": 10, "total_tokens": 10},
    }
    mock_response.raise_for_status = MagicMock()

    with patch.object(httpx.Client, "post", return_value=mock_response) as mock_post:
        embeddings = provider.embed_texts(["test text"])

    assert len(embeddings[0]) == 1024
    called_json = mock_post.call_args[1]["json"]
    assert "dimensions" not in called_json
    assert called_json["model"] == "qwen3-embedding:0.6b"


def test_provider_embed_texts_sends_dimensions_when_enabled() -> None:
    provider = OpenAICompatibleProvider(
        _settings(embedding_dimensions=512, send_embedding_dimensions=True)
    )

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "data": [{"embedding": [0.1] * 512, "index": 0}],
        "usage": {},
    }
    mock_response.raise_for_status = MagicMock()

    with patch.object(httpx.Client, "post", return_value=mock_response) as mock_post:
        provider.embed_texts(["test text"])

    called_json = mock_post.call_args[1]["json"]
    assert called_json["dimensions"] == 512


def test_provider_rerank_returns_scored_indices() -> None:
    provider = OpenAICompatibleProvider(_settings(rerank_model="bge"))

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "results": [
            {"index": 1, "relevance_score": 0.9},
            {"index": 0, "relevance_score": 0.2},
        ]
    }
    mock_response.raise_for_status = MagicMock()

    with patch.object(httpx.Client, "post", return_value=mock_response) as mock_post:
        ranked = provider.rerank("q", ["doc a", "doc b"])

    assert ranked == [(1, 0.9), (0, 0.2)]
    called_json = mock_post.call_args[1]["json"]
    assert called_json["model"] == "bge"
    assert called_json["query"] == "q"
    assert called_json["documents"] == ["doc a", "doc b"]


def test_provider_rerank_empty_documents_short_circuits() -> None:
    provider = OpenAICompatibleProvider(_settings())
    with patch.object(httpx.Client, "post") as mock_post:
        assert provider.rerank("q", []) == []
    mock_post.assert_not_called()
