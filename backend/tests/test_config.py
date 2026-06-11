from pathlib import Path

from app.core.config import Settings


def test_settings_loads_root_env_when_started_from_backend(
    monkeypatch,
    tmp_path: Path,
) -> None:
    project_dir = tmp_path / "studygraph"
    backend_dir = project_dir / "backend"
    backend_dir.mkdir(parents=True)
    (project_dir / ".env").write_text("OPENAI_API_KEY=test-root-key\n", encoding="utf-8")

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.chdir(backend_dir)

    settings = Settings()

    assert settings.openai_api_key == "test-root-key"
