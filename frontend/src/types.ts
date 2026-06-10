export type DocumentStatus = "queued" | "ingesting" | "ready" | "failed";

export interface StudyDocument {
  id: number;
  filename: string;
  content_type: string;
  status: DocumentStatus;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
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
  embedding_dimensions: number;
}
