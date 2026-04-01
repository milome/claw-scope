import type { ReactNode } from "react";
import type {
  GatewayAgentMemoryRuntimeStatusResult,
  GatewayAgentMemoryResult,
} from "../../contexts/OpenClawContext";
import { ArchiveDiagnosticsCard, ArchiveDiagnosticsLayout, ArchiveDrawer, archiveDiagnosticsTone } from "./memoryArchiveUi";
import { buildMemoryConfigStatusSummary } from "./memoryConfigStatus";
import { buildExternalKnowledgeViewModel } from "./memoryKnowledgeState";

type HealthProbeSummary = {
  provider: string;
  model: string;
  embeddingsReady: boolean | null;
  embeddingsError: string | null;
  rawPayload: string;
  primaryIssue: string | null;
};

type RuntimeStatusSummary = {
  agentId: string;
  provider: string;
  model: string | null;
  embeddingOk: boolean;
  embeddingError: string | null;
  indexedFiles: number;
  totalFiles: number | null;
  chunks: number;
  bySource: { source: string; files: number; chunks: number }[];
  rawPayload: string;
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
  selectedAgentId: string;
  t: (key: string, ...args: (string | number)[]) => string;
  onClose: () => void;
};

export function MemoryDiagnosticsDrawer({
  diagnosticsDrawer,
  healthProbeSummary,
  memoryResult,
  runtimeStatusSummary,
  isLocalGatewaySession,
  selectedAgentId,
  t,
  onClose,
}: MemoryDiagnosticsDrawerProps) {
  if (!diagnosticsDrawer.open || (!healthProbeSummary && !memoryResult && !runtimeStatusSummary)) {
    return null;
  }

  const runtimeStatus = runtimeStatusSummary
    ? ({
        agentId: runtimeStatusSummary.agentId,
        embeddingOk: runtimeStatusSummary.embeddingOk,
        embeddingError: runtimeStatusSummary.embeddingError,
        vectorOk: runtimeStatusSummary.embeddingOk,
        status: {
          backend: memoryResult?.diagnostics?.backend ?? "unknown",
          files: runtimeStatusSummary.indexedFiles,
          totalFiles: runtimeStatusSummary.totalFiles,
          chunks: runtimeStatusSummary.chunks,
          dirty: false,
          workspaceDir: null,
          dbPath: null,
          provider: runtimeStatusSummary.provider,
          model: runtimeStatusSummary.model,
          requestedProvider: runtimeStatusSummary.provider,
          sources: memoryResult?.diagnostics?.sources ?? [],
          extraPaths: memoryResult?.diagnostics?.extraPaths ?? [],
          sourceCounts: runtimeStatusSummary.bySource,
        },
        rawPayload: runtimeStatusSummary.rawPayload,
      } satisfies GatewayAgentMemoryRuntimeStatusResult)
    : null;

  const configStatus = buildMemoryConfigStatusSummary({
    selectedAgentId,
    isLocalGatewaySession,
    memoryResult,
    memoryStatus: null,
    runtimeStatus,
  });
  const knowledgeModel = buildExternalKnowledgeViewModel({
    diagnostics: memoryResult?.diagnostics,
    externalSources: [
      ...(memoryResult?.diagnostics?.extraPaths ?? []).map((value) => ({
        id: `extra:${value}`,
        kind: "extra_path" as const,
        value,
      })),
      ...(memoryResult?.diagnostics?.qmdPaths ?? []).map((value) => ({
        id: `qmd:${value}`,
        kind: "qmd_path" as const,
        value,
      })),
    ],
    runtimeStatus,
    isLocalGatewaySession,
  });

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
          <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <div>{t(`memory.knowledge.summary.${configStatus.statusKey}`)}</div>
            <div>{configStatus.localWritable ? t("memory.knowledge.bridgeStatus.local") : t("memory.knowledge.bridgeStatus.remote")}</div>
            <div>diagnostics: {knowledgeModel.diagnosticsAvailable ? t("memory.diag.ready") : t("memory.diag.unavailableShort")}</div>
            <div>backend: {knowledgeModel.backend ?? t("memory.diag.unavailable")}</div>
            <div>provider: {knowledgeModel.provider ?? t("memory.knowledge.providerFallback")}</div>
            <div>sources: {knowledgeModel.sources.join(", ") || t("memory.knowledge.sourcesEmpty")}</div>
            <div>extra paths: {knowledgeModel.extraPaths.join(", ") || t("memory.knowledge.none")}</div>
            <div>qmd paths: {knowledgeModel.qmdPaths.join(", ") || t("memory.knowledge.none")}</div>
            <div>session memory: {knowledgeModel.sessionMemoryEnabled ? t("memory.diag.ready") : t("memory.diag.unavailableShort")}</div>
            <div>
              runtime: {knowledgeModel.runtimeAvailable
                ? `${knowledgeModel.runtimeSummary?.files ?? 0} files · ${knowledgeModel.runtimeSummary?.chunks ?? 0} chunks`
                : t(isLocalGatewaySession ? "memory.diag.runtimePlaceholder" : "memory.diag.runtimeRemoteUnavailable")}
            </div>
            {!knowledgeModel.diagnosticsAvailable ? <div>{t("memory.knowledge.missing")}</div> : null}
          </div>
        </DiagnosticsCard>
      </ArchiveDiagnosticsLayout>
    </ArchiveDrawer>
  );
}
