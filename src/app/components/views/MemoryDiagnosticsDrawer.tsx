import type { ReactNode } from "react";
import type {
  GatewayAgentMemoryResult,
} from "../../contexts/OpenClawContext";
import { ArchiveDiagnosticsCard, ArchiveDiagnosticsLayout, ArchiveDrawer, archiveDiagnosticsTone } from "./memoryArchiveUi";

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

function DiagnosticsCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ArchiveDiagnosticsCard title={title} className={className}>
      {children}
    </ArchiveDiagnosticsCard>
  );
}

export function diagnosticsTone(summary: HealthProbeSummary | null) {
  return archiveDiagnosticsTone(summary ? Boolean(summary.primaryIssue) : null);
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
    <ArchiveDrawer>
      <ArchiveDiagnosticsLayout
        title={t("memory.diag.drawer")}
        subtitle={t("memory.diag.openedFrom", diagnosticsDrawer.source)}
        onClose={onClose}
      >
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
      </ArchiveDiagnosticsLayout>
    </ArchiveDrawer>
  );
}
