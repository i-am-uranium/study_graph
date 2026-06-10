import { describe, expect, it, vi } from "vitest";

import { apiUrl, listDocuments } from "../src/api";

describe("apiUrl", () => {
  it("does not duplicate /api when base URL already includes it", () => {
    expect(apiUrl("/api/documents", "/api")).toBe("/api/documents");
  });

  it("prefixes host-only API base URLs", () => {
    expect(apiUrl("/api/documents", "http://localhost:8000")).toBe(
      "http://localhost:8000/api/documents",
    );
  });
});

describe("listDocuments", () => {
  it("requests the document collection", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await listDocuments(fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/documents"), expect.any(Object));
  });
});
