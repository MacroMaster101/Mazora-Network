import React, { type ReactNode } from "react";

/**
 * Post bodies are stored as plain text and turned into React nodes here.
 *
 * This file never produces an HTML string and nothing in the forum calls
 * dangerouslySetInnerHTML. That is the whole security model: because the output
 * is React elements, anything in the body that looks like markup is escaped by
 * React as ordinary text without this parser needing to know about it.
 */
export type Block = { kind: "paragraph" | "quote" | "list" | "code"; lines: string[] };

export function parsePostBody(body: string): Block[] {
  const blocks: Block[] = [];
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1; // consume the closing fence, if present
      blocks.push({ kind: "code", lines: code });
      continue;
    }

    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quote.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push({ kind: "quote", lines: quote });
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push({ kind: "list", lines: items });
      continue;
    }

    if (line.trim() === "") { index += 1; continue; }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() !== "" && !isBlockStart(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ kind: "paragraph", lines: paragraph });
  }

  return blocks;
}

function isBlockStart(line: string): boolean {
  return line.startsWith("> ") || line.startsWith("- ") || line.trim().startsWith("```");
}

/** Only these two schemes are ever turned into a link. */
function isLinkable(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const TOKEN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|https?:\/\/\S+)/gi;

/** Inline markup for one line. Unbalanced markers fall through as literal text. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;

  while ((match = TOKEN.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith("**")) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith("*")) nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    else if (isLinkable(token)) {
      nodes.push(
        <a key={key} href={token} target="_blank" rel="noopener noreferrer" className="text-accent-bright hover:underline">
          {token}
        </a>,
      );
    } else nodes.push(token);

    cursor = match.index + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

export function renderPostBody(body: string): ReactNode {
  return parsePostBody(body).map((block, blockIndex) => {
    const key = `b${blockIndex}`;
    if (block.kind === "code") {
      return (
        <pre key={key} className="panel overflow-x-auto p-4 text-sm">
          <code>{block.lines.join("\n")}</code>
        </pre>
      );
    }
    if (block.kind === "quote") {
      return (
        <blockquote key={key} className="border-l-2 border-accent/50 pl-4 text-muted">
          {block.lines.map((line, i) => <p key={`${key}-${i}`}>{inline(line, `${key}-${i}`)}</p>)}
        </blockquote>
      );
    }
    if (block.kind === "list") {
      return (
        <ul key={key} className="list-disc space-y-1 pl-5">
          {block.lines.map((line, i) => <li key={`${key}-${i}`}>{inline(line, `${key}-${i}`)}</li>)}
        </ul>
      );
    }
    return (
      <p key={key} className="leading-7">
        {block.lines.length <= 1
          ? inline(block.lines[0] ?? "", `${key}-0`)
          : block.lines.map((line, i) => (
              <span key={`${key}-${i}`}>{i > 0 && <br />}{inline(line, `${key}-${i}`)}</span>
            ))}
      </p>
    );
  });
}
