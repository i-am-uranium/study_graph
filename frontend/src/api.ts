import type { AskResponse, SettingsRead, StudyArtifact, StudyDocument } from "./types";

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

export function ingestDocument(documentId: number): Promise<StudyDocument> {
  return request(`/api/documents/${documentId}/ingest`, { method: "POST" });
}

export function askQuestion(question: string, documentIds: number[]): Promise<AskResponse> {
  return request("/api/qa/ask", {
    method: "POST",
    body: JSON.stringify({ question, document_ids: documentIds }),
  });
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
