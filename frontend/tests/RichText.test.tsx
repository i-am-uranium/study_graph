import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RichText } from "../src/RichText";

describe("RichText", () => {
  it("renders study markdown with semantic sections, quotes, and code blocks", () => {
    render(
      <RichText
        content={[
          "## Key idea",
          "",
          "> Review this before the assignment.",
          "",
          "1. Read the **chapter notes**.",
          "2. Run `practice mode`.",
          "",
          "```txt",
          "score = correct / total",
          "```",
          "",
          "---",
        ].join("\n")}
      />,
    );

    expect(screen.getByRole("heading", { name: "Key idea", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Review this before the assignment.").tagName).toBe("BLOCKQUOTE");
    expect(screen.getByText("chapter notes").tagName).toBe("STRONG");
    expect(screen.getByText("practice mode").tagName).toBe("CODE");
    expect(screen.getByText("score = correct / total").closest("pre")).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });
});
