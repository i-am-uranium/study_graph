from app.services.providers import OpenAICompatibleProvider, ProviderSettings


def test_provider_settings_require_api_key_for_real_calls() -> None:
    settings = ProviderSettings(
        api_key="",
        base_url="https://api.openai.com/v1",
        chat_model="gpt-4.1-mini",
        embedding_model="text-embedding-3-small",
    )
    provider = OpenAICompatibleProvider(settings)

    try:
        provider.ensure_configured()
    except ValueError as exc:
        assert "OPENAI_API_KEY" in str(exc)
        assert "restart the API and worker" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_provider_builds_chat_payload() -> None:
    settings = ProviderSettings(
        api_key="sk-test",
        base_url="https://provider.example/v1",
        chat_model="study-chat",
        embedding_model="study-embedding",
    )
    provider = OpenAICompatibleProvider(settings)

    payload = provider.chat_payload("system", "question")

    assert payload["model"] == "study-chat"
    assert payload["messages"][0]["role"] == "system"
    assert payload["messages"][1]["content"] == "question"


def test_provider_embed_texts_passes_dimensions() -> None:
    from unittest.mock import MagicMock, patch
    import httpx

    settings = ProviderSettings(
        api_key="sk-test",
        base_url="https://provider.example/v1",
        chat_model="study-chat",
        embedding_model="study-embedding",
        embedding_dimensions=512,
    )
    provider = OpenAICompatibleProvider(settings)

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "data": [{"embedding": [0.1] * 512, "index": 0}],
        "usage": {"prompt_tokens": 10, "total_tokens": 10},
    }
    mock_response.raise_for_status = MagicMock()

    with patch.object(httpx.Client, "post", return_value=mock_response) as mock_post:
        embeddings = provider.embed_texts(["test text"])

        assert len(embeddings) == 1
        assert len(embeddings[0]) == 512
        mock_post.assert_called_once()
        called_json = mock_post.call_args[1]["json"]
        assert called_json["dimensions"] == 512
        assert called_json["model"] == "study-embedding"

