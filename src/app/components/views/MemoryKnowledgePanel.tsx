import { Activity, CheckCircle2, ChevronDown, ChevronUp, Copy, FolderTree, Info, Link2, ListChecks, Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
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
import {
  captureMemoryKnowledgeReindexSnapshot,
  describeMemoryKnowledgeReindexDelta,
  hasMemoryKnowledgeReindexProgress,
  isMemoryKnowledgeReindexSettled,
  type MemoryKnowledgeRefreshResult,
  type MemoryKnowledgeReindexPhase,
  type MemoryKnowledgeReindexSnapshot,
} from "./memoryKnowledgeReindexState";
import { MemoryMindMapPanel } from "./MemoryMindMapPanel";
import { ArchiveActionButton, ArchiveNotice, ArchiveSectionCard, ArchiveStatCard, type ArchiveTone } from "./memoryArchiveUi";
import { resolveInputTone, resolveViewToneClasses } from "./viewTone";

type FieldErrorState = {
  extraPath?: string | null;
  sessionMemory?: string | null;
  sources?: string | null;
  reindex?: string | null;
};

type ReindexTimelineEntry = {
  id: string;
  tone: "info" | "warn" | "error";
  title: string;
  detail?: string | null;
  atMs: number;
};

type ReindexActivityState = {
  phase: MemoryKnowledgeReindexPhase;
  startedAtMs: number;
  finishedAtMs: number | null;
  polls: number;
  afterCommandPolls: number;
  lastPolledAtMs: number | null;
  before: MemoryKnowledgeReindexSnapshot;
  latest: MemoryKnowledgeReindexSnapshot;
  commandStdout: string | null;
  syncIssue: string | null;
  progressObserved: boolean;
  entries: ReindexTimelineEntry[];
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
  onOpenEvidence,
  openHint,
  onRefreshKnowledge,
  onOpenDiagnostics,
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
  const [reindexActivity, setReindexActivity] = useState<ReindexActivityState | null>(null);
  const [reindexDetailsExpanded, setReindexDetailsExpanded] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const activeReindexTokenRef = useRef(0);
  const pollTimerRef = useRef<number | null>(null);
  const pollInFlightRef = useRef(false);
  const commandCompletedRef = useRef(false);
  const statusSummary = buildMemoryConfigStatusSummary({
    selectedAgentId,
    isLocalGatewaySession,
    memoryResult,
    memoryStatus,
    runtimeStatus,
  });
  const currentReindexSnapshot = useMemo(
    () =>
      captureMemoryKnowledgeReindexSnapshot({
        statusSummary,
        runtimeStatus,
      }),
    [statusSummary, runtimeStatus],
  );
  const autoReindexEnabled = statusSummary.reindexMode === "auto";
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

  const stopReindexPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollInFlightRef.current = false;
  };

  const isReindexBusy = savingAction === "reindex" || (reindexActivity !== null && reindexActivity.finishedAtMs === null);
  const controlsDisabled = savingAction !== null || isReindexBusy;
  const showReindexRecoveryActions =
    reindexActivity?.phase === "warning" || reindexActivity?.phase === "failed";
  const reindexTaskbarSummary = reindexActivity
    ? reindexActivity.commandStdout ??
      describeMemoryKnowledgeReindexDelta(reindexActivity.before, reindexActivity.latest) ??
      t("memory.knowledge.reindexLive.noDelta")
    : null;

  const formatElapsedSeconds = (sinceMs: number, untilMs?: number | null) => {
    const deltaMs = Math.max(0, (untilMs ?? nowMs) - sinceMs);
    return Math.round(deltaMs / 1000);
  };

  const createReindexEntry = (
    tone: ReindexTimelineEntry["tone"],
    title: string,
    detail?: string | null,
  ): ReindexTimelineEntry => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tone,
    title,
    detail,
    atMs: Date.now(),
  });

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

  useEffect(() => stopReindexPolling, []);

  useEffect(() => {
    if (!reindexActivity || reindexActivity.finishedAtMs === null) {
      return;
    }

    if (reindexActivity.phase === "settled") {
      setReindexFeedback(t("memory.knowledge.reindexLive.settledFeedback"));
      return;
    }

    if (reindexActivity.phase === "warning") {
      setReindexFeedback(reindexActivity.syncIssue ? null : t("memory.knowledge.reindexLive.warningFeedback"));
      return;
    }

    if (reindexActivity.phase === "failed") {
      setReindexFeedback(null);
    }
  }, [reindexActivity, t]);

  const setFieldError = (field: keyof FieldErrorState, message: string | null) => {
    setFieldErrors((current) => ({ ...current, [field]: message }));
  };

  const clearFieldError = (field: keyof FieldErrorState) => {
    setFieldErrors((current) => ({ ...current, [field]: null }));
  };

  const applyRefreshedKnowledge = (
    result: MemoryKnowledgeRefreshResult,
    options: {
      token: number;
      afterCommand: boolean;
      addIssueEntry?: boolean;
    },
  ) => {
    if (activeReindexTokenRef.current !== options.token) {
      return;
    }

    const nextStatusSummary = buildMemoryConfigStatusSummary({
      selectedAgentId,
      isLocalGatewaySession,
      memoryResult: result.memoryResult,
      memoryStatus: result.memoryStatus,
      runtimeStatus: result.runtimeStatus,
    });
    const nextSnapshot = captureMemoryKnowledgeReindexSnapshot({
      statusSummary: nextStatusSummary,
      runtimeStatus: result.runtimeStatus,
    });

    let shouldStopPolling = false;

    setReindexActivity((current) => {
      if (!current) {
        return current;
      }

      const afterCommandPolls = current.afterCommandPolls + (options.afterCommand ? 1 : 0);
      const observedProgress = hasMemoryKnowledgeReindexProgress(current.latest, nextSnapshot);
      const nextEntries = [...current.entries];
      let nextPhase: ReindexActivityState["phase"] = options.afterCommand ? "syncing" : "running";
      let finishedAtMs = current.finishedAtMs;

      if (observedProgress && !current.progressObserved) {
        nextEntries.push(
          createReindexEntry(
            "info",
            t("memory.knowledge.reindexLive.event.progress"),
            describeMemoryKnowledgeReindexDelta(current.before, nextSnapshot),
          ),
        );
      }

      if (options.addIssueEntry && current.syncIssue) {
        nextEntries.push(
          createReindexEntry(
            "warn",
            t("memory.knowledge.reindexLive.event.refreshFailed"),
            current.syncIssue,
          ),
        );
      }

      if (options.afterCommand && isMemoryKnowledgeReindexSettled(nextSnapshot)) {
        nextPhase = "settled";
        finishedAtMs = Date.now();
        nextEntries.push(
          createReindexEntry(
            "info",
            t("memory.knowledge.reindexLive.event.settled"),
            describeMemoryKnowledgeReindexDelta(current.before, nextSnapshot),
          ),
        );
        shouldStopPolling = true;
      } else if (options.afterCommand && afterCommandPolls >= 6) {
        nextPhase = "warning";
        finishedAtMs = Date.now();
        nextEntries.push(
          createReindexEntry(
            "warn",
            t("memory.knowledge.reindexLive.event.warning"),
            describeMemoryKnowledgeReindexDelta(current.before, nextSnapshot) || t("memory.knowledge.reindexLive.noDelta"),
          ),
        );
        shouldStopPolling = true;
      }

      return {
        ...current,
        phase: nextPhase,
        finishedAtMs,
        polls: current.polls + 1,
        afterCommandPolls,
        lastPolledAtMs: Date.now(),
        latest: nextSnapshot,
        syncIssue: null,
        progressObserved: current.progressObserved || observedProgress,
        entries: nextEntries,
      };
    });

    if (shouldStopPolling) {
      stopReindexPolling();
      setSavingAction(null);
    }
  };

  const refreshReindexProgress = async (
    token: number,
    options: {
      afterCommand: boolean;
      addIssueEntry?: boolean;
    },
  ) => {
    if (pollInFlightRef.current || activeReindexTokenRef.current !== token) {
      return;
    }

    pollInFlightRef.current = true;
    try {
      const result = await onRefreshKnowledge();
      if (result) {
        applyRefreshedKnowledge(result, { ...options, token });
      } else {
        let shouldStopPolling = false;
        setReindexActivity((current) => {
          if (!current) {
            return current;
          }
          const afterCommandPolls = current.afterCommandPolls + (options.afterCommand ? 1 : 0);
          const finishedAtMs =
            options.afterCommand && afterCommandPolls >= 6 ? Date.now() : current.finishedAtMs;
          const nextEntries =
            options.afterCommand && afterCommandPolls >= 6
              ? [
                  ...current.entries,
                  createReindexEntry(
                    "warn",
                    t("memory.knowledge.reindexLive.event.warning"),
                    null,
                  ),
                ]
              : current.entries;
          shouldStopPolling = finishedAtMs !== null;
          return {
            ...current,
            phase: finishedAtMs !== null ? "warning" : current.phase,
            polls: current.polls + 1,
            afterCommandPolls,
            lastPolledAtMs: Date.now(),
            finishedAtMs,
            syncIssue: t("memory.knowledge.reindexLive.noRefreshPayload"),
            entries: nextEntries,
          };
        });
        if (shouldStopPolling) {
          stopReindexPolling();
          setSavingAction(null);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      let shouldStopPolling = false;
      setReindexActivity((current) => {
        if (!current) {
          return current;
        }
        const afterCommandPolls = current.afterCommandPolls + (options.afterCommand ? 1 : 0);
        const finishedAtMs =
          options.afterCommand && afterCommandPolls >= 6 ? Date.now() : current.finishedAtMs;
        const nextEntries =
          options.afterCommand && afterCommandPolls >= 6
            ? [
                ...current.entries,
                createReindexEntry(
                  "warn",
                  t("memory.knowledge.reindexLive.event.refreshFailed"),
                  null,
                ),
              ]
            : current.entries;
        shouldStopPolling = finishedAtMs !== null;
        return {
          ...current,
          phase: finishedAtMs !== null ? "warning" : current.phase,
          polls: current.polls + 1,
          afterCommandPolls,
          lastPolledAtMs: Date.now(),
          finishedAtMs,
          syncIssue: message,
          entries: nextEntries,
        };
      });
      if (shouldStopPolling) {
        stopReindexPolling();
        setSavingAction(null);
      }
    } finally {
      pollInFlightRef.current = false;
    }
  };

  const startReindexPolling = (token: number) => {
    stopReindexPolling();
    pollTimerRef.current = window.setInterval(() => {
      void refreshReindexProgress(token, {
        afterCommand: commandCompletedRef.current,
        addIssueEntry: commandCompletedRef.current,
      });
    }, 1500);
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

    const token = Date.now();
    activeReindexTokenRef.current = token;
    commandCompletedRef.current = false;
    setReindexDetailsExpanded(true);
    setSavingAction("reindex");
    clearFieldError("reindex");
    setConfigFeedback(null);
    setReindexFeedback(null);
    setReindexActivity({
      phase: "starting",
      startedAtMs: Date.now(),
      finishedAtMs: null,
      polls: 0,
      afterCommandPolls: 0,
      lastPolledAtMs: null,
      before: currentReindexSnapshot,
      latest: currentReindexSnapshot,
      commandStdout: null,
      syncIssue: null,
      progressObserved: false,
      entries: [
        createReindexEntry(
          "info",
          t("memory.knowledge.reindexLive.event.submitted"),
          t("memory.knowledge.reindexLive.event.submittedDetail"),
        ),
      ],
    });
    startReindexPolling(token);
    void refreshReindexProgress(token, { afterCommand: false });
    try {
      const result = await runExternalKnowledgeReindex(
        selectedAgentId,
        statusSummary.reindexStrategy,
        t,
        selectedSessionId ?? undefined,
      );
      if (activeReindexTokenRef.current !== token) {
        return;
      }
      commandCompletedRef.current = true;
      setReindexActivity((current) =>
        current
          ? {
              ...current,
              phase: "syncing",
              commandStdout: result.stdout || t("memory.knowledge.reindexDone"),
              entries: [
                ...current.entries,
                createReindexEntry(
                  "info",
                  t("memory.knowledge.reindexLive.event.commandDone"),
                  result.stdout || t("memory.knowledge.reindexDone"),
                ),
              ],
            }
          : current,
      );
      await refreshReindexProgress(token, { afterCommand: true });
      setReindexFeedback(t("memory.knowledge.reindexLive.syncingFeedback"));
      toast.success(t("memory.knowledge.reindexLive.commandAccepted"));
    } catch (error) {
      const failure = error as MemoryKnowledgeActionFailure;
      stopReindexPolling();
      setReindexActivity((current) =>
        current
          ? {
              ...current,
              phase: "failed",
              finishedAtMs: Date.now(),
              syncIssue: failure.message,
              entries: [
                ...current.entries,
                createReindexEntry(
                  "error",
                  t("memory.knowledge.reindexLive.event.failed"),
                  null,
                ),
              ],
            }
          : current,
      );
      toast.error(failure.message);
    } finally {
      if (commandCompletedRef.current || activeReindexTokenRef.current !== token) {
        return;
      }
      setSavingAction(null);
    }
  };

  const runPostConfigReindex = async () => {
    if (!autoReindexEnabled || !statusSummary.localWritable || !selectedAgentId) {
      return;
    }

    const token = Date.now();
    activeReindexTokenRef.current = token;
    commandCompletedRef.current = false;
    setReindexDetailsExpanded(true);
    setSavingAction("reindex");
    clearFieldError("reindex");
    setReindexFeedback(t("memory.knowledge.reindexAutoRunning"));
    setReindexActivity({
      phase: "starting",
      startedAtMs: Date.now(),
      finishedAtMs: null,
      polls: 0,
      afterCommandPolls: 0,
      lastPolledAtMs: null,
      before: currentReindexSnapshot,
      latest: currentReindexSnapshot,
      commandStdout: null,
      syncIssue: null,
      progressObserved: false,
      entries: [
        createReindexEntry(
          "info",
          t("memory.knowledge.reindexLive.event.autoSubmitted"),
          t("memory.knowledge.reindexLive.event.submittedDetail"),
        ),
      ],
    });
    startReindexPolling(token);
    void refreshReindexProgress(token, { afterCommand: false });
    try {
      const result = await runExternalKnowledgeReindex(
        selectedAgentId,
        statusSummary.reindexStrategy,
        t,
        selectedSessionId ?? undefined,
      );
      if (activeReindexTokenRef.current !== token) {
        return;
      }
      commandCompletedRef.current = true;
      setReindexActivity((current) =>
        current
          ? {
              ...current,
              phase: "syncing",
              commandStdout: result.stdout || t("memory.knowledge.reindexDone"),
              entries: [
                ...current.entries,
                createReindexEntry(
                  "info",
                  t("memory.knowledge.reindexLive.event.commandDone"),
                  result.stdout || t("memory.knowledge.reindexDone"),
                ),
              ],
            }
          : current,
      );
      await refreshReindexProgress(token, { afterCommand: true });
      setReindexFeedback(t("memory.knowledge.reindexLive.syncingFeedback"));
    } catch (error) {
      const failure = error as MemoryKnowledgeActionFailure;
      stopReindexPolling();
      setReindexActivity((current) =>
        current
          ? {
              ...current,
              phase: "failed",
              finishedAtMs: Date.now(),
              syncIssue: failure.message,
              entries: [
                ...current.entries,
                createReindexEntry(
                  "error",
                  t("memory.knowledge.reindexLive.event.failed"),
                  null,
                ),
              ],
            }
          : current,
      );
      toast.error(failure.message);
      setSavingAction(null);
    } finally {
      if (commandCompletedRef.current || activeReindexTokenRef.current !== token) {
        return;
      }
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
      () => setExternalKnowledgePaths(nextPaths, t, selectedSessionId ?? undefined),
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
      () => setExternalKnowledgePaths(nextPaths, t, selectedSessionId ?? undefined),
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
      () => setExternalKnowledgeSources(nextSources, t, selectedSessionId ?? undefined),
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
          <ArchiveStatCard
            label={t("memory.knowledge.nodeScope")}
            value={selectedNodeName || t("memory.knowledge.nodeScopeFallback")}
            meta={selectedSessionId ?? t("memory.knowledge.sessionScopeFallback")}
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
            meta={knowledgeModel.runtimeAvailable ? `${knowledgeModel.runtimeSummary?.files ?? 0} ${t("common.files")} · ${knowledgeModel.runtimeSummary?.chunks ?? 0} ${t("common.chunks")}` : t(isLocalGatewaySession ? "memory.diag.runtimePlaceholder" : "memory.diag.runtimeRemoteUnavailable")}
          />
          <ArchiveStatCard
            label={t("memory.knowledge.sources")}
            value={readableSources.length > 0 ? readableSources.join(", ") : t("memory.knowledge.sourcesEmpty")}
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
              {readableSources.join(", ") || t("memory.knowledge.sourcesEmpty")}
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

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Info className={`h-4 w-4 ${toneClasses.icon}`} />
              {t("memory.knowledge.extraPathsGuideTitle")}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t("memory.knowledge.extraPathsGuideDesc")}
            </div>
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-xs leading-5 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
              <div className="font-semibold">{t("memory.knowledge.incrementalOnlyTitle")}</div>
              <div className="mt-1">{t("memory.knowledge.incrementalOnlyDesc")}</div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs leading-5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                <div className="font-semibold">{t("memory.knowledge.extraPathsDoTitle")}</div>
                <div className="mt-1 break-all">{t("memory.knowledge.extraPathsDoExample")}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                <div className="font-semibold">{t("memory.knowledge.extraPathsDontTitle")}</div>
                <div className="mt-1 break-all">{t("memory.knowledge.extraPathsDontExample")}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <ListChecks className={`h-4 w-4 ${toneClasses.icon}`} />
              {t("memory.knowledge.howToTitle")}
            </div>
            <div className="mt-3 space-y-3">
              {[
                t("memory.knowledge.howToStep1"),
                t("memory.knowledge.howToStep2"),
                t("memory.knowledge.howToStep3"),
                t("memory.knowledge.howToStep4"),
              ].map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200">
                  <div className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
                    {index + 1}
                  </div>
                  <div className="leading-6">{step}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

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

        {reindexActivity ? (
          <div className="sticky top-3 z-10 mt-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-none">
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
                  <ArchiveActionButton tone={tone} onClick={() => void handleRunReindex()} disabled={controlsDisabled} variant="primary">
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
                <ArchiveActionButton
                  tone={tone}
                  onClick={() => setReindexDetailsExpanded((current) => !current)}
                  disabled={false}
                >
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
                disabled={controlsDisabled}
                variant="primary"
              >
                <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                {t("memory.knowledge.reindexNow")}
              </ArchiveActionButton>
            ) : (
              <ArchiveActionButton tone={tone} onClick={() => void handleCopyRemoteGuide()} disabled={controlsDisabled}>
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
          <div className="mt-3">
            <ArchiveNotice tone="info">{t("memory.knowledge.incrementalOnlyInline")}</ArchiveNotice>
          </div>
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
            </div>
          ) : null}
          {fieldErrors.reindex && !reindexActivity?.syncIssue ? <div className="mt-3"><ArchiveNotice tone="error">{fieldErrors.reindex}</ArchiveNotice></div> : null}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t("memory.knowledge.externalPaths")}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t("memory.knowledge.externalPathsDesc")}</div>
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
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {t("memory.knowledge.pathInputHint")}
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
        </div>

        {configFeedback ? <div className="mt-2"><ArchiveNotice>{configFeedback}</ArchiveNotice></div> : null}
        {reindexFeedback && !reindexActivity?.syncIssue ? <div className="mt-2"><ArchiveNotice>{reindexFeedback}</ArchiveNotice></div> : null}
      </ArchiveSectionCard>
    </div>
  );
}
