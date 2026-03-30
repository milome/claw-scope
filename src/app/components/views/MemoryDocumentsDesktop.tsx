import { Network, Search } from "lucide-react";
import type { ReactNode } from "react";
import type { GatewayAgentFileEntry } from "../../contexts/OpenClawContext";

type MemorySearchMatch = {
  start: number;
  end: number;
};

type MemoryDocumentsDesktopProps = {
  title: string;
  description: string;
  documentQuery: string;
  documentMatches: MemorySearchMatch[];
  documentMatchIndex: number;
  documentDirty: boolean;
  documentSearchSource: "manual" | "search_result";
  documentSaveMessage: string | null;
  documentSaveState: "idle" | "saving" | "saved" | "error";
  selectedDocument: GatewayAgentFileEntry | null;
  selectedDocumentName: string;
  selectedDocumentContent: string;
  selectedDocumentUpdatedAtLabel: string;
  visibleDocuments: GatewayAgentFileEntry[];
  canEdit: boolean;
  isEditing: boolean;
  workspaceLabel: string;
  t: (key: string, ...args: (string | number)[]) => string;
  getAgentBadge: (agentId: string) => ReactNode;
  selectedAgentId: string;
  onDocumentQueryChange: (value: string) => void;
  onSelectDocument: (name: string) => void;
  onDocumentDraftChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  footerLabel: string;
};

export function MemoryDocumentsDesktop({
  title,
  description,
  documentQuery,
  documentMatches,
  documentMatchIndex,
  documentDirty,
  documentSearchSource,
  documentSaveMessage,
  documentSaveState,
  selectedDocument,
  selectedDocumentName,
  selectedDocumentContent,
  selectedDocumentUpdatedAtLabel,
  visibleDocuments,
  canEdit,
  isEditing,
  workspaceLabel,
  t,
  getAgentBadge,
  selectedAgentId,
  onDocumentQueryChange,
  onSelectDocument,
  onDocumentDraftChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  footerLabel,
}: MemoryDocumentsDesktopProps) {
  return (
    <div className="hidden flex-1 flex-col md:flex bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.88))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,1),rgba(2,6,23,0.92))]">
      <div className="px-5 pt-5">
        <div className="mb-5 px-2">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-700" />
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-300">
              <Network className="h-3.5 w-3.5 text-sky-500 dark:text-sky-300" />
              {title}
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-700" />
          </div>
          <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>

        <div className="mb-5 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.82),rgba(255,255,255,0.92))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.3),rgba(2,6,23,0.24))]">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Readable Workspace</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {t("memory.documents.current", selectedDocument?.name ?? t("memory.documents.none"))}
                </span>
                {!canEdit && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300">
                    {t("memory.documents.readonlyScope")}
                  </span>
                )}
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-medium text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300">
                  {workspaceLabel}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {documentDirty ? t("profile.unsaved") : t("profile.doc.exported")}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <input
                value={documentQuery}
                onChange={(event) => onDocumentQueryChange(event.target.value)}
                placeholder={t("memory.documents.searchPlaceholder")}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{t("memory.documents.matches", documentMatches.length)}</span>
                <span>{documentMatches.length > 0 ? `${documentMatchIndex + 1}/${documentMatches.length}` : "0/0"}</span>
                <span>{documentSearchSource === "search_result" ? t("memory.documents.searchSource.search") : t("memory.documents.searchSource.manual")}</span>
              </div>
            </div>
          </div>

          {documentSaveMessage && (
            <div className={`mt-4 rounded-2xl border px-3 py-2 text-xs ${documentSaveState === "error" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
              {documentSaveMessage}
            </div>
          )}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[minmax(420px,1.05fr)_minmax(0,1.35fr)] gap-5 px-5 pb-5 auto-rows-fr">
        <section className="overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 h-[calc(100vh-280px)] min-h-[720px]">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Document Directory</div>
          </div>

          {visibleDocuments.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Search className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">{t("memory.documents.emptyTitle")}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("memory.documents.emptyDesc")}</p>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {visibleDocuments.map((item) => {
                const active = item.name === selectedDocumentName;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => onSelectDocument(item.name)}
                    className={`relative w-full overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition shadow-sm ${active ? "border-sky-300 bg-sky-50/90 shadow-[0_16px_32px_rgba(14,165,233,0.12)] dark:border-sky-700 dark:bg-slate-800" : "border-slate-200/80 bg-white hover:border-sky-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/70"}`}
                  >
                    {active && <div className="absolute inset-y-3 left-0 w-1 rounded-full bg-gradient-to-b from-sky-400 via-cyan-400 to-violet-400 dark:from-sky-300 dark:via-cyan-300 dark:to-violet-300" />}
                    <div className="flex items-start justify-between gap-3">
                      <div className={`min-w-0 flex-1 ${active ? "pl-3" : ""}`}>
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className={`rounded-full border px-2 py-0.5 font-semibold ${active ? "border-sky-200 bg-white text-sky-700 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-300" : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"}`}>
                            {t("memory.documents.kind")}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 font-semibold ${active ? "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-700/50 dark:bg-cyan-900/20 dark:text-cyan-300" : "border-cyan-100 bg-cyan-50/70 text-cyan-600 dark:border-cyan-800/50 dark:bg-cyan-900/20 dark:text-cyan-300"}`}>
                            {workspaceLabel}
                          </span>
                        </div>
                        <div className={`mt-2.5 break-all ${active ? "text-[15px] font-bold tracking-tight text-slate-950 dark:text-white" : "text-[14px] font-semibold tracking-tight text-slate-900 dark:text-slate-100"}`}>
                          {item.name}
                        </div>
                        <div className="mt-1 break-all text-[12px] leading-5 text-slate-500 dark:text-slate-400">{item.path}</div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2 text-right">
                        <div>{getAgentBadge(selectedAgentId)}</div>
                        <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500" dir="ltr">
                          {item.updatedAtMs ? new Date(item.updatedAtMs).toLocaleString() : "-"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex min-h-[720px] h-[calc(100vh-280px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {selectedDocument && (
            <div className="flex h-full min-h-0 flex-col px-6 py-5">
              <div className="mb-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{selectedDocument.name}</div>
                    <div className="mt-0.5 break-all text-[12px] leading-5 text-slate-500 dark:text-slate-400">{selectedDocument.path}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-1 text-right text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    <div className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Updated</div>
                    <div>{selectedDocumentUpdatedAtLabel}</div>
                  </div>
                </div>
              </div>

              <section className="flex min-h-0 flex-1 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{t("memory.documents.editor")}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{isEditing ? "editing" : "read only"}</div>
                    {canEdit && !isEditing && (
                      <button
                        type="button"
                        onClick={onStartEdit}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
                      >
                        Edit
                      </button>
                    )}
                    {canEdit && isEditing && (
                      <>
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={onSave}
                          disabled={!documentDirty || documentSaveState === "saving"}
                          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
                        >
                          {documentSaveState === "saving" ? "Saving" : "Save"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 rounded-[24px] border border-slate-200/90 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-950/50">
                  <textarea
                    value={selectedDocumentContent}
                    onChange={(event) => onDocumentDraftChange(event.target.value)}
                    readOnly={!canEdit || !isEditing}
                    spellCheck={false}
                    className="min-h-0 flex-1 w-full resize-none rounded-[24px] bg-transparent px-4 py-4 font-mono text-[13px] leading-6 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500 overflow-auto"
                  />
                </div>
              </section>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                <span>{footerLabel}</span>
                <span>{selectedDocument.name}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
