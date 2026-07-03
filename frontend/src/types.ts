export type DocumentStatus = "queued" | "ingesting" | "ready" | "failed";
export type IngestionJobStatus = "queued" | "running" | "completed" | "failed";
export type PrintableStatus =
  | "generating"
  | "draft_ready"
  | "exporting"
  | "export_ready"
  | "failed";
export type PrintableJobStatus = "queued" | "running" | "completed" | "failed";

export interface StudyDocument {
  id: number;
  filename: string;
  content_type: string;
  status: DocumentStatus;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngestionJob {
  id: number;
  document_id: number;
  status: IngestionJobStatus;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface Citation {
  document_id: number;
  chunk_id: number;
  chunk_index: number;
  filename: string;
  text: string;
  metadata: Record<string, unknown>;
  score: number;
}

export interface AskResponse {
  session_id: number;
  answer: string;
  citations: Citation[];
  confidence_notes: string[];
}

export interface QaMessage {
  id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  citations: Record<string, unknown>[];
  confidence_notes: string[];
  created_at: string;
}

export interface QaSession {
  id: number;
  title: string;
  selected_document_ids: number[];
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string | null;
}

export interface QaSessionDetail {
  id: number;
  title: string;
  selected_document_ids: number[];
  created_at: string;
  updated_at: string;
  messages: QaMessage[];
}

export interface StudyArtifact {
  id: number;
  document_id: number;
  artifact_type: "summary" | "flashcards";
  title: string;
  content: Record<string, unknown>;
  source_refs: Record<string, unknown>[];
  created_at: string;
  updated_at: string;
}

export interface SettingsRead {
  provider: string;
  base_url: string;
  chat_model: string;
  embedding_model: string;
  api_key_configured: boolean;
  provider_ready: boolean;
  embedding_dimensions: number;
}

export interface PrintableQuestion {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  answer: string;
  marks: number;
  answer_space_lines: number;
  source_refs: Record<string, unknown>[];
}

export interface PrintableSection {
  title: string;
  marks: number;
  questions: PrintableQuestion[];
}

export interface PrintableContent {
  sections: PrintableSection[];
}

export interface PrintableSet {
  id: number;
  document_id: number;
  title: string;
  output_type: string;
  template: string;
  status: PrintableStatus;
  error_message?: string | null;
  config: Record<string, unknown>;
  content: PrintableContent | Record<string, never>;
  source_refs: Record<string, unknown>[];
  created_at: string;
  updated_at: string;
}

export interface PrintableJob {
  id: number;
  printable_set_id: number;
  job_type: "generate_draft" | "export_pdf";
  status: PrintableJobStatus;
  payload: Record<string, unknown>;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface PrintableExport {
  id: number;
  printable_set_id: number;
  export_type: string;
  file_path: string;
  created_at: string;
}

export interface PrintableCreateResponse {
  printable: PrintableSet;
  job: PrintableJob;
}
