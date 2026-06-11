import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../src/App";

function stubApi(apiKeyConfigured: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
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
      return {
        ok: true,
        status: 200,
        json: async () => [],
      };
    }),
  );
}

describe("App", () => {
  afterEach(() => {
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
});
