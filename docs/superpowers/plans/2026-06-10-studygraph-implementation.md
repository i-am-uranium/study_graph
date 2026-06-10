# StudyGraph Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the StudyGraph v0.1 usable MVP: local app/data RAG study preparation with PDF/DOCX/TXT/Markdown upload, cited Q&A, summaries, flashcards, and production-ready deployment assets.

**Architecture:** FastAPI provides the backend API, retrieval, generation, and orchestration. A separate React frontend talks to the API. Postgres with pgvector stores app data and embeddings, while uploaded files live on local disk or mounted production volumes.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, Alembic, pgvector, Pydantic, React, Vite, TypeScript, Docker, Docker Compose, pytest, Vitest.

---

## Chunk 1: Repository Foundation

**Files:**
- Create: `README.md`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `docker-compose.prod.yml`
- Create: `backend/pyproject.toml`
- Create: `frontend/package.json`
- Modify: `.gitignore`

- [ ] Create backend/frontend folder structure and root docs.
- [ ] Add local and production compose files.
- [ ] Add example environment variables for database, provider credentials, and CORS.
- [ ] Add root README with local setup and production deployment guidance.
- [ ] Initialize git if the folder is not already a repository.

## Chunk 2: Backend Core

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/db/*`
- Create: `backend/app/models/*`
- Create: `backend/app/schemas/*`
- Create: `backend/app/api/*`
- Create: `backend/app/services/*`
- Create: `backend/tests/*`

- [ ] Write tests for config, document parsers, chunking, provider contract, and API health.
- [ ] Implement FastAPI app and health endpoint.
- [ ] Implement SQLAlchemy models for documents, chunks, Q&A sessions/messages, study artifacts, and app settings.
- [ ] Implement file parsers for TXT/Markdown, PDF, and DOCX.
- [ ] Implement deterministic chunking with source metadata.
- [ ] Implement provider abstraction for OpenAI-compatible chat and embeddings.
- [ ] Implement upload, ingestion status, Q&A, summary, flashcard, and settings APIs.
- [ ] Add schema validation for flashcards and cited responses.
- [ ] Run backend tests.

## Chunk 3: Frontend Workspace

**Files:**
- Create: `frontend/src/*`
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig*.json`
- Create: `frontend/tests/*`

- [ ] Write component/API client tests for core rendering and request behavior.
- [ ] Implement React workspace with Library, Document Detail, Ask, Study Set, and Settings views.
- [ ] Implement upload flow and ingestion status display.
- [ ] Implement Q&A form with selected document filters and citation rendering.
- [ ] Implement summary and flashcard generation actions.
- [ ] Implement production-safe API base URL configuration.
- [ ] Run frontend tests and build.

## Chunk 4: Production Deployment

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/*`
- Create: `docs/DEPLOYMENT.md`

- [ ] Add backend production Dockerfile.
- [ ] Add frontend production Dockerfile with Nginx static serving.
- [ ] Add Alembic migration for pgvector and core tables.
- [ ] Add production compose file using persistent volumes and restart policies.
- [ ] Document required secrets, reverse proxy expectations, migration commands, and backup guidance.

## Chunk 5: Verification

**Files:**
- Modify as needed based on failures.

- [ ] Run backend unit/API tests.
- [ ] Run frontend tests.
- [ ] Run frontend production build.
- [ ] Validate Docker Compose config.
- [ ] Run a smoke import/startup check for the backend app.
- [ ] Record any known limitations honestly in README or deployment docs.

