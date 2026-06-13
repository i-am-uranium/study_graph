import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    if (url.endsWith("/api/settings")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          provider: "openai-compatible",
          base_url: "https://api.openai.com/v1",
          chat_model: "gpt-4.1-mini",
          embedding_model: "text-embedding-3-small",
          api_key_configured: apiKeyConfigured,
          embedding_dimensions: 1536,
        }),
      };
    }
    if (url.endsWith("/api/documents")) {
      return {
        ok: true,
        status: 200,
        json: async () => documents,
      };
    }
    if (url.endsWith("/api/documents/ingestion-jobs")) {
      return {
        ok: true,
        status: 200,
        json: async () => ingestionJobs,
      };
    }
    const ingestMatch = url.match(/\/api\/documents\/(\d+)\/ingest$/);
    if (ingestMatch && init?.method === "POST") {
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
    if (url.endsWith("/api/study/artifacts")) {
      return {
        ok: true,
        status: 200,
        json: async () => artifacts,
      };
    }
    if (url.endsWith("/api/printables")) {
      if (init?.method === "POST") {
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
      return {
        ok: true,
        status: 200,
        json: async () => printables,
      };
    }
    if (url.endsWith("/api/printables/jobs")) {
      return {
        ok: true,
        status: 200,
        json: async () => printableJobs,
      };
    }
    const printablePatchMatch = url.match(/\/api\/printables\/(\d+)$/);
    if (printablePatchMatch && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
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
    if (printableExportListMatch && !init?.method) {
      return {
        ok: true,
        status: 200,
        json: async () => printableExports,
      };
    }
    const printableExportMatch = url.match(/\/api\/printables\/(\d+)\/export$/);
    if (printableExportMatch && init?.method === "POST") {
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
    if (url.endsWith("/api/qa/sessions")) {
      return {
        ok: true,
        status: 200,
        json: async () => qaSessions,
      };
    }
    const qaSessionMatch = url.match(/\/api\/qa\/sessions\/(\d+)$/);
    if (qaSessionMatch) {
      return {
        ok: true,
        status: 200,
        json: async () => qaSessionDetails[Number(qaSessionMatch[1])],
      };
    }
    if (url.endsWith("/api/qa/ask") && init?.method === "POST") {
      return {
        ok: true,
        status: 200,
        json: async () => askResponse,
      };
    }
    if (init?.method === "POST") {
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
    return {
      ok: true,
      status: 200,
      json: async () => [],
    };
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens on the StudyGraph workspace", async () => {
    stubApi(true);
    render(<App />);

    expect(await screen.findByText("StudyGraph")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
  });

  it("shows provider setup guidance when the API key is missing", async () => {
    stubApi(false);
    render(<App />);

    expect(await screen.findByText("Provider key missing")).toBeInTheDocument();
    expect(
      screen.getByText("Set OPENAI_API_KEY in .env and restart the API and worker."),
    ).toBeInTheDocument();
  });

  it("shows the learning workspace source status from existing data", async () => {
    stubApi(true, {
      documents: [
        {
          id: 1,
          filename: "physics.pdf",
          content_type: "application/pdf",
          status: "ready",
          error_message: null,
          created_at: "2026-06-13T00:00:00Z",
          updated_at: "2026-06-13T00:00:00Z",
        },
        {
          id: 2,
          filename: "chemistry.pdf",
          content_type: "application/pdf",
          status: "queued",
          error_message: null,
          created_at: "2026-06-13T00:00:00Z",
          updated_at: "2026-06-13T00:00:00Z",
        },
      ],
      artifacts: [
        {
          id: 10,
          document_id: 1,
          artifact_type: "summary",
          title: "Physics Summary",
          content: { summary: "Motion notes" },
          source_refs: [],
          created_at: "2026-06-13T00:00:00Z",
          updated_at: "2026-06-13T00:00:00Z",
        },
      ],
    });
    render(<App />);

    expect(await screen.findByText("Learning Workspace")).toBeInTheDocument();
    expect(screen.getByText("Source Map")).toBeInTheDocument();
    expect(screen.getByText("1 ready")).toBeInTheDocument();
    expect(screen.getByText("1 pending")).toBeInTheDocument();
    expect(screen.getByText("1 artifact")).toBeInTheDocument();
  });

  it("shows Citation Lens evidence after asking a question", async () => {
    stubApi(true, {
      askResponse: {
        session_id: 1,
        answer: "Gravity pulls objects toward Earth.",
        citations: [
          {
            document_id: 1,
            chunk_id: 7,
            chunk_index: 3,
            filename: "physics.pdf",
            text: "Gravity is the force that attracts objects toward Earth.",
            metadata: {},
            score: 0.91,
          },
        ],
        confidence_notes: ["Answer grounded in one cited chunk."],
      },
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "RAG Library" }));
    const textbox = await screen.findByPlaceholderText("Ask a follow-up about your study material...");
    fireEvent.change(textbox, { target: { value: "What does gravity do?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Gravity pulls objects toward Earth.")).toBeInTheDocument();
    expect(screen.getByText("Citation Lens")).toBeInTheDocument();
    expect(screen.getByText("physics.pdf")).toBeInTheDocument();
    expect(screen.getByText("Answer grounded in one cited chunk.")).toBeInTheDocument();
  });

  it("toggles dark mode across the workspace", async () => {
    stubApi(true);
    const { container } = render(<App />);

    expect(await screen.findByText("StudyGraph")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dark mode" }));

    expect(container.querySelector(".appShell")).toHaveClass("theme-dark");
    expect(screen.getByRole("button", { name: "Light mode" })).toBeInTheDocument();
  });

  it("opens on the adapter-first Study Desk with persona controls and preview modules", async () => {
    stubApi(true);
    render(<App />);

    expect(await screen.findByRole("button", { name: "Study Desk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Student view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Teacher view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Admin view" })).toBeInTheDocument();
    expect(screen.getByText("Platform previews")).toBeInTheDocument();
    expect(screen.getByText("Collaboration")).toBeInTheDocument();
    expect(screen.getByText("Assignments")).toBeInTheDocument();
    expect(screen.getAllByText("Requires API").length).toBeGreaterThan(0);
  });

  it("toggles high contrast and cycles text scale without backend calls", async () => {
    const fetchMock = stubApi(true);
    const { container } = render(<App />);

    expect(await screen.findByText("StudyGraph")).toBeInTheDocument();
    const initialCallCount = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "High contrast" }));
    expect(container.querySelector(".appShell")).toHaveClass("contrast-high");

    fireEvent.click(screen.getByRole("button", { name: "Text size" }));
    expect(container.querySelector(".appShell")).toHaveClass("text-comfortable");
    expect(fetchMock.mock.calls).toHaveLength(initialCallCount);
  });

  it("disables ingestion when a document is already ready", async () => {
    stubApi(true, {
      documents: [
        {
          id: 1,
          filename: "production_rag_quiz.pdf",
          content_type: "application/pdf",
          status: "ready",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "RAG Library" }));
    expect((await screen.findAllByText("production_rag_quiz.pdf")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Ingest" })).toBeDisabled();
  });

  it("queues ingestion as a job and shows the job id", async () => {
    stubApi(true, {
      documents: [
        {
          id: 1,
          filename: "production_rag_quiz.pdf",
          content_type: "application/pdf",
          status: "failed",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "RAG Library" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ingest" }));

    expect(await screen.findByText("Job #42 · queued")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Queued" })).toBeDisabled();
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
      documents: [
        {
          id: 1,
          filename: "production_rag_quiz.pdf",
          content_type: "application/pdf",
          status: "queued",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
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

    fireEvent.click(await screen.findByRole("button", { name: "RAG Library" }));
    expect(await screen.findByText("Job #41 · running")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/api/documents")),
      ).toHaveLength(1);
    });
    await waitFor(() => {
      expect(intervalHandlers.length).toBeGreaterThan(0);
    });

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

  it("opens an existing summary instead of requesting generation again", async () => {
    const fetchMock = stubApi(true, {
      documents: [
        {
          id: 1,
          filename: "production_rag_quiz.pdf",
          content_type: "application/pdf",
          status: "ready",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
      artifacts: [
        {
          id: 10,
          document_id: 1,
          artifact_type: "summary",
          title: "Existing summary",
          content: { summary: "Already generated." },
          source_refs: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "RAG Library" }));
    const summaryButton = await screen.findByRole("button", { name: "Summary" });
    await waitFor(() =>
      expect(summaryButton).toHaveAttribute("title", "Open summary in Study Artifacts"),
    );
    fireEvent.click(summaryButton);

    expect(await screen.findByText("Existing summary")).toBeInTheDocument();
    expect(screen.getByText("Already generated.")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/study/summaries"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("opens existing flashcards instead of requesting generation again", async () => {
    const fetchMock = stubApi(true, {
      documents: [
        {
          id: 1,
          filename: "production_rag_quiz.pdf",
          content_type: "application/pdf",
          status: "ready",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
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

    fireEvent.click(await screen.findByRole("button", { name: "RAG Library" }));
    const flashcardsButton = await screen.findByRole("button", { name: "Flashcards" });
    await waitFor(() =>
      expect(flashcardsButton).toHaveAttribute("title", "Open flashcards in Study Artifacts"),
    );
    fireEvent.click(flashcardsButton);

    expect(await screen.findByText("Existing flashcards")).toBeInTheDocument();
    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(screen.getByText("Answer")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/study/flashcards"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("loads a saved conversation in the Ask section", async () => {
    stubApi(true, {
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

    fireEvent.click(await screen.findByRole("button", { name: "RAG Library" }));

    expect(await screen.findByText("What is RAG?")).toBeInTheDocument();
    expect(screen.getAllByText("RAG uses retrieval to ground answers.").length).toBeGreaterThan(0);
  });

  it("renders assistant conversation text with rich formatting", async () => {
    stubApi(true, {
      qaSessions: [
        {
          id: 6,
          title: "Explain RAG details",
          selected_document_ids: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:01:00Z",
          message_count: 2,
          last_message: "Formatted answer",
        },
      ],
      qaSessionDetails: {
        6: {
          id: 6,
          title: "Explain RAG details",
          selected_document_ids: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:01:00Z",
          messages: [
            {
              id: 10,
              session_id: 6,
              role: "user",
              content: "Explain RAG details",
              citations: [],
              confidence_notes: [],
              created_at: "2026-06-12T00:00:00Z",
            },
            {
              id: 11,
              session_id: 6,
              role: "assistant",
              content:
                "Key aspects include:\n\n- **Retrieval of Evidence:** Finds supporting chunks.\n- **Hybrid Search:** Combines dense and keyword retrieval.\n\nUse `top-k` carefully.",
              citations: [],
              confidence_notes: [],
              created_at: "2026-06-12T00:01:00Z",
            },
          ],
        },
      },
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "RAG Library" }));

    expect(await screen.findByText("Retrieval of Evidence:")).toHaveProperty("tagName", "STRONG");
    expect(screen.getByText("Hybrid Search:")).toHaveProperty("tagName", "STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("top-k")).toHaveProperty("tagName", "CODE");
  });

  it("continues the active conversation when asking a follow-up", async () => {
    const fetchMock = stubApi(true, {
      documents: [
        {
          id: 1,
          filename: "production_rag_quiz.pdf",
          content_type: "application/pdf",
          status: "ready",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
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

    fireEvent.click(await screen.findByRole("button", { name: "RAG Library" }));
    const textbox = await screen.findByPlaceholderText("Ask a follow-up about your study material...");
    fireEvent.change(textbox, { target: { value: "What is hybrid search?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Hybrid search combines dense and keyword retrieval.")).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole("button", { name: "Study Artifacts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open reader for Retrieval notes" }));

    const reader = await screen.findByRole("region", { name: "Reader mode" });
    expect(reader).toHaveClass("readerMode");
    expect(screen.getByText("Retrieval notes")).toBeInTheDocument();
    expect(screen.getByText("RAG retrieves evidence before answering.")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Dark mode" })[0]);

    expect(reader).toHaveClass("dark");
  });

  it("opens reader mode using the active app theme", async () => {
    stubApi(true, {
      artifacts: [
        {
          id: 22,
          document_id: 1,
          artifact_type: "summary",
          title: "Dark reader notes",
          content: { summary: "Reader should use the active theme." },
          source_refs: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Dark mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Study Artifacts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open reader for Dark reader notes" }));

    expect(await screen.findByRole("region", { name: "Reader mode" })).toHaveClass("dark");
  });

  it("renders flashcards inside reader mode", async () => {
    stubApi(true, {
      artifacts: [
        {
          id: 21,
          document_id: 1,
          artifact_type: "flashcards",
          title: "RAG cards",
          content: { flashcards: [{ front: "What is hybrid search?", back: "Dense plus keyword retrieval." }] },
          source_refs: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Study Artifacts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open reader for RAG cards" }));

    expect(await screen.findByRole("region", { name: "Reader mode" })).toBeInTheDocument();
    expect(screen.getByText("What is hybrid search?")).toBeInTheDocument();
    expect(screen.getByText("Dense plus keyword retrieval.")).toBeInTheDocument();
  });

  it("queues a printable paper draft from Paper Builder", async () => {
    const fetchMock = stubApi(true, {
      documents: [
        {
          id: 1,
          filename: "science.pdf",
          content_type: "application/pdf",
          status: "ready",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Paper Builder" }));
    fireEvent.change(await screen.findByLabelText("Paper title"), {
      target: { value: "Science Paper" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Draft" }));

    expect(await screen.findByText("Job #55 · generate draft · queued")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/printables",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("edits a printable draft and queues PDF export", async () => {
    const fetchMock = stubApi(true, {
      documents: [
        {
          id: 1,
          filename: "science.pdf",
          content_type: "application/pdf",
          status: "ready",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
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

    fireEvent.click(await screen.findByRole("button", { name: "Paper Builder" }));
    const prompt = await screen.findByDisplayValue("What is photosynthesis?");
    fireEvent.change(prompt, { target: { value: "Define photosynthesis." } });
    fireEvent.click(screen.getByRole("button", { name: "Save Draft Edits" }));
    fireEvent.click(await screen.findByRole("button", { name: "Export Teacher Pack" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/printables/30",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/printables/30/export",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
