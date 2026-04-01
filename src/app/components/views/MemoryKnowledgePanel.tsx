import { Copy, FolderTree, Link2, Plus, RefreshCw, ShieldCheck, Trash2, Activity } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  GatewayAgentMemoryResult,
  GatewayAgentMemoryStatusResult,
  GatewayAgentMemoryRuntimeStatusResult,
} from "../../contexts/OpenClawContext";
import type { SemanticMindMapModel } from "./memorySemanticTypes";
import type { MemoryExternalSourceItem } from "./memoryState";
import { buildExternalKnowledgeViewModel, isBlockedExternalKnowledgePath } from "./memoryKnowledgeState";
import { buildMemoryConfigStatusSummary, memoryConfigBridgeMessageKey, memoryConfigStatusMessageKey, memoryReindexModeMessageKey } from "./memoryConfigStatus";
import {
  runExternalKnowledgeReindex,
  setExternalKnowledgePaths,
  setExternalKnowledgeSources,
  setSessionMemoryEnabled,
  type MemoryKnowledgeActionFailure,
  type MemoryKnowledgeActionKind,
} from "./memoryKnowledgeActions";
import { MemoryMindMapPanel } from "./MemoryMindMapPanel";
import { ArchiveActionButton, ArchiveNotice, ArchiveSectionCard, ArchiveStatCard, type ArchiveTone } from "./memoryArchiveUi";
import { resolveInputTone, resolveViewToneClasses } from "./viewTone";

type FieldErrorState = {
  extraPath?: string | null;
  sessionMemory?: string | null;
  sources?: string | null;
  reindex?: string | null;
};

type MemoryKnowledgePanelProps = {
  tone?: ArchiveTone;
  memoryResult: GatewayAgentMemoryResult | null;
  memoryStatus: GatewayAgentMemoryStatusResult | null;
  runtimeStatus: GatewayAgentMemoryRuntimeStatusResult | null;
  externalSources: MemoryExternalSourceItem[];
  isLocalGatewaySession: boolean;
  selectedAgentId: string;
  model: SemanticMindMapModel;
  t: (key: string, ...args: (string | number)[]) => string;
  showDebug: boolean;
  onToggleDebug: () => void;
  onOpenEvidence: (evidence: {
    entryId: string;
    title: string;
    sourceKind: "document" | "timeline";
    path?: string;
    snippet: string;
    matchedTerms: string[];
  }) => void;
  openHint: string | null;
  onRefreshKnowledge: () => Promise<void>;
};

export function MemoryKnowledgePanel({
  tone = "sky",
  memoryResult,
  memoryStatus,
  runtimeStatus,
  externalSources,
  isLocalGatewaySession,
  selectedAgentId,
  model,
  t,
  showDebug,
  onToggleDebug,
  onOpenEvidence,
  openHint,
  onRefreshKnowledge,
}: MemoryKnowledgePanelProps) {
  const tonePalette = resolveViewToneClasses(tone);
  const toneClasses = {
    icon: tonePalette.iconText,
    soft: tonePalette.softBadge,
    chip: tonePalette.softBadge,
    input: resolveInputTone(tone),
    checkbox: tone === "violet" ? "text-violet-600" : tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : tone === "rose" ? "text-rose-600" : "text-sky-600",
  };
  const knowledgeModel = buildExternalKnowledgeViewModel({
    diagnostics: memoryResult?.diagnostics,
    externalSources,
    runtimeStatus,
    isLocalGatewaySession,
  });
  const [newExtraPath, setNewExtraPath] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrorState>({});
  const [savingAction, setSavingAction] = useState<MemoryKnowledgeActionKind | null>(null);
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);
  const [reindexFeedback, setReindexFeedback] = useState<string | null>(null);
  const statusSummary = buildMemoryConfigStatusSummary({
    selectedAgentId,
    isLocalGatewaySession,
    memoryResult,
    memoryStatus,
    runtimeStatus,
  });
  const autoReindexEnabled = statusSummary.reindexMode === "auto";
  const externalEntryCount = knowledgeModel.sections.reduce((count, section) => count + section.entries.length, 0);

  useEffect(() => {
    if (!knowledgeModel.localWritable) {
      setFieldErrors({});
    }
  }, [knowledgeModel.localWritable]);

  const setFieldError = (field: keyof FieldErrorState, message: string | null) => {
    setFieldErrors((current) => ({ ...current, [field]: message }));
  };

  const clearFieldError = (field: keyof FieldErrorState) => {
    setFieldErrors((current) => ({ ...current, [field]: null }));
  };

  const runAction = async (
    kind: Exclude<MemoryKnowledgeActionKind, "reindex">,
    field: keyof FieldErrorState,
    runner: () => Promise<{ stdout: string }>,
  ) => {
    setSavingAction(kind);
    clearFieldError(field);
    try {
      const result = await runner();
      await onRefreshKnowledge();
      setConfigFeedback(result.stdout || t("memory.knowledge.configUpdated"));
      setReindexFeedback(null);
      return result;
    } catch (error) {
      const failure = error as MemoryKnowledgeActionFailure;
      setFieldError(field, failure.message);
      setConfigFeedback(null);
      toast.error(failure.message);
      return null;
    } finally {
      setSavingAction(null);
    }
  };

  const handleCopyRemoteGuide = async () => {
    try {
      await navigator.clipboard.writeText(statusSummary.commandGuide);
      toast.success(t("memory.search.commands.copySuccess"));
    } catch {
      toast.error(t("memory.search.commands.copyFailed"));
    }
  };

  const handleRunReindex = async () => {
    if (!statusSummary.localWritable || !selectedAgentId) {
      return;
    }

    setSavingAction("reindex");
    clearFieldError("reindex");
    try {
      const result = await runExternalKnowledgeReindex(
        selectedAgentId,
        statusSummary.reindexStrategy,
        t,
      );
      await onRefreshKnowledge();
      setReindexFeedback(result.stdout || t("memory.knowledge.reindexDone"));
      setConfigFeedback(null);
      toast.success(t("memory.knowledge.reindexDone"));
    } catch (error) {
      const failure = error as MemoryKnowledgeActionFailure;
      setFieldError("reindex", failure.message);
      toast.error(failure.message);
    } finally {
      setSavingAction(null);
    }
  };

  const runPostConfigReindex = async () => {
    if (!autoReindexEnabled || !statusSummary.localWritable || !selectedAgentId) {
      return;
    }

    setSavingAction("reindex");
    clearFieldError("reindex");
    setReindexFeedback(t("memory.knowledge.reindexAutoRunning"));
    try {
      const result = await runExternalKnowledgeReindex(
        selectedAgentId,
        statusSummary.reindexStrategy,
        t,
      );
      await onRefreshKnowledge();
      setReindexFeedback(result.stdout || t("memory.knowledge.reindexDone"));
    } catch (error) {
      const failure = error as MemoryKnowledgeActionFailure;
      setFieldError("reindex", failure.message);
    } finally {
      setSavingAction(null);
    }
  };

  const handleAddExtraPath = async () => {
    const normalized = newExtraPath.trim();
    if (!normalized) {
      setFieldError("extraPath", t("memory.knowledge.pathRequired"));
      return;
    }
    if (knowledgeModel.extraPaths.includes(normalized)) {
      setFieldError("extraPath", t("memory.knowledge.pathDuplicate"));
      return;
    }
    if (isBlockedExternalKnowledgePath(normalized)) {
      setFieldError("extraPath", t("memory.knowledge.pathBlocked"));
      return;
    }

    const nextPaths = [...knowledgeModel.extraPaths, normalized];
    const result = await runAction(
      "set_extra_paths",
      "extraPath",
      () => setExternalKnowledgePaths(nextPaths, t),
    );
    if (result) {
      startTransition(() => setNewExtraPath(""));
      toast.success(t("memory.knowledge.pathAdded"));
      await runPostConfigReindex();
    }
  };

  const handleRemoveExtraPath = async (path: string) => {
    if (!globalThis.confirm?.(t("memory.knowledge.removePathConfirm", path))) {
      return;
    }

    const nextPaths = knowledgeModel.extraPaths.filter((item) => item !== path);
    const result = await runAction(
      "set_extra_paths",
      "extraPath",
      () => setExternalKnowledgePaths(nextPaths, t),
    );
    if (result) {
      toast.success(t("memory.knowledge.pathRemoved"));
      await runPostConfigReindex();
    }
  };

  const handleToggleSessionMemory = async (enabled: boolean) => {
    let nextSources = knowledgeModel.sources;
    if (enabled && !knowledgeModel.sources.includes("sessions")) {
      nextSources = [...knowledgeModel.sources, "sessions"];
    }

    const result = await runAction(
      "set_session_memory",
      "sessionMemory",
      async () => {
        const sessionResult = await setSessionMemoryEnabled(enabled, t);
        if (enabled && !knowledgeModel.sources.includes("sessions")) {
          await setExternalKnowledgeSources(nextSources, t);
        }
        return {
          ...sessionResult,
          stdout: enabled && !knowledgeModel.sources.includes("sessions")
            ? t("memory.knowledge.sessionToggleOnWithSources")
            : sessionResult.stdout,
        };
      },
    );
    if (result) {
      toast.success(t(enabled ? "memory.knowledge.sessionToggleOn" : "memory.knowledge.sessionToggleOff"));
      await runPostConfigReindex();
    }
  };

  const handleToggleSource = async (source: "memory" | "sessions") => {
    const sourceSet = new Set(knowledgeModel.sources);
    if (sourceSet.has(source)) {
      sourceSet.delete(source);
    } else {
      sourceSet.add(source);
    }

    if (sourceSet.size === 0) {
      setFieldError("sources", t("memory.knowledge.sourcesRequired"));
      return;
    }

    if (!knowledgeModel.sessionMemoryEnabled && sourceSet.has("sessions")) {
      setFieldError("sources", t("memory.knowledge.sessionsSourceNeedsSessionMemory"));
      return;
    }

    const nextSources = Array.from(sourceSet);
    const result = await runAction(
      "set_sources",
      "sources",
      () => setExternalKnowledgeSources(nextSources, t),
    );
    if (result) {
      toast.success(t("memory.knowledge.sourcesUpdated"));
      await runPostConfigReindex();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4">
      {openHint ? <ArchiveNotice>{openHint}</ArchiveNotice> : null}

      <MemoryMindMapPanel
        tone={tone}
        model={model}
        t={t}
        showDebug={showDebug}
        onToggleDebug={onToggleDebug}
        onOpenEvidence={onOpenEvidence}
      />

      <ArchiveSectionCard tone={tone}>
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <FolderTree className={`w-4 h-4 ${toneClasses.icon}`} />
          {t("memory.knowledge.title")}
        </div>

        {!knowledgeModel.diagnosticsAvailable ? (
          <ArchiveNotice tone="warn">{t("memory.knowledge.missing")}</ArchiveNotice>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ArchiveStatCard
            label={t("memory.knowledge.summaryCard")}
            value={t(memoryConfigStatusMessageKey(statusSummary.statusKey))}
            meta={knowledgeModel.hasExternalKnowledge ? t("memory.knowledge.present") : t("memory.knowledge.none")}
          />
          <ArchiveStatCard
            label={t("memory.knowledge.backend")}
            value={knowledgeModel.backend ?? t("memory.diag.unavailable")}
          />
          <ArchiveStatCard
            label={t("memory.knowledge.provider")}
            value={knowledgeModel.provider ?? t("memory.knowledge.providerFallback")}
          />
          <ArchiveStatCard
            label={t("memory.knowledge.externalInputs")}
            value={knowledgeModel.hasExternalKnowledge ? t("memory.knowledge.present") : t("memory.knowledge.none")}
            meta={t("memory.knowledge.externalCount", externalEntryCount)}
          />
          <ArchiveStatCard
            label={t("memory.knowledge.permission")}
            value={knowledgeModel.localWritable ? t("memory.knowledge.localWritable") : t("memory.knowledge.remoteReadonly")}
            meta={t(memoryConfigBridgeMessageKey(knowledgeModel.localWritable))}
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ArchiveStatCard
            label={t("memory.knowledge.diagnostics")}
            value={knowledgeModel.diagnosticsAvailable ? t("memory.diag.ready") : t("memory.diag.unavailableShort")}
          />
          <ArchiveStatCard
            label={t("memory.diag.runtimeStatus")}
            value={knowledgeModel.runtimeAvailable ? t("memory.diag.ready") : t("memory.diag.unavailableShort")}
            meta={knowledgeModel.runtimeAvailable ? `${knowledgeModel.runtimeSummary?.files ?? 0} files · ${knowledgeModel.runtimeSummary?.chunks ?? 0} chunks` : t(isLocalGatewaySession ? "memory.diag.runtimePlaceholder" : "memory.diag.runtimeRemoteUnavailable")}
          />
          <ArchiveStatCard
            label={t("memory.knowledge.sources")}
            value={knowledgeModel.sources.length > 0 ? knowledgeModel.sources.join(", ") : t("memory.knowledge.sourcesEmpty")}
          />
          <ArchiveStatCard
            label={t("memory.knowledge.store")}
            value={(
              <span className="block break-all text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">
                {memoryResult?.diagnostics?.builtinStorePath ?? t("memory.diag.unavailable")}
              </span>
            )}
          />
        </div>

        <div className={`mt-3 rounded-2xl border p-4 ${toneClasses.soft}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <Activity className={`h-4 w-4 ${toneClasses.icon}`} />
            {t("memory.knowledge.runtimeCard")}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t("memory.knowledge.runtimeHint")}</div>
          {knowledgeModel.runtimeAvailable && knowledgeModel.runtimeSummary ? (
            <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ArchiveStatCard label={t("memory.knowledge.runtimeFiles")} value={knowledgeModel.runtimeSummary.files} />
              <ArchiveStatCard label={t("memory.knowledge.runtimeChunks")} value={knowledgeModel.runtimeSummary.chunks} />
              <ArchiveStatCard label={t("memory.knowledge.runtimeDirty")} value={knowledgeModel.runtimeSummary.dirty ? t("memory.knowledge.reindexNeeded") : t("memory.knowledge.reindexClean")} />
              <ArchiveStatCard label={t("memory.knowledge.runtimeSources")} value={knowledgeModel.runtimeSummary.sourceCounts.length} meta={knowledgeModel.runtimeSummary.sourceCounts.map((item) => `${item.source}: ${item.files}/${item.chunks}`).join(" · ") || t("memory.knowledge.sourcesEmpty")} />
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {t(isLocalGatewaySession ? "memory.diag.runtimePlaceholder" : "memory.diag.runtimeRemoteUnavailable")}
            </div>
          )}
          <div className="mt-2">
            <ArchiveNotice tone={statusSummary.runtimeMatchState === "matched" ? "info" : "warn"}>
              {t(`memory.knowledge.runtimeMatch.${statusSummary.runtimeMatchState}`)}
            </ArchiveNotice>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className={`rounded-2xl border px-4 py-3 ${toneClasses.soft}`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <Link2 className={`h-3.5 w-3.5 ${toneClasses.icon}`} />
              {t("memory.knowledge.sources")}
            </div>
            <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              {memoryResult?.diagnostics?.sources.join(", ") || t("memory.knowledge.sourcesEmpty")}
            </div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${toneClasses.soft}`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <ShieldCheck className={`h-3.5 w-3.5 ${toneClasses.icon}`} />
              {t("memory.knowledge.guardrail")}
            </div>
            <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{t("memory.knowledge.guardrailDesc")}</div>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <ShieldCheck className={`h-4 w-4 ${toneClasses.icon}`} />
          {t("memory.knowledge.configActions")}
        </div>
        <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {t(memoryConfigBridgeMessageKey(knowledgeModel.localWritable))}
        </div>
        {!knowledgeModel.localWritable ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            {t("memory.knowledge.remoteReadonlyDetail")}
          </div>
        ) : null}

        <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("memory.knowledge.reindexCard")}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(statusSummary.commandDescriptionKey)}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(memoryReindexModeMessageKey(statusSummary.reindexMode))}</div>
              {autoReindexEnabled ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("memory.knowledge.reindexAutoHint")}</div> : null}
            </div>
            {statusSummary.localWritable ? (
              <ArchiveActionButton
                tone={tone}
                onClick={() => void handleRunReindex()}
                disabled={savingAction !== null}
                variant="primary"
              >
                <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                {t("memory.knowledge.reindexNow")}
              </ArchiveActionButton>
            ) : (
              <ArchiveActionButton tone={tone} onClick={() => void handleCopyRemoteGuide()} disabled={savingAction !== null}>
                <Copy className="mr-1 inline h-3.5 w-3.5" />
                {t("memory.knowledge.copyRemoteGuide")}
              </ArchiveActionButton>
            )}
          </div>
          {!statusSummary.localWritable ? (
            <>
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t("memory.knowledge.remoteCommandHint")}</div>
              <pre className="mt-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">{statusSummary.commandGuide}</pre>
            </>
          ) : null}
          {fieldErrors.reindex ? <div className="mt-3"><ArchiveNotice tone="error">{fieldErrors.reindex}</ArchiveNotice></div> : null}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t("memory.knowledge.externalPaths")}</div>
            <div className="mt-3 flex gap-2">
              <input
                value={newExtraPath}
                onChange={(event) => setNewExtraPath(event.target.value)}
                disabled={!knowledgeModel.localWritable || savingAction !== null}
                placeholder={t("memory.knowledge.pathPlaceholder")}
                className={`min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${toneClasses.input}`}
              />
              <ArchiveActionButton
                tone={tone}
                onClick={() => void handleAddExtraPath()}
                disabled={!knowledgeModel.localWritable || savingAction !== null}
                variant="primary"
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" />
                {t("memory.knowledge.addPath")}
              </ArchiveActionButton>
            </div>
            {knowledgeModel.extraPaths.length > 0 ? (
              <div className="mt-3 space-y-2">
                {knowledgeModel.extraPaths.map((path) => (
                  <div key={path} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="min-w-0 break-all text-sm text-slate-700 dark:text-slate-200">{path}</div>
                    <ArchiveActionButton
                      tone={tone}
                      onClick={() => void handleRemoveExtraPath(path)}
                      disabled={!knowledgeModel.localWritable || savingAction !== null}
                    >
                      <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                      {t("memory.knowledge.removePath")}
                    </ArchiveActionButton>
                  </div>
                ))}
              </div>
            ) : null}
            {fieldErrors.extraPath ? <div className="mt-3"><ArchiveNotice tone="error">{fieldErrors.extraPath}</ArchiveNotice></div> : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t("memory.knowledge.recallControls")}</div>
            <div className="mt-3 space-y-3">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                <div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{t("memory.knowledge.sessionMemoryLabel")}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{t("memory.knowledge.sessionMemoryDesc")}</div>
                  {!knowledgeModel.sources.includes("sessions") ? <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t("memory.knowledge.sessionMemoryEnablesSourcesHint")}</div> : null}
                </div>
                <input
                  type="checkbox"
                  checked={knowledgeModel.sessionMemoryEnabled}
                  onChange={(event) => void handleToggleSessionMemory(event.target.checked)}
                  disabled={!knowledgeModel.localWritable || savingAction !== null}
                  className={`h-4 w-4 rounded border-slate-300 ${toneClasses.checkbox}`}
                />
              </label>

              {(["memory", "sessions"] as const).map((source) => (
                <label key={source} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{source}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{t(source === "memory" ? "memory.knowledge.sourceMemoryDesc" : "memory.knowledge.sourceSessionsDesc")}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={knowledgeModel.sources.includes(source)}
                    onChange={() => void handleToggleSource(source)}
                    disabled={!knowledgeModel.localWritable || savingAction !== null}
                    className={`h-4 w-4 rounded border-slate-300 ${toneClasses.checkbox}`}
                  />
                </label>
              ))}
            </div>
            {fieldErrors.sessionMemory ? <div className="mt-3"><ArchiveNotice tone="error">{fieldErrors.sessionMemory}</ArchiveNotice></div> : null}
            {fieldErrors.sources ? <div className="mt-3"><ArchiveNotice tone="error">{fieldErrors.sources}</ArchiveNotice></div> : null}
          </div>
        </div>

        {configFeedback ? <div className="mt-2"><ArchiveNotice>{configFeedback}</ArchiveNotice></div> : null}
        {reindexFeedback ? <div className="mt-2"><ArchiveNotice>{reindexFeedback}</ArchiveNotice></div> : null}
      </ArchiveSectionCard>
    </div>
  );
}
