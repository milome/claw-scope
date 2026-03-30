import type { ReactNode } from "react";
import type {
  GatewayAgentMemoryResult,
} from "../../contexts/OpenClawContext";

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

type DiagnosticsDrawerState = {
  open: boolean;
  source: "search" | "knowledge";
};

export function DiagnosticsCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 ${className}`.trim()}
    >
      <div className="font-medium">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function diagnosticsTone(summary: HealthProbeSummary | null) {
  if (!summary) {
    return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
  if (summary.primaryIssue) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300";
}

type MemoryDiagnosticsDrawerProps = {
  diagnosticsDrawer: DiagnosticsDrawerState;
  healthProbeSummary: HealthProbeSummary | null;
  memoryResult: GatewayAgentMemoryResult | null;
  runtimeStatusSummary: RuntimeStatusSummary | null;
  isLocalGatewaySession: boolean;
  t: (key: string, ...args: (string | number)[]) => string;
  onClose: () => void;
};

export function MemoryDiagnosticsDrawer({
  diagnosticsDrawer,
  healthProbeSummary,
  memoryResult,
  runtimeStatusSummary,
  isLocalGatewaySession,
  t,
  onClose,
}: MemoryDiagnosticsDrawerProps) {
  if (!diagnosticsDrawer.open || (!healthProbeSummary && !memoryResult?.diagnostics)) {
    return null;
  }

  return (
    <div className="absolute inset-y-0 right-0 z-20 w-full max-w-md border-l border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("memory.diag.drawer")}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("memory.diag.openedFrom", diagnosticsDrawer.source)}</div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
        >
          Close
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {healthProbeSummary && (
          <>
            <DiagnosticsCard
              title={t("memory.diag.healthProbe")}
              className={diagnosticsTone(healthProbeSummary)}
            >
              <div>{healthProbeSummary.primaryIssue ?? t("memory.diag.noIssue")}</div>
            </DiagnosticsCard>
            <div className="grid gap-3 md:grid-cols-3">
              <DiagnosticsCard title={t("memory.diag.provider")} className="bg-white shadow-sm dark:bg-slate-950/60">
                <div>{healthProbeSummary.provider}</div>
              </DiagnosticsCard>
              <DiagnosticsCard title={t("memory.diag.model")} className="bg-white shadow-sm dark:bg-slate-950/60">
                <div>{healthProbeSummary.model}</div>
              </DiagnosticsCard>
              <DiagnosticsCard title={t("memory.diag.embeddings")} className="bg-white shadow-sm dark:bg-slate-950/60">
                <div>
                  {healthProbeSummary.embeddingsReady === true
                    ? t("memory.diag.ready")
                    : healthProbeSummary.embeddingsReady === false
                      ? t("memory.diag.unavailableShort")
                      : t("memory.diag.unknownShort")}
                </div>
              </DiagnosticsCard>
            </div>
            <DiagnosticsCard title={t("memory.diag.rawDoctor")}>
              <pre className="overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{healthProbeSummary.rawPayload}</pre>
            </DiagnosticsCard>
          </>
        )}
        <DiagnosticsCard title={t("memory.diag.runtimeStatus")}>
          {runtimeStatusSummary ? (
            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div>
                indexed: {runtimeStatusSummary.indexedFiles}
                {runtimeStatusSummary.totalFiles != null
                  ? `/${runtimeStatusSummary.totalFiles}`
                  : ""} files · {runtimeStatusSummary.chunks} chunks
              </div>
              {runtimeStatusSummary.bySource.map((item) => (
                <div key={item.source}>
                  {item.source}: {item.files} files · {item.chunks} chunks
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-500 dark:text-slate-400">
              {isLocalGatewaySession
                ? t("memory.diag.runtimePlaceholder")
                : t("memory.diag.runtimeRemoteUnavailable")}
            </div>
          )}
        </DiagnosticsCard>
        <DiagnosticsCard title={t("memory.diag.knowledge")}>
          {memoryResult?.diagnostics ? (
            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div>backend: {memoryResult.diagnostics.backend}</div>
              <div>provider: {memoryResult.diagnostics.provider ?? t("memory.knowledge.providerFallback")}</div>
              <div>store: {memoryResult.diagnostics.builtinStorePath}</div>
              <div>sources: {memoryResult.diagnostics.sources.join(", ") || t("memory.knowledge.sourcesEmpty")}</div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("memory.knowledge.missing")}</div>
          )}
        </DiagnosticsCard>
      </div>
    </div>
  );
}
