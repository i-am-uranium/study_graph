# Learning Workspace UI/UX Design

## Goal

Redesign the existing StudyGraph frontend into a modern, responsive learning workspace for the current local-first app while preserving a clear path toward a larger teacher/student learning platform.

The current implementation already supports document upload, ingestion, Agentic RAG Q&A, citations, summaries, flashcards, settings, and printable paper generation. This design improves the flow, mobile usability, visual identity, theme system, and app assets without pretending that future systems such as RBAC, cloud sync, collaboration, offline mutation, assignments, or LMS integrations already exist.

## Product Direction

StudyGraph should feel like a **Hybrid Learning Studio**:

- Students can use it to upload material, ask grounded questions, review summaries, and study flashcards.
- Teachers can use it to convert source documents into reviewable papers and future assignment workflows.
- Administrators, classroom analytics, collaboration, integrations, and secure syncing are long-term platform directions, not part of this UI-only pass.

The selected visual tone is **Clean Study OS**:

- Modern workspace rather than marketing page.
- Calm and capable rather than playful or purely academic.
- Restrained color, strong hierarchy, dense enough for repeated work.
- First-class light and dark themes.
- Innovation focused on source trust, citations, and source-to-output flow.

## Scope

### In Scope

- Responsive app shell for desktop, tablet, and mobile.
- Improved information architecture around source material and generated outputs.
- First-class light and dark theme token system.
- Updated Library, Ask, Study Set, Paper Builder, and Settings surfaces.
- Citation Lens pattern for inspecting answer evidence.
- Lightweight Source Map / Source Status panel using existing documents, ingestion jobs, artifacts, printables, and provider readiness.
- Empty, loading, failed, disabled, and setup states that explain the next action.
- App assets: favicon/app icon updates and project-local visual assets suitable for the new identity.
- Accessibility-oriented control sizing, focus states, color contrast, semantic regions, and mobile navigation.
- Tests and browser verification for the redesigned frontend.

### Out of Scope

- Authentication and role-based access control.
- Real student, teacher, or administrator accounts.
- Real-time collaboration.
- Assignment creation/submission workflows.
- Progress tracking backed by student performance data.
- Secure cloud syncing.
- Offline-first data mutation and conflict resolution.
- External classroom management or LMS integrations.
- Native mobile application packaging.
- Backend API changes unless a small frontend compatibility fix is required.

## Information Architecture

The app should open directly into the workspace. The primary navigation remains:

- **Library**: source upload, ingestion status, document actions, artifact generation entry points.
- **Ask**: cited Q&A over selected ready documents.
- **Study Set**: summaries, flashcards, and reader mode.
- **Paper Builder**: teacher-oriented draft generation, edit, save, export status, and export links.
- **Settings**: provider configuration visibility and local setup guidance.

The navigation presentation changes by viewport:

- **Desktop**: compact rail or sidebar with icon + label affordances, persistent workspace header, and room for a contextual source/status panel.
- **Tablet**: adaptive two-column layouts where useful, with context panels moving below or into collapsible sections.
- **Mobile**: bottom navigation with large touch targets. Core actions must remain reachable; no core feature should disappear solely because the viewport is small.

## Workspace Shell

The shell should provide a stronger sense of place:

- Brand mark and StudyGraph name.
- Current workflow title and concise helper text.
- Provider readiness warning when API key is missing.
- Refresh and theme controls.
- Summary of source readiness: total documents, ready documents, pending ingestion jobs, saved study artifacts, printable drafts.
- Clear next actions, such as upload a source, ingest queued documents, ask a question, generate study artifacts, or review a paper draft.

The shell should avoid nested card-heavy composition. Cards are appropriate for repeated documents, artifacts, conversations, and draft questions, but page sections should be full-width or unframed layouts with clear spacing.

## Key UX Patterns

### Source Map / Source Status

Implement a lightweight, data-backed source status area rather than a complex graph engine. It should summarize:

- Ready sources.
- Pending or failed ingestion.
- Generated study artifacts.
- Printable drafts and running printable jobs.
- Provider setup state.

This can appear as a right context panel on desktop and as stacked cards on mobile.

### Citation Lens

Citations should be inspectable and visually connected to answers:

- Assistant answers remain readable first.
- Citations appear as compact evidence cards below the answer.
- Each evidence card should show filename, chunk index, score when available, and excerpt.
- The UI should distinguish answer content from evidence and confidence notes.
- On mobile, evidence must remain accessible without requiring hover.

This pass can use the existing citation payload. Claim-level citation highlighting is a future enhancement unless the backend returns claim spans.

### Study Artifacts

The Study Set page should feel like a study library:

- Summaries and flashcards should have clearer artifact type, source, date, and open-reader affordances.
- Reader mode should keep its focused reading experience and support both light and dark themes.
- Long summary text and flashcard content must wrap safely on mobile.

### Paper Builder

Paper Builder should feel teacher-oriented and review-first:

- The form should be grouped into source, paper details, question mix, and generation action.
- Generated drafts should communicate status clearly: generating, draft ready, exporting, failed.
- Editable question rows should remain usable on mobile by stacking fields.
- Save and export actions should be visually distinct.
- Future Paper Quality Meter concepts can influence status presentation, but actual quality scoring is out of scope without backend support.

## Visual System

### Theme Tokens

Create a tokenized CSS system for:

- Backgrounds.
- Elevated surfaces.
- Text and muted text.
- Borders.
- Primary actions.
- Secondary actions.
- Accent highlights.
- Status colors for ready, failed, queued, ingesting, generating, exporting, and draft-ready states.
- Focus rings.
- Shadows.

Light and dark themes must be authored as peers. Dark mode should not be a simple inversion.

### Color Direction

Use a calm, study-oriented palette:

- Neutral base with a subtle green tint.
- Deep green/ink for structure.
- Warm yellow or amber as a focused learning accent.
- Red/orange only for destructive or failed states.
- Avoid dominant purple/blue gradients, generic neon-dark styling, and one-note green-only palettes.

### Typography

Use a readable, modern type scale:

- Tight hierarchy for workspace surfaces.
- Larger but restrained page headings.
- Smaller headings inside cards and panels.
- Body text optimized for reading generated answers and summaries.
- No viewport-width font scaling.
- Letter spacing remains `0` except for small uppercase metadata labels where a minor positive value may be used if needed.

### Assets

Generate or create app assets that match Clean Study OS:

- Updated favicon / app icon.
- Optional source-map or learning-studio visual asset for empty states.
- Assets must be saved inside the frontend workspace and referenced locally.
- Do not leave project-referenced generated images under Codex cache paths.

## Responsive Design

### Desktop

- Navigation stays persistent.
- Main workspace and source/status context can sit side by side.
- Ask view can preserve a conversation list plus conversation workspace.
- Paper Builder can use grouped multi-column controls where space allows.

### Tablet

- Use fewer columns and let context panels collapse below primary content.
- Maintain 44px practical touch targets for primary actions.
- Keep chat composer and paper generation actions reachable.

### Mobile

- Replace sidebar with bottom navigation.
- Stack content in a single column.
- Keep upload, send, reader close, save, export, and theme/refresh controls reachable.
- Avoid horizontal scrolling except inside intentionally scrollable code or table-like content.
- Conversation list should not consume the full primary surface when a conversation is active.
- Paper Builder question editors should stack prompt, answer, and metadata.

## Accessibility

Follow WCAG 2.2 as the design target. Relevant principles for this pass:

- Maintain readable text contrast across both themes.
- Provide visible focus indicators that are not hidden by sticky headers, footers, or bottom nav.
- Use semantic landmarks for sidebar/nav/main/header where practical.
- Preserve accessible names for icon-only controls.
- Ensure target size meets WCAG 2.2 AA minimums, and use 44px or larger for important mobile controls where practical.
- Support keyboard navigation through tabs, document actions, conversation items, forms, and paper editor controls.
- Avoid hover-only functionality.
- Respect reduced motion for any transitions.

References:

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WCAG 2.2 Quick Reference: https://www.w3.org/WAI/WCAG22/quickref/
- W3C mobile accessibility guidance: https://w3c.github.io/matf/

## Offline And Platform Vision

The long-term requirement includes offline access, secure cloud sync, cross-platform synchronization, collaboration, analytics, assignments, and classroom integrations. This design should make room for those systems, but not fake them.

For this pass:

- The frontend may visually support a future “sync/offline” status location.
- The app should not claim that data is synced or available offline unless implemented.
- PWA/service-worker work is a separate platform feature. Service workers can support cached assets and offline experiences, but meaningful offline data workflows need storage strategy, sync queues, conflict handling, auth, and backend support.

Reference:

- MDN Service Workers: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

## Implementation Boundaries

### Frontend Units

- `App.tsx`: may remain the main orchestrator for this pass, but repeated UI pieces should be extracted only if it materially reduces complexity.
- `styles.css`: should move toward clear theme tokens and component sections.
- `public/`: store generated or hand-authored app assets.
- Existing `api.ts` and `types.ts`: remain unchanged unless the UI needs a small type-safe helper.

### Data Flow

Use existing frontend state and API calls:

- Documents and ingestion jobs power Library and Source Status.
- Artifacts power Study Set and source-output counts.
- QA sessions and session details power Ask.
- Printables, printable jobs, and exports power Paper Builder.
- Settings power provider setup and disabled states.

No new backend endpoints are required for the first UI pass.

## Error Handling And States

The redesign must cover:

- Empty library.
- Provider key missing.
- Upload running.
- Ingestion queued/running/failed/ready.
- No ready documents for Ask or Paper Builder.
- Q&A request running and failed.
- Empty conversation history.
- Empty study artifacts.
- Printable generation/export queued/running/failed.
- Disabled actions with useful titles or visible helper text.

Error messages should remain concrete and actionable.

## Testing And Verification

### Automated

- Run existing frontend tests.
- Update tests only for changed accessible labels or text.
- Run frontend build.
- Add focused tests if new behavior is introduced beyond visual restructuring.

### Browser Verification

Use browser verification after implementation:

- Desktop viewport.
- Mobile viewport around 390px width.
- Light theme.
- Dark theme.
- Library empty and populated states, if data/mocks allow.
- Ask composer and citation display.
- Study reader mode.
- Paper Builder form and draft editor.

Check for:

- No horizontal overflow.
- No text overlap or clipped buttons.
- Touch-sized primary controls on mobile.
- Visible focus states.
- Correct asset rendering.
- Theme parity.

## Acceptance Criteria

- StudyGraph feels like a polished learning workspace rather than a basic admin UI.
- The user can understand the source-to-output flow from Library to Ask, Study Set, and Paper Builder.
- The app is usable on mobile without the desktop sidebar.
- Light and dark themes both look intentional and readable.
- Citations are easier to inspect and understand.
- Provider and ingestion states remain obvious.
- The UI does not claim unsupported platform features such as live collaboration, cloud sync, RBAC, or offline data access.
- Generated app assets are saved in the project and referenced by the frontend.
- Existing frontend tests and build pass, or any failures are documented with cause.
