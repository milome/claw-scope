import { FileDigit, Network, Search } from "lucide-react";
import type { ReactNode } from "react";
import type { GatewayAgentFileEntry } from "../../contexts/OpenClawContext";
import { ArchiveCapsule, ArchiveLayerHeader, type ArchiveTone } from "./memoryArchiveUi";
import { resolveSelectedToneSurface, resolveViewToneClasses } from "./viewTone";

type MemoryDocumentsMobileProps = {
  tone?: ArchiveTone;
  visibleDocuments: GatewayAgentFileEntry[];
  selectedDocumentName: string;
  selectedAgentId: string;
  workspaceLabel: string;
  t: (key: string, ...args: (string | number)[]) => string;
  getAgentBadge: (agentId: string) => ReactNode;
  onSelectDocument: (name: string) => void;
};

export function MemoryDocumentsMobile({
  tone = "sky",
  visibleDocuments,
  selectedDocumentName,
  selectedAgentId,
  workspaceLabel,
  t,
  getAgentBadge,
  onSelectDocument,
}: MemoryDocumentsMobileProps) {
  const tonePalette = resolveViewToneClasses(tone);
  const toneClasses = {
    selected: resolveSelectedToneSurface(tone),
    focus: tone === "violet" ? "focus:ring-violet-500" : tone === "emerald" ? "focus:ring-emerald-500" : tone === "amber" ? "focus:ring-amber-500" : tone === "rose" ? "focus:ring-rose-500" : "focus:ring-sky-500",
    chip: tonePalette.softBadge,
  };
  return (
    <div className="md:hidden flex-1 overflow-auto hide-scrollbar px-4 pb-4">
      <ArchiveLayerHeader icon={FileDigit} title={t("memory.documents.title")} description={t("memory.documents.desc")} tone={tone} />
      <ArchiveCapsule>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">{getAgentBadge(selectedAgentId)}</div>
          <span className={`rounded-full border px-3 py-1 font-medium ${toneClasses.chip}`}>
            {workspaceLabel}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {t("memory.documents.current", selectedDocumentName || t("memory.documents.none"))}
          </span>
        </div>
      </ArchiveCapsule>

      <div className="space-y-3">
        {visibleDocuments.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{t("memory.documents.emptyTitle")}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("memory.documents.emptyDesc")}</p>
          </div>
        ) : (
          visibleDocuments.map((item) => (
            <div key={item.name} tabIndex={0} onClick={() => onSelectDocument(item.name)} className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-4 shadow-sm transition-transform active:scale-[0.98] focus:outline-none focus:ring-2 ${toneClasses.focus} ${item.name === selectedDocumentName ? toneClasses.selected : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">{getAgentBadge(selectedAgentId)}</div>
                  <span className="flex items-center gap-1 text-[10px] font-medium text-cyan-600 dark:text-cyan-400">
                    <Network className="h-3 w-3" /> {workspaceLabel}
                  </span>
                </div>
                <span className="rounded bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-400 dark:bg-slate-800/50" dir="ltr">{item.updatedAtMs ? new Date(item.updatedAtMs).toLocaleTimeString() : "-"}</span>
              </div>
              <div className="mb-2 break-all text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">{item.name}</div>
              <p className="mb-4 line-clamp-3 text-[14px] leading-relaxed text-slate-700 dark:text-slate-300">{item.content ? item.content.slice(0, 120) : item.path}</p>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${toneClasses.chip}`}>
                  <FileDigit className="h-3 w-3" /> document
                </span>
                <div className="flex items-center gap-1.5 text-[11px] font-medium">
                  {!item.missing && <><div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div><span className="text-emerald-600 dark:text-emerald-400">{t("memory.documents.status.available")}</span></>}
                  {item.missing && <><div className="h-1.5 w-1.5 rounded-full bg-red-500"></div><span className="text-red-600 dark:text-red-400">{t("memory.documents.status.missing")}</span></>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
