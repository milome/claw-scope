import { ChevronRight, Search } from "lucide-react";
import { motion } from "motion/react";
import type {
  GatewayAgentMemorySearchResult,
} from "../../contexts/OpenClawContext";
import { ArchiveDetailPane, ArchiveDiagnosticsCard, ArchiveDiagnosticsLayout, archiveDiagnosticsTone, ArchiveEditorPane, ArchiveInfoBlock, ArchiveListPane, ArchiveNotice, ArchiveResultCard, ArchiveSplitPanel } from "./memoryArchiveUi";
import { openTargetLabel, sourceKindLabel } from "./memoryDisplayLabels";

type HealthProbeSummary = {
  provider: string;
  model: string;
  embeddingsReady: boolean | null;
  primaryIssue: string | null;
};

type RuntimeStatusSummary = {
  indexedFiles: number;
  totalFiles: number | null;
  chunks: number;
};

type SearchDetailState = {
  title: string;
  path: string;
  sourceKind: string;
  snippet: string;
  content: string;
  loading: boolean;
  error: string | null;
} | null;

function diagnosticsTone(summary: HealthProbeSummary | null) {
  return archiveDiagnosticsTone(summary ? Boolean(summary.primaryIssue) : null);
}

type MemorySearchPanelProps = {
  healthProbeSummary: HealthProbeSummary | null;
  runtimeStatusSummary: RuntimeStatusSummary | null;
  isLocalGatewaySession: boolean;
  commandGuide: string;
  commandGuideDescription: string;
  copiedCommandGuide: boolean;
  searchQuery: string;
  searchRunning: boolean;
  searchError: string | null;
  searchResult: GatewayAgentMemorySearchResult | null;
  searchGroups: { group: string; count: number }[];
  searchDetail: SearchDetailState;
  searchOpenHint: string | null;
  memoryStatusError: string | null;
  t: (key: string, ...args: (string | number)[]) => string;
  sourceTone: (source: string) => string;
  resultSubtitle: (path: string, openTarget: string) => string;
  resultRouteLabel: (openTarget: string) => string;
  onOpenDiagnostics: () => void;
  onCopyCommandGuide: () => void;
  onSearchQueryChange: (value: string) => void;
  onRunSemanticSearch: () => void;
  onOpenSearchEntry: (entry: GatewayAgentMemorySearchResult["results"][number]) => void;
  onCloseSearchDetail: () => void;
};

export function MemorySearchPanel({
  healthProbeSummary,
  runtimeStatusSummary,
  isLocalGatewaySession,
  commandGuide,
  commandGuideDescription,
  copiedCommandGuide,
  searchQuery,
  searchRunning,
  searchError,
  searchResult,
  searchGroups,
  searchDetail,
  searchOpenHint,
  memoryStatusError,
  t,
  sourceTone,
  resultSubtitle,
  resultRouteLabel,
  onOpenDiagnostics,
  onCopyCommandGuide,
  onSearchQueryChange,
  onRunSemanticSearch,
  onOpenSearchEntry,
  onCloseSearchDetail,
}: MemorySearchPanelProps) {
  return (
    <motion.div
      key="view-search"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <ArchiveSplitPanel
        icon={Search}
        title={t("memory.tab.search")}
        description={t("memory.search.routingNote")}
        left={(
        <ArchiveListPane title={t("memory.search.title")}>
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder={t("memory.search.inputPlaceholder")}
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:bg-white dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500"
              />
              <button
                onClick={onRunSemanticSearch}
                disabled={!searchQuery.trim() || searchRunning}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
              >
                {searchRunning ? <Search className="w-4 h-4 animate-pulse" /> : <Search className="w-4 h-4" />}
                {searchRunning ? t("memory.search.detailLoading") : t("memory.search.run")}
              </button>
            </div>
          </div>
              <div className={`mt-3 rounded-2xl border p-3 text-xs shadow-sm ${diagnosticsTone(healthProbeSummary)}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{t("memory.search.diagBar")}</div>
                <div className="mt-1">{healthProbeSummary ? t("memory.search.diagnosticsPair", healthProbeSummary.provider, healthProbeSummary.model) : t("memory.diag.unavailable")}</div>
                <div className="mt-1">{healthProbeSummary ? (healthProbeSummary.embeddingsReady === true ? t("memory.search.diagHealthy") : healthProbeSummary.primaryIssue ?? t("memory.diag.unavailable")) : t("memory.diag.unavailable")}</div>
              </div>
              <button
                onClick={onOpenDiagnostics}
                className="rounded-full border border-current/20 bg-white/90 px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur dark:bg-slate-900/60"
              >
                {t("memory.search.openDiagnostics")}
              </button>
            </div>
          </div>
          <ArchiveDiagnosticsCard title={t("memory.diag.runtimeStatus")} className="mt-3 text-xs">
            {runtimeStatusSummary ? (
              <div className="space-y-1 text-slate-500 dark:text-slate-400">
                <div>
                  {t(
                    "memory.search.indexedSummary",
                    runtimeStatusSummary.indexedFiles,
                    runtimeStatusSummary.totalFiles != null ? `/${runtimeStatusSummary.totalFiles}` : "",
                    runtimeStatusSummary.chunks,
                  )}
                </div>
              </div>
            ) : (
              <div className="text-slate-500 dark:text-slate-400">
                {isLocalGatewaySession ? t("memory.diag.runtimePlaceholder") : t("memory.diag.runtimeRemoteUnavailable")}
              </div>
            )}
          </ArchiveDiagnosticsCard>
          <ArchiveDiagnosticsCard title={t("memory.search.commands.title")} className="mt-3 text-xs">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {healthProbeSummary?.embeddingsReady ? t("memory.search.commands.providerReady") : t("memory.search.commands.providerMissing")}
            </div>
            <div className="text-slate-500 dark:text-slate-400">{commandGuideDescription}</div>
            <pre className="mt-3 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{commandGuide}</pre>
            <button
              onClick={onCopyCommandGuide}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
            >
              {copiedCommandGuide ? t("memory.search.commands.copied") : t("memory.search.commands.copy")}
            </button>
          </ArchiveDiagnosticsCard>
          {searchError ? <div className="mt-4"><ArchiveNotice tone="error">{searchError}</ArchiveNotice></div> : null}
        </ArchiveListPane>
        )}
        right={(
        <ArchiveDetailPane className="min-h-0 overflow-hidden">
          <ArchiveEditorPane
            header={(
              <div className="mb-4 flex flex-wrap gap-2">
                {searchGroups.map(({ group, count }) => (
                  <span key={group} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {t("memory.search.groupCount", group, count)}
                  </span>
                ))}
              </div>
            )}
            body={(
              <div className="min-h-0 space-y-4 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 320px)" }}>
                <div className="flex flex-wrap gap-2">
                  {(searchResult?.results ?? []).slice(0, 8).map((entry) => (
                    <span key={`source-${entry.id}`} className={`rounded-full border px-3 py-1 text-xs font-medium ${sourceTone(entry.sourceKind)}`}>
                      {entry.sourceKind}
                    </span>
                  ))}
                </div>
                <ArchiveNotice>{t("memory.search.routingNote")}</ArchiveNotice>
                {healthProbeSummary && (
                  <ArchiveDiagnosticsCard title={t("memory.diag.healthProbe")} className="text-xs">
                    <div className="mt-1 text-slate-500 dark:text-slate-400">{t("memory.search.diagnosticsPair", healthProbeSummary.provider, healthProbeSummary.model)}</div>
                    <div className="mt-1 text-slate-500 dark:text-slate-400">{t("memory.search.embeddings")}: {healthProbeSummary.embeddingsReady === true ? t("memory.diag.ready") : healthProbeSummary.embeddingsReady === false ? t("memory.diag.unavailableShort") : t("memory.diag.unknownShort")}</div>
                  </ArchiveDiagnosticsCard>
                )}
                {healthProbeSummary && memoryStatusError ? <ArchiveNotice tone="error">{memoryStatusError}</ArchiveNotice> : null}
                {searchResult?.diagnostics && (
                  <ArchiveDiagnosticsCard title={t("memory.diag.search")} className="text-xs">
                    <div className="mt-1 text-slate-500 dark:text-slate-400">{searchResult.diagnostics.backend} / {searchResult.diagnostics.storeDriver}</div>
                    <div className="mt-1 break-all text-slate-500 dark:text-slate-400">{searchResult.diagnostics.storePath}</div>
                  </ArchiveDiagnosticsCard>
                )}
                {searchError ? (
                  <ArchiveNotice tone="error">{searchError}</ArchiveNotice>
                ) : searchResult ? (
                  <div className="space-y-3">
                    {searchResult.results.map((entry) => (
                      <ArchiveResultCard key={entry.id}>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300">{sourceKindLabel(entry.sourceKind, t)}</span>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{openTargetLabel(entry.openTarget, t)}</span>
                        </div>
                        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{resultSubtitle(entry.path, entry.openTarget)}</div>
                        <div className="mt-3 break-all text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.path}</div>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 dark:text-slate-300">
                          {searchQuery.trim()
                            ? entry.snippet.split(new RegExp(`(${searchQuery})`, "ig")).map((part, index) =>
                                part.toLowerCase() === searchQuery.toLowerCase() ? (
                                  <mark key={index} className="rounded bg-sky-200 px-0.5 text-slate-900 dark:bg-sky-500/40 dark:text-sky-50">{part}</mark>
                                ) : (
                                  <span key={index}>{part}</span>
                                ),
                              )
                            : entry.snippet}
                        </p>
                        <ArchiveInfoBlock title={t("memory.search.resultFallback")}>
                          {entry.canonicalDocumentName ?? entry.timelineEntryName ?? t("memory.search.resultFallback")}
                        </ArchiveInfoBlock>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{t("memory.search.targetRoute", openTargetLabel(entry.openTarget, t))}</span>
                          {typeof entry.score === "number" && <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{t("memory.search.score", entry.score.toFixed(3))}</span>}
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {entry.canonicalDocumentName ?? entry.timelineEntryName ?? entry.path}
                          </div>
                          <button
                            onClick={() => onOpenSearchEntry(entry)}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                          >
                            {resultRouteLabel(entry.openTarget)}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </ArchiveResultCard>
                    ))}
                    {searchResult.results.length === 0 && (
                      <ArchiveNotice>{t("memory.search.empty")}</ArchiveNotice>
                    )}
                  </div>
                ) : (
                  <ArchiveNotice>{t("memory.search.idle")}</ArchiveNotice>
                )}
                {!healthProbeSummary && memoryStatusError ? <ArchiveNotice tone="error">{memoryStatusError}</ArchiveNotice> : null}
                {searchDetail && (
                  <ArchiveDiagnosticsLayout
                    title={t("memory.search.detailTitle")}
                    subtitle={searchDetail.path}
                    onClose={onCloseSearchDetail}
                  >
                    <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t("memory.search.detailMeta", searchDetail.sourceKind)}
                    </div>
                    <ArchiveDiagnosticsCard title={t("memory.search.detailTitle")} className="mt-3 text-sm whitespace-pre-wrap break-words max-h-[360px] overflow-y-auto">
                      {searchDetail.loading ? t("memory.search.detailLoading") : searchDetail.error ? searchDetail.error : searchDetail.content || searchDetail.snippet}
                    </ArchiveDiagnosticsCard>
                  </ArchiveDiagnosticsLayout>
                )}
                {searchOpenHint ? <ArchiveNotice>{searchOpenHint}</ArchiveNotice> : null}
              </div>
            )}
          />
        </ArchiveDetailPane>
        )}
      />
    </motion.div>
  );
}
