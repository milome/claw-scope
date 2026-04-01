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

function buildHighlightedParts(text: string, highlightTerm: string | null) {
  if (!highlightTerm || !text.toLowerCase().includes(highlightTerm.toLowerCase())) {
    return [{ text, isMatch: false }];
  }

  const regex = new RegExp(`(${highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  return text.split(regex).map((part) => ({
    text: part,
    isMatch: part.toLowerCase() === highlightTerm.toLowerCase(),
  }));
}

export function RichContentRenderer({
  text,
  highlightTerm,
  activeMatchIndex = -1,
  matchIdPrefix = "memory-match",
}: {
  text: string;
  highlightTerm: string | null;
  activeMatchIndex?: number;
  matchIdPrefix?: string;
}) {
  const blocks = buildRichContentBlocks(text);
  let globalMatchIndex = -1;

  const renderText = (value: string) =>
    buildHighlightedParts(value, highlightTerm).map((part, index) => {
      if (!part.isMatch) {
        return <Fragment key={`${value}-${index}`}>{part.text}</Fragment>;
      }

      globalMatchIndex += 1;
      const isActive = globalMatchIndex === activeMatchIndex;

      return (
        <mark
          key={`${value}-${index}`}
          id={`${matchIdPrefix}-${globalMatchIndex}`}
          data-memory-match-index={globalMatchIndex}
          className={isActive
            ? "rounded bg-amber-300 px-0.5 text-slate-950 ring-2 ring-amber-500 transition-all duration-300 data-[pulse=true]:scale-[1.08] data-[pulse=true]:shadow-[0_0_0_4px_rgba(251,191,36,0.24)] dark:bg-amber-300 dark:text-slate-950 dark:ring-amber-200 dark:data-[pulse=true]:shadow-[0_0_0_4px_rgba(253,230,138,0.22)]"
            : "rounded bg-yellow-200 px-0.5 text-slate-950 transition-colors duration-200 dark:bg-yellow-300/80 dark:text-slate-950"
          }
        >
          {part.text}
        </mark>
      );
    });

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        const rendered = renderText(block.text);
        if (block.type === "heading") {
          return <h4 key={blockIndex} className="border-b border-slate-200 pb-1 text-sm font-semibold tracking-tight text-slate-900 dark:border-slate-800 dark:text-slate-100">{rendered}</h4>;
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
