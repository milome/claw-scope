import { Fragment } from "react";

export type RichContentBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; text: string };

export function buildRichContentBlocks(text: string): RichContentBlock[] {
  if (!text.trim()) {
    return [];
  }

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("#")) {
        return { type: "heading" as const, text: line.replace(/^#+\s*/, "") };
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return { type: "list" as const, text: line.replace(/^[-*]\s*/, "") };
      }
      return { type: "paragraph" as const, text: line };
    });
}

function renderHighlightedText(text: string, highlightTerm: string | null) {
  if (!highlightTerm || !text.toLowerCase().includes(highlightTerm.toLowerCase())) {
    return text;
  }

  return text.split(new RegExp(`(${highlightTerm})`, "ig")).map((part, partIndex) =>
    part.toLowerCase() === highlightTerm.toLowerCase() ? (
      <mark key={partIndex} className="rounded bg-sky-200 px-0.5 text-slate-900 dark:bg-sky-500/40 dark:text-sky-50">{part}</mark>
    ) : (
      <Fragment key={partIndex}>{part}</Fragment>
    ),
  );
}

export function RichContentRenderer({
  text,
  highlightTerm,
}: {
  text: string;
  highlightTerm: string | null;
}) {
  const blocks = buildRichContentBlocks(text);

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        const rendered = renderHighlightedText(block.text, highlightTerm);
        if (block.type === "heading") {
          return <h4 key={blockIndex} className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 border-b border-slate-200 pb-1 dark:border-slate-800">{rendered}</h4>;
        }
        if (block.type === "list") {
          return (
            <div key={blockIndex} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/60">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-500" />
              <div>{rendered}</div>
            </div>
          );
        }
        return <p key={blockIndex}>{rendered}</p>;
      })}
    </div>
  );
}
