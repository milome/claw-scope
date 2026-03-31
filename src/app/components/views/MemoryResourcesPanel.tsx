import { ChevronDown, ChevronRight, Database, FileText, FolderTree, Route } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { diagnosticsTone } from "./MemoryDiagnosticsDrawer";
import type { GatewayAgentMemoryResult, GatewayAgentMemoryTimelineResult } from "../../contexts/OpenClawContext";
import type { MemoryExternalSourceItem } from "./memoryState";
import { buildMemoryResourceGroups } from "./memoryResourcesState";
import { ArchiveDetailPane, ArchiveDiagnosticsCard, ArchiveEditorPane, ArchiveInfoBlock, ArchiveNotice, ArchiveSectionCard, ArchiveSplitPanel } from "./memoryArchiveUi";

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

type MemoryResourcesPanelProps = {
  memoryResult: GatewayAgentMemoryResult | null;
  timelineResult: GatewayAgentMemoryTimelineResult | null;
  externalSources: MemoryExternalSourceItem[];
  healthProbeSummary: HealthProbeSummary | null;
  runtimeStatusSummary: RuntimeStatusSummary | null;
  isLocalGatewaySession: boolean;
  t: (key: string, ...args: (string | number)[]) => string;
  onOpenDiagnostics: () => void;
};

function groupIcon(groupId: string) {
  if (groupId.includes("documents")) {
    return FileText;
  }
  if (groupId.includes("timeline")) {
    return Route;
  }
  if (groupId.includes("external")) {
    return FolderTree;
  }
  return Database;
}

export function MemoryResourcesPanel({
  memoryResult,
  timelineResult,
  externalSources,
  healthProbeSummary,
  runtimeStatusSummary,
  isLocalGatewaySession,
  t,
  onOpenDiagnostics,
}: MemoryResourcesPanelProps) {
  const groups = useMemo(
    () => buildMemoryResourceGroups({
      workspace: memoryResult?.workspace,
      documents: memoryResult?.documents ?? [],
      timeline: timelineResult,
      externalSources,
      diagnostics: memoryResult?.diagnostics,
    }),
    [externalSources, memoryResult?.diagnostics, memoryResult?.documents, memoryResult?.workspace, timelineResult],
  );

  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({
    "resources:documents": true,
    "resources:timeline": true,
  });
  const [selectedLeafId, setSelectedLeafId] = useState<string>(groups[0]?.leaves[0]?.id ?? "");

  const selectedLeaf = groups.flatMap((group) => group.leaves).find((leaf) => leaf.id === selectedLeafId) ?? null;

  return (
    <motion.div
      key="view-resources"
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <ArchiveSplitPanel
        icon={FolderTree}
        title="Resources"
        description="Structural sources, files, diagnostics, and runtime topology live here instead of the semantic mind map."
        columns="lg:grid-cols-[1.05fr_0.95fr]"
        left={(
          <ArchiveSectionCard>
            <div className="mb-4 flex items-start justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <FolderTree className="h-3.5 w-3.5" />
                  Structural topology
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">This panel is the Phase 1 landing zone for files, paths, and runtime/source topology.</div>
                <div className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                  It intentionally separates structural browsing from the future semantic mind-map pipeline.
                </div>
              </div>
              <button
                onClick={onOpenDiagnostics}
                className="shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
              >
                Open diagnostics
              </button>
            </div>

            <div className="space-y-3">
              {groups.map((group) => {
                const Icon = groupIcon(group.id);
                const expanded = expandedGroupIds[group.id] ?? false;
                return (
                  <div key={group.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setExpandedGroupIds((current) => ({ ...current, [group.id]: !expanded }))}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950/60">
                          <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{group.title}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{group.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{group.leaves.length}</span>
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </button>
                    {expanded ? (
                      <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-800">
                        {group.leaves.length === 0 ? (
                          <ArchiveNotice>{t("memory.knowledge.pathsUnavailable")}</ArchiveNotice>
                        ) : (
                          <div className="space-y-2">
                            {group.leaves.map((leaf) => (
                              <button
                                key={leaf.id}
                                type="button"
                                onClick={() => setSelectedLeafId(leaf.id)}
                                className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${selectedLeafId === leaf.id ? "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-slate-800" : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700"}`}
                              >
                                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                                <div className="min-w-0">
                                  <div className="break-all text-sm font-medium text-slate-900 dark:text-slate-100">{leaf.label}</div>
                                  {leaf.meta ? <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{leaf.meta}</div> : null}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </ArchiveSectionCard>
        )}
        right={(
          <ArchiveSectionCard>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Selected resource</div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{selectedLeaf?.label ?? "No resource selected"}</div>
              {selectedLeaf?.meta ? <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{selectedLeaf.meta}</div> : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ArchiveInfoBlock title="Workspace">
                <div className="mt-1 break-all text-slate-800 dark:text-slate-100">{memoryResult?.workspace ?? t("memory.diag.unavailable")}</div>
              </ArchiveInfoBlock>
              <ArchiveInfoBlock title={t("memory.diag.runtimeStatus")}>
                {runtimeStatusSummary ? (
                  <div className="mt-1 text-slate-800 dark:text-slate-100">
                    {runtimeStatusSummary.indexedFiles}
                    {runtimeStatusSummary.totalFiles != null ? `/${runtimeStatusSummary.totalFiles}` : ""} files · {runtimeStatusSummary.chunks} chunks
                  </div>
                ) : (
                  <div className="mt-1 text-slate-800 dark:text-slate-100">{isLocalGatewaySession ? t("memory.diag.runtimePlaceholder") : t("memory.diag.runtimeRemoteUnavailable")}</div>
                )}
              </ArchiveInfoBlock>
            </div>

            {healthProbeSummary ? (
              <ArchiveDiagnosticsCard title={t("memory.diag.healthProbe")} className={`mt-4 text-xs ${diagnosticsTone(healthProbeSummary)}`}>
                <div>{healthProbeSummary.provider} / {healthProbeSummary.model}</div>
                <div className="mt-1">embeddings: {healthProbeSummary.embeddingsReady === true ? t("memory.diag.ready") : healthProbeSummary.embeddingsReady === false ? t("memory.diag.unavailableShort") : t("memory.diag.unknownShort")}</div>
              </ArchiveDiagnosticsCard>
            ) : null}

            <ArchiveDiagnosticsCard title="Resource payload" className="mt-4 text-sm leading-7 text-slate-800 dark:text-slate-100">
              {selectedLeaf?.content ? selectedLeaf.content : "Select a file, path, or runtime signal to inspect its current payload or reference string."}
            </ArchiveDiagnosticsCard>

            <ArchiveDiagnosticsCard title="Phase 1 separation contract" className="mt-4 text-xs">
              <div className="space-y-2 text-slate-500 dark:text-slate-400">
                <div>This panel owns structural/resource browsing.</div>
                <div>It is the explicit landing zone for diagnostics, file paths, and source topology.</div>
                <div>The future semantic `Mind Map` must not reuse this data as its primary semantic graph payload.</div>
              </div>
            </ArchiveDiagnosticsCard>
          </ArchiveSectionCard>
        )}
      />

      <ArchiveDetailPane>
        <ArchiveEditorPane
          header={<div className="text-sm font-semibold">Resources split status</div>}
          body={(
            <>
              <ArchiveDiagnosticsCard title="Phase 1 outcome">
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  <div>Structural data is now isolated in a dedicated panel path.</div>
                  <div>The current semantic map path can be replaced in Phase 2 and Phase 3 without reusing resource topology assumptions.</div>
                </div>
              </ArchiveDiagnosticsCard>
              <ArchiveDiagnosticsCard title="Panel scope">
                <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <div>Documents and timeline entries remain structural resources here.</div>
                  <div>External paths and runtime signals remain structural resources here.</div>
                  <div>Semantic concept derivation does not belong in this panel.</div>
                </div>
              </ArchiveDiagnosticsCard>
            </>
          )}
        />
      </ArchiveDetailPane>
    </motion.div>
  );
}
