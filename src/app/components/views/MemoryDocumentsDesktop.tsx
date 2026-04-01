import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { GatewayAgentFileEntry } from "../../contexts/OpenClawContext";
import { ARCHIVE_SPACING, ArchiveActionButton, ArchiveCapsule, ArchiveDetailPane, ArchiveLayerHeader, ArchiveListCard, ArchiveListPane, type ArchiveTone } from "./memoryArchiveUi";
import { EvidenceFocusCard } from "./EvidenceFocusCard";
import { RichContentRenderer } from "./RichContentRenderer";
import { resolveInputTone, resolveSelectedToneSurface, resolveViewToneClasses } from "./viewTone";

type MemorySearchMatch = {
  start: number;
  end: number;
};

type DocumentSearchFeedbackState = "idle" | "searching" | "matched" | "empty";

type MemoryDocumentsDesktopProps = {
  tone?: ArchiveTone;
  title: string;
  description: string;
  documentSearchInput: string;
  documentQuery: string;
  documentMatches: MemorySearchMatch[];
  documentMatchIndex: number;
  documentSearchFeedbackState: DocumentSearchFeedbackState;
  documentSearchHint: string | null;
  documentDirty: boolean;
  documentSearchSource: "manual" | "search_result";
  documentSaveMessage: string | null;
  documentSaveState: "idle" | "saving" | "saved" | "error";
  documentIndexRefreshState: "idle" | "done" | "error";
  documentIndexRefreshDescription: string | null;
  selectedDocument: GatewayAgentFileEntry | null;
  selectedDocumentName: string;
  selectedDocumentContent: string;
  selectedSnippet: string | null;
  evidenceExpanded: boolean;
  onToggleEvidenceExpanded: () => void;
  visibleDocuments: GatewayAgentFileEntry[];
  canEdit: boolean;
  isEditing: boolean;
  workspaceLabel: string;
  t: (key: string, ...args: (string | number)[]) => string;
  getAgentBadge: (agentId: string) => ReactNode;
  selectedAgentId: string;
  onDocumentSearchInputChange: (value: string) => void;
  onRunDocumentSearch: () => void;
  onClearDocumentSearch: () => void;
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
  tone = "sky",
  title: _title,
  description: _description,
  documentSearchInput,
  documentQuery,
  documentMatches,
  documentMatchIndex,
  documentSearchFeedbackState,
  documentSearchHint,
  documentDirty,
  documentSearchSource,
  documentSaveMessage,
  documentSaveState,
  documentIndexRefreshState,
  documentIndexRefreshDescription,
  selectedDocument,
  selectedDocumentName,
  selectedDocumentContent,
  selectedSnippet,
  evidenceExpanded,
  onToggleEvidenceExpanded,
  visibleDocuments,
  canEdit,
  isEditing,
  workspaceLabel,
  t,
  getAgentBadge,
  selectedAgentId,
  onDocumentSearchInputChange,
  onRunDocumentSearch,
  onClearDocumentSearch,
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
  const tonePalette = resolveViewToneClasses(tone);
  const toneClasses = {
    workspace: tonePalette.softBadge,
    selectedKind: `${tonePalette.softBadge} bg-white dark:bg-slate-900`,
    selectedCard: resolveSelectedToneSurface(tone),
    search: resolveInputTone(tone),
  };
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const stickySearchInputRef = useRef<HTMLInputElement | null>(null);
  const lastScrolledMatchIndexRef = useRef<number | null>(null);
  const navigationDirectionRef = useRef<"prev" | "next" | null>(null);
  const highlightPulseTimerRef = useRef<number | null>(null);

  const activeHighlightTerm = documentQuery.trim() || null;
  const activeMatchCursor = documentMatchIndex;

  const scrollToMatchIndex = (matchIndex: number) => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (matchIndex < 0) {
      return;
    }

    const activeNode = overlay?.querySelector<HTMLElement>(`#memory-document-match-${matchIndex}`) ?? null;
    if (overlay && activeNode) {
      activeNode.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      activeNode.dataset.pulse = "true";
      if (highlightPulseTimerRef.current) {
        window.clearTimeout(highlightPulseTimerRef.current);
      }
      highlightPulseTimerRef.current = window.setTimeout(() => {
        delete activeNode.dataset.pulse;
      }, 900);
      lastScrolledMatchIndexRef.current = matchIndex;
      return;
    }

    const fallbackMatch = highlightSelection?.matches[matchIndex];
    if (!fallbackMatch) {
      return;
    }

    const lineHeight = 24;
    const linesBefore = selectedDocumentContent.slice(0, fallbackMatch.start).split("\n").length - 1;
    const viewportHeight = textarea?.clientHeight ?? overlay?.clientHeight ?? 0;
    const fallbackScrollTop = Math.max(0, linesBefore * lineHeight - viewportHeight / 3);

    if (textarea) {
      textarea.scrollTop = fallbackScrollTop;
      if (isEditing) {
        textarea.focus();
        textarea.setSelectionRange(fallbackMatch.start, fallbackMatch.end);
      }
    }

    if (overlay) {
      overlay.scrollTop = fallbackScrollTop;
    }

    lastScrolledMatchIndexRef.current = matchIndex;
  };

  const highlightSelection = useMemo(() => {
    if (!selectedDocumentContent || !activeHighlightTerm) {
      return null;
    }

    const lowerContent = selectedDocumentContent.toLowerCase();
    const lowerTerm = activeHighlightTerm.toLowerCase();
    const matches: { start: number; end: number }[] = [];
    let cursor = 0;

    while (cursor < selectedDocumentContent.length) {
      const start = lowerContent.indexOf(lowerTerm, cursor);
      if (start === -1) {
        break;
      }
      matches.push({ start, end: start + activeHighlightTerm.length });
      cursor = start + activeHighlightTerm.length;
    }

    if (matches.length === 0) {
      return null;
    }

    return {
      matches,
      current: matches[Math.max(0, Math.min(activeMatchCursor, matches.length - 1))],
    };
  }, [activeHighlightTerm, activeMatchCursor, selectedDocumentContent]);

  useEffect(() => {
    return () => {
      if (highlightPulseTimerRef.current) {
        window.clearTimeout(highlightPulseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!highlightSelection) {
      lastScrolledMatchIndexRef.current = null;
      return;
    }

    if (lastScrolledMatchIndexRef.current === activeMatchCursor) {
      return;
    }

    requestAnimationFrame(() => {
      scrollToMatchIndex(activeMatchCursor);
      requestAnimationFrame(() => scrollToMatchIndex(activeMatchCursor));
    });
  }, [activeMatchCursor, highlightSelection, isEditing, selectedDocumentContent]);

  const handlePreviousHighlight = () => {
    navigationDirectionRef.current = "prev";
    onPreviousHighlight();
  };

  const handleNextHighlight = () => {
    navigationDirectionRef.current = "next";
    onNextHighlight();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) {
        handlePreviousHighlight();
      } else if (documentSearchInput.trim() !== documentQuery.trim()) {
        onRunDocumentSearch();
      } else {
        handleNextHighlight();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClearDocumentSearch();
    }
  };

  const renderSearchToolbar = () => (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-xs text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/85 dark:text-amber-100">
      <div className="flex flex-wrap items-center gap-2">
        <ArchiveActionButton tone={tone} onClick={onClearDocumentSearch} disabled={!documentSearchInput && !documentQuery}>
          <X className="mr-1 inline h-3.5 w-3.5" />
          {t("memory.documents.searchClear")}
        </ArchiveActionButton>
        <span className="rounded-full border border-amber-300 bg-white/90 px-3 py-1 font-medium text-amber-900 dark:border-amber-700 dark:bg-slate-950/80 dark:text-amber-100">
          {documentMatches.length > 0 ? `${documentMatchIndex + 1}/${documentMatches.length}` : "0/0"}
        </span>
        <div className="basis-full font-medium">
          {documentMatches.length > 0
            ? t("memory.documents.searchNavigationHint", documentMatchIndex + 1, documentMatches.length)
            : documentSearchHint ?? t("memory.documents.searchIdleHint")}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-amber-300 bg-white/90 px-3 py-2 dark:border-amber-700 dark:bg-slate-950/80">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            ref={stickySearchInputRef}
            value={documentSearchInput}
            onChange={(event) => onDocumentSearchInputChange(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t("memory.documents.searchPlaceholder")}
            className={`min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500 ${toneClasses.search}`}
          />
        </div>
        <ArchiveActionButton tone={tone} onClick={onRunDocumentSearch} variant="primary">
          {documentSearchFeedbackState === "matched"
            ? t("memory.documents.searchState.matched", documentMatches.length)
            : documentSearchFeedbackState === "empty"
              ? t("memory.documents.searchState.empty")
              : t("memory.documents.searchAction")}
        </ArchiveActionButton>
        <ArchiveActionButton tone={tone} onClick={handlePreviousHighlight} disabled={documentMatches.length <= 0}>
          {t("memory.highlight.prev")}
        </ArchiveActionButton>
        <ArchiveActionButton tone={tone} onClick={handleNextHighlight} disabled={documentMatches.length <= 0}>
          {t("memory.highlight.next")}
        </ArchiveActionButton>
      </div>
    </div>
  );

  useEffect(() => {
    if (!navigationDirectionRef.current || activeMatchCursor < 0) {
      return;
    }

    requestAnimationFrame(() => {
      scrollToMatchIndex(activeMatchCursor);
      navigationDirectionRef.current = null;
    });
  }, [activeMatchCursor]);

  const highlightedSegments = useMemo(() => {
    if (!selectedDocumentContent || !activeHighlightTerm) {
      return [{ text: selectedDocumentContent, match: false }];
    }

    const lowerContent = selectedDocumentContent.toLowerCase();
    const lowerTerm = activeHighlightTerm.toLowerCase();
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
      segments.push({ text: selectedDocumentContent.slice(index, index + activeHighlightTerm.length), match: true });
      cursor = index + activeHighlightTerm.length;
    }

    return segments;
  }, [activeHighlightTerm, selectedDocumentContent]);

  return (
    <div className="hidden flex-1 flex-col md:flex bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.88))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,1),rgba(2,6,23,0.92))]">
      <div className="px-5 pt-5">
        <ArchiveLayerHeader title={t("memory.tab.documents")} description={t("memory.documents.desc")} icon={Search} tone={tone} />
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
                <span className={`rounded-full border px-3 py-1 font-medium ${toneClasses.workspace}`}>
                  {workspaceLabel}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {documentDirty ? t("profile.unsaved") : t("profile.doc.exported")}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                {documentSearchHint ?? t("memory.documents.searchIdleHint")}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>{t("memory.documents.matches", documentMatches.length)}</span>
                <span>{documentSearchSource === "search_result" ? t("memory.documents.searchSource.search") : t("memory.documents.searchSource.manual")}</span>
              </div>
            </div>
          </div>

          {documentSaveMessage && (
            <div className={`mt-4 rounded-2xl border px-3 py-2 text-xs ${documentSaveState === "error" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
              {documentSaveMessage}
            </div>
          )}
          {documentIndexRefreshState !== "idle" ? (
            <div className={`mt-3 rounded-2xl border px-3 py-2 text-xs ${documentIndexRefreshState === "error" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
              {documentIndexRefreshDescription ?? documentSaveMessage}
            </div>
          ) : null}
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
                          <span className={`rounded-full border px-2 py-0.5 font-semibold ${active ? toneClasses.selectedKind : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"}`}>
                            {t("memory.documents.kind")}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 font-semibold ${active ? toneClasses.workspace : "border-cyan-100 bg-cyan-50/70 text-cyan-600 dark:border-cyan-800/50 dark:bg-cyan-900/20 dark:text-cyan-300"}`}>
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
            <div className="flex h-full min-h-0 flex-col px-6 py-5">
              <div className="mb-4 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ArchiveActionButton tone={tone} onClick={onReload}>{t("memory.documents.reload")}</ArchiveActionButton>
                    {canEdit && !isEditing && <ArchiveActionButton tone={tone} onClick={onStartEdit}>{t("memory.documents.edit")}</ArchiveActionButton>}
                    {canEdit && isEditing && (
                      <>
                        <ArchiveActionButton tone={tone} onClick={onCancelEdit}>{t("memory.documents.cancel")}</ArchiveActionButton>
                        <ArchiveActionButton tone={tone} onClick={onSave} disabled={!documentDirty || documentSaveState === "saving"} variant="primary">
                          {documentSaveState === "saving" ? t("memory.documents.saving") : t("memory.documents.save")}
                        </ArchiveActionButton>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{isEditing ? t("memory.documents.editingMode") : t("memory.documents.readonlyMode")}</div>
                </div>
              </div>

              <div className="mb-4 shrink-0">
                {renderSearchToolbar()}
              </div>

              <div className="min-h-0 flex-1 rounded-[24px] border border-slate-200/90 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-950/50">
                {canEdit && isEditing ? (
                  <div className="relative h-full min-h-0 flex-1">
                    <div
                      ref={overlayRef}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap rounded-[24px] px-4 py-6 font-mono text-[13px] leading-6 text-transparent"
                    >
                      {highlightedSegments.map((segment, index) =>
                        segment.match ? (
                          <mark key={index} className="rounded bg-yellow-200 px-0.5 text-transparent dark:bg-yellow-300/80">
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
                      className="h-full min-h-0 w-full resize-none rounded-[24px] bg-transparent px-4 py-6 font-mono text-[13px] leading-6 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500 overflow-auto"
                    />
                  </div>
                ) : (
                  <div
                    ref={overlayRef}
                    className="h-full min-h-0 overflow-auto rounded-[24px] px-4 py-6 text-[13px] leading-6 text-slate-800 dark:text-slate-100"
                  >
                    <RichContentRenderer text={selectedDocumentContent} highlightTerm={activeHighlightTerm} activeMatchIndex={activeMatchCursor} matchIdPrefix="memory-document-match" />
                  </div>
                )}
              </div>

              {selectedSnippet ? (
                <div className="mt-4 shrink-0">
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
                        <button type="button" onClick={handlePreviousHighlight} className="rounded-full border border-sky-300 px-2 py-1 text-[11px] font-semibold">{t("memory.highlight.prev")}</button>
                        <span className="text-[11px] font-semibold">{Math.max(1, Math.min(documentMatchIndex + 1, highlightSelection.matches.length))}/{highlightSelection.matches.length}</span>
                        <button type="button" onClick={handleNextHighlight} className="rounded-full border border-sky-300 px-2 py-1 text-[11px] font-semibold">{t("memory.highlight.next")}</button>
                      </div>
                    ) : null}
                  </EvidenceFocusCard>
                </div>
              ) : null}

              <div className="mt-4 shrink-0 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                <span>{footerLabel}</span>
                <span>{selectedDocument.name}</span>
              </div>
            </div>
          )}
        </ArchiveDetailPane>
      </div>
    </div>
  );
}
