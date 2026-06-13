# Learning Workspace UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Learning Workspace UI/UX redesign for the existing StudyGraph frontend.

**Architecture:** Keep the current Vite/React single-app architecture and existing backend API contracts. Improve `App.tsx` with focused derived state and markup changes, rebuild `styles.css` around theme tokens and responsive layout, and add local app assets under `frontend/public/`.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, lucide-react, CSS.

---

## Chunk 1: Tests And Workspace Signals

### Task 1: Add behavior tests for the redesigned shell

**Files:**
- Modify: `frontend/tests/App.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write failing tests**

Add tests that prove the UI exposes the new Learning Workspace signals:

```ts
it("shows the learning workspace source status from existing data", async () => {
  stubApi(true, {
    documents: [
      {
        id: 1,
        filename: "physics.pdf",
        content_type: "application/pdf",
        status: "ready",
        error_message: null,
        created_at: "2026-06-13T00:00:00Z",
        updated_at: "2026-06-13T00:00:00Z",
      },
      {
        id: 2,
        filename: "chemistry.pdf",
        content_type: "application/pdf",
        status: "queued",
        error_message: null,
        created_at: "2026-06-13T00:00:00Z",
        updated_at: "2026-06-13T00:00:00Z",
      },
    ],
    artifacts: [{ id: 10, document_id: 1, artifact_type: "summary", title: "Physics Summary", content: { summary: "Motion notes" }, source_refs: [], created_at: "2026-06-13T00:00:00Z", updated_at: "2026-06-13T00:00:00Z" }],
  });
  render(<App />);

  expect(await screen.findByText("Learning Workspace")).toBeInTheDocument();
  expect(screen.getByText("Source Map")).toBeInTheDocument();
  expect(screen.getByText("1 ready")).toBeInTheDocument();
  expect(screen.getByText("1 pending")).toBeInTheDocument();
  expect(screen.getByText("1 artifact")).toBeInTheDocument();
});
```

Add a second test that verifies answer citations appear under the `Citation Lens` heading after asking a question.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- App.test.tsx`

Expected: FAIL because `Learning Workspace`, `Source Map`, and `Citation Lens` are not implemented.

- [ ] **Step 3: Implement source status and Citation Lens markup**

Use existing state in `App.tsx` to derive counts and render:

- Workspace shell title `Learning Workspace`.
- Source Map/context panel.
- Citation Lens label above evidence cards.
- Theme-aware class names only; styling comes in later tasks.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- App.test.tsx`

Expected: PASS.

## Chunk 2: Responsive Shell And Visual System

### Task 2: Implement Clean Study OS theme tokens and responsive shell

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Create/modify: `frontend/public/favicon.svg`
- Create: `frontend/public/studygraph-mark.svg`
- Create: `frontend/public/app-manifest.svg`

- [ ] **Step 1: Add app assets**

Create SVG assets locally:

- `studygraph-mark.svg`: layered book/source-map mark.
- `favicon.svg`: compact version of the mark.
- `app-manifest.svg`: square app icon preview.

- [ ] **Step 2: Update shell markup**

In `App.tsx`:

- Use asset mark in the brand.
- Add workspace summary cards.
- Keep provider warning visible.
- Add desktop context panel and mobile-friendly structure.
- Keep existing tab behavior and data flow.

- [ ] **Step 3: Rebuild CSS tokens and responsive rules**

In `styles.css`:

- Define light and dark CSS custom properties.
- Style nav rail/sidebar, workspace, source map, status metrics, cards, forms, and reader mode.
- Add mobile bottom navigation at small widths.
- Ensure primary controls are at least 44px where practical.
- Add focus-visible styling and reduced-motion support.

- [ ] **Step 4: Run focused tests**

Run: `cd frontend && npm test -- App.test.tsx`

Expected: PASS.

## Chunk 3: Polish Core Pages

### Task 3: Improve Library, Ask, Study Set, Paper Builder, and Settings surfaces

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Library polish**

Improve document cards, empty state, status chips, and actions without changing upload/ingestion behavior.

- [ ] **Step 2: Ask polish**

Make conversation layout responsive, keep composer sticky within the panel, and show citations as inspectable evidence.

- [ ] **Step 3: Study Set polish**

Improve artifact cards and reader mode theme parity.

- [ ] **Step 4: Paper Builder polish**

Group form controls and stack question editors on mobile.

- [ ] **Step 5: Settings polish**

Make provider configuration readable and consistent with the new shell.

- [ ] **Step 6: Run focused tests**

Run: `cd frontend && npm test -- App.test.tsx`

Expected: PASS.

## Chunk 4: Verification And Finish

### Task 4: Automated and browser verification

**Files:**
- Verify: `frontend/src/App.tsx`
- Verify: `frontend/src/styles.css`
- Verify: `frontend/public/*`

- [ ] **Step 1: Run full frontend tests**

Run: `cd frontend && npm test`

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`

Expected: PASS.

- [ ] **Step 3: Start dev server**

Run: `cd frontend && npm run dev -- --host 127.0.0.1`

Expected: Vite serves the app locally.

- [ ] **Step 4: Browser verify**

Use browser automation to inspect:

- Desktop light theme.
- Desktop dark theme.
- Mobile light theme around 390px.
- Mobile dark theme around 390px.

Check no blank screen, no horizontal overflow, no obvious overlap, nav is usable, assets render, and citations/source status surfaces appear.

- [ ] **Step 5: Commit implementation**

Stage only files changed for this UI work. Do not stage unrelated backend or `.gitignore` edits.

Commit message: `feat: redesign learning workspace ui`
