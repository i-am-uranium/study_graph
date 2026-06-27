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
    if (url.endsWith("/api/documents") && init?.method === "POST") {
      const file = init.body instanceof FormData ? init.body.get("file") : null;
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

function primaryNav() {
  return within(screen.getByRole("navigation", { name: "Primary workspace" }));
}

function clickPrimaryNav(label: string) {
  fireEvent.click(primaryNav().getByRole("button", { name: label }));
}

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("opens on the StudyGraph workspace", async () => {
    stubApi(true);
    render(<App />);

    expect(await screen.findByText("StudyGraph")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /upload/i }).length).toBeGreaterThan(0);
  });

  it("uploads material when a file is dropped on the workspace upload target", async () => {
    stubApi(true);
    render(<App />);

    const uploadTarget = await screen.findByRole("button", { name: "Upload" });
    const file = new File(["lesson notes"], "drop-notes.pdf", { type: "application/pdf" });

    fireEvent.drop(uploadTarget, {
      dataTransfer: {
        files: [file],
        types: ["Files"],
      },
    });

    expect(await screen.findByText("drop-notes.pdf")).toBeInTheDocument();
  });

  it("shows learning support setup guidance when the connection is missing", async () => {
    stubApi(false);
    render(<App />);

    expect(await screen.findByText("Learning support is not connected")).toBeInTheDocument();
    expect(screen.getByText("Connect learning support before using this action.")).toBeInTheDocument();
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
    expect(
      screen.getByText("Open StudyGraph on this device to sync material, chats, and study sets."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try reconnecting" })).toBeInTheDocument();
    expect(screen.queryByText("StudyGraph is not connected. Start StudyGraph, then refresh.")).not.toBeInTheDocument();
  });

  it("lets users inspect a local sample workspace without the backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    render(<App />);

    expect(await screen.findByRole("status")).toHaveTextContent("Offline workspace");
    fireEvent.click(screen.getByRole("button", { name: "Explore sample" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getAllByText("Sample lesson - Photosynthesis.md").length).toBeGreaterThan(0);
    expect(screen.getByText("Sample workspace")).toBeInTheDocument();
    const lessonBrief = screen.getByRole("button", { name: "Open summary" });
    expect(lessonBrief).toBeEnabled();

    fireEvent.click(lessonBrief);

    expect(await screen.findByRole("heading", { name: "Photosynthesis lesson brief" })).toBeInTheDocument();
    expect(screen.getByText("Lesson goals")).toBeInTheDocument();
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

    expect(await screen.findByRole("heading", { name: "Material" })).toBeInTheDocument();
    expect(screen.getAllByText("physics.pdf").length).toBeGreaterThan(0);
    expect(screen.getAllByText("chemistry.pdf").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Waiting").length).toBeGreaterThan(0);
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
          {
            document_id: 1,
            chunk_id: 8,
            chunk_index: 4,
            filename: "physics.pdf",
            text: "Objects fall because gravity accelerates them toward Earth.",
            metadata: {},
            score: 0.88,
          },
        ],
        confidence_notes: ["Answer grounded in cited chunks."],
      },
    });
    render(<App />);

    clickPrimaryNav("Workspace");
    const textbox = await screen.findByPlaceholderText(
      "Ask a question, compare notes, or request examples...",
    );
    fireEvent.change(textbox, { target: { value: "What does gravity do?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Gravity pulls objects toward Earth.")).toBeInTheDocument();
    const evidence = screen.getByLabelText("Answer sources");
    expect(evidence).toHaveTextContent("From your files");
    expect(within(evidence).getAllByText("physics.pdf")).toHaveLength(1);
    expect(screen.getByText("References used")).toBeInTheDocument();
    expect(screen.getByText("Answer grounded in cited chunks.")).toBeInTheDocument();
  });

  it("toggles dark mode across the workspace", async () => {
    stubApi(true);
    const { container } = render(<App />);

    expect(await screen.findByText("StudyGraph")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dark mode" }));

    expect(container.querySelector(".appShell")).toHaveClass("theme-dark");
    expect(screen.getByRole("button", { name: "Light mode" })).toBeInTheDocument();
  });

  it("keeps theme preferences after a refresh", async () => {
    stubApi(true);
    const firstRender = render(<App />);

    expect(await screen.findByText("StudyGraph")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dark mode" }));
    fireEvent.click(screen.getByRole("button", { name: "High contrast" }));
    fireEvent.click(screen.getByRole("button", { name: "Text size" }));
    firstRender.unmount();

    const secondRender = render(<App />);

    expect(await screen.findByText("StudyGraph")).toBeInTheDocument();
    expect(secondRender.container.querySelector(".appShell")).toHaveClass("theme-dark");
    expect(secondRender.container.querySelector(".appShell")).toHaveClass("contrast-high");
    expect(secondRender.container.querySelector(".appShell")).toHaveClass("text-comfortable");
  });

  it("exposes first-class appearance controls in Settings", async () => {
    stubApi(true);
    const { container } = render(<App />);

    expect(await screen.findByText("StudyGraph")).toBeInTheDocument();
    clickPrimaryNav("Settings");

    expect(screen.getByText("Studio preferences")).toBeInTheDocument();
    expect(screen.getByLabelText("Theme preference")).toBeInTheDocument();
    expect(screen.getByLabelText("Reading size preference")).toBeInTheDocument();
    expect(screen.getByLabelText("Contrast preference")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    fireEvent.click(screen.getByRole("button", { name: "High contrast off" }));

    expect(container.querySelector(".appShell")).toHaveClass("theme-dark");
    expect(container.querySelector(".appShell")).toHaveClass("text-large");
    expect(container.querySelector(".appShell")).toHaveClass("contrast-high");
  });

  it("opens on one Workspace with chat, upload, and persona controls", async () => {
    stubApi(true);
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Learning canvas" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Material" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No prepared files" })).toBeInTheDocument();
    expect(screen.getByLabelText("Workspace command center")).toBeInTheDocument();
    expect(screen.getByLabelText("Workspace flow")).toHaveTextContent("AddPrepareAskCreate");
    expect(screen.getByLabelText("Learning session pulse")).toHaveTextContent(
      "Add material to begin",
    );
    expect(screen.getByLabelText("Next workspace step")).toHaveTextContent(
      "Start with a file",
    );
    expect(screen.queryByLabelText("Study flow progress")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Conversation history")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add material" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore sample" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Student view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Teacher view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Admin view" })).toBeInTheDocument();
    expect(primaryNav().getByRole("button", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask AI" })).not.toBeInTheDocument();
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

  it("shows only useful actions when class material is already ready", async () => {
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

    clickPrimaryNav("Workspace");
    expect((await screen.findAllByText("production_rag_quiz.pdf")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Prepare" })).not.toBeInTheDocument();
    const moves = screen.getByLabelText("Teaching modes composer suggestions");
    expect(within(moves).getByRole("button", { name: "Check understanding" })).toBeEnabled();
    expect(within(moves).getByRole("button", { name: "Exit ticket" })).toBeEnabled();
  });

  it("renders Workspace as one learning canvas instead of duplicate panels", async () => {
    stubApi(true, {
      documents: [
        {
          id: 1,
          filename: "lesson-notes.pdf",
          content_type: "application/pdf",
          status: "ready",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    const { container } = render(<App />);

    clickPrimaryNav("Workspace");

    expect(await screen.findByLabelText("Conversation history")).toBeInTheDocument();
    const learningCanvas = container.querySelector(".learningCanvas");
    const canvasRail = container.querySelector(".canvasRail");
    const canvasCenter = container.querySelector(".canvasCenter");

    expect(learningCanvas).not.toBeNull();
    expect(canvasRail).not.toBeNull();
    expect(canvasCenter).not.toBeNull();
    expect(container.querySelector(".canvasInsight")).toBeNull();
    expect(container.querySelector(".askPanel")).toBeNull();
    expect(container.querySelector(".materialLibrary")).toBeNull();
  });

  it("shows the learning flow inside the Workspace mission", async () => {
    stubApi(true, {
      documents: [
        {
          id: 1,
          filename: "lesson-notes.pdf",
          content_type: "application/pdf",
          status: "ready",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    const mission = await screen.findByLabelText("Next workspace step");
    expect(mission).toHaveTextContent("Guide the lesson");
    expect(screen.getByText("Ready when you are")).toBeInTheDocument();
    expect(screen.getByLabelText("Selected ready files")).toHaveTextContent("lesson-notes.pdf");
    const moves = screen.getByLabelText("Teaching modes composer suggestions");
    expect(within(moves).getByRole("button", { name: "Check understanding" })).toBeInTheDocument();
    expect(within(moves).getByRole("button", { name: "Exit ticket" })).toBeInTheDocument();
  });

  it("adapts study modes by role and fills the learning composer", async () => {
    stubApi(true, {
      documents: [
        {
          id: 1,
          filename: "lesson-notes.pdf",
          content_type: "application/pdf",
          status: "ready",
          error_message: null,
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    const teacherMission = await screen.findByLabelText("Next workspace step");
    expect(teacherMission).toHaveTextContent("Guide the lesson");
    const teacherMoves = screen.getByLabelText("Teaching modes composer suggestions");
    expect(teacherMoves).toBeInTheDocument();
    fireEvent.click(within(teacherMoves).getByRole("button", { name: "Check understanding" }));
    expect(
      screen.getByPlaceholderText("Ask a question, compare notes, or request examples..."),
    ).toHaveValue("Create five checks for understanding with answer guidance.");

    expect(
      within(teacherMoves).getByRole("button", { name: "Check understanding" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Student view" }));
    const studentMoves = screen.getByLabelText("Study modes composer suggestions");
    expect(studentMoves).toBeInTheDocument();
    expect(within(studentMoves).getByRole("button", { name: "Explain" })).toBeInTheDocument();
    expect(within(studentMoves).getByRole("button", { name: "Practice" })).toBeInTheDocument();
    const mode = within(studentMoves).getByRole("button", {
      name: "Plan",
    });
    fireEvent.click(mode);

    expect(
      screen.getByPlaceholderText("Ask a question, compare notes, or request examples..."),
    ).toHaveValue("Make a 10-minute revision plan.");

    fireEvent.click(screen.getByRole("button", { name: "Admin view" }));
    const adminMoves = screen.getByLabelText("Oversight modes composer suggestions");
    expect(adminMoves).toBeInTheDocument();
    expect(within(adminMoves).getByRole("button", { name: "Class pulse" })).toBeInTheDocument();
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

    clickPrimaryNav("Workspace");
    fireEvent.click(await screen.findByRole("button", { name: "Prepare" }));

    expect(await screen.findByRole("button", { name: "Waiting" })).toBeDisabled();
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

    clickPrimaryNav("Workspace");
    const preparingButtons = await screen.findAllByRole("button", { name: "Preparing" });
    expect(preparingButtons.length).toBeGreaterThan(0);
    preparingButtons.forEach((button) => expect(button).toBeDisabled());
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
      // A document still ingesting keeps the 3s poll active.
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

    clickPrimaryNav("Workspace");

    // The newest conversation is auto-selected on first load.
    const savedConversation = await screen.findByRole("button", {
      name: "Open conversation: What is RAG?",
    });
    await waitFor(() => expect(savedConversation).toHaveClass("active"));
    await waitFor(() => {
      expect(intervalHandlers.length).toBeGreaterThan(0);
    });

    // Start a fresh chat — the old conversation should deselect.
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(savedConversation).not.toHaveClass("active");

    // A background poll must NOT yank the user back into the old conversation.
    await act(async () => {
      const handler = intervalHandlers[intervalHandlers.length - 1];
      if (typeof handler === "function") {
        handler();
      }
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Open conversation: What is RAG?" }),
      ).not.toHaveClass("active");
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

    clickPrimaryNav("Workspace");
    const summaryButton = await screen.findByRole("button", { name: "Open summary" });
    await waitFor(() =>
      expect(summaryButton).toHaveAttribute("title", "Open summary in Study Sets"),
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

    clickPrimaryNav("Workspace");
    const flashcardsButton = await screen.findByRole("button", { name: "Open flashcards" });
    await waitFor(() =>
      expect(flashcardsButton).toHaveAttribute("title", "Open flashcards in Study Sets"),
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

  it("loads a saved conversation in the Workspace", async () => {
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

    clickPrimaryNav("Workspace");

    expect(await screen.findByText("What is RAG?")).toBeInTheDocument();
    expect(screen.getAllByText("RAG uses retrieval to ground answers.").length).toBeGreaterThan(0);
    const nextSteps = screen.getByLabelText("Study next");
    expect(within(nextSteps).getByRole("button", { name: "Check me" })).toBeInTheDocument();
    expect(within(nextSteps).getByRole("button", { name: "Make practice" })).toBeInTheDocument();
    expect(within(nextSteps).getByRole("button", { name: "Save brief" })).toBeInTheDocument();
  });

  it("keeps saved conversation previews short in the Workspace rail", async () => {
    const longAnswer =
      "1. **Question:** What is the difference between scalability and performance? **Answer Guidance:** Scalability is about handling more load as resources are added. Performance is how quickly one request completes. This full answer should stay in the conversation, not the rail.";
    stubApi(true, {
      qaSessions: [
        {
          id: 7,
          title: "Scalability review",
          selected_document_ids: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:01:00Z",
          message_count: 2,
          last_message: longAnswer,
        },
      ],
      qaSessionDetails: {
        7: {
          id: 7,
          title: "Scalability review",
          selected_document_ids: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:01:00Z",
          messages: [],
        },
      },
    });
    render(<App />);

    const savedConversation = await screen.findByRole("button", {
      name: "Open conversation: Scalability review",
    });

    expect(savedConversation).toHaveTextContent("Scalability review");
    expect(savedConversation).toHaveTextContent("What is the difference");
    expect(savedConversation).not.toHaveTextContent("Answer Guidance");
    expect(savedConversation).not.toHaveTextContent("This full answer should stay");
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

    clickPrimaryNav("Workspace");

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

    clickPrimaryNav("Workspace");
    const textbox = await screen.findByPlaceholderText(
      "Ask a question, compare notes, or request examples...",
    );
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

    clickPrimaryNav("Study Sets");
    expect(await screen.findByRole("heading", { name: "Review queue" })).toBeInTheDocument();
    expect(screen.getByLabelText("Study set actions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cards" })).toBeInTheDocument();
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
    clickPrimaryNav("Study Sets");
    fireEvent.click(await screen.findByRole("button", { name: "Open reader for Dark reader notes" }));

    expect(await screen.findByRole("region", { name: "Reader mode" })).toHaveClass("dark");
  });

  it("previews another study set from the review queue", async () => {
    stubApi(true, {
      artifacts: [
        {
          id: 31,
          document_id: 1,
          artifact_type: "summary",
          title: "First notes",
          content: { summary: "First summary." },
          source_refs: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
        {
          id: 32,
          document_id: 1,
          artifact_type: "flashcards",
          title: "Second deck",
          content: { flashcards: [{ front: "Term", back: "Definition" }] },
          source_refs: [],
          created_at: "2026-06-12T00:00:00Z",
          updated_at: "2026-06-12T00:00:00Z",
        },
      ],
    });
    render(<App />);

    clickPrimaryNav("Study Sets");
    const focus = await screen.findByLabelText("Focused study set");
    expect(within(focus).getByRole("heading", { name: "First notes" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Preview Second deck" }));

    expect(within(focus).getByRole("heading", { name: "Second deck" })).toBeInTheDocument();
    expect(within(focus).getByLabelText("Flashcard practice")).toBeInTheDocument();
    const progress = within(focus).getByLabelText("Practice progress");
    expect(progress).toHaveTextContent("Try recall first");
    expect(progress).toHaveTextContent("1 / 1");
    expect(progress).toHaveTextContent("0 left");
    expect(within(focus).getByText("Term")).toBeInTheDocument();
    expect(within(focus).queryByText("Definition")).not.toBeInTheDocument();

    fireEvent.click(within(focus).getByRole("button", { name: "Reveal answer" }));

    expect(within(focus).getByText("Definition")).toBeInTheDocument();
    expect(progress).toHaveTextContent("Rate recall");
  });

  it("keeps review queue previews short", async () => {
    stubApi(true, {
      artifacts: [
        {
          id: 33,
          document_id: 1,
          artifact_type: "flashcards",
          title: "Long deck",
          content: {
            flashcards: [
              {
                front:
                  "What is the difference between scalability and performance in system design?",
                back:
                  "Scalability means the system can handle more work as resources are added, while performance means a single request is fast. This long explanation belongs in practice or reader mode, not the queue.",
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

    clickPrimaryNav("Study Sets");

    const queue = await screen.findByLabelText("Saved study sets");
    expect(queue).toHaveTextContent("What is the difference");
    expect(queue).not.toHaveTextContent("This long explanation belongs");
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

    clickPrimaryNav("Study Sets");
    fireEvent.click(await screen.findByRole("button", { name: "Open reader for RAG cards" }));

    expect(await screen.findByRole("region", { name: "Reader mode" })).toBeInTheDocument();
    expect(screen.getByText("What is hybrid search?")).toBeInTheDocument();
    expect(screen.getByText("Dense plus keyword retrieval.")).toBeInTheDocument();
  });

  it("queues a printable paper draft from Papers", async () => {
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

    clickPrimaryNav("Papers");
    expect(await screen.findByLabelText("Paper blueprint")).toBeInTheDocument();
    expect(screen.getByText("Paper studio")).toBeInTheDocument();
    const paperSteps = screen.getByLabelText("Paper setup steps");
    expect(within(paperSteps).getByRole("button", { name: "Source" })).toBeInTheDocument();
    expect(within(paperSteps).getByRole("button", { name: "Format" })).toBeInTheDocument();
    expect(within(paperSteps).getByRole("button", { name: "Classroom" })).toBeInTheDocument();
    expect(within(paperSteps).getByRole("button", { name: "Mix" })).toBeInTheDocument();
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

    expect(
      await screen.findByText("The paper draft needs to be regenerated."),
    ).toBeInTheDocument();
    expect(screen.getByText("Try creating the paper again.")).toBeInTheDocument();
    expect(screen.queryByText(/validation errors for PrintableContent/)).not.toBeInTheDocument();
    expect(screen.queryByText(/type=dict_type/)).not.toBeInTheDocument();
    expect(screen.queryByText("Creating paper")).not.toBeInTheDocument();
    expect(screen.queryByText("Paper needs a retry")).not.toBeInTheDocument();
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
});
