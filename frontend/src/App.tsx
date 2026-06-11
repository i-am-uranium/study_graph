import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  FileText,
  HelpCircle,
  Layers,
  Loader2,
  Moon,
  Plus,
  RefreshCcw,
  Send,
  Settings,
  Sparkles,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import {
  apiUrl,
  askQuestion,
  createFlashcards,
  createPrintable,
  createSummary,
  exportPrintable,
  getQaSession,
  ingestDocument,
  listArtifacts,
  listDocuments,
  listIngestionJobs,
  listPrintableExports,
  listPrintableJobs,
  listPrintables,
  listQaSessions,
  readSettings,
  updatePrintable,
  uploadDocument,
} from "./api";
import { RichText } from "./RichText";
import type {
  IngestionJob,
  PrintableExport,
  PrintableJob,
  PrintableSection,
  PrintableSet,
  QaMessage,
  QaSession,
  SettingsRead,
  StudyArtifact,
  StudyDocument,
} from "./types";

type Tab = "library" | "ask" | "study" | "printables" | "settings";
type ArtifactKind = "summary" | "flashcards";
type AppTheme = "light" | "dark";
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Record<string, unknown>[];
  confidence_notes: string[];
};

const tabs: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: "library", label: "Library", icon: FileText },
  { id: "ask", label: "Ask", icon: HelpCircle },
  { id: "study", label: "Study Set", icon: Layers },
  { id: "printables", label: "Paper Builder", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: Settings },
];

function artifactKey(documentId: number, kind: ArtifactKind) {
  return `${documentId}:${kind}`;
}

function toChatMessage(message: QaMessage): ChatMessage {
  return {
    id: String(message.id),
    role: message.role,
    content: message.content,
    citations: message.citations,
    confidence_notes: message.confidence_notes,
  };
}

function hasPrintableSections(
  printable: PrintableSet,
): printable is PrintableSet & { content: { sections: PrintableSection[] } } {
  return Array.isArray((printable.content as { sections?: unknown }).sections);
}

function printableJobLabel(job: PrintableJob): string {
  return `Job #${job.id} · ${job.job_type.replace("_", " ")} · ${job.status}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("library");
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [ingestionJobs, setIngestionJobs] = useState<IngestionJob[]>([]);
  const [artifacts, setArtifacts] = useState<StudyArtifact[]>([]);
  const [printables, setPrintables] = useState<PrintableSet[]>([]);
  const [printableJobs, setPrintableJobs] = useState<PrintableJob[]>([]);
  const [printableExports, setPrintableExports] = useState<Record<number, PrintableExport[]>>({});
  const [qaSessions, setQaSessions] = useState<QaSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [readerArtifactId, setReaderArtifactId] = useState<number | null>(null);
  const [appTheme, setAppTheme] = useState<AppTheme>("light");
  const [settings, setSettings] = useState<SettingsRead | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [question, setQuestion] = useState("");
  const [paperDocumentId, setPaperDocumentId] = useState<number | "">("");
  const [paperTitle, setPaperTitle] = useState("New Question Paper");
  const [paperOutputType, setPaperOutputType] = useState("teacher_pack");
  const [paperSourceMode, setPaperSourceMode] = useState("whole_book");
  const [paperTopic, setPaperTopic] = useState("");
  const [paperClassName, setPaperClassName] = useState("Class VI");
  const [paperSubject, setPaperSubject] = useState("Science");
  const [paperDifficulty, setPaperDifficulty] = useState("medium");
  const [mcqCount, setMcqCount] = useState(5);
  const [shortCount, setShortCount] = useState(5);
  const [longCount, setLongCount] = useState(2);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (activeTab !== "ask" || activeSessionId === null) return;
    void loadQaSession(activeSessionId);
  }, [activeTab, activeSessionId]);

  useEffect(() => {
    if (paperDocumentId === "" && documents.some((document) => document.status === "ready")) {
      setPaperDocumentId(documents.find((document) => document.status === "ready")?.id ?? "");
    }
  }, [documents, paperDocumentId]);

  const hasPendingIngestion = useMemo(
    () =>
      documents.some((document) => document.status === "queued" || document.status === "ingesting") ||
      ingestionJobs.some((job) => job.status === "queued" || job.status === "running"),
    [documents, ingestionJobs],
  );
  const hasPendingPrintableWork = useMemo(
    () =>
      printables.some(
        (printable) => printable.status === "generating" || printable.status === "exporting",
      ) || printableJobs.some((job) => job.status === "queued" || job.status === "running"),
    [printables, printableJobs],
  );

  useEffect(() => {
    if (!hasPendingIngestion && !hasPendingPrintableWork) return;
    const pollingInterval = window.setInterval(() => {
      void refresh();
    }, 3000);
    return () => window.clearInterval(pollingInterval);
  }, [hasPendingIngestion, hasPendingPrintableWork]);

  async function refresh() {
    setError(null);
    try {
      const [
        docs,
        jobs,
        savedArtifacts,
        printableSets,
        paperJobs,
        currentSettings,
        savedSessions,
      ] = await Promise.all([
        listDocuments(),
        listIngestionJobs(),
        listArtifacts(),
        listPrintables(),
        listPrintableJobs(),
        readSettings(),
        listQaSessions(),
      ]);
      setDocuments(docs);
      setIngestionJobs(jobs);
      setArtifacts(savedArtifacts);
      setPrintables(printableSets);
      setPrintableJobs(paperJobs);
      if (printableSets.length > 0) {
        const exportEntries = await Promise.all(
          printableSets.map(async (printable) => [
            printable.id,
            await listPrintableExports(printable.id),
          ] as const),
        );
        setPrintableExports(Object.fromEntries(exportEntries));
      } else {
        setPrintableExports({});
      }
      setSettings(currentSettings);
      setQaSessions(savedSessions);
      setActiveSessionId((current) =>
        current && savedSessions.some((session) => session.id === current)
          ? current
          : savedSessions[0]?.id ?? null,
      );
    } catch (exc) {
      setError((exc as Error).message);
      setDocuments([]);
      setIngestionJobs([]);
      setArtifacts([]);
      setPrintables([]);
      setPrintableJobs([]);
      setPrintableExports({});
      setQaSessions([]);
      setActiveSessionId(null);
      setActiveMessages([]);
      setSettings(null);
    }
  }

  async function refreshQaSessions(preferredSessionId?: number) {
    const savedSessions = await listQaSessions();
    setQaSessions(savedSessions);
    setActiveSessionId((current) => {
      const nextSessionId = preferredSessionId ?? current;
      return nextSessionId && savedSessions.some((session) => session.id === nextSessionId)
        ? nextSessionId
        : savedSessions[0]?.id ?? null;
    });
  }

  async function loadQaSession(sessionId: number) {
    setError(null);
    try {
      const session = await getQaSession(sessionId);
      setActiveMessages(session.messages.map(toChatMessage));
      setSelectedIds(session.selected_document_ids);
    } catch (exc) {
      setError((exc as Error).message);
      setActiveMessages([]);
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
    if (!settings?.api_key_configured) {
      setError("Set OPENAI_API_KEY in .env and restart the API and worker before ingestion.");
      return;
    }
    setBusy(`ingest-${documentId}`);
    setError(null);
    try {
      const job = await ingestDocument(documentId);
      setIngestionJobs((current) => [
        job,
        ...current.filter((existingJob) => existingJob.id !== job.id),
      ]);
      setDocuments((current) =>
        current.map((doc) =>
          doc.id === documentId ? { ...doc, status: "queued", error_message: null } : doc,
        ),
      );
    } catch (exc) {
      setError((exc as Error).message);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onAsk(event: FormEvent) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    if (!settings?.api_key_configured) {
      setError("Set OPENAI_API_KEY in .env and restart the API and worker before asking questions.");
      return;
    }
    const sessionId = activeSessionId;
    const userMessage: ChatMessage = {
      id: `pending-user-${Date.now()}`,
      role: "user",
      content: trimmedQuestion,
      citations: [],
      confidence_notes: [],
    };
    setBusy("ask");
    setError(null);
    setQuestion("");
    setActiveMessages((current) => [...current, userMessage]);
    try {
      const response = await askQuestion(trimmedQuestion, selectedIds, sessionId);
      const assistantMessage: ChatMessage = {
        id: `assistant-${response.session_id}-${Date.now()}`,
        role: "assistant",
        content: response.answer,
        citations: response.citations.map((citation) => ({ ...citation })),
        confidence_notes: response.confidence_notes,
      };
      setActiveMessages((current) => [...current, assistantMessage]);
      await refreshQaSessions(response.session_id);
    } catch (exc) {
      setError((exc as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function onNewChat() {
    setActiveSessionId(null);
    setActiveMessages([]);
    setQuestion("");
  }

  function toggleAppTheme() {
    setAppTheme((current) => (current === "light" ? "dark" : "light"));
  }

  async function onArtifact(kind: ArtifactKind, documentId: number) {
    const existingArtifact = artifactByDocumentAndType.get(artifactKey(documentId, kind));
    if (existingArtifact) {
      setActiveTab("study");
      return;
    }

    if (!settings?.api_key_configured) {
      setError(
        "Set OPENAI_API_KEY in .env and restart the API and worker before generating study artifacts.",
      );
      return;
    }
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

  async function onCreatePrintable(event: FormEvent) {
    event.preventDefault();
    if (!settings?.api_key_configured) {
      setError("Set OPENAI_API_KEY in .env and restart the API and worker before generating papers.");
      return;
    }
    if (paperDocumentId === "") {
      setError("Choose a ready source document before generating a paper.");
      return;
    }
    setBusy("paper-generate");
    setError(null);
    try {
      const sourceScope =
        paperSourceMode === "topic"
          ? { mode: "topic", topic: paperTopic }
          : { mode: paperSourceMode };
      const response = await createPrintable({
        document_id: Number(paperDocumentId),
        title: paperTitle,
        output_type: paperOutputType,
        template: "formal_exam",
        config: {
          source_scope: sourceScope,
          class_name: paperClassName,
          subject: paperSubject,
          difficulty: paperDifficulty,
          question_counts: {
            multiple_choice: mcqCount,
            short_answer: shortCount,
            long_answer: longCount,
          },
        },
      });
      setPrintables((current) => [
        response.printable,
        ...current.filter((printable) => printable.id !== response.printable.id),
      ]);
      setPrintableJobs((current) => [
        response.job,
        ...current.filter((job) => job.id !== response.job.id),
      ]);
    } catch (exc) {
      setError((exc as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onSavePrintable(printable: PrintableSet) {
    setBusy(`paper-save-${printable.id}`);
    setError(null);
    try {
      const updated = await updatePrintable(printable.id, { content: printable.content });
      setPrintables((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (exc) {
      setError((exc as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onExportPrintable(printableId: number) {
    setBusy(`paper-export-${printableId}`);
    setError(null);
    try {
      const job = await exportPrintable(printableId, "teacher_pack");
      setPrintableJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      setPrintables((current) =>
        current.map((printable) =>
          printable.id === printableId ? { ...printable, status: "exporting" } : printable,
        ),
      );
    } catch (exc) {
      setError((exc as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function updatePrintableQuestion(
    printableId: number,
    sectionIndex: number,
    questionIndex: number,
    field: "prompt" | "answer",
    value: string,
  ) {
    setPrintables((current) =>
      current.map((printable) => {
        if (printable.id !== printableId || !hasPrintableSections(printable)) return printable;
        const sections = printable.content.sections.map((section, currentSectionIndex) => {
          if (currentSectionIndex !== sectionIndex) return section;
          return {
            ...section,
            questions: section.questions.map((question, currentQuestionIndex) =>
              currentQuestionIndex === questionIndex ? { ...question, [field]: value } : question,
            ),
          };
        });
        return { ...printable, content: { sections } };
      }),
    );
  }

  const readyDocuments = useMemo(
    () => documents.filter((document) => document.status === "ready"),
    [documents],
  );
  const artifactByDocumentAndType = useMemo(() => {
    const lookup = new Map<string, StudyArtifact>();
    for (const artifact of artifacts) {
      const key = artifactKey(artifact.document_id, artifact.artifact_type);
      if (!lookup.has(key)) {
        lookup.set(key, artifact);
      }
    }
    return lookup;
  }, [artifacts]);
  const latestJobByDocumentId = useMemo(() => {
    const lookup = new Map<number, IngestionJob>();
    for (const job of ingestionJobs) {
      const current = lookup.get(job.document_id);
      if (!current || new Date(job.created_at).getTime() > new Date(current.created_at).getTime()) {
        lookup.set(job.document_id, job);
      }
    }
    return lookup;
  }, [ingestionJobs]);
  const latestPrintableJobBySetId = useMemo(() => {
    const lookup = new Map<number, PrintableJob>();
    for (const job of printableJobs) {
      const current = lookup.get(job.printable_set_id);
      if (!current || new Date(job.created_at).getTime() > new Date(current.created_at).getTime()) {
        lookup.set(job.printable_set_id, job);
      }
    }
    return lookup;
  }, [printableJobs]);
  const readerArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === readerArtifactId) ?? null,
    [artifacts, readerArtifactId],
  );
  const providerReady = settings?.api_key_configured === true;
  const providerMissing = settings !== null && !providerReady;
  const providerSetupMessage = "Set OPENAI_API_KEY in .env and restart the API and worker.";

  const themeToggleLabel = appTheme === "light" ? "Dark mode" : "Light mode";

  return (
    <div className={`appShell theme-${appTheme}`}>
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
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== "study") {
                    setReaderArtifactId(null);
                  }
                }}
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
          <div className="topbarActions">
            <button
              className="iconButton"
              onClick={toggleAppTheme}
              aria-label={themeToggleLabel}
              title={themeToggleLabel}
            >
              {appTheme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className="iconButton"
              onClick={() => void refresh()}
              aria-label="Refresh data"
              title="Refresh data"
            >
              <RefreshCcw size={18} />
            </button>
          </div>
        </header>

        {error ? <div className="alert">{error}</div> : null}

        {providerMissing ? (
          <div className="setupWarning">
            <AlertTriangle size={18} />
            <div>
              <strong>Provider key missing</strong>
              <span>{providerSetupMessage}</span>
            </div>
          </div>
        ) : null}

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
              {documents.map((document) => {
                const isIngested = document.status === "ready";
                const latestJob = latestJobByDocumentId.get(document.id);
                const isIngesting =
                  latestJob?.status === "running" || document.status === "ingesting";
                const isQueued = latestJob
                  ? latestJob.status === "queued"
                  : document.status === "queued";
                const hasActiveJob = isQueued || isIngesting;
                const summaryArtifact = artifactByDocumentAndType.get(
                  artifactKey(document.id, "summary"),
                );
                const flashcardsArtifact = artifactByDocumentAndType.get(
                  artifactKey(document.id, "flashcards"),
                );
                const canCreateArtifact = providerReady && isIngested;

                return (
                  <article key={document.id} className="documentCard">
                    <div className="rowBetween">
                      <FileText size={20} />
                      <span className={`status ${document.status}`}>{document.status}</span>
                    </div>
                    <h4>{document.filename}</h4>
                    <p>{document.content_type}</p>
                    {latestJob ? (
                      <p className="jobMeta">
                        Job #{latestJob.id} · {latestJob.status}
                      </p>
                    ) : null}
                    {document.error_message ? <p className="errorText">{document.error_message}</p> : null}
                    <div className="actions">
                      <button
                        onClick={() => void onIngest(document.id)}
                        disabled={
                          !providerReady ||
                          isIngested ||
                          hasActiveJob ||
                          busy === `ingest-${document.id}`
                        }
                        title={
                          isIngested
                            ? "Document already ingested"
                            : hasActiveJob
                              ? "Ingestion job already queued"
                            : !providerReady
                              ? providerSetupMessage
                              : "Ingest document"
                        }
                      >
                        {busy === `ingest-${document.id}`
                          ? "Queueing"
                          : isQueued
                            ? "Queued"
                            : isIngesting
                              ? "Running"
                              : "Ingest"}
                      </button>
                      <button
                        onClick={() => void onArtifact("summary", document.id)}
                        disabled={
                          !summaryArtifact &&
                          (!canCreateArtifact || busy === `summary-${document.id}`)
                        }
                        title={
                          summaryArtifact
                            ? "Open summary in Study Set"
                            : !providerReady
                              ? providerSetupMessage
                              : "Generate summary"
                        }
                      >
                        Summary
                      </button>
                      <button
                        onClick={() => void onArtifact("flashcards", document.id)}
                        disabled={
                          !flashcardsArtifact &&
                          (!canCreateArtifact || busy === `flashcards-${document.id}`)
                        }
                        title={
                          flashcardsArtifact
                            ? "Open flashcards in Study Set"
                            : !providerReady
                              ? providerSetupMessage
                              : "Generate flashcards"
                        }
                      >
                        Flashcards
                      </button>
                    </div>
                  </article>
                );
              })}
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
            <aside className="conversationList" aria-label="Saved conversations">
              <div className="conversationListHeader">
                <h3>Conversations</h3>
                <button onClick={onNewChat} title="Start a new chat">
                  <Plus size={16} />
                  New
                </button>
              </div>
              <div className="conversationItems">
                {qaSessions.map((session) => (
                  <button
                    key={session.id}
                    className={activeSessionId === session.id ? "active" : ""}
                    onClick={() => setActiveSessionId(session.id)}
                  >
                    <strong>{session.title}</strong>
                    <span>{session.message_count} messages</span>
                    {session.last_message ? <p>{session.last_message}</p> : null}
                  </button>
                ))}
                {qaSessions.length === 0 ? <p>No conversations yet.</p> : null}
              </div>
            </aside>

            <div className="conversationWorkspace">
              <div className="conversationHeader">
                <div>
                  <h3>{activeSessionId ? "Saved conversation" : "New conversation"}</h3>
                  <p>Ask follow-ups and keep the full study trail in one place.</p>
                </div>
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
                  {readyDocuments.length === 0 ? (
                    <p>No ready documents. Ingest a document first.</p>
                  ) : null}
                </div>
              </div>

              <div className="messageTimeline" aria-label="Conversation history">
                {activeMessages.map((message) => (
                  <article key={message.id} className={`chatMessage ${message.role}`}>
                    <span className="messageRole">
                      {message.role === "user" ? "You" : "StudyGraph"}
                    </span>
                    {message.role === "assistant" ? (
                      <RichText content={message.content} />
                    ) : (
                      <p>{message.content}</p>
                    )}
                    {message.citations.length > 0 ? (
                      <div className="citationList compact">
                        {message.citations.map((citation, index) => (
                          <article key={index} className="citation">
                            <strong>{String(citation.filename || "Source")}</strong>
                            <span>
                              Chunk {String(citation.chunk_index ?? "?")}
                              {typeof citation.score === "number"
                                ? ` · score ${citation.score.toFixed(2)}`
                                : ""}
                            </span>
                            {citation.text ? <p>{String(citation.text)}</p> : null}
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
                {busy === "ask" ? (
                  <article className="chatMessage assistant">
                    <span className="messageRole">StudyGraph</span>
                    <p>Thinking...</p>
                  </article>
                ) : null}
                {activeMessages.length === 0 && busy !== "ask" ? (
                  <div className="conversationEmpty">
                    <HelpCircle size={28} />
                    <h3>Start with a question</h3>
                    <p>Previous conversations will appear here when you return to Ask.</p>
                  </div>
                ) : null}
              </div>

              <form className="askForm chatComposer" onSubmit={(event) => void onAsk(event)}>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a follow-up about your study material..."
                />
                <button
                  disabled={!providerReady || busy === "ask" || !question.trim()}
                  title={!providerReady ? providerSetupMessage : "Send question"}
                >
                  {busy === "ask" ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                  Send
                </button>
              </form>
            </div>
          </section>
        ) : null}

        {activeTab === "study" ? (
          readerArtifact ? (
            <section className={`readerMode ${appTheme}`} aria-label="Reader mode">
              <div className="readerTopbar">
                <button
                  className="readerButton"
                  onClick={() => setReaderArtifactId(null)}
                  aria-label="Close reader"
                  title="Close reader"
                >
                  <X size={18} />
                  Close
                </button>
                <button
                  className="readerButton"
                  onClick={toggleAppTheme}
                  aria-label={themeToggleLabel}
                  title={themeToggleLabel}
                >
                  {appTheme === "light" ? <Moon size={18} /> : <Sun size={18} />}
                  {appTheme === "light" ? "Dark" : "Light"}
                </button>
              </div>

              <article className="readerArticle">
                <div className="readerMeta">
                  <span>{readerArtifact.artifact_type}</span>
                  <span>{new Date(readerArtifact.updated_at).toLocaleDateString()}</span>
                </div>
                <h3>{readerArtifact.title}</h3>
                {readerArtifact.artifact_type === "summary" ? (
                  <p className="readerBody">{String(readerArtifact.content.summary || "")}</p>
                ) : (
                  <div className="readerFlashcards">
                    {Array.isArray(readerArtifact.content.flashcards)
                      ? readerArtifact.content.flashcards.map((card, index) => (
                          <div key={index} className="readerFlashcard">
                            <span>Card {index + 1}</span>
                            <strong>{String((card as { front?: string }).front || "")}</strong>
                            <p>{String((card as { back?: string }).back || "")}</p>
                          </div>
                        ))
                      : null}
                  </div>
                )}
              </article>
            </section>
          ) : (
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
                    <div className="artifactHeader">
                      <span className="status ready">{artifact.artifact_type}</span>
                      <button
                        className="readerOpenButton"
                        onClick={() => setReaderArtifactId(artifact.id)}
                        aria-label={`Open reader for ${artifact.title}`}
                        title={`Open reader for ${artifact.title}`}
                      >
                        <BookOpen size={16} />
                        Reader
                      </button>
                    </div>
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
          )
        ) : null}

        {activeTab === "printables" ? (
          <section className="panel paperBuilder">
            <div className="panelHeader">
              <div>
                <h3>Paper Builder</h3>
                <p>Create teacher-reviewed formal exam PDFs from ready documents.</p>
              </div>
            </div>

            <form className="paperWizard" onSubmit={(event) => void onCreatePrintable(event)}>
              <label>
                Source document
                <select
                  value={paperDocumentId}
                  onChange={(event) =>
                    setPaperDocumentId(event.target.value ? Number(event.target.value) : "")
                  }
                >
                  <option value="">Choose a ready document</option>
                  {readyDocuments.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.filename}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Paper title
                <input
                  aria-label="Paper title"
                  value={paperTitle}
                  onChange={(event) => setPaperTitle(event.target.value)}
                />
              </label>
              <label>
                Output type
                <select
                  value={paperOutputType}
                  onChange={(event) => setPaperOutputType(event.target.value)}
                >
                  <option value="question_paper">Question paper only</option>
                  <option value="teacher_pack">Question paper + answer key</option>
                  <option value="worksheet_pack">Worksheet pack</option>
                  <option value="exam_variants">Quiz/exam variants</option>
                </select>
              </label>
              <label>
                Source scope
                <select
                  value={paperSourceMode}
                  onChange={(event) => setPaperSourceMode(event.target.value)}
                >
                  <option value="whole_book">Whole book</option>
                  <option value="chapter_or_pages">Chapter or page range</option>
                  <option value="topic">Topic</option>
                </select>
              </label>
              <label>
                Topic or range
                <input
                  value={paperTopic}
                  onChange={(event) => setPaperTopic(event.target.value)}
                  placeholder="Optional topic, chapter, or page range"
                />
              </label>
              <label>
                Class
                <input
                  value={paperClassName}
                  onChange={(event) => setPaperClassName(event.target.value)}
                />
              </label>
              <label>
                Subject
                <input
                  value={paperSubject}
                  onChange={(event) => setPaperSubject(event.target.value)}
                />
              </label>
              <label>
                Difficulty
                <select
                  value={paperDifficulty}
                  onChange={(event) => setPaperDifficulty(event.target.value)}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label>
                MCQ count
                <input
                  type="number"
                  min="0"
                  value={mcqCount}
                  onChange={(event) => setMcqCount(Number(event.target.value))}
                />
              </label>
              <label>
                Short answers
                <input
                  type="number"
                  min="0"
                  value={shortCount}
                  onChange={(event) => setShortCount(Number(event.target.value))}
                />
              </label>
              <label>
                Long answers
                <input
                  type="number"
                  min="0"
                  value={longCount}
                  onChange={(event) => setLongCount(Number(event.target.value))}
                />
              </label>
              <button
                disabled={!providerReady || busy === "paper-generate" || readyDocuments.length === 0}
                title={!providerReady ? providerSetupMessage : "Generate editable paper draft"}
              >
                {busy === "paper-generate" ? <Loader2 className="spin" size={16} /> : null}
                Generate Draft
              </button>
            </form>

            <div className="printableList">
              {printables.map((printable) => {
                const latestJob = latestPrintableJobBySetId.get(printable.id);
                const exportsForPrintable = printableExports[printable.id] ?? [];
                const isExporting =
                  printable.status === "exporting" ||
                  latestJob?.status === "queued" ||
                  latestJob?.status === "running";
                return (
                  <article key={printable.id} className="printableDraft">
                    <div className="printableHeader">
                      <div>
                        <span className={`status ${printable.status}`}>{printable.status}</span>
                        <h4>{printable.title}</h4>
                        <p>
                          {printable.output_type.replace(/_/g, " ")} · {printable.template}
                        </p>
                        {latestJob ? <p className="jobMeta">{printableJobLabel(latestJob)}</p> : null}
                      </div>
                      <div className="actions">
                        <button
                          onClick={() => void onSavePrintable(printable)}
                          disabled={!hasPrintableSections(printable) || busy === `paper-save-${printable.id}`}
                        >
                          Save Draft Edits
                        </button>
                        <button
                          onClick={() => void onExportPrintable(printable.id)}
                          disabled={
                            !hasPrintableSections(printable) ||
                            isExporting ||
                            busy === `paper-export-${printable.id}`
                          }
                        >
                          Export Teacher Pack
                        </button>
                      </div>
                    </div>

                    {printable.error_message ? (
                      <p className="errorText">{printable.error_message}</p>
                    ) : null}

                    {hasPrintableSections(printable) ? (
                      <div className="draftEditor">
                        {printable.content.sections.map((section, sectionIndex) => (
                          <section key={`${printable.id}-${sectionIndex}`} className="draftSection">
                            <div className="rowBetween">
                              <h5>{section.title}</h5>
                              <span>{section.marks} marks</span>
                            </div>
                            {section.questions.map((question, questionIndex) => (
                              <article key={question.id} className="questionEditor">
                                <label>
                                  Question
                                  <textarea
                                    value={question.prompt}
                                    onChange={(event) =>
                                      updatePrintableQuestion(
                                        printable.id,
                                        sectionIndex,
                                        questionIndex,
                                        "prompt",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                                <label>
                                  Answer key
                                  <textarea
                                    value={question.answer}
                                    onChange={(event) =>
                                      updatePrintableQuestion(
                                        printable.id,
                                        sectionIndex,
                                        questionIndex,
                                        "answer",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                                <span className="questionMeta">
                                  {question.type.replace(/_/g, " ")} · {question.marks} marks
                                </span>
                              </article>
                            ))}
                          </section>
                        ))}
                      </div>
                    ) : (
                      <div className="emptyState compact">
                        <Loader2 className={isExporting ? "spin" : ""} size={24} />
                        <h3>Draft pending</h3>
                        <p>The worker will generate the editable paper and this screen will refresh.</p>
                      </div>
                    )}

                    {exportsForPrintable.length > 0 ? (
                      <div className="exportLinks">
                        {exportsForPrintable.map((paperExport) => (
                          <a
                            key={paperExport.id}
                            href={apiUrl(
                              `/api/printables/${printable.id}/exports/${paperExport.id}`,
                            )}
                          >
                            Download {paperExport.export_type.replace(/_/g, " ")} PDF
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {printables.length === 0 ? (
                <div className="emptyState compact">
                  <ClipboardList size={28} />
                  <h3>No papers yet</h3>
                  <p>Choose a ready source document and generate an editable draft.</p>
                </div>
              ) : null}
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
                <dd className={settings?.api_key_configured ? "configured" : "missing"}>
                  {settings?.api_key_configured ? "Configured" : "Missing"}
                </dd>
              </dl>
            </div>
            <div className="settingsNote">
              Configure provider credentials through `.env` before starting the API and worker.
              Secrets are not stored in the frontend.
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
