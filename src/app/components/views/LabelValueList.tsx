import type { ReactNode } from "react";

export function LabelValueList({
  items,
  className = "",
}: {
  items: Array<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className}`.trim()}>
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</div>
          <div className="min-w-0 break-all text-sm text-slate-800 dark:text-slate-100">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
