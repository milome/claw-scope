import { Activity, CheckCircle2, ChevronDown, ChevronUp, Copy, FolderTree, Info, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import { buildMemoryConfigStatusSummary, memoryConfigBridgeMessageKey, memoryConfigStatusMessageKey } from "./memoryConfigStatus";
import {
  setExternalKnowledgePaths,
  setExternalKnowledgeSources,
  setSessionMemoryEnabled,
  type MemoryKnowledgeActionFailure,
  type MemoryKnowledgeActionKind,
} from "./memoryKnowledgeActions";
import {
  describeMemoryKnowledgeReindexDelta,
  type MemoryKnowledgeRefreshResult,
  type MemoryKnowledgeReindexActivityState,
} from "./memoryKnowledgeReindexState";
import { MemoryMindMapPanel } from "./MemoryMindMapPanel";
import { ArchiveActionButton, ArchiveNotice, ArchiveSectionCard, ArchiveStatCard, type ArchiveTone } from "./memoryArchiveUi";
import { resolveInputTone, resolveViewToneClasses } from "./viewTone";

type FieldErrorState = {
  extraPath?: string | null;
  sessionMemory?: string | null;
  sources?: string | null;
};

type MemoryKnowledgePanelProps = {
  tone?: ArchiveTone;
  memoryResult: GatewayAgentMemoryResult | null;
  memoryStatus: GatewayAgentMemoryStatusResult | null;
  runtimeStatus: GatewayAgentMemoryRuntimeStatusResult | null;
  externalSources: MemoryExternalSourceItem[];
  isLocalGatewaySession: boolean;
  selectedAgentId: string;
  selectedNodeName: string;
  selectedSessionId?: string | null;
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
  onRefreshKnowledge: () => Promise<MemoryKnowledgeRefreshResult | null>;
  onOpenDiagnostics: () => void;
  reindexActivity: MemoryKnowledgeReindexActivityState | null;
  reindexDetailsExpanded: boolean;
  reindexFeedback: string | null;
  isReindexBusy: boolean;
  onToggleReindexDetails: () => void;
  onRunReindex: () => Promise<void>;
  onRunAutoReindex: () => Promise<void>;
};

export function MemoryKnowledgePanel({
  tone = "sky",
  memoryResult,
  memoryStatus,
  runtimeStatus,
  externalSources,
  isLocalGatewaySession,
  selectedAgentId,
  selectedNodeName,
  selectedSessionId,
  model,
  t,
  showDebug,
  onToggleDebug,
  openHint,
  onRefreshKnowledge,
  onOpenDiagnostics,
  reindexActivity,
  reindexDetailsExpanded,
  reindexFeedback,
  isReindexBusy,
  onToggleReindexDetails,
  onRunReindex,
  onRunAutoReindex,
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
  const [nowMs, setNowMs] = useState(() => Date.now());
  const statusSummary = buildMemoryConfigStatusSummary({
    selectedAgentId,
    isLocalGatewaySession,
    memoryResult,
    memoryStatus,
    runtimeStatus,
  });
  const externalEntryCount = knowledgeModel.sections.reduce((count, section) => count + section.entries.length, 0);
  const readableSources = knowledgeModel.sources.map((source) =>
    source === "memory"
      ? t("memory.knowledge.sourceMemoryLabel")
      : source === "sessions"
        ? t("memory.knowledge.sourceSessionsLabel")
        : source,
  );

  const describeKnowledgeEntry = (label: string) => {
    switch (label) {
      case "session_memory_enabled":
        return t("memory.knowledge.sessionMemoryEnabled");
      case "session_memory_disabled":
        return t("memory.knowledge.sessionMemoryDisabled");
      default:
        return label;
    }
  };

  const describeKnowledgeNote = (note?: string | null) => {
    switch (note) {
      case "qmd_active":
        return t("memory.knowledge.qmdActive");
      case "qmd_inactive":
        return t("memory.knowledge.qmdInactive");
      case "sessions_source_enabled":
        return t("memory.knowledge.sessionsSourceEnabled");
      case "sessions_source_missing":
        return t("memory.knowledge.sessionsSourceMissing");
      default:
        return note;
    }
  };

  const controlsDisabled = savingAction !== null || isReindexBusy;
  const showReindexRecoveryActions =
    reindexActivity?.phase === "warning" || reindexActivity?.phase === "failed";
  const reindexTaskbarSummary = reindexActivity
    ? reindexActivity.commandStdout ??
      describeMemoryKnowledgeReindexDelta(reindexActivity.before, reindexActivity.latest) ??
      t("memory.knowledge.reindexLive.noDelta")
    : null;
  const runtimeFiles = knowledgeModel.runtimeSummary?.files ?? 0;
  const runtimeChunks = knowledgeModel.runtimeSummary?.chunks ?? 0;
  const runtimeSourceCount = knowledgeModel.runtimeSummary?.sourceCounts.length ?? 0;
  const runtimeNeedsAttention = statusSummary.runtimeMatchState !== "matched";
  const primaryActionLabel = statusSummary.localWritable
    ? t("memory.knowledge.reindexNow")
    : t("memory.knowledge.copyRemoteGuide");

  const formatElapsedSeconds = (sinceMs: number, untilMs?: number | null) => {
    const deltaMs = Math.max(0, (untilMs ?? nowMs) - sinceMs);
    return Math.round(deltaMs / 1000);
  };

  useEffect(() => {
    if (!knowledgeModel.localWritable) {
      setFieldErrors({});
    }
  }, [knowledgeModel.localWritable]);

  useEffect(() => {
    if (!reindexActivity || reindexActivity.finishedAtMs !== null) {
      return;
    }

    const timerId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [reindexActivity]);

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
      () => setExternalKnowledgePaths(nextPaths, t, selectedSessionId ?? undefined),
    );
    if (result) {
      startTransition(() => setNewExtraPath(""));
      toast.success(t("memory.knowledge.pathAdded"));
      await onRunAutoReindex();
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
      () => setExternalKnowledgePaths(nextPaths, t, selectedSessionId ?? undefined),
    );
    if (result) {
      toast.success(t("memory.knowledge.pathRemoved"));
      await onRunAutoReindex();
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
        const sessionResult = await setSessionMemoryEnabled(
          enabled,
          t,
          selectedSessionId ?? undefined,
        );
        if (enabled && !knowledgeModel.sources.includes("sessions")) {
          await setExternalKnowledgeSources(
            nextSources,
            t,
            selectedSessionId ?? undefined,
          );
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
      await onRunAutoReindex();
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
      () => setExternalKnowledgeSources(nextSources, t, selectedSessionId ?? undefined),
    );
    if (result) {
      toast.success(t("memory.knowledge.sourcesUpdated"));
      await onRunAutoReindex();
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
      />

      <ArchiveSectionCard tone={tone}>
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <FolderTree className={`w-4 h-4 ${toneClasses.icon}`} />
          {t("memory.knowledge.title")}
        </div>

        {!knowledgeModel.diagnosticsAvailable ? (
          <ArchiveNotice tone="warn">{t("memory.knowledge.missing")}</ArchiveNotice>
        ) : null}

        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.96),rgba(255,255,255,0.92))] p-4 shadow-sm dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.86),rgba(2,6,23,0.74))]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${runtimeNeedsAttention ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>
                  {runtimeNeedsAttention ? t("memory.knowledge.reindexNeeded") : t("memory.knowledge.reindexClean")}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClasses.chip}`}>
                  {knowledgeModel.localWritable ? t("memory.knowledge.localWritable") : t("memory.knowledge.remoteReadonly")}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {t("memory.knowledge.externalCount", externalEntryCount)}
                </span>
              </div>
              <div className="mt-3 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {t(memoryConfigStatusMessageKey(statusSummary.statusKey))}
              </div>
              <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {t(`memory.knowledge.runtimeMatch.${statusSummary.runtimeMatchState}`)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ArchiveActionButton
                tone={tone}
                onClick={statusSummary.localWritable ? () => void onRunReindex() : () => void handleCopyRemoteGuide()}
                disabled={controlsDisabled}
                variant="primary"
              >
                {statusSummary.localWritable ? <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> : <Copy className="mr-1 inline h-3.5 w-3.5" />}
                {primaryActionLabel}
              </ArchiveActionButton>
              <ArchiveActionButton tone={tone} onClick={onOpenDiagnostics} disabled={false}>
                <Info className="mr-1 inline h-3.5 w-3.5" />
                {t("memory.resources.openDiagnostics")}
              </ArchiveActionButton>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ArchiveStatCard
              label={t("memory.knowledge.externalInputs")}
              value={knowledgeModel.hasExternalKnowledge ? t("memory.knowledge.present") : t("memory.knowledge.none")}
              meta={t("memory.knowledge.externalCount", externalEntryCount)}
            />
            <ArchiveStatCard
              label={t("memory.knowledge.runtimeCard")}
              value={knowledgeModel.runtimeAvailable ? t("memory.diag.ready") : t("memory.diag.unavailableShort")}
              meta={knowledgeModel.runtimeAvailable ? `${runtimeFiles} ${t("common.files")} · ${runtimeChunks} ${t("common.chunks")}` : t(isLocalGatewaySession ? "memory.diag.runtimePlaceholder" : "memory.diag.runtimeRemoteUnavailable")}
            />
            <ArchiveStatCard
              label={t("memory.knowledge.sources")}
              value={readableSources.length > 0 ? readableSources.join(", ") : t("memory.knowledge.sourcesEmpty")}
            />
            <ArchiveStatCard
              label={t("memory.knowledge.nodeScope")}
              value={selectedNodeName || t("memory.knowledge.nodeScopeFallback")}
              meta={selectedSessionId ?? t("memory.knowledge.sessionScopeFallback")}
            />
          </div>
        </div>

        {runtimeNeedsAttention ? (
          <div className="mt-3">
            <ArchiveNotice tone="warn">{t(`memory.knowledge.runtimeMatch.${statusSummary.runtimeMatchState}`)}</ArchiveNotice>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("memory.knowledge.recallControls")}</div>
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
                  disabled={!knowledgeModel.localWritable || controlsDisabled}
                  className={`h-4 w-4 rounded border-slate-300 ${toneClasses.checkbox}`}
                />
              </label>

              {(["memory", "sessions"] as const).map((source) => (
                <label key={source} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {source === "memory" ? t("memory.knowledge.sourceMemoryLabel") : t("memory.knowledge.sourceSessionsLabel")}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{t(source === "memory" ? "memory.knowledge.sourceMemoryDesc" : "memory.knowledge.sourceSessionsDesc")}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={knowledgeModel.sources.includes(source)}
                    onChange={() => void handleToggleSource(source)}
                    disabled={!knowledgeModel.localWritable || controlsDisabled}
                    className={`h-4 w-4 rounded border-slate-300 ${toneClasses.checkbox}`}
                  />
                </label>
              ))}
            </div>
            {fieldErrors.sessionMemory ? <div className="mt-3"><ArchiveNotice tone="error">{fieldErrors.sessionMemory}</ArchiveNotice></div> : null}
            {fieldErrors.sources ? <div className="mt-3"><ArchiveNotice tone="error">{fieldErrors.sources}</ArchiveNotice></div> : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("memory.knowledge.externalPaths")}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t("memory.knowledge.externalPathsDesc")}</div>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${toneClasses.chip}`}>
                  {knowledgeModel.extraPaths.length}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={newExtraPath}
                  onChange={(event) => setNewExtraPath(event.target.value)}
                  disabled={!knowledgeModel.localWritable || controlsDisabled}
                  placeholder={t("memory.knowledge.pathPlaceholder")}
                  className={`min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${toneClasses.input}`}
                />
                <ArchiveActionButton
                  tone={tone}
                  onClick={() => void handleAddExtraPath()}
                  disabled={!knowledgeModel.localWritable || controlsDisabled}
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
                        disabled={!knowledgeModel.localWritable || controlsDisabled}
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
          </div>

        </div>

        {reindexActivity ? (
          <div className="sticky top-3 z-10 mt-4 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-none">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {reindexActivity.finishedAtMs === null ? (
                    <Loader2 className={`h-4 w-4 animate-spin ${toneClasses.icon}`} />
                  ) : (
                    <Activity className={`h-4 w-4 ${toneClasses.icon}`} />
                  )}
                  {t("memory.knowledge.reindexLive.taskbarTitle")}
                  <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                    reindexActivity.phase === "failed"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      : reindexActivity.phase === "warning"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        : reindexActivity.phase === "settled"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                  }`}>
                    {t(`memory.knowledge.reindexLive.phase.${reindexActivity.phase}`)}
                  </span>
                </div>
                <div className="mt-1 truncate text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {reindexTaskbarSummary}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{t("memory.knowledge.reindexLive.elapsedValue", formatElapsedSeconds(reindexActivity.startedAtMs, reindexActivity.finishedAtMs))}</span>
                  <span>{t(`memory.knowledge.runtimeMatch.${reindexActivity.latest.runtimeMatchState}`)}</span>
                  <span>{t("memory.knowledge.reindexLive.snapshotFiles", reindexActivity.latest.files ?? 0)}</span>
                  <span>{t("memory.knowledge.reindexLive.snapshotChunks", reindexActivity.latest.chunks ?? 0)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {showReindexRecoveryActions && statusSummary.localWritable ? (
                  <ArchiveActionButton tone={tone} onClick={() => void onRunReindex()} disabled={controlsDisabled} variant="primary">
                    <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                    {t("memory.knowledge.reindexLive.retry")}
                  </ArchiveActionButton>
                ) : null}
                {showReindexRecoveryActions ? (
                  <ArchiveActionButton tone={tone} onClick={onOpenDiagnostics} disabled={false}>
                    <Info className="mr-1 inline h-3.5 w-3.5" />
                    {t("memory.knowledge.reindexLive.openDiagnostics")}
                  </ArchiveActionButton>
                ) : null}
                <ArchiveActionButton tone={tone} onClick={onToggleReindexDetails} disabled={false}>
                  {reindexDetailsExpanded ? (
                    <>
                      <ChevronUp className="mr-1 inline h-3.5 w-3.5" />
                      {t("memory.knowledge.reindexLive.collapse")}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 inline h-3.5 w-3.5" />
                      {t("memory.knowledge.reindexLive.expand")}
                    </>
                  )}
                </ArchiveActionButton>
              </div>
            </div>
          </div>
        ) : null}

        {reindexActivity && reindexDetailsExpanded ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {reindexActivity.finishedAtMs === null ? (
                    <Loader2 className={`h-4 w-4 animate-spin ${toneClasses.icon}`} />
                  ) : (
                    <Activity className={`h-4 w-4 ${toneClasses.icon}`} />
                  )}
                  {t("memory.knowledge.reindexLive.title")}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t("memory.knowledge.reindexLive.desc")}
                </div>
              </div>
              <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${
                reindexActivity.phase === "failed"
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  : reindexActivity.phase === "warning"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    : reindexActivity.phase === "settled"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
              }`}>
                {t(`memory.knowledge.reindexLive.phase.${reindexActivity.phase}`)}
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ArchiveStatCard
                label={t("memory.knowledge.reindexLive.elapsedLabel")}
                value={t("memory.knowledge.reindexLive.elapsedValue", formatElapsedSeconds(reindexActivity.startedAtMs, reindexActivity.finishedAtMs))}
              />
              <ArchiveStatCard
                label={t("memory.knowledge.reindexLive.pollsLabel")}
                value={reindexActivity.polls}
                meta={t("memory.knowledge.reindexLive.afterCommandPolls", reindexActivity.afterCommandPolls)}
              />
              <ArchiveStatCard
                label={t("memory.knowledge.reindexLive.lastCheckedLabel")}
                value={reindexActivity.lastPolledAtMs ? t("memory.knowledge.reindexLive.lastCheckedValue", formatElapsedSeconds(reindexActivity.lastPolledAtMs)) : t("memory.knowledge.reindexLive.pendingCheck")}
              />
              <ArchiveStatCard
                label={t("memory.knowledge.reindexLive.commandLabel")}
                value={reindexActivity.commandStdout ? t("memory.knowledge.reindexLive.commandFinished") : t("memory.knowledge.reindexLive.commandRunning")}
                meta={reindexActivity.commandStdout ?? t("memory.knowledge.reindexLive.commandPending")}
              />
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {t("memory.knowledge.reindexLive.beforeLabel")}
                </div>
                <div className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                  <div>{t("memory.knowledge.reindexLive.snapshotFiles", reindexActivity.before.files ?? 0)}</div>
                  <div>{t("memory.knowledge.reindexLive.snapshotChunks", reindexActivity.before.chunks ?? 0)}</div>
                  <div>{t("memory.knowledge.reindexLive.snapshotDirty", reindexActivity.before.dirty === null ? t("memory.diag.unavailableShort") : reindexActivity.before.dirty ? t("memory.knowledge.reindexNeeded") : t("memory.knowledge.reindexClean"))}</div>
                  <div>{t(`memory.knowledge.runtimeMatch.${reindexActivity.before.runtimeMatchState}`)}</div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {t("memory.knowledge.reindexLive.latestLabel")}
                </div>
                <div className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                  <div>{t("memory.knowledge.reindexLive.snapshotFiles", reindexActivity.latest.files ?? 0)}</div>
                  <div>{t("memory.knowledge.reindexLive.snapshotChunks", reindexActivity.latest.chunks ?? 0)}</div>
                  <div>{t("memory.knowledge.reindexLive.snapshotDirty", reindexActivity.latest.dirty === null ? t("memory.diag.unavailableShort") : reindexActivity.latest.dirty ? t("memory.knowledge.reindexNeeded") : t("memory.knowledge.reindexClean"))}</div>
                  <div>{t(`memory.knowledge.runtimeMatch.${reindexActivity.latest.runtimeMatchState}`)}</div>
                </div>
              </div>
            </div>

            {reindexActivity.syncIssue ? (
              <div className="mt-3">
                <ArchiveNotice tone="warn">
                  {`${t("memory.knowledge.reindexLive.syncIssue")} ${reindexActivity.syncIssue}`}
                </ArchiveNotice>
              </div>
            ) : null}

            {reindexActivity.entries.length > 0 ? (
              <div className="mt-3 space-y-2">
                {reindexActivity.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-xl border px-3 py-3 text-xs leading-5 ${
                      entry.tone === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                        : entry.tone === "warn"
                          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                          : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium">{entry.title}</div>
                      <div className="shrink-0 text-[11px] opacity-70">
                        {t("memory.knowledge.reindexLive.atSeconds", formatElapsedSeconds(reindexActivity.startedAtMs, entry.atMs))}
                      </div>
                    </div>
                    {entry.detail ? <div className="mt-1 opacity-80">{entry.detail}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t("memory.knowledge.diagnostics")}
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ArchiveStatCard label={t("memory.knowledge.backend")} value={knowledgeModel.backend ?? t("memory.diag.unavailable")} />
            <ArchiveStatCard label={t("memory.knowledge.provider")} value={knowledgeModel.provider ?? t("memory.knowledge.providerFallback")} />
            <ArchiveStatCard label={t("memory.knowledge.runtimeFiles")} value={runtimeFiles} />
            <ArchiveStatCard label={t("memory.knowledge.runtimeChunks")} value={runtimeChunks} />
            <ArchiveStatCard label={t("memory.knowledge.runtimeDirty")} value={knowledgeModel.runtimeSummary?.dirty ? t("memory.knowledge.reindexNeeded") : t("memory.knowledge.reindexClean")} />
            <ArchiveStatCard label={t("memory.knowledge.runtimeSources")} value={runtimeSourceCount} meta={knowledgeModel.runtimeSummary?.sourceCounts.map((item) => `${item.source}: ${item.files}/${item.chunks}`).join(" · ") || t("memory.knowledge.sourcesEmpty")} />
            <ArchiveStatCard
              label={t("memory.knowledge.store")}
              value={(
                <span className="block break-all text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">
                  {memoryResult?.diagnostics?.builtinStorePath ?? t("memory.diag.unavailable")}
                </span>
              )}
            />
            <ArchiveStatCard
              label={t("memory.knowledge.permission")}
              value={knowledgeModel.localWritable ? t("memory.knowledge.localWritable") : t("memory.knowledge.remoteReadonly")}
              meta={t(memoryConfigBridgeMessageKey(knowledgeModel.localWritable))}
            />
          </div>
        </details>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {knowledgeModel.sections.map((section) => (
            <div key={section.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t(section.titleKey)}
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {t(section.descriptionKey)}
              </div>
              {section.entries.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {section.entries.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {describeKnowledgeEntry(entry.label)}
                          </div>
                          {entry.path && describeKnowledgeEntry(entry.label) !== entry.path ? (
                            <div className="mt-1 break-all text-xs leading-5 text-slate-500 dark:text-slate-400">
                              {entry.path}
                            </div>
                          ) : null}
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${entry.status === "indexed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : entry.status === "stale" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                          {t(`memory.knowledge.status.${entry.status}`)}
                        </span>
                      </div>
                      {entry.note ? (
                        <div className="mt-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <div>{describeKnowledgeNote(entry.note)}</div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {t("memory.knowledge.sectionEmpty")}
                </div>
              )}
            </div>
          ))}
        </div>
        {configFeedback ? <div className="mt-2"><ArchiveNotice>{configFeedback}</ArchiveNotice></div> : null}
        {reindexFeedback && !reindexActivity?.syncIssue ? <div className="mt-2"><ArchiveNotice>{reindexFeedback}</ArchiveNotice></div> : null}
      </ArchiveSectionCard>
    </div>
  );
}
