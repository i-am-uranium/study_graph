import type {
  AskResponse,
  IngestionJob,
  PrintableCreateResponse,
  PrintableExport,
  PrintableJob,
  PrintableSet,
  QaSession,
  QaSessionDetail,
  SettingsRead,
  StudyArtifact,
  StudyDocument,
} from "./types";

type FetchLike = typeof fetch;

const DEFAULT_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:8000" : "");

export function apiUrl(path: string, baseUrl = DEFAULT_BASE_URL): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  if (!cleanBase) {
    return path;
  }
  if (cleanBase.endsWith("/api") && path.startsWith("/api/")) {
    return `${cleanBase}${path.slice(4)}`;
  }
  return `${cleanBase}${path}`;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  fetcher: FetchLike = fetch,
): Promise<T> {
  const response = await fetcher(apiUrl(path), {
    headers:
      options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed with ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function listDocuments(fetcher?: FetchLike): Promise<StudyDocument[]> {
  return request<StudyDocument[]>("/api/documents", {}, fetcher);
}

export function uploadDocument(file: File): Promise<{ document: StudyDocument }> {
  const formData = new FormData();
  formData.append("file", file);
  return request("/api/documents", { method: "POST", body: formData });
}

export function ingestDocument(documentId: number): Promise<IngestionJob> {
  return request(`/api/documents/${documentId}/ingest`, { method: "POST" });
}

export function deleteDocument(documentId: number): Promise<void> {
  return request(`/api/documents/${documentId}`, { method: "DELETE" });
}

export function listIngestionJobs(fetcher?: FetchLike): Promise<IngestionJob[]> {
  return request<IngestionJob[]>("/api/documents/ingestion-jobs", {}, fetcher);
}

export function askQuestion(
  question: string,
  documentIds: number[],
  sessionId?: number | null,
): Promise<AskResponse> {
  return request("/api/qa/ask", {
    method: "POST",
    body: JSON.stringify({ question, document_ids: documentIds, session_id: sessionId ?? null }),
  });
}

export function listQaSessions(): Promise<QaSession[]> {
  return request("/api/qa/sessions");
}

export function getQaSession(sessionId: number): Promise<QaSessionDetail> {
  return request(`/api/qa/sessions/${sessionId}`);
}

export function deleteQaSession(sessionId: number): Promise<void> {
  return request(`/api/qa/sessions/${sessionId}`, { method: "DELETE" });
}

export function createSummary(documentId: number): Promise<StudyArtifact> {
  return request("/api/study/summaries", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId }),
  });
}

export function createFlashcards(documentId: number, count = 8): Promise<StudyArtifact> {
  return request("/api/study/flashcards", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId, count }),
  });
}

export function listArtifacts(): Promise<StudyArtifact[]> {
  return request("/api/study/artifacts");
}

export function readSettings(): Promise<SettingsRead> {
  return request("/api/settings");
}

export function listPrintables(fetcher?: FetchLike): Promise<PrintableSet[]> {
  return request<PrintableSet[]>("/api/printables", {}, fetcher);
}

export function listPrintableJobs(fetcher?: FetchLike): Promise<PrintableJob[]> {
  return request<PrintableJob[]>("/api/printables/jobs", {}, fetcher);
}

export function createPrintable(payload: {
  document_id: number;
  title: string;
  output_type: string;
  template: string;
  config: Record<string, unknown>;
}): Promise<PrintableCreateResponse> {
  return request("/api/printables", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePrintable(
  printableId: number,
  payload: Record<string, unknown>,
): Promise<PrintableSet> {
  return request(`/api/printables/${printableId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function exportPrintable(printableId: number, exportType = "teacher_pack"): Promise<PrintableJob> {
  return request(`/api/printables/${printableId}/export`, {
    method: "POST",
    body: JSON.stringify({ export_type: exportType }),
  });
}

export function listPrintableExports(
  printableId: number,
  fetcher?: FetchLike,
): Promise<PrintableExport[]> {
  return request<PrintableExport[]>(`/api/printables/${printableId}/exports`, {}, fetcher);
}
