# StudyGraph Roadmap

## Direction

StudyGraph starts as a local app/data study preparation app and grows into a classroom product for teachers and students.

The roadmap intentionally separates the v0.1 usable MVP from later classroom workflows. This keeps the first release shippable while preserving the product direction.

## v0.1: Usable MVP

Goal: make StudyGraph useful from a cloned repository.

- Local FastAPI backend.
- Separate React frontend.
- Local Postgres + pgvector storage.
- Local file storage for uploaded documents.
- Provider API keys for chat and embeddings.
- Upload support for PDF, DOCX, TXT, and Markdown.
- Document ingestion with parsing, chunking, embeddings, and status tracking.
- Cited Q&A over selected documents or the full library.
- Document summaries.
- Flashcards with source references.
- Docker Compose local setup.

## v0.2: Quality RAG

Goal: improve trust, retrieval quality, and developer confidence.

Detailed implementation plan: [v0.2-quality-rag-plan.md](v0.2-quality-rag-plan.md).

- Stronger reranking.
- Better context verification.
- Citation coverage scoring.
- Retrieval and generation eval fixtures.
- Observability for ingestion, retrieval, provider calls, and answer generation.
- Better document previews and chunk inspection.
- Retry controls for failed ingestion and generation.

## v0.3: Classroom Foundation

Goal: introduce the core data model for real classroom use.

- Users and local authentication.
- Teacher and student roles.
- Courses or classes.
- Teacher-managed material collections.
- Shared document libraries per class.
- Class-scoped Q&A.
- Basic role-based access control.

## v0.4: Classroom Workflows

Goal: support repeatable teaching and learning workflows.

- Assignments based on uploaded materials.
- Quizzes generated from class materials.
- Study plans for learners.
- Teacher review of generated study sets.
- Student progress views.
- Due dates and completion status.

## v1.0: Classroom Product

Goal: make StudyGraph a durable classroom platform.

- Multi-class teacher dashboard.
- Student dashboards.
- Robust permissions.
- Deployment guidance beyond local development.
- Import/export for study materials and artifacts.
- Admin-friendly configuration.
- Production-grade reliability, logging, and backup guidance.

## Later Ideas

- Web search as an optional fresh-data retrieval tool.
- OCR and slide ingestion.
- LMS integrations.
- Collaborative annotation.
- Shared class flashcard decks.
- Local model support as an optional runtime mode.
