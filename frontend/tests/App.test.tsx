import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../src/App";

function stubApi(
  apiKeyConfigured: boolean,
  options: {
    documents?: unknown[];
    ingestionJobs?: unknown[];
    printables?: unknown[];
    printableJobs?: unknown[];
    printableExports?: unknown[];
    artifacts?: unknown[];
    qaSessions?: unknown[];
    qaSessionDetails?: Record<number, unknown>;
    askResponse?: unknown;
  } = {},
) {
  const documents = options.documents ?? [];
  const ingestionJobs = options.ingestionJobs ?? [];
  const printables = options.printables ?? [];
  const printableJobs = options.printableJobs ?? [];
  const printableExports = options.printableExports ?? [];
  const artifacts = options.artifacts ?? [];
  const qaSessions = options.qaSessions ?? [];
  const qaSessionDetails = options.qaSessionDetails ?? {};
  const askResponse =
    options.askResponse ??
    ({
      session_id: 1,
      answer: "Generated answer",
      citations: [],
      confidence_notes: [],
    } as const);
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/settings")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          provider: "openai-compatible",
          base_url: "http://localhost:11434/v1",
          chat_model: "qwen3:8b",
          embedding_model: "qwen3-embedding:0.6b",
          api_key_configured: apiKeyConfigured,
          provider_ready: apiKeyConfigured,
          embedding_dimensions: 1024,
        }),
      };
    }
    if (url.endsWith("/api/documents") && method === "POST") {
      const file = init?.body instanceof FormData ? init.body.get("file") : null;
      const filename = file instanceof File ? file.name : "uploaded.pdf";
      return {
        ok: true,
        status: 200,
        json: async () => ({
          document: {
            id: 99,
            filename,
            content_type: file instanceof File ? file.type : "application/pdf",
            status: "uploaded",
            error_message: null,
            created_at: "2026-06-12T00:00:00Z",
            updated_at: "2026-06-12T00:00:00Z",
          },
        }),
      };
    }
    if (url.endsWith("/api/documents")) {
      return { ok: true, status: 200, json: async () => documents };
    }
    if (url.endsWith("/api/documents/ingestion-jobs")) {
      return { ok: true, status: 200, json: async () => ingestionJobs };
    }
    const ingestMatch = url.match(/\/api\/documents\/(\d+)\/ingest$/);
    if (ingestMatch && method === "POST") {
      return {
        ok: true,
        status: 202,
        json: async () => ({
          id: 42,
          document_id: Number(ingestMatch[1]),
          status: "queued",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
          started_at: null,
          completed_at: null,
        }),
      };
    }
    const documentDeleteMatch = url.match(/\/api\/documents\/(\d+)$/);
    if (documentDeleteMatch && method === "DELETE") {
      return { ok: true, status: 204, json: async () => undefined };
    }
    if (url.endsWith("/api/study/artifacts")) {
      return { ok: true, status: 200, json: async () => artifacts };
    }
    if (url.endsWith("/api/printables")) {
      if (method === "POST") {
        return {
          ok: true,
          status: 202,
          json: async () => ({
            printable: {
              id: 30,
              document_id: 1,
              title: "Generated paper",
              output_type: "teacher_pack",
              template: "formal_exam",
              status: "generating",
              error_message: null,
              config: {},
              content: {},
              source_refs: [],
              created_at: "2026-06-12T00:00:00Z",
              updated_at: "2026-06-12T00:00:00Z",
            },
            job: {
              id: 55,
              printable_set_id: 30,
              job_type: "generate_draft",
              status: "queued",
              payload: {},
              error_message: null,
              created_at: "2026-06-12T00:00:00Z",
              updated_at: "2026-06-12T00:00:00Z",
              started_at: null,
              completed_at: null,
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => printables };
    }
    if (url.endsWith("/api/printables/jobs")) {
      return { ok: true, status: 200, json: async () => printableJobs };
    }
    const printablePatchMatch = url.match(/\/api\/printables\/(\d+)$/);
    if (printablePatchMatch && method === "PATCH") {
      const body = JSON.parse(String(init?.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: Number(printablePatchMatch[1]),
          document_id: 1,
          title: "Science Paper",
          output_type: "teacher_pack",
          template: "formal_exam",
          status: "draft_ready",
          error_message: null,
          config: {},
          content: body.content,
          source_refs: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        }),
      };
    }
    const printableExportListMatch = url.match(/\/api\/printables\/(\d+)\/exports$/);
    if (printableExportListMatch && method === "GET") {
      return { ok: true, status: 200, json: async () => printableExports };
    }
    const printableExportMatch = url.match(/\/api\/printables\/(\d+)\/export$/);
    if (printableExportMatch && method === "POST") {
      return {
        ok: true,
        status: 202,
        json: async () => ({
          id: 56,
          printable_set_id: Number(printableExportMatch[1]),
          job_type: "export_pdf",
          status: "queued",
          payload: { export_type: "teacher_pack" },
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
          started_at: null,
          completed_at: null,
        }),
      };
    }
    const qaSessionDeleteMatch = url.match(/\/api\/qa\/sessions\/(\d+)$/);
    if (qaSessionDeleteMatch && method === "DELETE") {
      return { ok: true, status: 204, json: async () => undefined };
    }
    if (url.endsWith("/api/qa/sessions")) {
      return { ok: true, status: 200, json: async () => qaSessions };
    }
    const qaSessionMatch = url.match(/\/api\/qa\/sessions\/(\d+)$/);
    if (qaSessionMatch) {
      return {
        ok: true,
        status: 200,
        json: async () => qaSessionDetails[Number(qaSessionMatch[1])],
      };
    }
    if (url.endsWith("/api/qa/ask") && method === "POST") {
      return { ok: true, status: 200, json: async () => askResponse };
    }
    if (method === "POST") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 2,
          document_id: 1,
          artifact_type: url.includes("flashcards") ? "flashcards" : "summary",
          title: "Generated artifact",
          content: {},
          source_refs: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        }),
      };
    }
    return { ok: true, status: 200, json: async () => [] };
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

const readyDocument = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  filename: "physics.pdf",
  content_type: "application/pdf",
  status: "ready",
  error_message: null,
  created_at: "2026-06-12T00:00:00Z",
  updated_at: "2026-06-12T00:00:00Z",
  ...overrides,
});

function primaryNav() {
  return within(screen.getByRole("navigation", { name: "Primary workspace" }));
}

function clickPrimaryNav(label: string) {
  fireEvent.click(primaryNav().getByRole("button", { name: label }));
}

function library() {
  return within(screen.getByLabelText("Library and conversations"));
}

describe("App shell and workspace", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("opens on the three-zone StudyGraph workspace", async () => {
    stubApi(true);
    const { container } = render(<App />);

    expect(await screen.findByText("StudyGraph", { selector: ".sgBrandName" })).toBeInTheDocument();
    expect(primaryNav().getByRole("button", { name: "Workspace" })).toHaveClass("active");
    expect(screen.getByLabelText("Library and conversations")).toBeInTheDocument();
    expect(screen.getByLabelText("Document workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Study chat")).toBeInTheDocument();
    expect(screen.getByText("Ask StudyGraph")).toBeInTheDocument();
    expect(screen.getByText("Grounded in the active document")).toBeInTheDocument();
    expect(container.querySelector(".sgWorkspace")).not.toBeNull();
  });

  it("does not expose student / teacher / admin modes", async () => {
    stubApi(true, { documents: [readyDocument()] });
    render(<App />);

    await screen.findByLabelText("Document workspace");
    expect(screen.queryByRole("button", { name: "Teacher view" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Student view" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Admin view" })).not.toBeInTheDocument();
    expect(screen.queryByText("Teacher workspace")).not.toBeInTheDocument();
  });

  it("uploads material when a file is dropped on the library upload target", async () => {
    stubApi(true);
    render(<App />);

    await screen.findByLabelText("Library and conversations");
    const uploadTarget = library().getAllByRole("button", { name: "Upload material" })[0];
    const file = new File(["lesson notes"], "drop-notes.pdf", { type: "application/pdf" });

    fireEvent.drop(uploadTarget, {
      dataTransfer: { files: [file], types: ["Files"] },
    });

    expect(await library().findByText("drop-notes.pdf")).toBeInTheDocument();
  });

  it("shows learning support setup guidance when the connection is missing", async () => {
    stubApi(false);
    render(<App />);

    expect(await screen.findByText("Learning support is not connected")).toBeInTheDocument();
    expect(
      screen.getByText("Connect learning support before using this action."),
    ).toBeInTheDocument();
  });

  it("shows a recoverable offline workspace state when the backend is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    render(<App />);

    expect(await screen.findByRole("status")).toHaveTextContent("Offline workspace");
    expect(screen.getByRole("button", { name: "Try reconnecting" })).toBeInTheDocument();
    expect(
      screen.queryByText("StudyGraph is not connected. Start StudyGraph, then refresh."),
    ).not.toBeInTheDocument();
  });

  it("lets users explore a local sample workspace without the backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    render(<App />);

    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: "Explore sample" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getAllByText("Sample lesson - Photosynthesis.md").length).toBeGreaterThan(0);
    // The active document's summary renders as the reading surface.
    expect(await screen.findByText("Lesson goals")).toBeInTheDocument();
  });

  it("lists documents with their preparation status in the library", async () => {
    stubApi(true, {
      documents: [readyDocument(), readyDocument({ id: 2, filename: "chemistry.pdf", status: "queued" })],
    });
    render(<App />);

    const lib = library();
    expect(await lib.findByText("physics.pdf")).toBeInTheDocument();
    expect(lib.getByText("chemistry.pdf")).toBeInTheDocument();
    expect(lib.getAllByText("Ready").length).toBeGreaterThan(0);
    // "Waiting" appears as the queued document's status and its prepare pill.
    expect(lib.getAllByText("Waiting").length).toBeGreaterThan(0);
  });
});

describe("library collapse and sections", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("collapses the library into a useful nav rail and re-expands from it", async () => {
    stubApi(true, { documents: [readyDocument()] });
    const { container } = render(<App />);

    await screen.findByLabelText("Document workspace");
    const workspace = container.querySelector(".sgWorkspace");
    expect(workspace).not.toHaveClass("library-collapsed");

    fireEvent.click(screen.getByRole("button", { name: "Collapse library" }));
    expect(workspace).toHaveClass("library-collapsed");
    expect(screen.getByRole("button", { name: "Expand library" })).toBeInTheDocument();

    const rail = within(screen.getByLabelText("Collapsed library actions"));
    fireEvent.click(rail.getByRole("button", { name: "Conversations" }));
    expect(workspace).not.toHaveClass("library-collapsed");
  });

  it("collapses document and conversation sections independently", async () => {
    stubApi(true, { documents: [readyDocument()] });
    render(<App />);

    const documentsSection = within(await screen.findByLabelText("Documents section"));
    const documentsToggle = documentsSection.getByRole("button", { name: "Documents" });
    expect(documentsToggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(documentsToggle);
    expect(documentsToggle).toHaveAttribute("aria-expanded", "false");

    const conversationsSection = within(screen.getByLabelText("Conversations section"));
    const conversationsToggle = conversationsSection.getByRole("button", { name: "Conversations" });
    expect(conversationsToggle).toHaveAttribute("aria-expanded", "true");
    // Documents stays collapsed while conversations is independent.
    expect(documentsToggle).toHaveAttribute("aria-expanded", "false");
  });
});

describe("delete with confirmation", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("deletes a document after confirmation and updates the count", async () => {
    const fetchMock = stubApi(true, { documents: [readyDocument()] });
    render(<App />);

    const lib = library();
    await lib.findByText("physics.pdf");
    fireEvent.click(lib.getByRole("button", { name: "Delete physics.pdf" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete document?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).endsWith("/api/documents/1") && init?.method === "DELETE",
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(library().queryByRole("button", { name: "Delete physics.pdf" })).not.toBeInTheDocument(),
    );
    expect(
      library().getByText("No documents yet. Upload material to start a study session."),
    ).toBeInTheDocument();
  });

  it("cancels then confirms a conversation delete", async () => {
    const fetchMock = stubApi(true, {
      documents: [readyDocument()],
      qaSessions: [
        {
          id: 5,
          title: "What is RAG?",
          selected_document_ids: [1],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:01:00Z",
          message_count: 2,
          last_message: "RAG grounds answers in retrieval.",
        },
      ],
      qaSessionDetails: {
        5: {
          id: 5,
          title: "What is RAG?",
          selected_document_ids: [1],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:01:00Z",
          messages: [],
        },
      },
    });
    render(<App />);

    const lib = library();
    await lib.findByRole("button", { name: "Open conversation: What is RAG?" });

    fireEvent.click(lib.getByRole("button", { name: "Delete What is RAG? conversation" }));
    expect(within(screen.getByRole("dialog")).getByText("Delete conversation?")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      library().getByRole("button", { name: "Open conversation: What is RAG?" }),
    ).toBeInTheDocument();

    fireEvent.click(library().getByRole("button", { name: "Delete What is RAG? conversation" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).endsWith("/api/qa/sessions/5") && init?.method === "DELETE",
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(
        library().queryByRole("button", { name: "Open conversation: What is RAG?" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("closes the delete dialog on Escape and on backdrop click", async () => {
    stubApi(true, { documents: [readyDocument()] });
    const { container } = render(<App />);

    await library().findByText("physics.pdf");
    fireEvent.click(library().getByRole("button", { name: "Delete physics.pdf" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(library().getByRole("button", { name: "Delete physics.pdf" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(container.querySelector(".sgConfirmBackdrop") as Element);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("chat", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("answers a question and shows grounded source chips", async () => {
    stubApi(true, {
      documents: [readyDocument()],
      askResponse: {
        session_id: 1,
        answer: "Gravity pulls objects toward Earth.",
        citations: [
          {
            document_id: 1,
            chunk_id: 7,
            chunk_index: 3,
            filename: "physics.pdf",
            text: "Gravity attracts objects toward Earth.",
            metadata: {},
            score: 0.91,
          },
        ],
        confidence_notes: ["Answer grounded in cited chunks."],
      },
    });
    render(<App />);

    const textbox = await screen.findByPlaceholderText(
      "Ask a question, compare notes, or request examples...",
    );
    fireEvent.change(textbox, { target: { value: "What does gravity do?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Gravity pulls objects toward Earth.")).toBeInTheDocument();
    const sources = screen.getByLabelText("Answer sources");
    expect(within(sources).getByText("physics.pdf")).toBeInTheDocument();
  });

  it("continues the active conversation when asking a follow-up", async () => {
    const fetchMock = stubApi(true, {
      documents: [readyDocument()],
      qaSessions: [
        {
          id: 5,
          title: "What is RAG?",
          selected_document_ids: [1],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:01:00Z",
          message_count: 1,
          last_message: "RAG grounds answers.",
        },
      ],
      qaSessionDetails: {
        5: {
          id: 5,
          title: "What is RAG?",
          selected_document_ids: [1],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:01:00Z",
          messages: [
            {
              id: 1,
              session_id: 5,
              role: "user",
              content: "What is RAG?",
              citations: [],
              confidence_notes: [],
              created_at: "2026-06-12T00:00:00Z",
            },
          ],
        },
      },
      askResponse: {
        session_id: 5,
        answer: "Hybrid search combines dense and keyword retrieval.",
        citations: [],
        confidence_notes: [],
      },
    });
    render(<App />);

    const textbox = await screen.findByPlaceholderText(
      "Ask a question, compare notes, or request examples...",
    );
    fireEvent.change(textbox, { target: { value: "What is hybrid search?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("Hybrid search combines dense and keyword retrieval."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/qa/ask",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          question: "What is hybrid search?",
          document_ids: [1],
          session_id: 5,
        }),
      }),
    );
  });

  it("loads a saved conversation from the library", async () => {
    stubApi(true, {
      documents: [readyDocument()],
      qaSessions: [
        {
          id: 5,
          title: "What is RAG?",
          selected_document_ids: [1],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:01:00Z",
          message_count: 2,
          last_message: "RAG uses retrieval to ground answers.",
        },
      ],
      qaSessionDetails: {
        5: {
          id: 5,
          title: "What is RAG?",
          selected_document_ids: [1],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:01:00Z",
          messages: [
            {
              id: 1,
              session_id: 5,
              role: "user",
              content: "What is RAG?",
              citations: [],
              confidence_notes: [],
              created_at: "2026-06-12T00:00:00Z",
            },
            {
              id: 2,
              session_id: 5,
              role: "assistant",
              content: "RAG uses retrieval to ground answers.",
              citations: [],
              confidence_notes: [],
              created_at: "2026-06-12T00:01:00Z",
            },
          ],
        },
      },
    });
    render(<App />);

    fireEvent.click(
      await library().findByRole("button", { name: "Open conversation: What is RAG?" }),
    );

    const history = within(await screen.findByLabelText("Conversation history"));
    expect(await history.findByText("RAG uses retrieval to ground answers.")).toBeInTheDocument();
  });

  it("keeps a new chat fresh when a background poll fires", async () => {
    const intervalHandlers: TimerHandler[] = [];
    vi.spyOn(window, "setInterval").mockImplementation((handler: TimerHandler, timeout?: number) => {
      if (timeout === 3000) {
        intervalHandlers.push(handler);
      }
      return 1;
    });
    vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);
    stubApi(true, {
      documents: [readyDocument({ status: "queued" })],
      ingestionJobs: [
        {
          id: 41,
          document_id: 1,
          status: "running",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
          started_at: "2026-06-12T00:00:01Z",
          completed_at: null,
        },
      ],
      qaSessions: [
        {
          id: 5,
          title: "What is RAG?",
          selected_document_ids: [1],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:01:00Z",
          message_count: 2,
          last_message: "RAG uses retrieval to ground answers.",
        },
      ],
      qaSessionDetails: {
        5: {
          id: 5,
          title: "What is RAG?",
          selected_document_ids: [1],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:01:00Z",
          messages: [
            {
              id: 2,
              session_id: 5,
              role: "assistant",
              content: "RAG uses retrieval to ground answers.",
              citations: [],
              confidence_notes: [],
              created_at: "2026-06-12T00:01:00Z",
            },
          ],
        },
      },
    });
    render(<App />);

    const savedConversation = await library().findByRole("button", {
      name: "Open conversation: What is RAG?",
    });
    await waitFor(() => expect(savedConversation.closest(".sgThread")).toHaveClass("active"));
    await waitFor(() => expect(intervalHandlers.length).toBeGreaterThan(0));

    fireEvent.click(library().getByRole("button", { name: "New" }));
    expect(savedConversation.closest(".sgThread")).not.toHaveClass("active");

    await act(async () => {
      const handler = intervalHandlers[intervalHandlers.length - 1];
      if (typeof handler === "function") {
        handler();
      }
    });

    await waitFor(() =>
      expect(
        library()
          .getByRole("button", { name: "Open conversation: What is RAG?" })
          .closest(".sgThread"),
      ).not.toHaveClass("active"),
    );
  });
});

describe("appearance and theming", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("toggles dark mode across the workspace", async () => {
    stubApi(true);
    const { container } = render(<App />);

    expect(await screen.findByText("StudyGraph", { selector: ".sgBrandName" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dark mode" }));

    expect(container.querySelector(".appShell")).toHaveClass("theme-dark");
    expect(screen.getByRole("button", { name: "Light mode" })).toBeInTheDocument();
  });

  it("keeps theme preferences after a refresh", async () => {
    stubApi(true);
    const firstRender = render(<App />);

    expect(await screen.findByText("StudyGraph", { selector: ".sgBrandName" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dark mode" }));
    fireEvent.click(screen.getByRole("button", { name: "High contrast" }));
    fireEvent.click(screen.getByRole("button", { name: "Text size" }));
    firstRender.unmount();

    const secondRender = render(<App />);

    expect(await screen.findByText("StudyGraph", { selector: ".sgBrandName" })).toBeInTheDocument();
    expect(secondRender.container.querySelector(".appShell")).toHaveClass("theme-dark");
    expect(secondRender.container.querySelector(".appShell")).toHaveClass("contrast-high");
    expect(secondRender.container.querySelector(".appShell")).toHaveClass("text-comfortable");
  });

  it("exposes appearance controls in Settings", async () => {
    stubApi(true);
    const { container } = render(<App />);

    expect(await screen.findByText("StudyGraph", { selector: ".sgBrandName" })).toBeInTheDocument();
    clickPrimaryNav("Settings");

    expect(screen.getByText("Studio preferences")).toBeInTheDocument();
    expect(screen.getByLabelText("Theme preference")).toBeInTheDocument();
    expect(screen.getByLabelText("Reading size preference")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Large" }));

    expect(container.querySelector(".appShell")).toHaveClass("theme-dark");
    expect(container.querySelector(".appShell")).toHaveClass("text-large");
  });
});

describe("mobile workspace", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders bottom tabs defaulting to Read and switches to Chat from the top action", async () => {
    stubApi(true, { documents: [readyDocument()] });
    const { container } = render(<App />);

    const tabs = within(await screen.findByRole("navigation", { name: "Mobile workspace" }));
    expect(tabs.getByRole("button", { name: "Files" })).toBeInTheDocument();
    expect(tabs.getByRole("button", { name: "Read" })).toHaveAttribute("aria-pressed", "true");
    expect(tabs.getByRole("button", { name: "Chat" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ask chat" }));
    expect(container.querySelector(".sgWorkspace")).toHaveClass("mobile-show-chat");
    expect(tabs.getByRole("button", { name: "Chat" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("study sets and papers", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("opens the active document's flashcards without regenerating them", async () => {
    const fetchMock = stubApi(true, {
      documents: [readyDocument()],
      artifacts: [
        {
          id: 11,
          document_id: 1,
          artifact_type: "flashcards",
          title: "Existing flashcards",
          content: { flashcards: [{ front: "Question", back: "Answer" }] },
          source_refs: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Open flashcards" }));

    expect(await screen.findByText("Existing flashcards")).toBeInTheDocument();
    expect(screen.getByText("Question")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/study/flashcards"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("opens a summary in reader mode and supports dark mode", async () => {
    stubApi(true, {
      artifacts: [
        {
          id: 20,
          document_id: 1,
          artifact_type: "summary",
          title: "Retrieval notes",
          content: { summary: "RAG retrieves evidence before answering." },
          source_refs: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    clickPrimaryNav("Study Sets");
    expect(await screen.findByRole("heading", { name: "Review queue" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Open reader for Retrieval notes" }));

    const reader = await screen.findByRole("region", { name: "Reader mode" });
    expect(screen.getByText("RAG retrieves evidence before answering.")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Dark mode" })[0]);
    expect(reader).toHaveClass("dark");
  });

  it("queues a printable paper draft from Papers", async () => {
    const fetchMock = stubApi(true, { documents: [readyDocument({ filename: "science.pdf" })] });
    render(<App />);

    clickPrimaryNav("Papers");
    expect(await screen.findByLabelText("Paper blueprint")).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Paper title"), {
      target: { value: "Science Paper" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create paper" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8000/api/printables",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("shows a readable paper error instead of validation internals", async () => {
    stubApi(true, {
      documents: [readyDocument({ filename: "science.pdf" })],
      printables: [
        {
          id: 30,
          document_id: 1,
          title: "Science Paper",
          output_type: "teacher_pack",
          template: "formal_exam",
          status: "failed",
          error_message:
            "18 validation errors for PrintableContent sections.0.questions.0.source_refs.0 Input should be a valid dictionary [type=dict_type]",
          config: {},
          content: {},
          source_refs: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    clickPrimaryNav("Papers");
    expect(await screen.findByText("The paper draft needs to be regenerated.")).toBeInTheDocument();
    expect(screen.queryByText(/type=dict_type/)).not.toBeInTheDocument();
  });

  it("edits a printable draft and queues PDF export", async () => {
    const fetchMock = stubApi(true, {
      documents: [readyDocument({ filename: "science.pdf" })],
      printables: [
        {
          id: 30,
          document_id: 1,
          title: "Science Paper",
          output_type: "teacher_pack",
          template: "formal_exam",
          status: "draft_ready",
          error_message: null,
          config: {},
          content: {
            sections: [
              {
                title: "Section A",
                marks: 2,
                questions: [
                  {
                    id: "q1",
                    type: "short_answer",
                    prompt: "What is photosynthesis?",
                    options: [],
                    answer: "Plants make food using sunlight.",
                    marks: 2,
                    answer_space_lines: 3,
                    source_refs: [],
                  },
                ],
              },
            ],
          },
          source_refs: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    clickPrimaryNav("Papers");
    fireEvent.click(await screen.findByRole("button", { name: "Edit draft" }));
    const prompt = await screen.findByDisplayValue("What is photosynthesis?");
    fireEvent.change(prompt, { target: { value: "Define photosynthesis." } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Download Teacher Pack" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/printables/30",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/printables/30/export",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("polls while ingestion work is pending", async () => {
    const intervalHandlers: TimerHandler[] = [];
    vi.spyOn(window, "setInterval").mockImplementation((handler: TimerHandler, timeout?: number) => {
      if (timeout === 3000) {
        intervalHandlers.push(handler);
      }
      return 1;
    });
    vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);
    const fetchMock = stubApi(true, {
      documents: [readyDocument({ filename: "quiz.pdf", status: "queued" })],
      ingestionJobs: [
        {
          id: 41,
          document_id: 1,
          status: "running",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
          started_at: "2026-06-12T00:00:01Z",
          completed_at: null,
        },
      ],
    });
    render(<App />);

    const preparing = await library().findByRole("button", { name: "Preparing" });
    expect(preparing).toBeDisabled();
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/api/documents")),
      ).toHaveLength(1);
    });
    await waitFor(() => expect(intervalHandlers.length).toBeGreaterThan(0));

    await act(async () => {
      const handler = intervalHandlers[intervalHandlers.length - 1];
      if (typeof handler === "function") {
        handler();
      }
    });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/api/documents")),
      ).toHaveLength(2);
    });
  });
});
