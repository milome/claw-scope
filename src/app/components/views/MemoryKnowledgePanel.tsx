import { motion } from "motion/react";
import { DiagnosticsCard, diagnosticsTone } from "./MemoryDiagnosticsDrawer";
import type { GatewayAgentMemoryResult } from "../../contexts/OpenClawContext";

type HealthProbeSummary = {
  provider: string;
  model: string;
  embeddingsReady: boolean | null;
  embeddingsError: string | null;
  rawPayload: string;
  primaryIssue: string | null;
};

type RuntimeStatusSummary = {
  indexedFiles: number;
  totalFiles: number | null;
  chunks: number;
  bySource: { source: string; files: number; chunks: number }[];
};

type ExternalSource = {
  id: string;
  kind: string;
  value: string;
};

type MemoryKnowledgePanelProps = {
  memoryResult: GatewayAgentMemoryResult | null;
  healthProbeSummary: HealthProbeSummary | null;
  runtimeStatusSummary: RuntimeStatusSummary | null;
  externalSources: ExternalSource[];
  isLocalGatewaySession: boolean;
  t: (key: string, ...args: (string | number)[]) => string;
  onOpenDiagnostics: () => void;
};

export function MemoryKnowledgePanel({
  memoryResult,
  healthProbeSummary,
  runtimeStatusSummary,
  externalSources,
  isLocalGatewaySession,
  t,
  onOpenDiagnostics,
}: MemoryKnowledgePanelProps) {
  return (
    <motion.div
      key="view-knowledge"
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 text-sm font-semibold">{t("memory.knowledge.title")}</div>
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{t("memory.knowledge.summary")}</div>
                <div className="mt-1">{memoryResult?.diagnostics ? `${memoryResult.diagnostics.backend} / ${memoryResult.diagnostics.provider ?? t("memory.knowledge.providerFallback")}` : t("memory.diag.unavailable")}</div>
              </div>
              <button
                onClick={onOpenDiagnostics}
                className="rounded-lg border border-current/20 px-3 py-1 text-xs font-medium"
              >
                Open diagnostics
              </button>
            </div>
          </div>
          {healthProbeSummary && (
            <DiagnosticsCard
              title={t("memory.diag.healthProbe")}
              className={`mb-4 text-xs ${diagnosticsTone(healthProbeSummary)}`}
            >
              <div>{healthProbeSummary.provider} / {healthProbeSummary.model}</div>
              <div className="mt-1">
                embeddings: {healthProbeSummary.embeddingsReady === true ? t("memory.diag.ready") : healthProbeSummary.embeddingsReady === false ? t("memory.diag.unavailableShort") : t("memory.diag.unknownShort")}
              </div>
              {healthProbeSummary.embeddingsError && (
                <div className="mt-1 text-rose-600 dark:text-rose-300">{healthProbeSummary.embeddingsError}</div>
              )}
            </DiagnosticsCard>
          )}
          <DiagnosticsCard title={t("memory.diag.runtimeStatus")} className="mb-4 text-xs">
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
          </DiagnosticsCard>
          {memoryResult?.diagnostics ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="font-medium">{t("memory.knowledge.backend")}</div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  {memoryResult.diagnostics.backend} / {memoryResult.diagnostics.provider ?? "no provider"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="font-medium">{t("memory.knowledge.store")}</div>
                <div className="mt-1 break-all text-slate-500 dark:text-slate-400">{memoryResult.diagnostics.builtinStorePath}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="font-medium">{t("memory.knowledge.sources")}</div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">{memoryResult.diagnostics.sources.join(", ") || t("memory.knowledge.sourcesEmpty")}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
              {t("memory.knowledge.missing")}
            </div>
          )}
          <div className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50/60 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
            {t("memory.knowledge.note")}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 text-sm font-semibold">{t("memory.knowledge.paths")}</div>
          {externalSources.length > 0 ? (
            <div className="space-y-2">
              {externalSources.map((source) => (
                <div key={source.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{source.kind}</div>
                  <div className="mt-1 break-all text-slate-700 dark:text-slate-200">{source.value}</div>
                </div>
              ))}
            </div>
          ) : memoryResult?.diagnostics ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              {t("memory.knowledge.pathsEmpty")}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              {t("memory.knowledge.pathsUnavailable")}
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="mb-4 text-sm font-semibold">{t("memory.knowledge.drawerFields")}</div>
          {healthProbeSummary || memoryResult?.diagnostics ? (
            <div className="space-y-3">
              <DiagnosticsCard title={t("memory.diag.healthProbe")}>
                <div className="mt-1 text-slate-500 dark:text-slate-400">{healthProbeSummary?.primaryIssue ?? t("memory.diag.noIssue")}</div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">provider: {healthProbeSummary?.provider ?? t("memory.diag.unavailable")}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">embeddings: {healthProbeSummary ? (healthProbeSummary.embeddingsReady === true ? t("memory.diag.ready") : healthProbeSummary.embeddingsReady === false ? t("memory.diag.unavailableShort") : t("memory.diag.unknownShort")) : t("memory.diag.unknownShort")}</div>
              </DiagnosticsCard>
              <DiagnosticsCard title={t("memory.diag.runtimeStatus")}>
                {runtimeStatusSummary ? (
                  <div className="space-y-1 text-slate-500 dark:text-slate-400">
                    <div>
                      indexed: {runtimeStatusSummary.indexedFiles}
                      {runtimeStatusSummary.totalFiles != null ? `/${runtimeStatusSummary.totalFiles}` : ""} files · {runtimeStatusSummary.chunks} chunks
                    </div>
                    {runtimeStatusSummary.bySource.map((item) => (
                      <div key={item.source}>
                        {item.source}: {item.files} files · {item.chunks} chunks
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 dark:text-slate-400">
                    {isLocalGatewaySession ? t("memory.diag.runtimePlaceholder") : t("memory.diag.runtimeRemoteUnavailable")}
                  </div>
                )}
              </DiagnosticsCard>
              <DiagnosticsCard title={t("memory.diag.knowledge")}>
                {memoryResult?.diagnostics ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <div>backend: {memoryResult.diagnostics.backend}</div>
                    <div>provider: {memoryResult.diagnostics.provider ?? t("memory.knowledge.providerFallback")}</div>
                    <div>store: {memoryResult.diagnostics.builtinStorePath}</div>
                    <div>sources: {memoryResult.diagnostics.sources.join(", ") || t("memory.knowledge.sourcesEmpty")}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t("memory.knowledge.missing")}</div>
                )}
              </DiagnosticsCard>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              {t("memory.knowledge.diagUnavailable")}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}
