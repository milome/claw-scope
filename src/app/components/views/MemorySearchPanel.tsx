import { ChevronRight, Search } from "lucide-react";
import { motion } from "motion/react";
import type {
  GatewayAgentMemorySearchResult,
} from "../../contexts/OpenClawContext";
import { ARCHIVE_SPACING, ArchiveDiagnosticsCard, archiveDiagnosticsTone, ArchiveInfoBlock, ArchiveSectionCard, ArchiveTabFrame } from "./memoryArchiveUi";

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
      <ArchiveTabFrame icon={Search} title={t("memory.tab.search")} description={t("memory.search.routingNote")}>
      <div className={`grid lg:grid-cols-[300px_1fr] ${ARCHIVE_SPACING.sectionGap}`}>
        <ArchiveSectionCard>
          <div className="text-sm font-semibold">{t("memory.search.title")}</div>
          <div className={`mt-3 rounded-2xl border p-3 text-xs shadow-sm ${diagnosticsTone(healthProbeSummary)}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{t("memory.search.diagBar")}</div>
                <div className="mt-1">{healthProbeSummary ? `${healthProbeSummary.provider} / ${healthProbeSummary.model}` : t("memory.diag.unavailable")}</div>
                <div className="mt-1">{healthProbeSummary ? (healthProbeSummary.embeddingsReady === true ? t("memory.search.diagHealthy") : healthProbeSummary.primaryIssue ?? t("memory.diag.unavailable")) : t("memory.diag.unavailable")}</div>
              </div>
              <button
                onClick={onOpenDiagnostics}
                className="rounded-full border border-current/20 bg-white/90 px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur dark:bg-slate-900/60"
              >
                Open diagnostics
              </button>
            </div>
          </div>
          <ArchiveDiagnosticsCard title={t("memory.diag.runtimeStatus")} className="mt-3 text-xs">
            {runtimeStatusSummary ? (
              <div className="space-y-1 text-slate-500 dark:text-slate-400">
                <div>
                  indexed: {runtimeStatusSummary.indexedFiles}
                  {runtimeStatusSummary.totalFiles != null ? `/${runtimeStatusSummary.totalFiles}` : ""} files · {runtimeStatusSummary.chunks} chunks
                </div>
              </div>
            ) : (
              <div className="text-slate-500 dark:text-slate-400">
                {isLocalGatewaySession ? t("memory.diag.runtimePlaceholder") : t("memory.diag.runtimeRemoteUnavailable")}
              </div>
            )}
          </ArchiveDiagnosticsCard>
          <ArchiveDiagnosticsCard title={t("memory.search.probeNote")} className="mt-3 text-xs">
            <div className="text-slate-500 dark:text-slate-400">{t("memory.search.probeNote")}</div>
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
          <div className="mt-4 flex gap-2">
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
              Run
            </button>
          </div>
          {searchError && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
              {searchError}
            </div>
          )}
        </ArchiveSectionCard>
        <ArchiveSectionCard>
          <div className="mb-4 flex flex-wrap gap-2">
            {searchGroups.map(({ group, count }) => (
              <span key={group} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {t("memory.search.groupCount", group, count)}
              </span>
            ))}
          </div>
          <div className="mb-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
            {t("memory.search.routingNote")}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {(searchResult?.results ?? []).slice(0, 8).map((entry) => (
              <span key={`source-${entry.id}`} className={`rounded-full border px-3 py-1 text-xs font-medium ${sourceTone(entry.sourceKind)}`}>
                {entry.sourceKind}
              </span>
            ))}
          </div>
          {healthProbeSummary && (
            <ArchiveDiagnosticsCard title={t("memory.diag.healthProbe")} className="mb-4 text-xs">
              <div className="mt-1 text-slate-500 dark:text-slate-400">{healthProbeSummary.provider} / {healthProbeSummary.model}</div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">embeddings: {healthProbeSummary.embeddingsReady === true ? t("memory.diag.ready") : healthProbeSummary.embeddingsReady === false ? t("memory.diag.unavailableShort") : t("memory.diag.unknownShort")}</div>
            </ArchiveDiagnosticsCard>
          )}
          {healthProbeSummary && memoryStatusError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
              {memoryStatusError}
            </div>
          )}
          {searchResult?.diagnostics && (
            <ArchiveDiagnosticsCard title={t("memory.diag.search")} className="mb-4 text-xs">
              <div className="mt-1 text-slate-500 dark:text-slate-400">{searchResult.diagnostics.backend} / {searchResult.diagnostics.storeDriver}</div>
              <div className="mt-1 break-all text-slate-500 dark:text-slate-400">{searchResult.diagnostics.storePath}</div>
            </ArchiveDiagnosticsCard>
          )}
          {searchError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
              {searchError}
            </div>
          ) : searchResult ? (
            <div className="space-y-3">
              {searchResult.results.map((entry) => (
                <article key={entry.id} className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-4 text-slate-700 shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-slate-700/80 dark:from-slate-900 dark:to-slate-900 dark:text-slate-300 dark:hover:border-sky-700">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300">{entry.sourceKind}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{entry.openTarget}</span>
                  </div>
                  <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{resultSubtitle(entry.path, entry.openTarget)}</div>
                  <div className="mt-3 break-all text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.path}</div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">{entry.snippet}</p>
                  <ArchiveInfoBlock title={t("memory.search.resultFallback")}>
                    {entry.canonicalDocumentName ?? entry.timelineEntryName ?? t("memory.search.resultFallback")}
                  </ArchiveInfoBlock>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{t("memory.search.targetRoute", entry.openTarget)}</span>
                    {typeof entry.score === "number" && <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{t("memory.search.score", entry.score.toFixed(3))}</span>}
                  </div>
                  <button
                    onClick={() => onOpenSearchEntry(entry)}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                  >
                    {resultRouteLabel(entry.openTarget)}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </article>
              ))}
              {searchResult.results.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  {t("memory.search.empty")}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              {t("memory.search.idle")}
            </div>
          )}
          {!healthProbeSummary && memoryStatusError && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
              {memoryStatusError}
            </div>
          )}
          {searchDetail && (
            <ArchiveSectionCard>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{t("memory.search.detailTitle")}</div>
                  <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{searchDetail.path}</div>
                </div>
                <button
                  onClick={onCloseSearchDetail}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
              <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t("memory.search.detailMeta", searchDetail.sourceKind)}
              </div>
              <ArchiveDiagnosticsCard title={t("memory.search.detailTitle")} className="mt-3 text-sm">
                {searchDetail.loading ? t("memory.search.detailLoading") : searchDetail.error ? searchDetail.error : searchDetail.content || searchDetail.snippet}
              </ArchiveDiagnosticsCard>
            </ArchiveSectionCard>
          )}
          {searchOpenHint && (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300">
              {searchOpenHint}
            </div>
          )}
        </ArchiveSectionCard>
      </div>
      </ArchiveTabFrame>
    </motion.div>
  );
}
