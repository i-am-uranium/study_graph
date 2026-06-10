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
        assert "API key" in str(exc)
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
