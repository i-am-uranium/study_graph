# Printable Paper Builder Design

## Goal

Enable a teacher to turn an uploaded book or study document into polished, print-ready school papers. The workflow should support question papers, question papers with answer keys, worksheet packs, and exam variants. The default print style is a formal school exam template.

The product should treat AI output as a draft. The teacher must review and edit the generated paper before exporting a PDF.

## Context

StudyGraph already supports:

- Uploading and ingesting documents into searchable chunks.
- Generating summaries and flashcards from ready documents.
- Asking grounded questions against selected documents.
- Saving generated study artifacts.

The new feature should build on this document ingestion and generation pipeline, but printable papers need their own draft lifecycle, editor, and PDF export. They should not be squeezed into the existing summary/flashcard artifact model.

## User Workflow

1. Open a new Paper Builder or Printables area from the study workspace.
2. Choose a source document.
3. Scope the source as one of:
   - Whole book.
   - Chapter or page range.
   - Teacher-entered topic.
4. Choose output type:
   - Question paper only.
   - Question paper plus answer key.
   - Worksheet pack.
   - Quiz or exam variants.
5. Configure the paper:
   - Class or grade.
   - Subject.
   - Paper title.
   - Time limit.
   - Maximum marks.
   - Difficulty.
   - Question types and counts.
   - Marks per question type.
   - Number of variants, when applicable.
6. Generate an editable draft.
7. Review and edit questions before export:
   - Edit wording.
   - Edit options and answers.
   - Remove questions.
   - Reorder questions.
   - Regenerate one question or one section.
   - Review answer key.
8. Preview the formal exam PDF.
9. Download:
   - Student PDF.
   - Answer key PDF.
   - Bundled PDF, if selected.
   - Variant PDFs, if selected.

## Recommended Approach

Build a wizard plus draft editor plus server-side PDF export.

This is the recommended approach because it matches the teacher workflow: choose the source and paper shape, generate a structured draft, review it, then export for printing. It also keeps the app safer because generated questions can be inspected before students see them.

## Alternatives Considered

### Fast PDF Generator

The app could generate a PDF directly from a few settings. This would be faster to build, but it is not suitable as the primary workflow because the teacher cannot reliably use AI-generated questions without review.

### Full Question Bank System

The app could generate a reusable question bank per book and assemble papers from that bank. This is powerful for repeated use and large exam programs, but it is a larger second phase. The first version should focus on getting one high-quality paper from one source through review and export.

## Backend Design

Add a printable-paper domain separate from study artifacts.

Suggested models:

- `PrintableSet`
  - `id`
  - `document_id`
  - `title`
  - `output_type`
  - `template`
  - `status`
  - `config`
  - `content`
  - `source_refs`
  - `created_at`
  - `updated_at`
- `PrintableExport`
  - `id`
  - `printable_set_id`
  - `export_type`
  - `file_path`
  - `created_at`
- `PrintableJob`
  - `id`
  - `printable_set_id`
  - `job_type`
  - `status`
  - `error_message`
  - `created_at`
  - `started_at`
  - `completed_at`

The `config` JSON should store source scope, grade, subject, difficulty, marks, time limit, question type counts, and variant settings.

The `content` JSON should store editable draft structure:

- Sections.
- Questions.
- Question type.
- Options, where applicable.
- Correct answer or model answer.
- Marks.
- Answer space setting.
- Source references.
- Variant identifier, where applicable.

Suggested endpoints:

- `GET /api/printables`
- `POST /api/printables`
- `GET /api/printables/{id}`
- `PATCH /api/printables/{id}`
- `POST /api/printables/{id}/regenerate`
- `POST /api/printables/{id}/export`
- `GET /api/printables/{id}/exports/{export_id}`
- `GET /api/printables/jobs`

Draft generation should reuse the existing retrieval/generation provider pattern. The generation prompt should request strict JSON with sections, marks, answer keys, and source references.

Long-running draft generation and PDF export should follow the ingestion-job pattern already in the app: create a job, return the job id, and let the frontend poll until the draft or export is ready. This avoids blocking the UI and keeps failure states visible.

## Frontend Design

Add a new Paper Builder experience, likely under Study Set or as a dedicated sidebar entry if it becomes a core workflow.

Wizard steps:

1. Source.
2. Output type.
3. Question mix.
4. Template and school details.
5. Review draft.
6. Preview and export.

The page should poll while printable jobs are queued or running, using the same user experience pattern as document ingestion.

The editor should use structured controls rather than a large raw text area. Each question card should expose:

- Edit.
- Regenerate.
- Remove.
- Move up/down.
- Marks.
- Answer key toggle or answer editor.

The teacher should always see whether the answer key exists and whether source references are available.

## PDF Design

Generate PDFs server-side to keep print output consistent.

Default template: formal school exam.

Requirements:

- A4 page size.
- Black-and-white first version for low ink usage.
- School header.
- Subject, class, chapter/topic, time, maximum marks.
- Name and roll number fields.
- Instructions block.
- Section headings.
- Question numbers.
- Marks aligned to the right.
- Answer lines or answer space for worksheet-style output.
- Page numbers.
- Separate answer key pages or separate answer key PDF.

Use `reportlab` or an equivalent server-side PDF library. Generated PDFs should be visually checked by rendering pages to PNG during development.

## Error Handling

- If generation fails, keep the wizard config so the teacher can retry.
- If PDF export fails, keep the editable draft.
- If a generated draft has invalid JSON, show a retryable generation error rather than storing partial content.
- If source scope returns too little content, ask the teacher to broaden the scope.
- If answer key generation is incomplete, block PDF export until the teacher confirms or fixes it.

## Data Safety and Quality

- Generated papers remain drafts until exported.
- Questions keep source references so the teacher can inspect grounding.
- The app should never silently overwrite an edited draft when regenerating.
- Regeneration should be scoped to a selected question or section unless the teacher explicitly regenerates the whole paper.

## Testing Plan

Backend:

- Create printable draft from document and config.
- Persist editable draft content.
- Update a question and preserve the edit.
- Regenerate one question without replacing the full draft.
- Export student PDF.
- Export answer key PDF.
- Validate variant generation metadata.
- Handle generation and export failures without losing drafts.

Frontend:

- Wizard source selection.
- Fully configurable question type counts.
- Draft editor question edit/remove/reorder actions.
- Answer key review.
- Export buttons and loading/error states.

PDF:

- Render generated PDFs to PNG.
- Verify header, marks, page numbers, section breaks, and answer key pages.
- Check long question wrapping and multi-page output.

## Phasing

### Phase 1

- Paper Builder wizard.
- One source document.
- Whole book, page range, or topic scope.
- Question paper plus optional answer key.
- Fully configurable question type counts.
- Review/edit draft.
- Formal exam PDF export.

### Phase 2

- Worksheet pack answer spaces.
- Exam variants.
- Regenerate individual questions.
- Saved exports.

### Phase 3

- Reusable question bank.
- Template gallery.
- School branding presets.
- Rubrics and grading guidance.
