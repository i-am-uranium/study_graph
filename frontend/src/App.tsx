import {
  Accessibility,
  ArrowRight,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileStack,
  FileText,
  HelpCircle,
  Layers,
  Loader2,
  Moon,
  Network,
  Plus,
  RefreshCcw,
  Send,
  Settings,
  Sparkles,
  Sun,
  Type,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

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
import SourceConstellation from "./SourceConstellation";
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

type Tab = "rag" | "study" | "printables" | "settings";
type ArtifactKind = "summary" | "flashcards";
type AppTheme = "light" | "dark";
type UserPersona = "student" | "teacher" | "admin";
type TextScale = "standard" | "comfortable" | "large";
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Record<string, unknown>[];
  confidence_notes: string[];
};

const APPEARANCE_STORAGE_KEY = "studygraph.appearance";

type AppearanceSettings = {
  appTheme: AppTheme;
  highContrast: boolean;
  textScale: TextScale;
};

const tabs: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: "rag", label: "Workspace", icon: HelpCircle },
  { id: "study", label: "Study Sets", icon: Layers },
  { id: "printables", label: "Papers", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: Settings },
];

const personas: Array<{ id: UserPersona; label: string }> = [
  { id: "student", label: "Student" },
  { id: "teacher", label: "Teacher" },
  { id: "admin", label: "Admin" },
];

type StudyMode = {
  id: string;
  title: string;
  detail: string;
  prompt?: string;
  artifactKind?: ArtifactKind;
  icon: typeof FileText;
};

type WorkspaceMission =
  | {
      action: "upload";
      actionLabel: string;
      detail: string;
      meta: string;
      stage: string;
      title: string;
      tone: "start" | "prepare" | "work" | "review";
    }
  | {
      action: "prepare";
      actionLabel: string;
      detail: string;
      disabled: boolean;
      documentId: number;
      meta: string;
      stage: string;
      title: string;
      tone: "start" | "prepare" | "work" | "review";
    }
  | {
      action: "prompt";
      actionLabel: string;
      detail: string;
      meta: string;
      prompt: string;
      stage: string;
      title: string;
      tone: "start" | "prepare" | "work" | "review";
    }
  | {
      action: "artifact";
      actionLabel: string;
      artifactKind: ArtifactKind;
      detail: string;
      disabled: boolean;
      documentId: number;
      meta: string;
      stage: string;
      title: string;
      tone: "start" | "prepare" | "work" | "review";
    }
  | {
      action: "openArtifact";
      actionLabel: string;
      artifactId: number;
      detail: string;
      meta: string;
      stage: string;
      title: string;
      tone: "start" | "prepare" | "work" | "review";
    };

const personaStudyModes: Record<UserPersona, StudyMode[]> = {
  student: [
    {
      id: "student-explain",
      title: "Explain",
      detail: "Plain-language walkthrough",
      prompt: "Explain the main ideas in simple language.",
      icon: BookOpen,
    },
    {
      id: "student-practice",
      title: "Practice",
      detail: "Active recall questions",
      prompt: "Quiz me on the most important points.",
      icon: HelpCircle,
    },
    {
      id: "student-plan",
      title: "Plan",
      detail: "10-minute revision path",
      prompt: "Make a 10-minute revision plan.",
      icon: Clock3,
    },
    {
      id: "student-flashcards",
      title: "Flashcards",
      detail: "Create a review deck",
      artifactKind: "flashcards",
      icon: Layers,
    },
  ],
  teacher: [
    {
      id: "teacher-brief",
      title: "Lesson brief",
      detail: "Objectives and key points",
      artifactKind: "summary",
      icon: ClipboardList,
    },
    {
      id: "teacher-check",
      title: "Check understanding",
      detail: "Questions with answers",
      prompt: "Create five checks for understanding with answer guidance.",
      icon: CheckCircle2,
    },
    {
      id: "teacher-exit",
      title: "Exit ticket",
      detail: "Quick end-of-class prompt",
      prompt: "Create a short exit ticket for this material.",
      icon: FileText,
    },
    {
      id: "teacher-cards",
      title: "Review deck",
      detail: "Flashcards for practice",
      artifactKind: "flashcards",
      icon: Layers,
    },
  ],
  admin: [
    {
      id: "admin-pulse",
      title: "Class pulse",
      detail: "What needs attention",
      prompt: "Summarize likely progress signals and support needs from this learning material.",
      icon: FileStack,
    },
    {
      id: "admin-gaps",
      title: "Gap scan",
      detail: "Find weak spots",
      prompt: "Identify prerequisite gaps and misconceptions learners may have with this material.",
      icon: Network,
    },
    {
      id: "admin-plan",
      title: "Support plan",
      detail: "Next steps for groups",
      prompt: "Create a simple support plan for students who are ahead, on track, or stuck.",
      icon: ClipboardList,
    },
    {
      id: "admin-summary",
      title: "Briefing",
      detail: "Shareable overview",
      artifactKind: "summary",
      icon: BookOpen,
    },
  ],
};

const SAMPLE_DOCUMENT_ID = -1001;
const SAMPLE_NOW = "2026-06-14T00:00:00Z";
const sampleDocument: StudyDocument = {
  id: SAMPLE_DOCUMENT_ID,
  filename: "Sample lesson - Photosynthesis.md",
  content_type: "text/markdown",
  status: "ready",
  error_message: null,
  created_at: SAMPLE_NOW,
  updated_at: SAMPLE_NOW,
};
const sampleArtifacts: StudyArtifact[] = [
  {
    id: -2001,
    document_id: SAMPLE_DOCUMENT_ID,
    artifact_type: "summary",
    title: "Photosynthesis lesson brief",
    content: {
      summary:
        "## Lesson goals\n\nStudents should be able to explain how plants use sunlight, water, and carbon dioxide to make food.\n\n### Key ideas\n\n- Chlorophyll captures energy from sunlight.\n- Water and carbon dioxide are the inputs.\n- Glucose and oxygen are the outputs.\n\n### Teaching notes\n\nStart with a leaf observation, ask students what a plant needs to grow, then connect their answers to the process.",
    },
    source_refs: [],
    created_at: SAMPLE_NOW,
    updated_at: SAMPLE_NOW,
  },
  {
    id: -2002,
    document_id: SAMPLE_DOCUMENT_ID,
    artifact_type: "flashcards",
    title: "Photosynthesis review deck",
    content: {
      flashcards: [
        {
          front: "What does chlorophyll do?",
          back: "It captures sunlight so the plant can use that energy to make food.",
        },
        {
          front: "What are the inputs for photosynthesis?",
          back: "Sunlight, water, and carbon dioxide.",
        },
        {
          front: "What are the outputs of photosynthesis?",
          back: "Glucose and oxygen.",
        },
      ],
    },
    source_refs: [],
    created_at: SAMPLE_NOW,
    updated_at: SAMPLE_NOW,
  },
];

function isAppTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark";
}

function isTextScale(value: unknown): value is TextScale {
  return value === "standard" || value === "comfortable" || value === "large";
}

function readAppearanceSettings(): AppearanceSettings {
  const fallback: AppearanceSettings = {
    appTheme: "light",
    highContrast: false,
    textScale: "standard",
  };

  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<AppearanceSettings>;
    return {
      appTheme: isAppTheme(parsed.appTheme) ? parsed.appTheme : fallback.appTheme,
      highContrast:
        typeof parsed.highContrast === "boolean" ? parsed.highContrast : fallback.highContrast,
      textScale: isTextScale(parsed.textScale) ? parsed.textScale : fallback.textScale,
    };
  } catch {
    return fallback;
  }
}

function writeAppearanceSettings(settings: AppearanceSettings) {
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Appearance persistence is best-effort; the UI should still work without storage.
  }
}

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

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function uniqueCitationSourceNames(citations: Record<string, unknown>[]) {
  const seen = new Set<string>();
  return citations.reduce<string[]>((names, citation, index) => {
    const name = String(citation.filename || `Source ${index + 1}`).trim();
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) return names;
    seen.add(key);
    names.push(name);
    return names;
  }, []);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ready: "Ready",
    queued: "Waiting",
    ingesting: "Preparing",
    generating: "Creating",
    exporting: "Exporting",
    failed: "Needs attention",
    draft_ready: "Draft ready",
    export_ready: "Ready to download",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

function artifactTypeLabel(type: string) {
  return type === "summary" ? "Summary" : type === "flashcards" ? "Flashcards" : statusLabel(type);
}

function artifactPreviewText(artifact: StudyArtifact) {
  if (artifact.artifact_type === "summary") {
    return String(artifact.content.summary || "")
      .replace(/[#*_>`-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (Array.isArray(artifact.content.flashcards)) {
    return artifact.content.flashcards
      .slice(0, 2)
      .map((card) => {
        const front = String((card as { front?: string }).front || "").trim();
        const back = String((card as { back?: string }).back || "").trim();
        return [front, back].filter(Boolean).join(" -> ");
      })
      .filter(Boolean)
      .join(" / ");
  }

  return "";
}

function compactPreviewText(value: string, maxLength = 118) {
  const cleaned = value
    .replace(/[#*_>`[\]]/g, "")
    .replace(/\bQuestion:\s*/gi, "")
    .replace(/\bAnswer Guidance:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trimEnd()}...`;
}

type PracticeCard = {
  front: string;
  back: string;
};

function artifactPracticeCards(artifact: StudyArtifact | null): PracticeCard[] {
  if (!artifact || !Array.isArray(artifact.content.flashcards)) return [];

  return artifact.content.flashcards
    .map((card) => {
      const front = String((card as { front?: string }).front || "").trim();
      const back = String((card as { back?: string }).back || "").trim();
      return { front, back };
    })
    .filter((card) => card.front || card.back);
}

function artifactDisplayTitle(artifact: StudyArtifact) {
  const cleaned = artifact.title
    .replace(/^(summary|flashcards):\s*/i, "")
    .replace(/\.(pdf|docx|md|markdown|txt)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length > 42) {
    return artifact.artifact_type === "summary" ? "Study summary" : "Review deck";
  }

  return cleaned;
}

function paperOutputTypeLabel(value: string) {
  if (value === "question_paper") return "Question paper";
  if (value === "worksheet_pack") return "Worksheet pack";
  if (value === "exam_variants") return "Quiz variants";
  return "Question paper + answer key";
}

function paperSourceModeLabel(value: string) {
  if (value === "chapter_or_pages") return "Chapter or pages";
  if (value === "topic") return "Topic";
  return "Whole material";
}

function paperErrorMessage(message: string) {
  if (
    /validation errors/i.test(message) ||
    /PrintableContent/i.test(message) ||
    /type=dict_type/i.test(message) ||
    /source_refs/i.test(message)
  ) {
    return {
      title: "The paper draft needs to be regenerated.",
      detail: "Try creating the paper again.",
    };
  }

  return {
    title: "Paper generation needs attention.",
    detail: message,
  };
}

function resetViewportScroll() {
  const reset = () => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(reset);
    return;
  }

  reset();
}

function userMessageFromError(exc: unknown) {
  const message = exc instanceof Error ? exc.message : String(exc);
  if (message === "Failed to fetch") {
    return "StudyGraph is not connected. Start StudyGraph, then refresh.";
  }
  return message;
}

export default function App() {
  const initialAppearance = useMemo(readAppearanceSettings, []);
  const [activeTab, setActiveTab] = useState<Tab>("rag");
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
  const [focusedArtifactId, setFocusedArtifactId] = useState<number | null>(null);
  const [expandedPrintableId, setExpandedPrintableId] = useState<number | null>(null);
  const [practiceCardIndex, setPracticeCardIndex] = useState(0);
  const [practiceRevealed, setPracticeRevealed] = useState(false);
  const [practiceMasteredCount, setPracticeMasteredCount] = useState(0);
  const [appTheme, setAppTheme] = useState<AppTheme>(initialAppearance.appTheme);
  const [persona, setPersona] = useState<UserPersona>("teacher");
  const [highContrast, setHighContrast] = useState(initialAppearance.highContrast);
  const [textScale, setTextScale] = useState<TextScale>(initialAppearance.textScale);
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
  const [uploadDragActive, setUploadDragActive] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    writeAppearanceSettings({ appTheme, highContrast, textScale });
  }, [appTheme, highContrast, textScale]);

  useEffect(() => {
    if (activeTab !== "rag" || activeSessionId === null) return;
    void loadQaSession(activeSessionId);
  }, [activeTab, activeSessionId]);

  useEffect(() => {
    setPracticeCardIndex(0);
    setPracticeRevealed(false);
    setPracticeMasteredCount(0);
  }, [focusedArtifactId]);

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
      setError(userMessageFromError(exc));
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
      setError(userMessageFromError(exc));
      setActiveMessages([]);
    }
  }

  async function uploadSelectedFile(file: File) {
    setBusy("upload");
    setError(null);
    try {
      const result = await uploadDocument(file);
      setDocuments((current) => [result.document, ...current]);
    } catch (exc) {
      setError(userMessageFromError(exc));
    } finally {
      setBusy(null);
    }
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await uploadSelectedFile(file);
    } finally {
      event.target.value = "";
    }
  }

  function onUploadDragEnter(event: DragEvent<HTMLElement>) {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    setUploadDragActive(true);
  }

  function onUploadDragOver(event: DragEvent<HTMLElement>) {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setUploadDragActive(true);
  }

  function onUploadDragLeave(event: DragEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setUploadDragActive(false);
  }

  async function onUploadDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setUploadDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || busy === "upload") return;
    await uploadSelectedFile(file);
  }

  async function onIngest(documentId: number) {
    if (!settings?.api_key_configured) {
      setError("Learning support is not connected yet. Open Settings to finish setup.");
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
      setError(userMessageFromError(exc));
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onAsk(event: FormEvent) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    if (selectedIds.some((id) => id < 0)) {
      setError("Upload your own material before asking about it.");
      return;
    }
    if (!settings?.api_key_configured) {
      setError("Learning support is not connected yet. Open Settings to finish setup.");
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
      setError(userMessageFromError(exc));
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

  function cycleTextScale() {
    setTextScale((current) =>
      current === "standard" ? "comfortable" : current === "comfortable" ? "large" : "standard",
    );
  }

  async function onArtifact(kind: ArtifactKind, documentId: number) {
    const existingArtifact = artifactByDocumentAndType.get(artifactKey(documentId, kind));
    if (existingArtifact) {
      setReaderArtifactId(existingArtifact.id);
      setActiveTab("study");
      return;
    }

    if (documentId < 0) {
      setError("Upload your own material before creating a new study set.");
      return;
    }

    if (!settings?.api_key_configured) {
      setError("Learning support is not connected yet. Open Settings to finish setup.");
      return;
    }
    setBusy(`${kind}-${documentId}`);
    setError(null);
    try {
      const artifact =
        kind === "summary" ? await createSummary(documentId) : await createFlashcards(documentId);
      setArtifacts((current) => [artifact, ...current]);
      setReaderArtifactId(artifact.id);
      setActiveTab("study");
    } catch (exc) {
      setError(userMessageFromError(exc));
    } finally {
      setBusy(null);
    }
  }

  async function onCreatePrintable(event: FormEvent) {
    event.preventDefault();
    if (!settings?.api_key_configured) {
      setError("Learning support is not connected yet. Open Settings to finish setup.");
      return;
    }
    if (paperDocumentId === "") {
      setError("Choose prepared class material before generating a paper.");
      return;
    }
    if (Number(paperDocumentId) < 0) {
      setError("Upload your own material before creating a paper.");
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
      setError(userMessageFromError(exc));
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
      setError(userMessageFromError(exc));
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
      setError(userMessageFromError(exc));
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

  function openSampleWorkspace() {
    setActiveTab("rag");
    setError(null);
    setDocuments([sampleDocument]);
    setIngestionJobs([]);
    setArtifacts(sampleArtifacts);
    setPrintables([]);
    setPrintableJobs([]);
    setPrintableExports({});
    setQaSessions([]);
    setActiveSessionId(null);
    setActiveMessages([]);
    setSelectedIds([SAMPLE_DOCUMENT_ID]);
    setQuestion("");
    setPaperDocumentId("");
    setReaderArtifactId(null);
    resetViewportScroll();
  }

  const readyDocuments = useMemo(
    () => documents.filter((document) => document.status === "ready"),
    [documents],
  );
  const documentNameById = useMemo(() => {
    const lookup = new Map<number, string>();
    for (const document of documents) {
      lookup.set(document.id, document.filename);
    }
    return lookup;
  }, [documents]);
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
  const providerSetupMessage = "Connect learning support before using this action.";
  const connectionMissing = error === "StudyGraph is not connected. Start StudyGraph, then refresh.";
  const isSampleWorkspace = documents.some((document) => document.id === SAMPLE_DOCUMENT_ID);

  const themeToggleLabel = appTheme === "light" ? "Dark mode" : "Light mode";
  const contrastToggleLabel = highContrast ? "Standard contrast" : "High contrast";
  const draftPrintableCount = printables.filter(
    (printable) => printable.status === "draft_ready" || printable.status === "export_ready",
  ).length;
  const activeTabLabel =
    activeTab === "rag" ? "Workspace" : (tabs.find((tab) => tab.id === activeTab)?.label ?? "Workspace");
  const selectedReadyDocuments = readyDocuments.filter((document) =>
    selectedIds.includes(document.id),
  );
  const activeContextDocuments =
    selectedReadyDocuments.length > 0 ? selectedReadyDocuments : readyDocuments;
  const hasCreatedOutput = artifacts.length > 0 || draftPrintableCount > 0;
  const workspaceFlow = [
    {
      label: "Add",
      state: documents.length > 0 ? "done" : "current",
    },
    {
      label: "Prepare",
      state:
        readyDocuments.length > 0
          ? "done"
          : documents.length > 0
            ? "current"
            : "waiting",
    },
    {
      label: "Ask",
      state:
        activeMessages.length > 0 || hasCreatedOutput
          ? "done"
          : readyDocuments.length > 0
            ? "current"
            : "waiting",
    },
    {
      label: "Create",
      state:
        hasCreatedOutput
          ? "done"
          : activeMessages.length > 0
            ? "current"
            : "waiting",
    },
  ];
  const activePersonaModes = personaStudyModes[persona];
  const firstUnreadyDocument = documents.find((document) => document.status !== "ready") ?? null;
  const missionDocument = activeContextDocuments[0] ?? readyDocuments[0] ?? null;
  const missionSummaryArtifact = missionDocument
    ? artifactByDocumentAndType.get(artifactKey(missionDocument.id, "summary"))
    : undefined;
  const missionFlashcardsArtifact = missionDocument
    ? artifactByDocumentAndType.get(artifactKey(missionDocument.id, "flashcards"))
    : undefined;
  const firstSavedArtifact = artifacts[0] ?? null;
  const focusedStudyArtifact =
    artifacts.find((artifact) => artifact.id === focusedArtifactId) ?? artifacts[0] ?? null;
  const focusedStudySource = focusedStudyArtifact
    ? documentNameById.get(focusedStudyArtifact.document_id) ??
      `Material #${focusedStudyArtifact.document_id}`
    : null;
  const focusedStudyPreview = focusedStudyArtifact
    ? artifactPreviewText(focusedStudyArtifact)
    : "";
  const focusedPracticeCards = artifactPracticeCards(focusedStudyArtifact);
  const activePracticeCard = focusedPracticeCards[practiceCardIndex] ?? focusedPracticeCards[0] ?? null;
  const practiceProgress =
    focusedPracticeCards.length > 0
      ? `${Math.min(practiceCardIndex + 1, focusedPracticeCards.length)} / ${focusedPracticeCards.length}`
      : "0 / 0";
  const practiceTotal = focusedPracticeCards.length;
  const practiceCurrent = practiceTotal > 0 ? Math.min(practiceCardIndex + 1, practiceTotal) : 0;
  const practiceRemaining = Math.max(practiceTotal - practiceCurrent, 0);
  const practicePercent = practiceTotal > 0 ? Math.round((practiceCurrent / practiceTotal) * 100) : 0;
  const practiceCue = practiceRevealed ? "Rate recall" : "Try recall first";
  const firstPromptMode = activePersonaModes.find((mode) => mode.prompt);
  const composerPromptModes = activePersonaModes.filter((mode) => mode.prompt);
  const personaModeLabel =
    persona === "student"
      ? "Study modes"
      : persona === "teacher"
        ? "Teaching modes"
        : "Oversight modes";
  const firstUnreadyJob = firstUnreadyDocument
    ? latestJobByDocumentId.get(firstUnreadyDocument.id)
    : undefined;
  const firstUnreadyHasActiveJob =
    firstUnreadyJob?.status === "queued" ||
    firstUnreadyJob?.status === "running" ||
    firstUnreadyDocument?.status === "queued" ||
    firstUnreadyDocument?.status === "ingesting";
  const preferredArtifactKind: ArtifactKind = persona === "student" ? "flashcards" : "summary";
  const preferredExistingArtifact =
    preferredArtifactKind === "summary" ? missionSummaryArtifact : missionFlashcardsArtifact;
  const workspaceMission: WorkspaceMission =
    documents.length === 0
      ? {
          action: "upload",
          actionLabel: "Upload file",
          detail: "Drop in notes, a worksheet, or a lesson file.",
          meta: "PDF, DOCX, TXT, or Markdown",
          stage: "Next",
          title: "Start with a file",
          tone: "start",
        }
      : readyDocuments.length === 0 && firstUnreadyDocument
        ? {
            action: "prepare",
            actionLabel: firstUnreadyHasActiveJob ? "Preparing" : "Prepare material",
            detail: "The file is uploaded. Prepare it once, then ask anything.",
            disabled: !providerReady || firstUnreadyHasActiveJob,
            documentId: firstUnreadyDocument.id,
            meta: firstUnreadyHasActiveJob
              ? "Preparation is already in progress"
              : providerReady
                ? "One click, then it is ready to use"
                : providerSetupMessage,
            stage: "Next",
            title: "Prepare the file",
            tone: "prepare",
          }
        : firstSavedArtifact && hasCreatedOutput
          ? {
              action: "openArtifact",
              actionLabel: `Open ${artifactTypeLabel(firstSavedArtifact.artifact_type).toLowerCase()}`,
              artifactId: firstSavedArtifact.id,
              detail: "Saved work is ready to review.",
              meta: "Saved study set",
              stage: "Next",
              title: "Review saved work",
              tone: "review",
            }
          : activeMessages.length > 0 && missionDocument
            ? {
                action: "artifact",
                actionLabel: preferredArtifactKind === "summary" ? "Create summary" : "Create flashcards",
                artifactKind: preferredArtifactKind,
                detail:
                  preferredArtifactKind === "summary"
                    ? "Save the useful parts as a teaching brief."
                    : "Save the useful parts as quick practice.",
                disabled:
                  !providerReady ||
                  missionDocument.id < 0 ||
                  busy === `${preferredArtifactKind}-${missionDocument.id}`,
                documentId: missionDocument.id,
                meta:
                  missionDocument.id < 0
                    ? "Upload your own file to create a new study set"
                    : providerReady
                      ? missionDocument.filename
                      : providerSetupMessage,
                stage: "Next",
                title: "Create from this",
                tone: "work",
              }
            : preferredExistingArtifact
              ? {
                  action: "openArtifact",
                  actionLabel: `Open ${artifactTypeLabel(preferredExistingArtifact.artifact_type).toLowerCase()}`,
                  artifactId: preferredExistingArtifact.id,
                  detail: "Saved work is ready to review.",
                  meta: missionDocument?.filename ?? "Prepared material",
                  stage: "Next",
                  title: "Open saved work",
                  tone: "review",
                }
              : firstPromptMode?.prompt
                ? {
                    action: "prompt",
                    actionLabel: firstPromptMode.title,
                    detail: firstPromptMode.detail,
                    meta: missionDocument?.filename ?? "Prepared material",
                    prompt: firstPromptMode.prompt,
                    stage: "Next",
                    title:
                      persona === "student"
                        ? "Start studying"
                        : persona === "teacher"
                          ? "Guide the lesson"
                          : "Check the overview",
                    tone: "work",
                  }
                : {
                    action: "prompt",
                    actionLabel: "Ask",
                    detail: "Start with a focused question about the selected material.",
                    meta: missionDocument?.filename ?? "Prepared material",
                    prompt: "What are the most important points in this material?",
                    stage: "Next",
                    title: "Ask a question",
                    tone: "work",
                  };
  const lastAssistantMessage =
    [...activeMessages].reverse().find((message) => message.role === "assistant") ?? null;
  const lastAnswerSources = lastAssistantMessage
    ? uniqueCitationSourceNames(lastAssistantMessage.citations)
    : [];
  const sessionPulseTitle =
    documents.length === 0
      ? "Add material to begin"
      : readyDocuments.length === 0
        ? "Preparing your material"
        : activeMessages.length === 0
          ? "Ask from selected files"
          : lastAnswerSources.length > 0
            ? `Last answer used ${pluralize(lastAnswerSources.length, "file")}`
            : "Last answer is ready";
  const sessionPulseDetail =
    lastAnswerSources.length > 0
      ? lastAnswerSources.slice(0, 2).join(", ")
      : activeContextDocuments.length > 0
        ? activeContextDocuments
            .slice(0, 2)
            .map((document) => document.filename)
            .join(", ")
        : workspaceMission.meta;

  function runWorkspaceMission() {
    if (workspaceMission.action === "prepare") {
      void onIngest(workspaceMission.documentId);
      return;
    }
    if (workspaceMission.action === "prompt") {
      setQuestion(workspaceMission.prompt);
      return;
    }
    if (workspaceMission.action === "artifact") {
      void onArtifact(workspaceMission.artifactKind, workspaceMission.documentId);
      return;
    }
    if (workspaceMission.action === "openArtifact") {
      setReaderArtifactId(workspaceMission.artifactId);
      setActiveTab("study");
    }
  }

  function runStudyMode(mode: StudyMode) {
    const firstReadyDocument = activeContextDocuments[0];

    if (mode.artifactKind) {
      if (firstReadyDocument) {
        void onArtifact(mode.artifactKind, firstReadyDocument.id);
      }
      return;
    }

    if (mode.prompt) {
      setQuestion(mode.prompt);
    }
  }

  function askAboutStudySet(prompt: string, documentId: number) {
    if (documentId > 0) {
      setSelectedIds([documentId]);
    }
    setQuestion(prompt);
    setActiveTab("rag");
    resetViewportScroll();
  }

  function goToNextPracticeCard() {
    if (focusedPracticeCards.length === 0) return;
    setPracticeCardIndex((current) => (current + 1) % focusedPracticeCards.length);
    setPracticeRevealed(false);
  }

  function markPracticeCardMastered() {
    setPracticeMasteredCount((current) => Math.min(current + 1, focusedPracticeCards.length));
    goToNextPracticeCard();
  }

  function resetPracticeSession() {
    setPracticeCardIndex(0);
    setPracticeRevealed(false);
    setPracticeMasteredCount(0);
  }

  function scrollPaperStep(stepId: string) {
    document.getElementById(stepId)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
  }

  function applyPaperPreset(
    preset: "quick_check" | "balanced" | "exam",
    outputType: string,
    difficulty: string,
    counts: { mcq: number; short: number; long: number },
  ) {
    setPaperOutputType(outputType);
    setPaperDifficulty(difficulty);
    setMcqCount(counts.mcq);
    setShortCount(counts.short);
    setLongCount(counts.long);
    if (preset === "quick_check") {
      setPaperTitle("Quick Check");
      return;
    }
    if (preset === "exam") {
      setPaperTitle("Exam Practice");
      return;
    }
    setPaperTitle("Balanced Practice Paper");
  }

  return (
    <div
      className={`appShell theme-${appTheme} text-${textScale}${highContrast ? " contrast-high" : ""}`}
    >
      <aside className="sidebar">
        <div className="brand">
          <img src="/studygraph-mark.svg" alt="" aria-hidden="true" />
          <div>
            <h1>StudyGraph</h1>
          </div>
        </div>
        <nav className="appNav" aria-label="Primary workspace">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                aria-label={tab.label}
                title={tab.label}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== "study") {
                    setReaderArtifactId(null);
                  }
                  resetViewportScroll();
                }}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="workspace">
        <header
          className={`workspaceHero ${activeTab === "rag" ? "chatHeader" : ""}`}
        >
          <div className="workspaceIntro">
            <h2>{activeTabLabel}</h2>
          </div>
          <div className="topbarActions">
            <div className="personaSwitch" aria-label="Workspace persona">
              {personas.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`${item.label} view`}
                  aria-pressed={persona === item.id}
                  className={persona === item.id ? "active" : ""}
                  onClick={() => setPersona(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              className="iconButton"
              onClick={() => setHighContrast((current) => !current)}
              aria-label={contrastToggleLabel}
              title={contrastToggleLabel}
            >
              <Accessibility size={18} />
            </button>
            <button
              className="iconButton"
              onClick={cycleTextScale}
              aria-label="Text size"
              title={`Text size: ${textScale}`}
            >
              <Type size={18} />
            </button>
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

        {connectionMissing ? (
          <div className="connectionBanner" role="status">
            <div>
              <strong>Offline workspace</strong>
              <span>Open StudyGraph on this device to sync material, chats, and study sets.</span>
            </div>
            <button type="button" onClick={() => void refresh()}>
              Try reconnecting
            </button>
          </div>
        ) : error ? (
          <div className="alert">{error}</div>
        ) : null}

        {providerMissing ? (
          <div className="setupWarning">
            <AlertTriangle size={18} />
            <div>
              <strong>Learning support is not connected</strong>
              <span>{providerSetupMessage}</span>
            </div>
          </div>
        ) : null}

        <div className="workspaceGrid">
          <div className="workspacePrimary">

        {activeTab === "rag" ? (
            <section className="learningCanvas" aria-label="Learning canvas">
            <section className="canvasRail" aria-label="Material">
              <label
                className={`materialUpload${uploadDragActive ? " dragActive" : ""}`}
                role="button"
                tabIndex={0}
                onDragEnter={onUploadDragEnter}
                onDragOver={onUploadDragOver}
                onDragLeave={onUploadDragLeave}
                onDrop={(event) => void onUploadDrop(event)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.currentTarget.querySelector("input")?.click();
                  }
                }}
              >
                {busy === "upload" ? <Loader2 className="spin" size={20} /> : <Upload size={20} />}
                <span>{busy === "upload" ? "Uploading..." : "Upload"}</span>
                <input
                  type="file"
                  aria-hidden="true"
                  accept=".pdf,.docx,.txt,.md,.markdown"
                  tabIndex={-1}
                  onChange={(event) => void onUpload(event)}
                />
              </label>

              <div className="railSection">
                <div className="railHeader">
                  <h3>Material</h3>
                  <span>{documents.length}</span>
                </div>
                <div className="materialStack">
                  {documents.map((document) => {
                    const isIngested = document.status === "ready";
                    const latestJob = latestJobByDocumentId.get(document.id);
                    const isIngesting =
                      latestJob?.status === "running" || document.status === "ingesting";
                    const isQueued = latestJob
                      ? latestJob.status === "queued"
                      : document.status === "queued";
                    const hasActiveJob = isQueued || isIngesting;

                    return (
                      <article key={document.id} className="materialRow">
                        <FileText size={18} />
                        <div>
                          <strong title={document.filename}>{document.filename}</strong>
                          <span>{statusLabel(document.status)}</span>
                        </div>
                        {!isIngested ? (
                          <button
                            className="preparePill"
                            onClick={() => void onIngest(document.id)}
                            disabled={!providerReady || hasActiveJob || busy === `ingest-${document.id}`}
                            title={
                              hasActiveJob
                                ? "Preparation already started"
                                : !providerReady
                                  ? providerSetupMessage
                                  : "Prepare material"
                            }
                          >
                            {busy === `ingest-${document.id}`
                              ? "Starting"
                              : isQueued
                                ? "Waiting"
                                : isIngesting
                                  ? "Preparing"
                                  : "Prepare"}
                          </button>
                        ) : (
                          <span className="readyDot" aria-label="Ready" />
                        )}
                      </article>
                    );
                  })}
                  {documents.length === 0 ? (
                    <div className="railEmpty">
                      <Sparkles size={22} />
                      <p>Add notes, PDFs, or worksheets.</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="railSection conversationList" aria-label="Saved conversations">
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
                      aria-label={`Open conversation: ${session.title}`}
                      onClick={() => setActiveSessionId(session.id)}
                    >
                      <strong>{session.title}</strong>
                      <span>{session.message_count} messages</span>
                      {session.last_message ? <p>{compactPreviewText(session.last_message)}</p> : null}
                    </button>
                  ))}
                  {qaSessions.length === 0 ? <p>No conversations yet.</p> : null}
                </div>
              </div>
            </section>

            <section className="canvasCenter">
              <div className="studioCommand" aria-label="Workspace command center">
                <section className={`missionPanel ${workspaceMission.tone}`} aria-label="Next workspace step">
                  <div className="missionTopline">
                    <span>{workspaceMission.stage}</span>
                    {isSampleWorkspace ? <strong>Sample workspace</strong> : null}
                  </div>
                  <div className="missionCopy">
                    <strong>{workspaceMission.title}</strong>
                    <p>{workspaceMission.detail}</p>
                  </div>
                  <div className="missionTrail" aria-label="Workspace flow">
                    {workspaceFlow.map((step) => (
                      <span key={step.label} className={step.state}>
                        {step.label}
                      </span>
                    ))}
                  </div>
                  {workspaceMission.action === "upload" ? (
                    <label
                      className={`missionAction${uploadDragActive ? " dragActive" : ""}`}
                      role="button"
                      tabIndex={0}
                      onDragEnter={onUploadDragEnter}
                      onDragOver={onUploadDragOver}
                      onDragLeave={onUploadDragLeave}
                      onDrop={(event) => void onUploadDrop(event)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.currentTarget.querySelector("input")?.click();
                        }
                      }}
                    >
                      {busy === "upload" ? (
                        <Loader2 className="spin" size={16} />
                      ) : (
                        <Upload size={16} />
                      )}
                      <span>{busy === "upload" ? "Uploading..." : workspaceMission.actionLabel}</span>
                      <input
                        type="file"
                        aria-hidden="true"
                        accept=".pdf,.docx,.txt,.md,.markdown"
                        tabIndex={-1}
                        onChange={(event) => void onUpload(event)}
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      className="missionAction"
                      disabled={"disabled" in workspaceMission ? workspaceMission.disabled : false}
                      title={
                        workspaceMission.action === "openArtifact"
                          ? `${workspaceMission.actionLabel} in Study Sets`
                          : workspaceMission.actionLabel
                      }
                      onClick={runWorkspaceMission}
                    >
                      <span>{workspaceMission.actionLabel}</span>
                      <ArrowRight size={16} />
                    </button>
                  )}
                </section>

                <section className="sourceScope" aria-label="Selected material">
                  <div className="sourceScopeHeader">
                    <div>
                      <span className="canvasKicker">Files</span>
                      <h3>
                        {readyDocuments.length > 0
                          ? `${activeContextDocuments.length || readyDocuments.length} in use`
                          : "No prepared files"}
                      </h3>
                    </div>
                    <label
                      className={`miniUploadAction${uploadDragActive ? " dragActive" : ""}`}
                      role="button"
                      tabIndex={0}
                      onDragEnter={onUploadDragEnter}
                      onDragOver={onUploadDragOver}
                      onDragLeave={onUploadDragLeave}
                      onDrop={(event) => void onUploadDrop(event)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.currentTarget.querySelector("input")?.click();
                        }
                      }}
                    >
                      {busy === "upload" ? (
                        <Loader2 className="spin" size={14} />
                      ) : (
                        <Upload size={14} />
                      )}
                      <span>{busy === "upload" ? "Adding..." : "Add file"}</span>
                      <input
                        type="file"
                        aria-hidden="true"
                        accept=".pdf,.docx,.txt,.md,.markdown"
                        tabIndex={-1}
                        onChange={(event) => void onUpload(event)}
                      />
                    </label>
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
                        <span>{document.filename}</span>
                      </label>
                    ))}
                    {readyDocuments.length === 0 ? <p>Prepare material first.</p> : null}
                  </div>
                </section>

              </div>

              <section className="sessionPulse" aria-label="Learning session pulse">
                <div className="sessionPulseSignal" aria-hidden="true">
                  {workspaceFlow.map((step) => (
                    <span key={step.label} className={step.state} />
                  ))}
                </div>
                <div className="sessionPulseCopy">
                  <span>Learning session</span>
                  <strong>{sessionPulseTitle}</strong>
                  <p>{sessionPulseDetail}</p>
                </div>
                <div className="sessionPulseStats" aria-label="Session context">
                  <span>
                    <BookOpen size={14} />
                    {pluralize(activeContextDocuments.length, "file")}
                  </span>
                  <span>
                    <Network size={14} />
                    {lastAssistantMessage
                      ? pluralize(lastAssistantMessage.citations.length, "reference")
                      : "No references yet"}
                  </span>
                  <span>
                    <Layers size={14} />
                    {pluralize(artifacts.length, "study set")}
                  </span>
                </div>
              </section>

              <div className="messageTimeline learningStream" aria-label="Conversation history">
                {activeMessages.map((message) => {
                  const citationSourceNames = uniqueCitationSourceNames(message.citations);
                  const visibleSourceNames = citationSourceNames.slice(0, 3);
                  const hiddenSourceCount = citationSourceNames.length - visibleSourceNames.length;
                  const answerActionDocument = activeContextDocuments[0] ?? readyDocuments[0] ?? null;
                  const answerSummaryArtifact = answerActionDocument
                    ? artifactByDocumentAndType.get(artifactKey(answerActionDocument.id, "summary"))
                    : undefined;
                  const answerFlashcardsArtifact = answerActionDocument
                    ? artifactByDocumentAndType.get(
                        artifactKey(answerActionDocument.id, "flashcards"),
                      )
                    : undefined;
                  const answerSummaryDisabled =
                    !answerActionDocument ||
                    (!answerSummaryArtifact &&
                      (!providerReady ||
                        answerActionDocument.id < 0 ||
                        busy === `summary-${answerActionDocument.id}`));
                  const answerFlashcardsDisabled =
                    !answerActionDocument ||
                    (!answerFlashcardsArtifact &&
                      (!providerReady ||
                        answerActionDocument.id < 0 ||
                        busy === `flashcards-${answerActionDocument.id}`));

                  return (
                    <article key={message.id} className={`chatMessage ${message.role}`}>
                      <span className="messageRole">
                        {message.role === "user" ? "You" : "StudyGraph"}
                      </span>
                      {message.role === "assistant" ? (
                        <RichText content={message.content} />
                      ) : (
                        <p>{message.content}</p>
                      )}
                      {message.role === "assistant" && message.citations.length > 0 ? (
                        <div className="answerEvidence" aria-label="Answer sources">
                          <span>From your files</span>
                          <div>
                            {visibleSourceNames.map((sourceName) => (
                              <strong key={sourceName}>{sourceName}</strong>
                            ))}
                            {hiddenSourceCount > 0 ? (
                              <strong>+{hiddenSourceCount} more</strong>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {message.role === "assistant" ? (
                        <div className="answerNextSteps" aria-label="Study next">
                          <span>Study next</span>
                          <button
                            type="button"
                            onClick={() =>
                              setQuestion("Ask me one question to check if I understood this answer.")
                            }
                          >
                            Check me
                          </button>
                          <button
                            type="button"
                            disabled={answerFlashcardsDisabled}
                            title={
                              answerFlashcardsArtifact
                                ? "Open flashcards"
                                : answerActionDocument?.id && answerActionDocument.id < 0
                                  ? "Upload your own material to create flashcards"
                                  : !providerReady
                                    ? providerSetupMessage
                                    : "Create flashcards"
                            }
                            onClick={() =>
                              answerActionDocument
                                ? void onArtifact("flashcards", answerActionDocument.id)
                                : undefined
                            }
                          >
                            {answerFlashcardsArtifact ? "Open practice" : "Make practice"}
                          </button>
                          <button
                            type="button"
                            disabled={answerSummaryDisabled}
                            title={
                              answerSummaryArtifact
                                ? "Open brief"
                                : answerActionDocument?.id && answerActionDocument.id < 0
                                  ? "Upload your own material to create a brief"
                                  : !providerReady
                                    ? providerSetupMessage
                                    : "Create brief"
                            }
                            onClick={() =>
                              answerActionDocument
                                ? void onArtifact("summary", answerActionDocument.id)
                                : undefined
                            }
                          >
                            {answerSummaryArtifact ? "Open brief" : "Save brief"}
                          </button>
                        </div>
                      ) : null}
                      {message.citations.length > 0 ? (
                        <details className="citationLens">
                          <summary className="citationLensHeader">
                            <Network size={16} />
                            <div>
                              <strong>References used</strong>
                              <span>{pluralize(message.citations.length, "reference")}</span>
                            </div>
                          </summary>
                          <div className="citationList compact">
                            {message.citations.map((citation, index) => (
                              <article key={index} className="citation">
                                <div className="citationTopline">
                                  <span>Reference {index + 1}</span>
                                  <strong>
                                    {String(citation.filename || `Reference ${index + 1}`)}
                                  </strong>
                                </div>
                                {citation.text ? <p>{String(citation.text)}</p> : null}
                              </article>
                            ))}
                          </div>
                          {message.confidence_notes.length > 0 ? (
                            <div className="confidenceNotes">
                              {message.confidence_notes.map((note, index) => (
                                <p key={index}>{note}</p>
                              ))}
                            </div>
                          ) : null}
                        </details>
                      ) : null}
                    </article>
                  );
                })}
                {busy === "ask" ? (
                  <article className="chatMessage assistant">
                    <span className="messageRole">StudyGraph</span>
                    <p>Thinking...</p>
                  </article>
                ) : null}
                {activeMessages.length === 0 && busy !== "ask" ? (
                  documents.length === 0 ? (
                    <div className="conversationEmpty onboardingEmpty">
                      <div className="emptyMark" aria-hidden="true">
                        <Sparkles size={24} />
                      </div>
                      <div>
                        <h3>Start a study session</h3>
                        <p>Bring one file. StudyGraph keeps answers tied to it.</p>
                      </div>
                      <div className="emptyActions">
                        <label
                          className={`emptyUploadAction${uploadDragActive ? " dragActive" : ""}`}
                          role="button"
                          tabIndex={0}
                          onDragEnter={onUploadDragEnter}
                          onDragOver={onUploadDragOver}
                          onDragLeave={onUploadDragLeave}
                          onDrop={(event) => void onUploadDrop(event)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.currentTarget.querySelector("input")?.click();
                            }
                          }}
                        >
                          {busy === "upload" ? (
                            <Loader2 className="spin" size={18} />
                          ) : (
                            <Upload size={18} />
                          )}
                          <span>{busy === "upload" ? "Uploading..." : "Add material"}</span>
                          <input
                            type="file"
                            aria-hidden="true"
                            accept=".pdf,.docx,.txt,.md,.markdown"
                            tabIndex={-1}
                            onChange={(event) => void onUpload(event)}
                          />
                        </label>
                        <button
                          type="button"
                          className="sampleWorkspaceAction"
                          onClick={openSampleWorkspace}
                        >
                          Explore sample
                        </button>
                      </div>
                      <div className="learningLoopPreview" aria-label="Learning loop">
                        <span>
                          <strong>1</strong>
                          Add
                        </span>
                        <span>
                          <strong>2</strong>
                          Ask
                        </span>
                        <span>
                          <strong>3</strong>
                          Create
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="conversationEmpty sourceReadyState">
                      <SourceConstellation
                        documents={activeContextDocuments}
                        moves={composerPromptModes.map((mode) => ({
                          id: mode.id,
                          title: mode.title,
                          detail: mode.detail,
                          icon: mode.icon,
                          onRun: () => runStudyMode(mode),
                        }))}
                        modesLabel={personaModeLabel}
                      />
                    </div>
                  )
                ) : null}
              </div>

              <form className="askForm chatComposer" onSubmit={(event) => void onAsk(event)}>
                {activeMessages.length > 0 &&
                readyDocuments.length > 0 &&
                composerPromptModes.length > 0 ? (
                  <div
                    className="composerGuides"
                    aria-label={`${personaModeLabel} composer suggestions`}
                  >
                    <span>Try</span>
                    <div>
                      {composerPromptModes.map((mode) => {
                        const Icon = mode.icon;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            className="composerGuideButton"
                            title={mode.detail}
                            onClick={() => runStudyMode(mode)}
                          >
                            <Icon size={15} />
                            {mode.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a question, compare notes, or request examples..."
                />
                <button
                  disabled={!providerReady || busy === "ask" || !question.trim()}
                  title={!providerReady ? providerSetupMessage : "Ask question"}
                >
                  {busy === "ask" ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                  Send
                </button>
              </form>
            </section>
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
                  <span>{artifactTypeLabel(readerArtifact.artifact_type)}</span>
                  <span>{new Date(readerArtifact.updated_at).toLocaleDateString()}</span>
                </div>
                <h3>{readerArtifact.title}</h3>
                {readerArtifact.artifact_type === "summary" ? (
                  <RichText
                    className="readerBody"
                    content={String(readerArtifact.content.summary || "")}
                  />
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
            <section className="studyShelf">
              {focusedStudyArtifact ? (
                <div className="studyReviewGrid">
                  <article className="reviewFocus" aria-label="Focused study set">
                    <div className="reviewFocusTop">
                      <div className="shelfType large" aria-hidden="true">
                        {focusedStudyArtifact.artifact_type === "summary" ? (
                          <FileText size={22} />
                        ) : (
                          <Layers size={22} />
                        )}
                      </div>
                      <div>
                        <span className="canvasKicker">
                          {artifactTypeLabel(focusedStudyArtifact.artifact_type)}
                        </span>
                        <h4>{artifactDisplayTitle(focusedStudyArtifact)}</h4>
                        <p>{focusedStudySource}</p>
                      </div>
                    </div>
                    <div className="reviewFocusMeta" aria-label="Focused study set details">
                      <span>{new Date(focusedStudyArtifact.updated_at).toLocaleDateString()}</span>
                      <span>{artifactTypeLabel(focusedStudyArtifact.artifact_type)}</span>
                      <span>{focusedStudySource}</span>
                    </div>
                    <div className="studyActionDeck" aria-label="Study set actions">
                      <button
                        className="readerOpenButton primary"
                        onClick={() => setReaderArtifactId(focusedStudyArtifact.id)}
                        aria-label={`Open focused reader for ${focusedStudyArtifact.title}`}
                        title={`Open focused reader for ${focusedStudyArtifact.title}`}
                      >
                        <BookOpen size={16} />
                        Open reader
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          askAboutStudySet(
                            focusedStudyArtifact.artifact_type === "summary"
                              ? "Quiz me on the most important points in this summary."
                              : "Help me practice these flashcards with follow-up questions.",
                            focusedStudyArtifact.document_id,
                          )
                        }
                      >
                        <HelpCircle size={16} />
                        Quiz me
                      </button>
                      {focusedStudyArtifact.artifact_type === "summary" ? (
                        <button
                          type="button"
                          disabled={
                            focusedStudyArtifact.document_id < 0 ||
                            (!artifactByDocumentAndType.get(
                              artifactKey(focusedStudyArtifact.document_id, "flashcards"),
                            ) &&
                              (!providerReady ||
                                busy === `flashcards-${focusedStudyArtifact.document_id}`))
                          }
                          title={
                            focusedStudyArtifact.document_id < 0
                              ? "Upload your own material to create flashcards"
                              : !providerReady &&
                                  !artifactByDocumentAndType.get(
                                    artifactKey(focusedStudyArtifact.document_id, "flashcards"),
                                  )
                                ? providerSetupMessage
                                : "Create or open flashcards"
                          }
                          onClick={() =>
                            void onArtifact("flashcards", focusedStudyArtifact.document_id)
                          }
                        >
                          {busy === `flashcards-${focusedStudyArtifact.document_id}` ? (
                            <Loader2 className="spin" size={16} />
                          ) : (
                            <Layers size={16} />
                          )}
                          Cards
                        </button>
                      ) : null}
                    </div>
                    {focusedStudyArtifact.artifact_type === "flashcards" && activePracticeCard ? (
                      <div className="practicePanel" aria-label="Flashcard practice">
                        <div className="practiceSession" aria-label="Practice progress">
                          <div className="practiceSessionCopy">
                            <span>{practiceCue}</span>
                            <strong>{practiceProgress}</strong>
                          </div>
                          <div
                            className="practiceProgressTrack"
                            aria-hidden="true"
                            style={{ "--practice-progress": `${practicePercent}%` } as CSSProperties}
                          />
                          <div className="practiceSessionStats">
                            <span>{practiceRemaining} left</span>
                            <span>{practiceMasteredCount} remembered</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`practiceCard${practiceRevealed ? " revealed" : ""}`}
                          onClick={() => setPracticeRevealed((current) => !current)}
                          aria-label={practiceRevealed ? "Hide answer" : "Reveal answer"}
                        >
                          <span>{practiceRevealed ? "Answer" : "Prompt"}</span>
                          <strong>
                            {practiceRevealed
                              ? activePracticeCard.back || "No answer saved."
                              : activePracticeCard.front || "No prompt saved."}
                          </strong>
                          <small>{practiceRevealed ? "Tap to hide" : "Tap to reveal"}</small>
                        </button>
                        <div className="practiceControls">
                          <button type="button" onClick={() => setPracticeRevealed(true)}>
                            Reveal
                          </button>
                          <button type="button" onClick={goToNextPracticeCard}>
                            Again
                          </button>
                          <button type="button" className="primary" onClick={markPracticeCardMastered}>
                            Got it
                          </button>
                          <button
                            type="button"
                            className="iconOnly"
                            onClick={resetPracticeSession}
                            aria-label="Restart flashcard practice"
                            title="Restart practice"
                          >
                            <RefreshCcw size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <RichText
                        className="reviewFocusPreview"
                        content={
                          focusedStudyArtifact.artifact_type === "summary"
                            ? String(focusedStudyArtifact.content.summary || "")
                            : focusedStudyPreview || "Open the reader to review this study set."
                        }
                      />
                    )}
                  </article>

                  <aside className="reviewQueue" aria-label="Saved study sets">
                    <div className="reviewQueueHeader">
                      <div>
                        <span className="canvasKicker">Queue</span>
                        <h3>Review queue</h3>
                      </div>
                      <strong>{pluralize(artifacts.length, "set")}</strong>
                    </div>
                    <div className="shelfList">
                      {artifacts.map((artifact) => {
                        const sourceName =
                          documentNameById.get(artifact.document_id) ??
                          `Material #${artifact.document_id}`;
                        const previewText = compactPreviewText(artifactPreviewText(artifact), 96);
                        const isFocused = focusedStudyArtifact?.id === artifact.id;

                        return (
                          <article
                            key={artifact.id}
                            className={`shelfItem compact ${isFocused ? "active" : ""}`}
                          >
                            <div className="shelfType" aria-hidden="true">
                              {artifact.artifact_type === "summary" ? (
                                <FileText size={18} />
                              ) : (
                                <Layers size={18} />
                              )}
                            </div>
                            <div className="shelfItemMain">
                              <div className="shelfItemMeta">
                                <span>{artifactTypeLabel(artifact.artifact_type)}</span>
                                <span>{new Date(artifact.updated_at).toLocaleDateString()}</span>
                              </div>
                              <h4>{artifactDisplayTitle(artifact)}</h4>
                              <p>{previewText || "Open the reader to review this study set."}</p>
                              <small>{sourceName}</small>
                            </div>
                            <div className="shelfItemActions">
                              <button
                                className="shelfPreviewButton"
                                type="button"
                                disabled={isFocused}
                                onClick={() => setFocusedArtifactId(artifact.id)}
                                aria-label={`Preview ${artifact.title}`}
                                title={`Preview ${artifact.title}`}
                              >
                                {isFocused ? "In focus" : "Preview"}
                              </button>
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
                          </article>
                        );
                      })}
                    </div>
                  </aside>
                </div>
              ) : (
                <div className="emptyState compact">
                    <Layers size={22} />
                    <h3>No study sets yet</h3>
                    <p>Create a summary or flashcards from prepared material.</p>
                </div>
              )}
            </section>
          )
        ) : null}

        {activeTab === "printables" ? (
          <section className="panel paperBuilder">
            <div className="panelHeader paperStudioHeader">
              <div>
                <span className="canvasKicker">Paper studio</span>
                <h3>Create from class material</h3>
                <p>Pick the moment, shape the questions, and review before download.</p>
              </div>
            </div>

            <section className="paperLaunchPad" aria-label="Paper starting points">
              <div>
                <span className="canvasKicker">Start with</span>
                <h4>Pick the classroom moment</h4>
              </div>
              <div className="paperLaunchOptions">
                <button
                  type="button"
                  aria-label="Use quick check preset, 7 questions"
                  onClick={() =>
                    applyPaperPreset("quick_check", "worksheet_pack", "easy", {
                      mcq: 4,
                      short: 3,
                      long: 0,
                    })
                  }
                >
                  <CheckCircle2 size={17} />
                  <strong>Quick check</strong>
                  <span>7 questions</span>
                </button>
                <button
                  type="button"
                  aria-label="Use balanced preset, 12 questions"
                  onClick={() =>
                    applyPaperPreset("balanced", "teacher_pack", "medium", {
                      mcq: 5,
                      short: 5,
                      long: 2,
                    })
                  }
                >
                  <ClipboardList size={17} />
                  <strong>Balanced</strong>
                  <span>12 questions</span>
                </button>
                <button
                  type="button"
                  aria-label="Use exam prep preset, 17 questions"
                  onClick={() =>
                    applyPaperPreset("exam", "exam_variants", "hard", {
                      mcq: 8,
                      short: 6,
                      long: 3,
                    })
                  }
                >
                  <Clock3 size={17} />
                  <strong>Exam prep</strong>
                  <span>17 questions</span>
                </button>
              </div>
            </section>

            <div className="paperStudio">
              <form
                id="paper-create-form"
                className="paperWizard"
                onSubmit={(event) => void onCreatePrintable(event)}
              >
                <div className="paperStepRail" aria-label="Paper setup steps">
                  <button type="button" onClick={() => scrollPaperStep("paper-step-source")}>
                    Source
                  </button>
                  <button type="button" onClick={() => scrollPaperStep("paper-step-format")}>
                    Format
                  </button>
                  <button type="button" onClick={() => scrollPaperStep("paper-step-classroom")}>
                    Classroom
                  </button>
                  <button type="button" onClick={() => scrollPaperStep("paper-step-mix")}>
                    Mix
                  </button>
                </div>
                <section id="paper-step-source" className="paperWizardSection wideField">
                  <div className="paperWizardStep">
                    <span>1</span>
                    <div>
                      <strong>Source</strong>
                      <small>Pick the material and scope.</small>
                    </div>
                  </div>
                  <label>
                    Class material
                    <select
                      value={paperDocumentId}
                      onChange={(event) =>
                        setPaperDocumentId(event.target.value ? Number(event.target.value) : "")
                      }
                    >
                      <option value="">Choose prepared material</option>
                      {readyDocuments.map((document) => (
                        <option key={document.id} value={document.id}>
                          {document.filename}
                        </option>
                      ))}
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
                </section>

                <section id="paper-step-format" className="paperWizardSection">
                  <div className="paperWizardStep">
                    <span>2</span>
                    <div>
                      <strong>Format</strong>
                      <small>Choose what students receive.</small>
                    </div>
                  </div>
                  <label>
                    Paper title
                    <input
                      aria-label="Paper title"
                      value={paperTitle}
                      onChange={(event) => setPaperTitle(event.target.value)}
                    />
                  </label>
                  <label>
                    Paper type
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
                    Material scope
                    <select
                      value={paperSourceMode}
                      onChange={(event) => setPaperSourceMode(event.target.value)}
                    >
                      <option value="whole_book">Whole book</option>
                      <option value="chapter_or_pages">Chapter or page range</option>
                      <option value="topic">Topic</option>
                    </select>
                  </label>
                </section>

                <section id="paper-step-classroom" className="paperWizardSection">
                  <div className="paperWizardStep">
                    <span>3</span>
                    <div>
                      <strong>Classroom</strong>
                      <small>Match the learners.</small>
                    </div>
                  </div>
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
                </section>

                <section id="paper-step-mix" className="paperWizardSection wideField paperMixSection">
                  <div className="paperWizardStep">
                    <span>4</span>
                    <div>
                      <strong>Question mix</strong>
                      <small>Tune the counts.</small>
                    </div>
                  </div>
                  <div className="paperCountGrid">
                    <label>
                      MCQ
                      <input
                        type="number"
                        min="0"
                        value={mcqCount}
                        onChange={(event) => setMcqCount(Number(event.target.value))}
                      />
                    </label>
                    <label>
                      Short
                      <input
                        type="number"
                        min="0"
                        value={shortCount}
                        onChange={(event) => setShortCount(Number(event.target.value))}
                      />
                    </label>
                    <label>
                      Long
                      <input
                        type="number"
                        min="0"
                        value={longCount}
                        onChange={(event) => setLongCount(Number(event.target.value))}
                      />
                    </label>
                  </div>
                </section>
              </form>

              <aside className="paperBlueprint" aria-label="Paper blueprint">
                <span className="canvasKicker">Blueprint</span>
                <h4>{paperTitle || "Untitled paper"}</h4>
                <p>
                  {paperClassName || "Class"} · {paperSubject || "Subject"} ·{" "}
                  {paperDifficulty}
                </p>
                <div className="blueprintReadiness">
                  <CheckCircle2 size={18} />
                  <span>
                    {paperDocumentId
                      ? "Ready to create an editable draft"
                      : "Choose material to continue"}
                  </span>
                </div>
                <div className="blueprintSource">
                  <FileText size={18} />
                  <span>
                    {paperDocumentId
                      ? documentNameById.get(Number(paperDocumentId)) ?? "Selected material"
                      : "Choose prepared material"}
                  </span>
                </div>
                <div className="blueprintGrid">
                  <div>
                    <strong>{mcqCount}</strong>
                    <span>MCQ</span>
                  </div>
                  <div>
                    <strong>{shortCount}</strong>
                    <span>Short</span>
                  </div>
                  <div>
                    <strong>{longCount}</strong>
                    <span>Long</span>
                  </div>
                </div>
                <div className="blueprintTotal">
                  <strong>{mcqCount + shortCount + longCount}</strong>
                  <span>questions planned</span>
                </div>
                <ul>
                  <li>{paperOutputTypeLabel(paperOutputType)}</li>
                  <li>{paperSourceModeLabel(paperSourceMode)}</li>
                  <li>{paperTopic.trim() || "No topic filter"}</li>
                </ul>
                <button
                  form="paper-create-form"
                  className="paperCreateButton"
                  disabled={!providerReady || busy === "paper-generate" || readyDocuments.length === 0}
                  title={!providerReady ? providerSetupMessage : "Create editable paper"}
                >
                  {busy === "paper-generate" ? <Loader2 className="spin" size={16} /> : null}
                  Create paper
                </button>
              </aside>
            </div>

            <div className="printableList">
              {printables.length > 0 ? (
                <div className="paperDraftQueueHeader">
                  <div>
                    <span className="canvasKicker">Draft queue</span>
                    <h4>Review generated papers</h4>
                  </div>
                  <span>{pluralize(printables.length, "paper")}</span>
                </div>
              ) : null}
              {printables.map((printable) => {
                const latestJob = latestPrintableJobBySetId.get(printable.id);
                const exportsForPrintable = printableExports[printable.id] ?? [];
                const paperError = printable.error_message
                  ? paperErrorMessage(printable.error_message)
                  : null;
                const isExporting =
                  printable.status === "exporting" ||
                  latestJob?.status === "queued" ||
                  latestJob?.status === "running";
                const hasSections = hasPrintableSections(printable);
                const isExpanded = expandedPrintableId === printable.id;
                const sectionCount = hasSections ? printable.content.sections.length : 0;
                const questionCount = hasSections
                  ? printable.content.sections.reduce(
                      (total, section) => total + section.questions.length,
                      0,
                    )
                  : 0;
                return (
                  <article key={printable.id} className="printableDraft">
                    <div className="printableHeader">
                      <div>
                        <span className={`status ${printable.status}`}>{statusLabel(printable.status)}</span>
                        <h4>{printable.title}</h4>
                      </div>
                      <div className="actions">
                        {hasSections ? (
                          <button
                            type="button"
                            className="draftToggleButton"
                            onClick={() =>
                              setExpandedPrintableId((current) =>
                                current === printable.id ? null : printable.id,
                              )
                            }
                          >
                            {isExpanded ? "Close editor" : "Edit draft"}
                          </button>
                        ) : null}
                        {isExpanded ? (
                          <button
                            onClick={() => void onSavePrintable(printable)}
                            disabled={!hasSections || busy === `paper-save-${printable.id}`}
                          >
                            Save Changes
                          </button>
                        ) : null}
                        <button
                          onClick={() => void onExportPrintable(printable.id)}
                          disabled={
                            !hasSections ||
                            isExporting ||
                            busy === `paper-export-${printable.id}`
                          }
                        >
                          Download Teacher Pack
                        </button>
                      </div>
                    </div>

                    {paperError ? (
                      <div className="paperError" role="status">
                        <AlertTriangle size={18} />
                        <div>
                          <strong>{paperError.title}</strong>
                          <span>{paperError.detail}</span>
                        </div>
                      </div>
                    ) : null}

                    {hasSections && !isExpanded ? (
                      <div className="paperDraftSummary" aria-label={`Draft summary for ${printable.title}`}>
                        <div>
                          <FileText size={20} />
                          <span>{pluralize(sectionCount, "section")}</span>
                        </div>
                        <div>
                          <ClipboardList size={20} />
                          <span>{pluralize(questionCount, "question")}</span>
                        </div>
                        <div>
                          <CheckCircle2 size={20} />
                          <span>Ready to review</span>
                        </div>
                      </div>
                    ) : null}

                    {hasSections && isExpanded ? (
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
                    ) : !hasSections && !paperError ? (
                      <div className="paperDraftState pending">
                        <Loader2 className={isExporting ? "spin" : ""} size={22} />
                        <h3>Creating paper</h3>
                        <p>You can keep working here while StudyGraph prepares the draft.</p>
                      </div>
                    ) : null}

                    {exportsForPrintable.length > 0 ? (
                      <div className="exportLinks">
                        {exportsForPrintable.map((paperExport) => (
                          <a
                            key={paperExport.id}
                            href={apiUrl(
                              `/api/printables/${printable.id}/exports/${paperExport.id}`,
                            )}
                          >
                            Download {paperExport.export_type.replace(/_/g, " ")}
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
                  <p>Create a draft, edit it here, then download it when it is ready for class.</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="settingsStudio">
            <article className="panel preferencePanel">
              <div className="settingsPanelHeader">
                <span className="canvasKicker">Studio preferences</span>
                <h3>Make StudyGraph comfortable</h3>
                <p>Appearance choices are saved on this device and apply across the workspace.</p>
              </div>

              <section className="themePreview" aria-label="Theme preview">
                <div className="themePreviewTop">
                  <span>{appTheme === "light" ? "Light workspace" : "Dark workspace"}</span>
                  <strong>
                    {textScale === "standard"
                      ? "Standard text"
                      : textScale === "comfortable"
                        ? "Comfort text"
                        : "Large text"}
                  </strong>
                </div>
                <div className="themePreviewCard">
                  <span className="themePreviewKicker">Answer preview</span>
                  <p>StudyGraph keeps answers tied to your material across long sessions.</p>
                  <div className="themePreviewChips">
                    <span>Material ready</span>
                    <span>{highContrast ? "High contrast" : "Standard contrast"}</span>
                  </div>
                </div>
              </section>

              <div className="preferenceGroup" aria-label="Theme preference">
                <div>
                  <strong>Theme</strong>
                  <span>Choose the workspace tone for reading and editing.</span>
                </div>
                <div className="preferenceChoices">
                  <button
                    type="button"
                    className={appTheme === "light" ? "active" : ""}
                    aria-pressed={appTheme === "light"}
                    onClick={() => setAppTheme("light")}
                  >
                    <Sun size={16} />
                    Light
                  </button>
                  <button
                    type="button"
                    className={appTheme === "dark" ? "active" : ""}
                    aria-pressed={appTheme === "dark"}
                    onClick={() => setAppTheme("dark")}
                  >
                    <Moon size={16} />
                    Dark
                  </button>
                </div>
              </div>

              <div className="preferenceGroup" aria-label="Reading size preference">
                <div>
                  <strong>Reading size</strong>
                  <span>Adjust text size for longer study sessions.</span>
                </div>
                <div className="preferenceChoices three">
                  {(["standard", "comfortable", "large"] as TextScale[]).map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      className={textScale === scale ? "active" : ""}
                      aria-pressed={textScale === scale}
                      onClick={() => setTextScale(scale)}
                    >
                      {scale === "standard"
                        ? "Standard"
                        : scale === "comfortable"
                          ? "Comfort"
                          : "Large"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="preferenceGroup" aria-label="Contrast preference">
                <div>
                  <strong>Contrast</strong>
                  <span>Use stronger boundaries for controls and study content.</span>
                </div>
                <button
                  type="button"
                  className={`preferenceToggle${highContrast ? " active" : ""}`}
                  aria-pressed={highContrast}
                  onClick={() => setHighContrast((current) => !current)}
                >
                  <Accessibility size={16} />
                  {highContrast ? "High contrast on" : "High contrast off"}
                </button>
              </div>

              <div className="preferenceSavedState" role="status">
                <CheckCircle2 size={16} />
                <span>Saved on this device</span>
              </div>
            </article>

            <article className="panel connectionPanel">
              <div className="settingsPanelHeader">
                <span className="canvasKicker">System readiness</span>
                <h3>Learning engine</h3>
                <p>These checks show whether answers, study sets, and papers can use prepared material.</p>
              </div>
              <dl className="readinessList">
                <dt>Status</dt>
                <dd className={settings?.api_key_configured ? "configured" : "missing"}>
                  {settings?.api_key_configured ? "Connected" : "Not connected"}
                </dd>
                <dt>Answers</dt>
                <dd>{settings?.chat_model ?? "Not available"}</dd>
                <dt>Material search</dt>
                <dd>{settings?.embedding_model ?? "Not available"}</dd>
              </dl>
              <div className="readinessPulse" aria-label="Workspace readiness summary">
                <div>
                  <strong>{settings?.api_key_configured ? "Ready" : "Needs setup"}</strong>
                  <span>
                    {settings?.api_key_configured
                      ? "Answers, study sets, and papers can use prepared material."
                      : "Connect the learning engine to unlock answers and generated outputs."}
                  </span>
                </div>
              </div>
              <button type="button" className="recheckButton" onClick={() => void refresh()}>
                <RefreshCcw size={16} />
                Recheck
              </button>
            </article>
          </section>
        ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
