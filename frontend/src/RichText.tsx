import type { ReactNode } from "react";

type Block =
  | { type: "heading"; level: 2 | 3 | 4; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "divider" }
  | { type: "paragraph"; text: string };

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a key={`${keyPrefix}-link-${tokenIndex}`} href={match[3]}>
          {match[2]}
        </a>,
      );
    } else if (match[4]) {
      nodes.push(<strong key={`${keyPrefix}-strong-${tokenIndex}`}>{match[4]}</strong>);
    } else if (match[5]) {
      nodes.push(<code key={`${keyPrefix}-code-${tokenIndex}`}>{match[5]}</code>);
    } else if (match[6]) {
      nodes.push(<em key={`${keyPrefix}-em-${tokenIndex}`}>{match[6]}</em>);
    }

    lastIndex = pattern.lastIndex;
    tokenIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let codeLanguage = "";
  let codeLines: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    paragraphLines.length = 0;
  }

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push({ type: "list", ordered: listOrdered, items: listItems });
    listItems = [];
  }

  for (const rawLine of content.replace(/\r\n/g, "\n").split("\n")) {
    if (codeLines.length > 0 || rawLine.trim().startsWith("```")) {
      const fence = rawLine.trim().match(/^```([\w-]*)\s*$/);
      if (fence && codeLines.length === 0) {
        flushParagraph();
        flushList();
        codeLanguage = fence[1] ?? "";
        codeLines = [""];
        continue;
      }

      if (fence) {
        blocks.push({ type: "code", language: codeLanguage, text: codeLines.slice(1).join("\n") });
        codeLanguage = "";
        codeLines = [];
        continue;
      }

      codeLines.push(rawLine);
      continue;
    }

    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: heading[1].length === 1 ? 2 : heading[1].length === 2 ? 3 : 4,
        text: heading[2],
      });
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "divider" });
      continue;
    }

    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", text: quote[1] });
      continue;
    }

    const unorderedItem = line.match(/^[-*]\s+(.+)$/);
    const orderedItem = line.match(/^\d+[.)]\s+(.+)$/);
    if (unorderedItem || orderedItem) {
      flushParagraph();
      const ordered = Boolean(orderedItem);
      if (listItems.length > 0 && listOrdered !== ordered) {
        flushList();
      }
      listOrdered = ordered;
      listItems.push((unorderedItem ?? orderedItem)?.[1] ?? line);
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  if (codeLines.length > 0) {
    blocks.push({ type: "code", language: codeLanguage, text: codeLines.slice(1).join("\n") });
  }
  return blocks;
}

export function RichText({ content, className = "" }: { content: string; className?: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className={className ? `richText ${className}` : "richText"}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Heading = `h${block.level}` as "h2" | "h3" | "h4";
          return <Heading key={index}>{parseInline(block.text, `heading-${index}`)}</Heading>;
        }

        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{parseInline(item, `list-${index}-${itemIndex}`)}</li>
              ))}
            </List>
          );
        }

        if (block.type === "quote") {
          return <blockquote key={index}>{parseInline(block.text, `quote-${index}`)}</blockquote>;
        }

        if (block.type === "code") {
          return (
            <pre key={index} data-language={block.language || undefined}>
              <code>{block.text}</code>
            </pre>
          );
        }

        if (block.type === "divider") {
          return <hr key={index} />;
        }

        return <p key={index}>{parseInline(block.text, `paragraph-${index}`)}</p>;
      })}
    </div>
  );
}
