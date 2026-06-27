from app.api import dashboard, documents, printables, qa, settings, study
from app.core.config import get_settings
from app.core.logging import setup_logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app_settings = get_settings()
    setup_logging(app_settings.log_level)
    app = FastAPI(title="StudyGraph API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.frontend_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(settings.router)
    app.include_router(documents.router)
    app.include_router(qa.router)
    app.include_router(study.router)
    app.include_router(printables.router)
    app.include_router(dashboard.router)
    return app


app = create_app()
