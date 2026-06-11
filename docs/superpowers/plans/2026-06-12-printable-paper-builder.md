# Printable Paper Builder Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end Paper Builder that creates editable teacher-reviewed printable drafts from uploaded documents and exports formal school exam PDFs.

**Architecture:** Add a separate printable domain with `PrintableSet`, `PrintableJob`, and `PrintableExport` models. Generation and export run through queued jobs processed by the existing worker loop, while the React UI polls job status and exposes a wizard/editor/export flow.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic, React, TypeScript, Vitest, ReportLab for PDF generation.

---

## File Structure

- Create `backend/app/models/printable.py`: printable set/job/export SQLAlchemy models and enums.
- Modify `backend/app/models/__init__.py`: export printable models.
- Create `backend/app/schemas/printables.py`: request/response schemas and editable draft shape validation.
- Create `backend/app/services/printables.py`: generation, draft updates, job queueing, PDF export service.
- Create `backend/app/api/printables.py`: CRUD/job/export endpoints.
- Modify `backend/app/main.py`: include printables router.
- Modify `backend/app/worker.py`: process printable jobs alongside ingestion jobs.
- Create `backend/alembic/versions/0003_printable_sets.py`: printable tables.
- Modify `backend/pyproject.toml` and `backend/uv.lock`: add ReportLab.
- Create `backend/tests/test_printables.py`: service/API tests.
- Modify `frontend/src/types.ts`: printable types.
- Modify `frontend/src/api.ts`: printable API functions.
- Modify `frontend/src/App.tsx`: add Paper Builder tab/workflow/editor/export.
- Modify `frontend/src/styles.css`: wizard/editor/PDF controls styling.
- Modify `frontend/tests/App.test.tsx`: wizard, editor, polling, export tests.

## Chunk 1: Backend Data Model and API

### Task 1: Printable Models and Migration

**Files:**
- Create: `backend/app/models/printable.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/0003_printable_sets.py`
- Test: `backend/tests/test_printables.py`

- [ ] Write failing tests for creating a printable set and queued generation job.
- [ ] Run `uv run --extra dev pytest -q tests/test_printables.py`.
- [ ] Add printable SQLAlchemy models and exports.
- [ ] Add Alembic migration.
- [ ] Re-run targeted tests.

### Task 2: Printable Service and Router

**Files:**
- Create: `backend/app/schemas/printables.py`
- Create: `backend/app/services/printables.py`
- Create: `backend/app/api/printables.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_printables.py`

- [ ] Write failing tests for `POST /api/printables`, `GET /api/printables`, `PATCH /api/printables/{id}`, and jobs listing.
- [ ] Implement schemas, service functions, and API routes.
- [ ] Return job ids immediately for generation/export requests.
- [ ] Re-run backend targeted tests.

## Chunk 2: Generation Jobs and PDF Export

### Task 3: Draft Generation Job

**Files:**
- Modify: `backend/app/services/printables.py`
- Modify: `backend/app/worker.py`
- Test: `backend/tests/test_printables.py`

- [ ] Write failing test for running a queued draft-generation job with a fake provider.
- [ ] Generate strict draft JSON with sections, questions, answers, marks, and source refs.
- [ ] Store failed job status and error message when provider output is invalid.
- [ ] Extend worker to process printable jobs.
- [ ] Re-run backend targeted tests.

### Task 4: Formal PDF Export

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/uv.lock`
- Modify: `backend/app/services/printables.py`
- Modify: `backend/app/api/printables.py`
- Test: `backend/tests/test_printables.py`

- [ ] Add ReportLab dependency.
- [ ] Write failing test that an export job writes a PDF file and records a `PrintableExport`.
- [ ] Implement formal A4 student paper and answer key PDF generation.
- [ ] Add download endpoint using `FileResponse`.
- [ ] Re-run backend targeted tests.

## Chunk 3: Frontend Wizard, Polling, and Editor

### Task 5: API Types and Client

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`
- Test: `frontend/tests/App.test.tsx`

- [ ] Write failing API/UI test for loading printable sets and jobs.
- [ ] Add printable TypeScript types.
- [ ] Add API functions for list/create/update/jobs/export.
- [ ] Re-run targeted frontend tests.

### Task 6: Paper Builder UI

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/tests/App.test.tsx`

- [ ] Write failing tests for wizard defaults, editable draft question updates, and export button behavior.
- [ ] Add Paper Builder tab.
- [ ] Add wizard controls for source scope, output type, question counts, class/subject/title, time, marks, difficulty.
- [ ] Add editable draft cards with edit/remove/reorder controls.
- [ ] Poll while printable jobs are queued/running.
- [ ] Re-run frontend tests.

## Chunk 4: Verification

- [ ] Run `uv run --extra dev pytest -q` from `backend`.
- [ ] Run `uv run --extra dev ruff check .` from `backend`.
- [ ] Run `npm test` from `frontend`.
- [ ] Run `npm run build` from `frontend`.
- [ ] Run `npm run lint` from `frontend` and report the known ESLint 9 config blocker if still present.
- [ ] Apply migrations locally with `uv run alembic upgrade head`.
- [ ] Browser-check `http://localhost:5173` for Paper Builder load, job polling, editor, and export controls.
