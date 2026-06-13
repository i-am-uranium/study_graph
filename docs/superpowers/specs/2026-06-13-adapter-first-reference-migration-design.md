# Adapter-First Reference Migration Design

## Goal

Borrow the design, UX flow, theme direction, and component ideas from the Google AI Studio `smart-learning-studio` prototype while keeping StudyGraph wired only to backend APIs that exist today.

The first implementation pass should make StudyGraph feel like a modern learning workspace, not a basic document utility. It should preserve current working capabilities:

- Document upload.
- Document ingestion.
- Grounded Q&A with citations.
- Saved QA sessions.
- Summaries.
- Flashcards.
- Printable paper generation, editing, saving, exporting, and job status.
- Provider/settings visibility.

Future platform capabilities from the prototype should be visible only as restrained preview or roadmap panels. The UI must not imply that collaboration, assignments, analytics, LMS sync, RBAC, cloud sync, or offline mutation already work.

## Source Prototype Takeaways

The reference app contributes these reusable product patterns:

- A top learning-studio identity bar with role, accessibility, and sync status controls.
- Role-aware navigation that separates student, teacher, and admin concerns.
- A RAG Studio surface with document roster, selected source context, question input, citations, and study-guide generation.
- Assignment, analytics, integrations, collaboration, and offline sync panels that establish long-term platform direction.
- First-class accessibility controls: font size and high-contrast mode.
- A modern learning-app theme using clean cards, clear status badges, strong section titles, and compact dashboards.

The reference app's runtime and backend should not be copied directly. StudyGraph should remain on the existing frontend and FastAPI backend. Components should be translated into the current app structure and API client.

## Recommended Approach

Use Adapter-first migration:

- Borrow the reference shell, theme posture, and component vocabulary.
- Wire only the current StudyGraph flows to real APIs.
- Present future-only modules as non-primary preview panels with clear labels.
- Keep the main navigation focused on working flows.
- Avoid adding prototype-only server endpoints as frontend dependencies.

This gives the product a stronger direction immediately while keeping user expectations accurate.

## Compatibility Matrix

| Prototype area | StudyGraph treatment | Backend compatibility |
| --- | --- | --- |
| Studio shell | Borrow and adapt as the main app shell | Compatible, frontend only |
| Role switcher | Use as a view-mode control or persona cue, not security | Frontend only now, true RBAC later |
| Accessibility controls | Borrow font-size and high-contrast behavior where practical | Compatible, frontend only |
| Online/offline/sync status | Show local API readiness and job activity now; reserve cloud/offline sync for preview | Partial |
| RAG document roster | Map to `listDocuments`, `uploadDocument`, `ingestDocument`, and `listIngestionJobs` | Compatible |
| RAG ask panel | Map to `askQuestion`, `listQaSessions`, and `getQaSession` | Compatible |
| Citation cards | Map to current `Citation` payload | Compatible |
| Study guide generation | Map to existing summary and flashcard actions instead of prototype text-prompt endpoint | Compatible |
| Assignment center | Preview only or teacher roadmap panel | API missing |
| Automated assignment feedback | Preview only | API missing |
| Analytics dashboard | Preview only, or minimal local counters using existing loaded data | Server analytics API missing |
| LMS integrations | Preview only | API missing |
| Real-time collaboration | Preview only | WebSocket/collaboration API missing |
| Offline queue | Preview only, unless limited to purely local UI state | Offline persistence/conflict API missing |
| Secure cloud sync | Preview only | API missing |

## Information Architecture

The app should open into a "Learning Workspace" shell. Primary navigation should be limited to working flows:

- **Study Desk**: dashboard-like entry point with source readiness, recent activity, suggested next actions, and preview panels.
- **RAG Library**: document upload, ingestion, source selection, grounded Q&A, citation review, and QA session history.
- **Paper Builder**: teacher-oriented paper draft generation, edit/review, save, export, and job state.
- **Study Artifacts**: saved summaries, flashcards, and reader mode.
- **Settings**: provider readiness and local setup state.

Future platform modules may appear in a secondary area:

- Assignments.
- Collaboration.
- Analytics.
- Integrations.
- Offline and cloud sync.

These should be visually secondary and labeled as "planned" or "preview". They should not block access to working flows.

## App Shell Design

The app shell should borrow the reference app's top studio structure:

- Brand mark and "Learning Workspace" title.
- Short subheading that explains the current workspace purpose.
- Role/persona control, initially visual only unless an existing feature needs it.
- Theme control.
- Accessibility control for text size and/or high contrast.
- Provider readiness and local sync/job status.
- Responsive navigation.

Desktop behavior:

- Persistent left rail or compact side navigation.
- Main content area with a strong page heading and working cards.
- Optional right context panel for source readiness or preview modules.

Tablet behavior:

- Navigation may stay top or become compact segmented controls.
- Context panels should move below primary content.
- Two-column layouts are allowed only when controls remain readable.

Mobile behavior:

- Use bottom or segmented navigation with 44px practical tap targets.
- Stack content in one column.
- Keep upload, ask, generate, save, export, and reader-close actions reachable.
- Avoid hover-only controls and horizontal scrolling.

## Theme System

Theme must be treated as a first-class citizen.

Required modes:

- Light.
- Dark.
- High contrast or accessibility-enhanced contrast.

Implementation should use a tokenized CSS system rather than scattered literal colors:

- App background.
- Surface.
- Raised surface.
- Text.
- Muted text.
- Border.
- Primary action.
- Secondary action.
- Accent.
- Success.
- Warning.
- Danger.
- Queued/running/ready/failed/generating/exporting status colors.
- Focus ring.
- Shadow.

Dark mode should be authored intentionally, not generated by inversion. High contrast should increase legibility and focus visibility without changing the information architecture.

## Component Design

### Studio Header

Purpose:

- Establish app identity.
- Expose role/persona, theme, accessibility, and status controls.
- Show provider and job readiness at a glance.

Inputs:

- `settings.api_key_configured`.
- Ingestion jobs.
- Printable jobs.
- Current selected role/persona state.
- Current theme and accessibility preferences.

Output:

- Header controls and status badges.
- No backend writes unless an existing settings API is extended in a later phase.

### Workspace Navigation

Purpose:

- Keep primary navigation focused on working StudyGraph flows.
- Keep future modules discoverable without making them feel functional.

Working nav items:

- Study Desk.
- RAG Library.
- Paper Builder.
- Study Artifacts.
- Settings.

Preview nav or panel items:

- Assignments.
- Collaboration.
- Analytics.
- Integrations.
- Offline Sync.

Mobile:

- Working nav should fit in compact controls.
- Preview items can move to the Study Desk roadmap area instead of crowding the bottom navigation.

### Study Desk

Purpose:

- Replace the current basic landing experience with a useful command center.
- Guide the user to the next valid action.

Data:

- Documents.
- Ingestion jobs.
- QA sessions.
- Artifacts.
- Printables.
- Printable jobs.
- Settings.

Sections:

- Source readiness summary.
- Next best action.
- Recent conversations or outputs.
- Quick actions: upload source, ask question, generate study set, create paper.
- Preview modules as a secondary roadmap strip.

### RAG Library

Purpose:

- Borrow the reference RAG Studio flow and adapt it to StudyGraph APIs.

Data flow:

1. `listDocuments` and `listIngestionJobs` populate the document roster.
2. `uploadDocument` uploads a real file with `FormData`.
3. `ingestDocument` queues ingestion for uploaded documents.
4. Ready documents become selectable sources.
5. `askQuestion` sends the user prompt, selected document IDs, and optional session ID.
6. `listQaSessions` and `getQaSession` populate conversation history.
7. Citations and confidence notes render below assistant answers.

Important adaptation:

- The prototype supports text paste upload through `POST /api/documents` JSON. StudyGraph currently supports file upload. The migrated UI should use file upload and not introduce text paste upload unless the backend is extended later.

### Citation Cards

Purpose:

- Make grounded answers inspectable.

Each citation card should show:

- Filename.
- Chunk index.
- Retrieval score when present.
- Excerpt.
- Optional metadata if useful and compact.

Behavior:

- Citations are visible or expandable on mobile.
- Citation access must not depend on hover.
- Long excerpts wrap safely.

### Study Artifacts

Purpose:

- Turn the reference app's "study guide" concept into StudyGraph's existing summary and flashcard APIs.

Data flow:

- `createSummary(documentId)` creates or opens a summary.
- `createFlashcards(documentId, count)` creates or opens flashcards.
- `listArtifacts` populates saved artifacts.

UI:

- Artifact cards show type, title, source context when available, and updated date.
- Reader mode supports summaries and flashcards.
- The view must preserve long-form readability on mobile.

### Paper Builder

Purpose:

- Use the reference assignment-center pattern as inspiration for a teacher-oriented creation and review workflow, but map it to current printables.

Data flow:

- `createPrintable` queues draft generation.
- `listPrintableJobs` shows queue/running/completed/failed state.
- `updatePrintable` saves edits.
- `exportPrintable` queues PDF export.
- `listPrintableExports` shows available downloads.

UI:

- Group controls into source, paper details, question mix, and generation action.
- Show generated drafts as reviewable sections and questions.
- Keep save and export visually distinct.
- On mobile, stack question prompt, answer, options, marks, and answer-space controls.

### Settings

Purpose:

- Keep provider readiness clear and actionable.

Current behavior:

- Read settings from `readSettings`.
- Show provider, base URL, chat model, embedding model, embedding dimensions, and API key configured state.

The settings page should not expose cloud sync, RBAC, or LMS controls as working settings until the APIs exist.

### Preview Modules

Purpose:

- Preserve the product direction from the reference app without overstating current capability.

Preview modules:

- Collaboration: planned real-time workspace.
- Assignments: planned assignment creation, submission, rubric, and feedback workflow.
- Analytics: planned progress and performance dashboard.
- Integrations: planned classroom management/LMS connectors.
- Offline Sync: planned local cache, queue, conflict, and secure cloud sync behavior.

Rules:

- Preview modules should be visually subdued.
- Calls to action should say "Planned" or "Requires API".
- Do not provide controls that look like they execute real backend actions.

## Data Boundaries

The Adapter-first pass should not change backend contracts unless a small compatibility fix is discovered during implementation.

Allowed frontend API dependencies:

- `/api/documents`
- `/api/documents/{document_id}/ingest`
- `/api/documents/ingestion-jobs`
- `/api/qa/ask`
- `/api/qa/sessions`
- `/api/qa/sessions/{session_id}`
- `/api/study/summaries`
- `/api/study/flashcards`
- `/api/study/artifacts`
- `/api/printables`
- `/api/printables/jobs`
- `/api/printables/{printable_id}`
- `/api/printables/{printable_id}/export`
- `/api/printables/{printable_id}/exports`
- `/api/settings`

Disallowed for this pass:

- New fake analytics endpoints.
- New fake integration endpoints.
- New fake assignment endpoints.
- New fake collaboration sockets.
- New fake sync endpoints.

## Error, Empty, And Loading States

Required states:

- API unavailable.
- Provider API key missing.
- No documents uploaded.
- Document uploaded but not ingested.
- Ingestion queued.
- Ingestion running.
- Ingestion failed with message.
- No ready documents selected for Q&A.
- Question submitted while provider is unavailable.
- QA request failed.
- No artifacts yet.
- Artifact generation failed.
- No printable drafts yet.
- Printable generation queued/running.
- Printable generation failed.
- Printable export queued/running.
- Printable export failed.

State copy should explain the next action. It should not expose raw stack traces.

## Accessibility

Use WCAG 2.2 as the target for the implementation pass.

Requirements:

- Preserve semantic `header`, `nav`, `main`, `section`, form labels, and button semantics where practical.
- Provide accessible names for icon-only controls.
- Keep visible focus indicators across themes and high contrast mode.
- Avoid hover-only functionality.
- Support keyboard access through nav, document actions, QA session list, question form, artifact cards, reader controls, printable form, printable editor, save/export actions, and settings.
- Keep important mobile controls at practical 44px target size.
- Ensure generated text, citation excerpts, filenames, paper questions, and flashcards wrap without overflow.
- Respect reduced-motion preferences for transitions.

References:

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WCAG 2.2 Quick Reference: https://www.w3.org/WAI/WCAG22/quickref/

## Testing And Verification

Implementation planning should include:

- TypeScript build or lint verification.
- Existing unit tests, if present.
- Browser verification at desktop width.
- Browser verification at mobile width.
- Theme verification for light, dark, and high contrast.
- Keyboard navigation smoke test.
- Empty state smoke test with no documents.
- Provider-missing state smoke test.
- Ready-document RAG flow smoke test when test data is available.
- Paper Builder responsive smoke test.

If backend services or provider credentials are unavailable, verification should explicitly say which flows could not be exercised end to end.

## Out Of Scope

- Real authentication.
- Role-based access control.
- Student/teacher/admin permissions.
- Native mobile packaging.
- Offline persistence and conflict handling.
- Cloud sync.
- Real-time collaboration.
- Assignment submission and grading.
- Analytics event pipelines and dashboards backed by server metrics.
- LMS or classroom management integrations.
- Migrating the reference app's Express/WebSocket server.
- Replacing StudyGraph's current backend API.

## Implementation Planning Notes

The implementation plan should break the work into small pieces:

1. Introduce theme tokens and app shell state.
2. Build the studio header and navigation.
3. Create the Study Desk summary surface.
4. Reshape document and RAG flows into RAG Library.
5. Reshape saved summaries and flashcards into Study Artifacts.
6. Restyle Paper Builder using the teacher-workflow pattern.
7. Add preview modules.
8. Finish responsive, accessibility, and browser verification.

Each piece should preserve existing API calls and existing user data behavior.
