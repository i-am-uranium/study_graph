# Adapter-First Reference Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance StudyGraph into an adapter-first learning workspace using the Google AI Studio reference flow while preserving all existing API integrations.

**Architecture:** Keep the current React/Vite frontend and FastAPI backend contracts. Add frontend-only shell state for persona, font scale, and high contrast; add a Study Desk command center and preview modules without adding backend dependencies or WebSocket calls.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, existing FastAPI APIs.

---

## Chunk 1: Frontend Adapter-First UX

### File Structure

- Modify `frontend/src/App.tsx`: add persona/accessibility state, rename working navigation, add Study Desk tab, add preview module cards, preserve existing API calls.
- Modify `frontend/src/styles.css`: add studio shell, persona/accessibility controls, high contrast/font scale classes, Study Desk and preview module styles, responsive adjustments.
- Modify `frontend/tests/App.test.tsx`: add behavior tests for adapter-first controls and preview-only modules.

No backend file should be edited in this plan. The WebSocket collaboration capability from the reference app is represented as a preview module only, so backend WebSocket work is out of scope unless implementation accidentally introduces a live WebSocket dependency.

### Task 1: Add Failing Tests For Adapter-First Shell

**Files:**
- Modify: `frontend/tests/App.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that prove:

- The app renders the new "Study Desk" command center and preview modules as planned/preview surfaces.
- Persona controls include Student, Teacher, and Admin.
- High contrast and font size controls change the shell class or state.
- The app still boots using only existing stubbed API routes.

- [ ] **Step 2: Run tests and verify failure**

Run from `frontend/`: `npm test -- tests/App.test.tsx`

Expected: fail because the new Study Desk, controls, and preview modules do not exist yet.

### Task 2: Implement App Shell State And Working Navigation

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add minimal implementation**

Add:

- `Tab = "desk" | "rag" | "study" | "printables" | "settings"`.
- Persona state: `"student" | "teacher" | "admin"`.
- Contrast state and font scale state.
- Working nav labels: Study Desk, RAG Library, Study Artifacts, Paper Builder, Settings.
- Shell class names for theme, high contrast, and font scale.
- Header controls for persona, high contrast, font size, theme, and refresh.

- [ ] **Step 2: Run focused tests**

Run from `frontend/`: `npm test -- tests/App.test.tsx`

Expected: tests progress; remaining failures should point to missing Study Desk or styles.

### Task 3: Add Study Desk And Preview Modules

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add Study Desk view**

Add a dashboard surface that uses existing loaded data:

- Source readiness.
- Next best action.
- Recent QA/artifact/paper signals.
- Quick actions that switch to existing working tabs.

- [ ] **Step 2: Add preview modules**

Add subdued preview cards for:

- Collaboration.
- Assignments.
- Analytics.
- Integrations.
- Offline Sync.

Each card must say Planned, Preview, or Requires API. Do not add WebSocket, analytics, assignment, integration, or sync API calls.

- [ ] **Step 3: Run focused tests**

Run from `frontend/`: `npm test -- tests/App.test.tsx`

Expected: pass.

### Task 4: Style The Adapter-First Experience

**Files:**
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Add CSS for controls and Study Desk**

Add:

- Persona control styling.
- Accessibility control styling.
- High contrast variables.
- Font scale classes.
- Study Desk layout and preview module card styles.
- Mobile-safe wrapping and tap targets.

- [ ] **Step 2: Run frontend build**

Run: `npm run build`

Expected: pass.

### Task 5: Browser Verification

**Files:**
- No planned file edits.

- [ ] **Step 1: Start frontend dev server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite serves the app on an available localhost port.

- [ ] **Step 2: Verify desktop in browser**

Open the app in the in-app browser and verify:

- Study Desk is first screen.
- Existing API-backed flows are still represented.
- Preview modules are clearly not active backend features.
- High contrast, font size, role, theme, and nav controls are visible.

- [ ] **Step 3: Verify mobile in browser**

Use a mobile viewport and verify:

- Navigation remains usable.
- Controls wrap without overlap.
- Cards stack.
- Text remains readable.

### Task 6: Commit Implementation

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/tests/App.test.tsx`
- Add or modify generated app assets only if implementation requires them.

- [ ] **Step 1: Check status**

Run: `git status --short`

Expected: only intended frontend/test files plus the already-known unrelated local files.

- [ ] **Step 2: Stage only intended files**

Run: `git add frontend/src/App.tsx frontend/src/styles.css frontend/tests/App.test.tsx`

- [ ] **Step 3: Commit**

Run: `git commit -m "feat: add adapter-first learning workspace"`

Expected: commit succeeds.
