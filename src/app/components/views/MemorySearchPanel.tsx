import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { motion } from "motion/react";
import type {
  GatewayAgentMemorySearchResult,
} from "../../contexts/OpenClawContext";
import { ArchiveDetailPane, ArchiveDiagnosticsCard, ArchiveDiagnosticsLayout, archiveDiagnosticsTone, ArchiveEditorPane, ArchiveInfoBlock, ArchiveListPane, ArchiveNotice, ArchiveResultCard, ArchiveSplitPanel, type ArchiveTone } from "./memoryArchiveUi";
import { openTargetLabel, sourceKindLabel } from "./memoryDisplayLabels";
import { resolveInputTone, resolveOutlineToneButton, resolveSolidToneButton, resolveViewToneClasses } from "./viewTone";

function renderNoticeContent(value: string | null) {
  if (!value) {
    return null;
  }

  return <span className="whitespace-pre-wrap break-words">{value}</span>;
}

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
  tone?: ArchiveTone;
  healthProbeSummary: HealthProbeSummary | null;
  runtimeStatusSummary: RuntimeStatusSummary | null;
  isLocalGatewaySession: boolean;
  commandGuide: string;
  commandGuideDescription: string;
  configStatusMessage: string;
  searchAvailabilityReason: string;
  providerAvailabilityReason: string;
  searchPrimaryReason: string | null;
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
  tone = "sky",
  healthProbeSummary,
  runtimeStatusSummary,
  isLocalGatewaySession,
  commandGuide,
  commandGuideDescription,
  configStatusMessage,
  searchAvailabilityReason,
  providerAvailabilityReason,
  searchPrimaryReason,
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
  const [isCommandGuideExpanded, setIsCommandGuideExpanded] = useState(false);
  const focusTone = resolveInputTone(tone);
  const solidTone = resolveSolidToneButton(tone);
  const outlineTone = resolveOutlineToneButton(tone);
  const softBadgeTone = resolveViewToneClasses(tone).softBadge;
  const providerReady = healthProbeSummary?.embeddingsReady === true;
  const hasSetupIssue = Boolean(
    searchPrimaryReason ||
    memoryStatusError ||
    healthProbeSummary?.primaryIssue ||
    healthProbeSummary?.embeddingsReady === false ||
    !healthProbeSummary,
  );
  const setupSummary = searchPrimaryReason ??
    healthProbeSummary?.primaryIssue ??
    memoryStatusError ??
    (providerReady ? t("memory.search.diagHealthy") : configStatusMessage);
  const showMemoryStatusErrorInSetup = Boolean(
    memoryStatusError &&
    memoryStatusError !== searchPrimaryReason &&
    memoryStatusError !== healthProbeSummary?.primaryIssue,
  );
  const providerBadgeTone = providerReady
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-300"
    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-300";
  const setupIssueTone = hasSetupIssue
    ? "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100"
    : "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100";
  const commandGuideToggleLabel = isCommandGuideExpanded
    ? t("memory.search.commands.hideGuide")
    : t("memory.search.commands.showGuide");

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
        tone={tone}
        left={(
        <ArchiveListPane title={t("memory.search.title")}>
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder={t("memory.search.inputPlaceholder")}
                className={`min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 ${focusTone}`}
              />
              <button
                onClick={onRunSemanticSearch}
                disabled={!searchQuery.trim() || searchRunning}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${solidTone}`}
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
          <ArchiveDiagnosticsCard title={t("memory.search.commands.title")} className="mt-3 text-xs" tone={hasSetupIssue ? "amber" : "emerald"}>
            <div className="rounded-2xl border border-white/70 bg-white/85 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/35">
              <div className="flex items-start gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${providerBadgeTone}`}>
                      {providerReady ? t("memory.search.commands.providerReady") : t("memory.search.commands.providerMissing")}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                      {isLocalGatewaySession ? t("memory.knowledge.bridgeStatus.local") : t("memory.knowledge.bridgeStatus.remote")}
                    </span>
                    {runtimeStatusSummary ? (
                      <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/35 dark:text-sky-300">
                        {t(
                          "memory.search.indexedSummary",
                          runtimeStatusSummary.indexedFiles,
                          runtimeStatusSummary.totalFiles != null ? `/${runtimeStatusSummary.totalFiles}` : "",
                          runtimeStatusSummary.chunks,
                        )}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {hasSetupIssue ? t("memory.search.commands.needsAttentionTitle") : t("memory.search.commands.readyTitle")}
                  </div>
                  <p className="mt-1 leading-5 text-slate-600 dark:text-slate-300">{setupSummary}</p>
                </div>
              </div>

              {hasSetupIssue ? (
                <div className={`mt-3 rounded-xl border p-3 ${setupIssueTone}`}>
                  <div className="font-semibold">{t("memory.search.commands.issueSummary")}</div>
                  {showMemoryStatusErrorInSetup ? (
                    <div className="mt-1 whitespace-pre-wrap break-words leading-5">{memoryStatusError}</div>
                  ) : null}
                  <div className="mt-1 leading-5">{searchAvailabilityReason}</div>
                  {providerAvailabilityReason !== searchAvailabilityReason ? (
                    <div className="mt-1 leading-5">{providerAvailabilityReason}</div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={onCopyCommandGuide}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm ${solidTone}`}
                >
                  {copiedCommandGuide ? t("memory.search.commands.copied") : t("memory.search.commands.copy")}
                </button>
                <button
                  onClick={() => setIsCommandGuideExpanded((expanded) => !expanded)}
                  className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 ${outlineTone}`}
                >
                  {commandGuideToggleLabel}
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isCommandGuideExpanded ? "rotate-90" : ""}`} />
                </button>
              </div>

              {isCommandGuideExpanded ? (
                <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-slate-600 dark:border-slate-800 dark:bg-slate-950/55 dark:text-slate-300">
                  <div className="leading-5">{configStatusMessage}</div>
                  <div className="leading-5">{commandGuideDescription}</div>
                  <div className="leading-5">{isLocalGatewaySession ? t("memory.knowledge.bridgeStatus.local") : t("memory.knowledge.bridgeStatus.remote")}</div>
                  <pre className="mt-3 max-h-52 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{commandGuide}</pre>
                </div>
              ) : null}
            </div>
          </ArchiveDiagnosticsCard>
          {searchError ? <div className="mt-4"><ArchiveNotice tone="error">{renderNoticeContent(searchError)}</ArchiveNotice></div> : null}
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
                {healthProbeSummary && memoryStatusError ? <ArchiveNotice tone="error">{renderNoticeContent(memoryStatusError)}</ArchiveNotice> : null}
                {searchResult?.diagnostics && (
                  <ArchiveDiagnosticsCard title={t("memory.diag.search")} className="text-xs">
                    <div className="mt-1 text-slate-500 dark:text-slate-400">{searchResult.diagnostics.backend} / {searchResult.diagnostics.storeDriver}</div>
                    <div className="mt-1 break-all text-slate-500 dark:text-slate-400">{searchResult.diagnostics.storePath}</div>
                  </ArchiveDiagnosticsCard>
                )}
                {searchError ? (
                  <ArchiveNotice tone="error">{renderNoticeContent(searchError)}</ArchiveNotice>
                ) : searchResult ? (
                  <div className="space-y-3">
                    {searchResult.results.map((entry) => (
                      <ArchiveResultCard key={entry.id}>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`rounded-full border px-2 py-0.5 font-medium ${softBadgeTone}`}>{sourceKindLabel(entry.sourceKind, t)}</span>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{openTargetLabel(entry.openTarget, t)}</span>
                        </div>
                        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{resultSubtitle(entry.path, entry.openTarget)}</div>
                        <div className="mt-3 break-all text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.path}</div>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 dark:text-slate-300">
                          {searchQuery.trim()
                            ? entry.snippet.split(new RegExp(`(${searchQuery})`, "ig")).map((part, index) =>
                                part.toLowerCase() === searchQuery.toLowerCase() ? (
                                  <mark key={index} className={`rounded px-0.5 text-slate-900 dark:text-white ${tone === "amber" ? "bg-amber-200 dark:bg-amber-500/40" : tone === "violet" ? "bg-violet-200 dark:bg-violet-500/40" : tone === "emerald" ? "bg-emerald-200 dark:bg-emerald-500/40" : tone === "rose" ? "bg-rose-200 dark:bg-rose-500/40" : "bg-sky-200 dark:bg-sky-500/40"}`}>{part}</mark>
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
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-white shadow-sm ${solidTone}`}
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
                {!healthProbeSummary && memoryStatusError ? <ArchiveNotice tone="error">{renderNoticeContent(memoryStatusError)}</ArchiveNotice> : null}
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
