import { ChevronDown, ChevronRight } from "lucide-react";

type EvidenceFocusCardProps = {
  title: string;
  snippet: string;
  sourceTitle: string | null;
  expanded: boolean;
  onToggle: () => void;
  navigationLabel?: string | null;
  navigationMeta?: string | null;
  children?: React.ReactNode;
};

export function EvidenceFocusCard({
  title,
  snippet,
  sourceTitle,
  expanded,
  onToggle,
  navigationLabel,
  navigationMeta,
  children,
}: EvidenceFocusCardProps) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-200">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide">{title}</div>
          {sourceTitle ? <div className="mt-1 text-xs font-medium text-sky-700 dark:text-sky-300">{sourceTitle}</div> : null}
        </div>
        <div className="rounded-full border border-sky-300 px-2 py-1 text-[11px] font-semibold text-sky-700 dark:border-sky-700 dark:text-sky-300">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>
      {expanded ? (
        <div className="mt-3 space-y-3">
          <div className="whitespace-pre-wrap">{snippet}</div>
          {navigationLabel ? (
            <div className="rounded-xl border border-sky-200 bg-white/70 px-3 py-2 text-xs text-sky-800 dark:border-sky-800/70 dark:bg-slate-950/40 dark:text-sky-200">
              <div className="font-semibold">{navigationLabel}</div>
              {navigationMeta ? <div className="mt-1 text-sky-700 dark:text-sky-300">{navigationMeta}</div> : null}
            </div>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
