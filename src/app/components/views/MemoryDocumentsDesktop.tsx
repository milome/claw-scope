import { Network, Search } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { GatewayAgentFileEntry } from "../../contexts/OpenClawContext";
import { ARCHIVE_SPACING, ArchiveActionButton, ArchiveCapsule, ArchiveDetailHeader, ArchiveDetailPane, ArchiveEditorPane, ArchiveFormHeader, ArchiveLayerHeader, ArchiveListCard, ArchiveListPane } from "./memoryArchiveUi";
import { EvidenceFocusCard } from "./EvidenceFocusCard";

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
  selectedSnippet: string | null;
  selectedHighlightTerm: string | null;
  activeHighlightIndex: number;
  evidenceExpanded: boolean;
  onToggleEvidenceExpanded: () => void;
  visibleDocuments: GatewayAgentFileEntry[];
  canEdit: boolean;
  isEditing: boolean;
  workspaceLabel: string;
  t: (key: string, ...args: (string | number)[]) => string;
  getAgentBadge: (agentId: string) => ReactNode;
  selectedAgentId: string;
  onDocumentQueryChange: (value: string) => void;
  onPreviousHighlight: () => void;
  onNextHighlight: () => void;
  onSelectDocument: (name: string) => void;
  onDocumentDraftChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onReload: () => void;
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
  selectedSnippet,
  selectedHighlightTerm,
  activeHighlightIndex,
  evidenceExpanded,
  onToggleEvidenceExpanded,
  visibleDocuments,
  canEdit,
  isEditing,
  workspaceLabel,
  t,
  getAgentBadge,
  selectedAgentId,
  onDocumentQueryChange,
  onPreviousHighlight,
  onNextHighlight,
  onSelectDocument,
  onDocumentDraftChange,
  onStartEdit,
  onCancelEdit,
  onReload,
  onSave,
  footerLabel,
}: MemoryDocumentsDesktopProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const highlightSelection = useMemo(() => {
    if (!selectedDocumentContent || !selectedHighlightTerm) {
      return null;
    }

    const lowerContent = selectedDocumentContent.toLowerCase();
    const lowerTerm = selectedHighlightTerm.toLowerCase();
    const matches: { start: number; end: number }[] = [];
    let cursor = 0;

    while (cursor < selectedDocumentContent.length) {
      const start = lowerContent.indexOf(lowerTerm, cursor);
      if (start === -1) {
        break;
      }
      matches.push({ start, end: start + selectedHighlightTerm.length });
      cursor = start + selectedHighlightTerm.length;
    }

    if (matches.length === 0) {
      return null;
    }

    return {
      matches,
      current: matches[Math.max(0, Math.min(activeHighlightIndex, matches.length - 1))],
    };
  }, [selectedDocumentContent, selectedHighlightTerm]);

  useEffect(() => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if ((!textarea && !overlay) || !highlightSelection) {
      return;
    }

    const lineHeight = 24;
    const linesBefore = selectedDocumentContent.slice(0, highlightSelection.current.start).split("\n").length - 1;
    const scrollTop = Math.max(0, linesBefore * lineHeight - (textarea?.clientHeight ?? overlay?.clientHeight ?? 0) / 3);

    if (textarea) {
      textarea.scrollTop = scrollTop;
      if (isEditing) {
        textarea.focus();
        textarea.setSelectionRange(highlightSelection.current.start, highlightSelection.current.end);
      }
    }

    if (overlay) {
      overlay.scrollTop = scrollTop;
    }
  }, [highlightSelection, isEditing, selectedDocumentContent]);

  const highlightedSegments = useMemo(() => {
    if (!selectedDocumentContent || !selectedHighlightTerm) {
      return [{ text: selectedDocumentContent, match: false }];
    }

    const lowerContent = selectedDocumentContent.toLowerCase();
    const lowerTerm = selectedHighlightTerm.toLowerCase();
    const segments: { text: string; match: boolean }[] = [];
    let cursor = 0;

    while (cursor < selectedDocumentContent.length) {
      const index = lowerContent.indexOf(lowerTerm, cursor);
      if (index === -1) {
        segments.push({ text: selectedDocumentContent.slice(cursor), match: false });
        break;
      }
      if (index > cursor) {
        segments.push({ text: selectedDocumentContent.slice(cursor, index), match: false });
      }
      segments.push({ text: selectedDocumentContent.slice(index, index + selectedHighlightTerm.length), match: true });
      cursor = index + selectedHighlightTerm.length;
    }

    return segments;
  }, [selectedDocumentContent, selectedHighlightTerm]);

  return (
    <div className="hidden flex-1 flex-col md:flex bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.88))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,1),rgba(2,6,23,0.92))]">
      <div className="px-5 pt-5">
        <ArchiveLayerHeader icon={Network} title={title} description={description} />

        <ArchiveCapsule>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">{t("memory.documents.readableWorkspace")}</div>
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
        </ArchiveCapsule>
      </div>

      <div className={`grid flex-1 grid-cols-[minmax(420px,1.05fr)_minmax(0,1.35fr)] px-5 pb-5 auto-rows-fr ${ARCHIVE_SPACING.sectionGap}`}>
        <ArchiveListPane title={t("memory.documents.directory")} className="h-[calc(100vh-280px)]">

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
                  <ArchiveListCard
                    key={item.name}
                    active={active}
                    onClick={() => onSelectDocument(item.name)}
                  >
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
                  </ArchiveListCard>
                );
              })}
            </div>
          )}
        </ArchiveListPane>

        <ArchiveDetailPane className="h-[calc(100vh-280px)]">
          {selectedDocument && (
            <ArchiveEditorPane
              header={(
                <ArchiveDetailHeader
                  title={selectedDocument.name}
                  subtitle={selectedDocument.path}
                  meta={(
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-1 text-right text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      <div className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("memory.documents.updatedShort")}</div>
                      <div>{selectedDocumentUpdatedAtLabel}</div>
                    </div>
                  )}
                />
              )}
              body={(
                <>
                  <ArchiveFormHeader label={t("memory.documents.editor")}>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{isEditing ? t("memory.documents.editing") : t("memory.documents.readonly")}</div>
                    <ArchiveActionButton onClick={onReload}>{t("memory.documents.reload")}</ArchiveActionButton>
                    {canEdit && !isEditing && <ArchiveActionButton onClick={onStartEdit}>{t("memory.documents.edit")}</ArchiveActionButton>}
                    {canEdit && isEditing && (
                      <>
                        <ArchiveActionButton onClick={onCancelEdit}>{t("memory.documents.cancel")}</ArchiveActionButton>
                        <ArchiveActionButton onClick={onSave} disabled={!documentDirty || documentSaveState === "saving"} variant="primary">
                          {documentSaveState === "saving" ? t("memory.documents.saving") : t("memory.documents.save")}
                        </ArchiveActionButton>
                      </>
                    )}
                  </ArchiveFormHeader>
                  <div className="flex min-h-0 flex-1 rounded-[24px] border border-slate-200/90 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-950/50">
                    {canEdit && isEditing ? (
                      <div className="relative min-h-0 flex-1">
                        <div
                          ref={overlayRef}
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap rounded-[24px] px-4 py-4 font-mono text-[13px] leading-6 text-transparent"
                        >
                          {highlightedSegments.map((segment, index) =>
                            segment.match ? (
                              <mark key={index} className="rounded bg-sky-200 px-0.5 text-transparent dark:bg-sky-500/40">
                                {segment.text}
                              </mark>
                            ) : (
                              <span key={index}>{segment.text}</span>
                            ),
                          )}
                        </div>
                        <textarea
                          ref={textareaRef}
                          value={selectedDocumentContent}
                          onChange={(event) => onDocumentDraftChange(event.target.value)}
                          onScroll={(event) => {
                            if (overlayRef.current) {
                              overlayRef.current.scrollTop = event.currentTarget.scrollTop;
                            }
                          }}
                          readOnly={false}
                          spellCheck={false}
                          className="relative min-h-0 flex-1 w-full resize-none rounded-[24px] bg-transparent px-4 py-4 font-mono text-[13px] leading-6 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500 overflow-auto"
                        />
                      </div>
                    ) : (
                      <div
                        ref={overlayRef}
                        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-[24px] px-4 py-4 font-mono text-[13px] leading-6 text-slate-800 dark:text-slate-100"
                      >
                        {highlightedSegments.map((segment, index) =>
                          segment.match ? (
                            <mark key={index} className="rounded bg-sky-200 px-0.5 text-slate-900 dark:bg-sky-500/40 dark:text-sky-50">
                              {segment.text}
                            </mark>
                          ) : (
                            <span key={index}>{segment.text}</span>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                  {selectedSnippet ? (
                    <div className="mt-4">
                      <EvidenceFocusCard
                        title={t("memory.evidence.focus")}
                        snippet={selectedSnippet}
                        sourceTitle={selectedDocument?.name ?? null}
                        expanded={evidenceExpanded}
                        onToggle={onToggleEvidenceExpanded}
                        navigationLabel={t("memory.evidence.sourceAnchor")}
                        navigationMeta={selectedDocument?.path ?? null}
                      >
                        {highlightSelection ? (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={onPreviousHighlight} className="rounded-full border border-sky-300 px-2 py-1 text-[11px] font-semibold">{t("memory.highlight.prev")}</button>
                            <span className="text-[11px] font-semibold">{Math.max(1, Math.min(activeHighlightIndex + 1, highlightSelection.matches.length))}/{highlightSelection.matches.length}</span>
                            <button type="button" onClick={onNextHighlight} className="rounded-full border border-sky-300 px-2 py-1 text-[11px] font-semibold">{t("memory.highlight.next")}</button>
                          </div>
                        ) : null}
                      </EvidenceFocusCard>
                    </div>
                  ) : null}
                </>
              )}
              footer={(
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  <span>{footerLabel}</span>
                  <span>{selectedDocument.name}</span>
                </div>
              )}
            />
          )}
        </ArchiveDetailPane>
      </div>
    </div>
  );
}
