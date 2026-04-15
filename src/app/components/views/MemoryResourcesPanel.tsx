import { ChevronDown, ChevronRight, Database, FileText, FolderTree, Route } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { GatewayAgentMemoryResult, GatewayAgentMemoryTimelineResult } from "../../contexts/OpenClawContext";
import type { MemoryExternalSourceItem } from "./memoryState";
import { buildMemoryResourceGroups } from "./memoryResourcesState";
import { ArchiveDetailPane, ArchiveDiagnosticsCard, ArchiveEditorPane, ArchiveInfoBlock, ArchiveNotice, ArchiveSectionCard, ArchiveSplitPanel, ArchiveStatCard } from "./memoryArchiveUi";
import { resourceToneForGroup, resolveResourceToneClasses } from "./viewTone";

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
  onOpenResource: (resource: {
    kind: "document" | "timeline" | "external_source" | "runtime_signal";
    label: string;
    meta?: string;
  }) => void;
  compact?: boolean;
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
  onOpenResource,
  compact = false,
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
  const resourceCount = groups.reduce((count, group) => count + group.leaves.length, 0);
  const topGroup = groups.reduce<(typeof groups)[number] | null>((current, group) => {
    if (!current || group.leaves.length > current.leaves.length) {
      return group;
    }
    return current;
  }, null);
  const selectedLeafGroup = groups.find((group) => group.leaves.some((leaf) => leaf.id === selectedLeafId)) ?? null;
  const selectedToneClasses = resolveResourceToneClasses(resourceToneForGroup(selectedLeafGroup?.id ?? "resources:runtime"));

  if (compact) {
    return (
      <ArchiveSectionCard tone="sky">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <FolderTree className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          {t("memory.resources.title")}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ArchiveStatCard
            label={t("memory.resources.workspace")}
            value={<span className="break-all text-sm font-medium text-slate-700 dark:text-slate-200">{memoryResult?.workspace ?? t("memory.diag.unavailable")}</span>}
            meta={topGroup ? t(topGroup.titleKey) : t("memory.resources.noneSelected")}
          />
          <ArchiveStatCard
            label={t("memory.resources.total")}
            value={<span className="text-sm font-medium">{resourceCount}</span>}
            meta={t("memory.resources.totalMeta", groups.length)}
          />
          <ArchiveStatCard
            label={t("memory.diag.runtimeStatus")}
            value={<span className="text-sm font-medium">{runtimeStatusSummary ? `${runtimeStatusSummary.indexedFiles}${runtimeStatusSummary.totalFiles != null ? `/${runtimeStatusSummary.totalFiles}` : ""}` : t(isLocalGatewaySession ? "memory.diag.runtimePlaceholder" : "memory.diag.runtimeRemoteUnavailable")}</span>}
            meta={runtimeStatusSummary ? `${runtimeStatusSummary.chunks} ${t("common.chunks")}` : "-"}
          />
          <ArchiveStatCard
            label={t("memory.resources.tree")}
            value={<span className="text-sm font-medium">{topGroup ? t(topGroup.titleKey) : t("memory.resources.noneSelected")}</span>}
            meta={topGroup ? t("memory.resources.count", topGroup.leaves.length) : t("memory.resources.treeHint")}
          />
        </div>

        <div className="mt-4 space-y-3">
          {groups.map((group) => {
            const Icon = groupIcon(group.id);
            const toneClasses = resolveResourceToneClasses(resourceToneForGroup(group.id));
            const expanded = expandedGroupIds[group.id] ?? false;
            return (
          <div key={group.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setExpandedGroupIds((current) => ({ ...current, [group.id]: !expanded }))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-xl border p-2 ${toneClasses.iconWrap}`}>
                      <Icon className={`h-4 w-4 ${toneClasses.icon}`} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t(group.titleKey)}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(group.descriptionKey)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{t("memory.resources.count", group.leaves.length)}</span>
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
                            onClick={() => {
                              setSelectedLeafId(leaf.id);
                              onOpenResource({ kind: leaf.kind, label: leaf.label, meta: leaf.meta });
                            }}
                            className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${selectedLeafId === leaf.id ? toneClasses.selected : `border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 ${toneClasses.hover}`}`}
                          >
                            <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${toneClasses.dot}`} />
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
    );
  }

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
        title={t("memory.resources.title")}
        description={t("memory.resources.desc")}
        columns="lg:grid-cols-[1.05fr_0.95fr]"
        left={(
          <ArchiveSectionCard tone="sky">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <FolderTree className="w-4 h-4 text-sky-500 dark:text-sky-400" />
              {t("memory.resources.title")}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ArchiveStatCard
                label={t("memory.resources.workspace")}
                value={<span className="break-all text-sm font-medium text-slate-700 dark:text-slate-200">{memoryResult?.workspace ?? t("memory.diag.unavailable")}</span>}
              />
              <ArchiveStatCard
                label={t("memory.resources.total")}
                value={<span className="text-sm font-medium">{resourceCount}</span>}
                meta={t("memory.resources.totalMeta", groups.length)}
              />
              <ArchiveStatCard
                label={t("memory.diag.runtimeStatus")}
                value={<span className="text-sm font-medium">{runtimeStatusSummary ? `${runtimeStatusSummary.indexedFiles}${runtimeStatusSummary.totalFiles != null ? `/${runtimeStatusSummary.totalFiles}` : ""}` : t(isLocalGatewaySession ? "memory.diag.runtimePlaceholder" : "memory.diag.runtimeRemoteUnavailable")}</span>}
                meta={runtimeStatusSummary ? `${runtimeStatusSummary.chunks} chunks` : "-"}
              />
              <ArchiveStatCard
                label={t("memory.resources.topGroup")}
                value={<span className="text-sm font-medium">{topGroup ? t(topGroup.titleKey) : t("memory.resources.noneSelected")}</span>}
                meta={topGroup ? t("memory.resources.count", topGroup.leaves.length) : "-"}
              />
            </div>
            <div className="mt-4 flex items-center justify-end">
              <button
                onClick={onOpenDiagnostics}
                className={`shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 ${selectedToneClasses.action}`}
              >
                {t("memory.resources.openDiagnostics")}
              </button>
            </div>

            <div className="space-y-3">
              {groups.map((group) => {
                const Icon = groupIcon(group.id);
                const toneClasses = resolveResourceToneClasses(resourceToneForGroup(group.id));
                const expanded = expandedGroupIds[group.id] ?? false;
                return (
                  <div key={group.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setExpandedGroupIds((current) => ({ ...current, [group.id]: !expanded }))}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`rounded-xl border p-2 ${toneClasses.iconWrap}`}>
                          <Icon className={`h-4 w-4 ${toneClasses.icon}`} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t(group.titleKey)}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(group.descriptionKey)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{t("memory.resources.count", group.leaves.length)}</span>
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
                                onClick={() => {
                                  setSelectedLeafId(leaf.id);
                                  onOpenResource({ kind: leaf.kind, label: leaf.label, meta: leaf.meta });
                                }}
                                className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${selectedLeafId === leaf.id ? toneClasses.selected : `border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 ${toneClasses.hover}`}`}
                              >
                                <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${toneClasses.dot}`} />
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
          <ArchiveSectionCard tone="sky">
            <div className={`rounded-3xl border p-4 ${selectedToneClasses.iconWrap}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t("memory.resources.selected")}</div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{selectedLeaf?.label ?? t("memory.resources.noneSelected")}</div>
              {selectedLeaf?.meta ? <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{selectedLeaf.meta}</div> : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ArchiveInfoBlock title={t("memory.resources.workspace")}>
                <div className="mt-1 break-all text-slate-800 dark:text-slate-100">{memoryResult?.workspace ?? t("memory.diag.unavailable")}</div>
              </ArchiveInfoBlock>
              <ArchiveInfoBlock title={t("memory.diag.runtimeStatus")}>
                {runtimeStatusSummary ? (
                  <div className="mt-1 text-slate-800 dark:text-slate-100">
                    {runtimeStatusSummary.indexedFiles}
                    {runtimeStatusSummary.totalFiles != null ? `/${runtimeStatusSummary.totalFiles}` : ""} {t("common.files")} · {runtimeStatusSummary.chunks} {t("common.chunks")}
                  </div>
                ) : (
                  <div className="mt-1 text-slate-800 dark:text-slate-100">{isLocalGatewaySession ? t("memory.diag.runtimePlaceholder") : t("memory.diag.runtimeRemoteUnavailable")}</div>
                )}
              </ArchiveInfoBlock>
            </div>

            {healthProbeSummary ? (
              <ArchiveDiagnosticsCard title={t("memory.diag.healthProbe")} className="mt-4 text-xs" tone={resourceToneForGroup(selectedLeafGroup?.id ?? "resources:runtime")}>
                <div>{healthProbeSummary.provider} / {healthProbeSummary.model}</div>
                <div className="mt-1">{t("memory.resources.embeddings")}: {healthProbeSummary.embeddingsReady === true ? t("memory.diag.ready") : healthProbeSummary.embeddingsReady === false ? t("memory.diag.unavailableShort") : t("memory.diag.unknownShort")}</div>
              </ArchiveDiagnosticsCard>
            ) : null}

            <ArchiveDiagnosticsCard title={t("memory.resources.payload")} className="mt-4 text-sm leading-7 text-slate-800 dark:text-slate-100" tone={resourceToneForGroup(selectedLeafGroup?.id ?? "resources:runtime")}>
              {selectedLeaf?.content ? selectedLeaf.content : t("memory.resources.payloadEmpty")}
            </ArchiveDiagnosticsCard>

            <ArchiveDiagnosticsCard title={t("memory.resources.phase1Contract")} className="mt-4 text-xs">
              <div className="space-y-2 text-slate-500 dark:text-slate-400">
                <div>{t("memory.resources.scopeLine1")}</div>
                <div>{t("memory.resources.scopeLine2")}</div>
                <div>{t("memory.resources.scopeLine3")}</div>
              </div>
            </ArchiveDiagnosticsCard>
          </ArchiveSectionCard>
        )}
      />

      <ArchiveDetailPane>
        <ArchiveEditorPane
          header={<div className="text-sm font-semibold">{t("memory.resources.phase1Status")}</div>}
          tone={resourceToneForGroup(selectedLeafGroup?.id ?? "resources:runtime")}
          body={(
            <>
              <ArchiveDiagnosticsCard title={t("memory.resources.phase1Outcome")} tone={resourceToneForGroup(selectedLeafGroup?.id ?? "resources:runtime")}>
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  <div>{t("memory.resources.phase1OutcomeLine1")}</div>
                  <div>{t("memory.resources.phase1OutcomeLine2")}</div>
                </div>
              </ArchiveDiagnosticsCard>
              <ArchiveDiagnosticsCard title={t("memory.resources.panelScope")} tone={resourceToneForGroup(selectedLeafGroup?.id ?? "resources:runtime")}>
                <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <div>{t("memory.resources.scopeLine1")}</div>
                  <div>{t("memory.resources.scopeLine2")}</div>
                  <div>{t("memory.resources.scopeLine3")}</div>
                </div>
              </ArchiveDiagnosticsCard>
            </>
          )}
        />
      </ArchiveDetailPane>
    </motion.div>
  );
}
