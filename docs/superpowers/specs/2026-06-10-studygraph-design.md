# StudyGraph v0.1 Design

## Overview

StudyGraph is a local app/data agentic RAG study preparation app for students and teachers. Users upload learning documents, then use those materials to ask cited questions, generate summaries, and create flashcards.

The v0.1 goal is a usable open-source MVP, not the full classroom platform. It should be credible from a cloned repo, with local application services and database storage, while using provider API keys for LLM and embedding calls.

## Product Name

The working product name is **StudyGraph**.

The name fits the product direction because the app turns static learning material into connected, queryable study context: documents, chunks, citations, questions, summaries, and flashcards.

## v0.1 Scope

### In Scope

- Upload PDF, DOCX, TXT, and Markdown documents.
- Parse documents into extractable text.
- Chunk extracted content with source metadata.
- Generate embeddings through a configured provider API.
- Store chunks and embeddings in local Postgres with pgvector.
- Ask cited questions over selected documents or the full local library.
- Generate document summaries.
- Generate flashcards with source references.
- Save Q&A history and study artifacts locally.
- Run locally with Docker Compose.
- Configure provider API keys and model names through settings.

### Out of Scope

- Classroom accounts, teacher dashboards, assignments, and progress tracking.
- Multi-user authorization beyond local app assumptions.
- Web search.
- OCR-heavy image workflows.
- Fully local model hosting.
- Managed vector databases or hosted storage as required dependencies.
- Complex LMS integrations.

## Architecture

StudyGraph v0.1 uses a **Lean Monolith API + Worker** architecture.

### Runtime Services

- **React frontend**: library, upload flow, document detail, Q&A workspace, study artifact screens, and settings.
- **FastAPI backend**: REST APIs, orchestration, retrieval, generation, settings validation, and response shaping.
- **Ingestion worker**: parsing, chunking, embedding, and persistence.
- **Postgres + pgvector**: local relational and vector storage.
- **Local file storage**: original uploaded documents.
- **Provider AI APIs**: embeddings and chat completions via user-provided keys.

### Backend Module Boundaries

- `ingestion`: file validation, parsing, extraction, chunking, and ingestion status.
- `retrieval`: vector search, metadata filters, and ranking preparation.
- `generation`: provider calls for answers, summaries, and flashcards.
- `verification`: citation coverage checks and confidence notes.
- `artifacts`: persistence and retrieval of summaries and flashcards.
- `providers`: provider abstraction for embeddings and chat completions.

These boundaries keep the MVP small while preserving clear extension points for stronger RAG quality and later classroom workflows.

## Primary Flows

### Upload and Ingest

1. User uploads a PDF, DOCX, TXT, or Markdown file from the frontend.
2. FastAPI validates the file type, stores the original file locally, creates a `documents` row, and queues ingestion.
3. The worker extracts text, splits it into chunks, attaches page or section metadata where available, generates embeddings, and writes `document_chunks`.
4. The frontend shows ingestion status and any parsing errors.

### Cited Q&A

1. User asks a question against selected documents or the full library.
2. FastAPI embeds the query through the configured provider.
3. Retrieval searches pgvector chunks with optional document filters.
4. The backend reranks enough context for v0.1 using provider-assisted or local scoring.
5. Verification checks whether the selected context supports a grounded answer.
6. The answer builder returns a response, citations, and confidence notes.
7. The Q&A exchange is saved for later review.

### Summaries

1. User requests a summary for a selected document.
2. The backend retrieves representative chunks or uses document chunks in sequence.
3. The generation layer returns a structured summary with key points and cited source references.
4. The summary is saved as a study artifact.

### Flashcards

1. User requests flashcards for a selected document or section.
2. The backend retrieves relevant chunks and asks the provider to generate structured cards.
3. The response is validated for front/back shape and source references.
4. Flashcards are saved as a study artifact and can be regenerated or deleted.

## Frontend UX

StudyGraph should open directly into the study workspace rather than a marketing page.

### Screens

- **Library**: upload files, view ingestion status, file type, chunk count, created date, and errors.
- **Document Detail**: show metadata, extracted text preview, summary actions, and flashcard actions.
- **Ask**: chat-style Q&A over selected documents or the full library, with citations visible near answers.
- **Study Set**: saved summaries and flashcards with source references, regenerate, and delete actions.
- **Settings**: provider API key, chat model, embedding model, and chunking defaults.

### UX Principles

- Make document status obvious: queued, ingesting, ready, failed.
- Treat citations as first-class UI, not hidden metadata.
- Keep local setup and provider configuration visible and debuggable.
- Prefer useful study output over generic chat behavior.

## Data Model

### `documents`

Stores uploaded document metadata.

- `id`
- `filename`
- `content_type`
- `file_path`
- `status`
- `error_message`
- `created_at`
- `updated_at`

### `document_chunks`

Stores searchable chunks and source metadata.

- `id`
- `document_id`
- `chunk_index`
- `text`
- `metadata`
- `embedding`
- `created_at`

### `qa_sessions`

Stores local Q&A sessions.

- `id`
- `title`
- `selected_document_ids`
- `created_at`
- `updated_at`

### `qa_messages`

Stores questions, answers, citations, and confidence notes.

- `id`
- `session_id`
- `role`
- `content`
- `citations`
- `confidence_notes`
- `created_at`

### `study_artifacts`

Stores summaries and flashcards.

- `id`
- `document_id`
- `artifact_type`
- `title`
- `content`
- `source_refs`
- `created_at`
- `updated_at`

### `app_settings`

Stores local provider and model configuration.

- `id`
- `provider`
- `chat_model`
- `embedding_model`
- `settings`
- `updated_at`

Secrets should be loaded from environment variables or local ignored config rather than committed files.

## Error Handling

- Unsupported file types are rejected before storage.
- Failed parsing updates document status to `failed` with a readable error.
- Provider authentication failures are surfaced in settings and generation responses.
- Embedding failures leave documents retryable.
- Q&A responses should clearly say when the uploaded material does not support an answer.
- Generated flashcards should be schema-validated before saving.

## Testing Strategy

- Unit tests for parsers, chunking, provider adapters, retrieval filters, and artifact validation.
- API tests for upload, ingestion status, Q&A, summaries, flashcards, and settings validation.
- Integration tests with Postgres + pgvector for document ingestion and retrieval.
- Fixture-based RAG tests using small sample documents with expected citation coverage.
- Frontend tests for library status, Q&A citation rendering, and study artifact actions.

## Open Questions for Implementation

- Exact provider abstraction shape and supported providers for v0.1.
- Whether the worker should use Celery/RQ/Arq or a simpler process queue for the first release.
- Whether the frontend should use Vite React or Next.js as a static client for the FastAPI service.
- How much source preview to expose for PDFs and DOCX in v0.1.

## Acceptance Criteria

- A new user can clone the repo, configure provider credentials, run Docker Compose, upload a supported document, and ask cited questions.
- The user can generate and revisit a summary for an uploaded document.
- The user can generate and revisit flashcards for an uploaded document.
- Failed ingestion and provider configuration errors are visible and actionable.
- All app data is stored locally except provider API calls.
- The architecture leaves clear extension points for the classroom roadmap.
