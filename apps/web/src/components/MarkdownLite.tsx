"use client";

import React from "react";

/**
 * Tiny markdown renderer (no external deps).
 * Supports: ## heading, - bullets, **bold**, _italic_, `code`, paragraphs.
 * Good enough for AI summary which we control via system prompt.
 */
export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^##\s+/.test(line)) {
      blocks.push(
        <h2 key={`h-${i}`}>{renderInline(line.replace(/^##\s+/, ""))}</h2>
      );
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^##\s+/.test(lines[i]) && !/^[-*]\s+/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={`p-${i}`}>{renderInline(para.join(" "))}</p>);
  }

  return <div className="markdown text-sm leading-relaxed">{blocks}</div>;
}

function renderInline(s: string): React.ReactNode {
  // Tokenize: **bold**, _italic_, `code`
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(s)) !== null) {
    if (m.index > lastIndex) {
      tokens.push(s.slice(lastIndex, m.index));
    }
    const t = m[0];
    if (t.startsWith("**")) {
      tokens.push(<strong key={key++}>{t.slice(2, -2)}</strong>);
    } else if (t.startsWith("_")) {
      tokens.push(<em key={key++}>{t.slice(1, -1)}</em>);
    } else if (t.startsWith("`")) {
      tokens.push(
        <code key={key++} className="px-1 py-0.5 bg-white/10 rounded mono text-xs">
          {t.slice(1, -1)}
        </code>
      );
    }
    lastIndex = m.index + t.length;
  }
  if (lastIndex < s.length) tokens.push(s.slice(lastIndex));
  return <>{tokens}</>;
}
