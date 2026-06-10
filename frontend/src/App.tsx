import {
  BookOpen,
  FileText,
  HelpCircle,
  Layers,
  Loader2,
  RefreshCcw,
  Settings,
  Sparkles,
  Upload,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import {
  askQuestion,
  createFlashcards,
  createSummary,
  ingestDocument,
  listArtifacts,
  listDocuments,
  readSettings,
  uploadDocument,
} from "./api";
import type { AskResponse, SettingsRead, StudyArtifact, StudyDocument } from "./types";

type Tab = "library" | "ask" | "study" | "settings";

const tabs: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: "library", label: "Library", icon: FileText },
  { id: "ask", label: "Ask", icon: HelpCircle },
  { id: "study", label: "Study Set", icon: Layers },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("library");
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [artifacts, setArtifacts] = useState<StudyArtifact[]>([]);
  const [settings, setSettings] = useState<SettingsRead | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setError(null);
    try {
      const [docs, savedArtifacts, currentSettings] = await Promise.all([
        listDocuments(),
        listArtifacts(),
        readSettings(),
      ]);
      setDocuments(docs);
      setArtifacts(savedArtifacts);
      setSettings(currentSettings);
    } catch (exc) {
      setError((exc as Error).message);
      setDocuments([]);
      setArtifacts([]);
      setSettings(null);
    }
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy("upload");
    setError(null);
    try {
      const result = await uploadDocument(file);
      setDocuments((current) => [result.document, ...current]);
    } catch (exc) {
      setError((exc as Error).message);
    } finally {
      setBusy(null);
      event.target.value = "";
    }
  }

  async function onIngest(documentId: number) {
    setBusy(`ingest-${documentId}`);
    setError(null);
    try {
      const updated = await ingestDocument(documentId);
      setDocuments((current) => current.map((doc) => (doc.id === updated.id ? updated : doc)));
    } catch (exc) {
      setError((exc as Error).message);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onAsk(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy("ask");
    setError(null);
    try {
      setAnswer(await askQuestion(question, selectedIds));
    } catch (exc) {
      setError((exc as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onArtifact(kind: "summary" | "flashcards", documentId: number) {
    setBusy(`${kind}-${documentId}`);
    setError(null);
    try {
      const artifact =
        kind === "summary" ? await createSummary(documentId) : await createFlashcards(documentId);
      setArtifacts((current) => [artifact, ...current]);
      setActiveTab("study");
    } catch (exc) {
      setError((exc as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const readyDocuments = useMemo(
    () => documents.filter((document) => document.status === "ready"),
    [documents],
  );

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <BookOpen size={28} />
          <div>
            <h1>StudyGraph</h1>
            <span>Local study RAG</span>
          </div>
        </div>
        <nav>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Study workspace</p>
            <h2>{tabs.find((tab) => tab.id === activeTab)?.label}</h2>
          </div>
          <button className="iconButton" onClick={() => void refresh()} title="Refresh data">
            <RefreshCcw size={18} />
          </button>
        </header>

        {error ? <div className="alert">{error}</div> : null}

        {activeTab === "library" ? (
          <section className="panel">
            <div className="panelHeader">
              <div>
                <h3>Documents</h3>
                <p>Upload course notes, papers, and study material.</p>
              </div>
              <label className="uploadButton" role="button" tabIndex={0}>
                {busy === "upload" ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
                Upload
                <input
                  aria-label="Upload document"
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown"
                  onChange={(event) => void onUpload(event)}
                />
              </label>
            </div>

            <div className="documentGrid">
              {documents.map((document) => (
                <article key={document.id} className="documentCard">
                  <div className="rowBetween">
                    <FileText size={20} />
                    <span className={`status ${document.status}`}>{document.status}</span>
                  </div>
                  <h4>{document.filename}</h4>
                  <p>{document.content_type}</p>
                  {document.error_message ? <p className="errorText">{document.error_message}</p> : null}
                  <div className="actions">
                    <button
                      onClick={() => void onIngest(document.id)}
                      disabled={busy === `ingest-${document.id}`}
                    >
                      {busy === `ingest-${document.id}` ? "Ingesting" : "Ingest"}
                    </button>
                    <button
                      onClick={() => void onArtifact("summary", document.id)}
                      disabled={document.status !== "ready" || busy === `summary-${document.id}`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => void onArtifact("flashcards", document.id)}
                      disabled={document.status !== "ready" || busy === `flashcards-${document.id}`}
                    >
                      Flashcards
                    </button>
                  </div>
                </article>
              ))}
              {documents.length === 0 ? (
                <div className="emptyState">
                  <Sparkles size={28} />
                  <h3>No documents yet</h3>
                  <p>Upload a PDF, DOCX, TXT, or Markdown file to start building your study graph.</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === "ask" ? (
          <section className="panel askPanel">
            <div className="documentSelector">
              {readyDocuments.map((document) => (
                <label key={document.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(document.id)}
                    onChange={(event) => {
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...current, document.id]
                          : current.filter((id) => id !== document.id),
                      );
                    }}
                  />
                  {document.filename}
                </label>
              ))}
              {readyDocuments.length === 0 ? <p>No ready documents. Ingest a document first.</p> : null}
            </div>

            <form className="askForm" onSubmit={(event) => void onAsk(event)}>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a question about your uploaded material..."
              />
              <button disabled={busy === "ask" || !question.trim()}>
                {busy === "ask" ? "Thinking" : "Ask StudyGraph"}
              </button>
            </form>

            {answer ? (
              <div className="answerBlock">
                <h3>Answer</h3>
                <p>{answer.answer}</p>
                <h4>Citations</h4>
                <div className="citationList">
                  {answer.citations.map((citation) => (
                    <article key={citation.chunk_id} className="citation">
                      <strong>{citation.filename}</strong>
                      <span>Chunk {citation.chunk_index} · score {citation.score.toFixed(2)}</span>
                      <p>{citation.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === "study" ? (
          <section className="panel">
            <div className="panelHeader">
              <div>
                <h3>Saved Study Artifacts</h3>
                <p>Summaries and flashcards generated from your library.</p>
              </div>
            </div>
            <div className="artifactList">
              {artifacts.map((artifact) => (
                <article key={artifact.id} className="artifact">
                  <span className="status ready">{artifact.artifact_type}</span>
                  <h4>{artifact.title}</h4>
                  {artifact.artifact_type === "summary" ? (
                    <p>{String(artifact.content.summary || "")}</p>
                  ) : (
                    <div className="flashcards">
                      {Array.isArray(artifact.content.flashcards)
                        ? artifact.content.flashcards.map((card, index) => (
                            <div key={index} className="flashcard">
                              <strong>{String((card as { front?: string }).front || "")}</strong>
                              <span>{String((card as { back?: string }).back || "")}</span>
                            </div>
                          ))
                        : null}
                    </div>
                  )}
                </article>
              ))}
              {artifacts.length === 0 ? <p>No saved summaries or flashcards yet.</p> : null}
            </div>
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="panel settingsGrid">
            <div>
              <h3>Provider</h3>
              <dl>
                <dt>Provider</dt>
                <dd>{settings?.provider ?? "Unknown"}</dd>
                <dt>Base URL</dt>
                <dd>{settings?.base_url ?? "Unknown"}</dd>
                <dt>Chat model</dt>
                <dd>{settings?.chat_model ?? "Unknown"}</dd>
                <dt>Embedding model</dt>
                <dd>{settings?.embedding_model ?? "Unknown"}</dd>
                <dt>API key</dt>
                <dd>{settings?.api_key_configured ? "Configured" : "Missing"}</dd>
              </dl>
            </div>
            <div className="settingsNote">
              Configure provider credentials through `.env` before starting the API. Secrets are not
              stored in the frontend.
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
