import { useEffect, useMemo, useState } from "react";
import { Search, Calendar, Network, Cpu, BrainCircuit, ChevronDown, BookOpen, FileText, Info, LibraryBig } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useI18n } from "../../contexts/I18nContext";
import type { ReactNode } from "react";
import {
  gatewayAgentMemoryGet,
  gatewayAgentMemorySet,
  gatewayAgentMemoryIndex,
  gatewayAgentFileRead,
  gatewayAgentMemorySearch,
  gatewayAgentMemoryRuntimeStatus,
  gatewayAgentMemoryStatus,
  gatewayAgentMemoryTimelineAccessResolve,
  gatewayAgentMemoryTimelineEntryRead,
  gatewayAgentMemoryTimelineGet,
  gatewayAgentMemoryTimelineLocalScan,
  gatewayAgentMemoryTimelineRemoteProbeDates,
  gatewayAgentMemoryTimelineRemoteProbe,
  type GatewayAgentMemoryResult,
  type GatewayAgentMemoryRuntimeStatusResult,
  type GatewayAgentMemorySearchResult,
  type GatewayAgentMemoryStatusResult,
  type GatewayAgentMemoryTimelineAccessResult,
  type GatewayAgentMemoryTimelineResult,
  useOpenClaw,
} from "../../contexts/OpenClawContext";
import {
  buildCanonicalDateRange,
  buildMemoryFootprintGroups,
  canEditMemory,
  canLoadLocalTimeline,
  clampActiveSearchMatchIndex,
  collectTimelineEntryCoveredDates,
  collectTextSearchMatches,
  createMemoryDrafts,
  filterMemoryFootprintGroups,
  hasSharedWorkspaceMemory,
  isMemoryDocumentDirty,
  moveActiveSearchMatchIndex,
  mergeTimelineProbeResults,
  resolveExternalMemorySources,
  resolveMemoryDocumentContent,
  resolveMemoryRootDocument,
  resolveInitialSearchMatchIndex,
  resolveSelectedMemoryAgentId,
  resolveSelectedMemoryDocumentName,
  resolveSelectedTimelineEntryName,
  resolveTimelineProbeRangePreset,
  summarizeMemoryFootprintGroups,
  type MemoryTimelineFocusFilter,
} from "./memoryState";
import {
  canRunSemanticMemorySearch,
  resolveSemanticMemorySearchGroup,
  sortSemanticMemorySearchGroups,
  type SemanticMemorySearchGroup,
} from "./memorySearchState";
import { MemoryDiagnosticsDrawer } from "./MemoryDiagnosticsDrawer";
import { MemorySearchPanel } from "./MemorySearchPanel";
import { MemoryFootprintsPanel } from "./MemoryFootprintsPanel";
import { MemoryKnowledgePanel } from "./MemoryKnowledgePanel";
import { buildMemoryConfigStatusSummary, memoryConfigStatusMessageKey, type MemoryIndexStrategy } from "./memoryConfigStatus";
import { MemoryResourcesPanel } from "./MemoryResourcesPanel";
import { MemoryDocumentsDesktop } from "./MemoryDocumentsDesktop";
import { MemoryDocumentsMobile } from "./MemoryDocumentsMobile";
import { ARCHIVE_SPACING, ARCHIVE_SURFACE, ArchiveNotice, ArchivePageHeader, ArchivePane, ArchiveSectionCard, ArchiveSegmentedTabButton, ArchiveStatCard, ArchiveTabBar, ArchiveTabFrame, ArchiveTabSwitch } from "./memoryArchiveUi";
import { buildSemanticMemoryEntries, buildSemanticMindMapModel } from "./memorySemanticState";
import { buildSemanticCorpusDebug } from "./memorySemanticState";

type MemorySection = "overview" | "documents" | "footprints" | "search" | "knowledge";

export type SearchDetailState = {
  title: string;
  path: string;
  sourceKind: string;
  snippet: string;
  content: string;
  loading: boolean;
  error: string | null;
} | null;

export type HealthProbeSummary = {
  provider: string;
  model: string;
  embeddingsReady: boolean | null;
  embeddingsError: string | null;
  rawPayload: string;
  primaryIssue: string | null;
};

export type RuntimeStatusSummary = {
  available: boolean;
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

export type DiagnosticsDrawerState = {
  open: boolean;
  source: "search" | "knowledge";
};

type DocumentIndexRefreshState = "idle" | "done" | "error";

type DocumentSearchOrigin = "manual" | "search_result" | "mind_map";

type DocumentSearchState = {
  query: string;
  input: string;
  matchIndex: number;
  feedbackState: "idle" | "matched" | "empty";
  source: DocumentSearchOrigin;
  hint: string | null;
};

function sourceTone(source: string) {
  if (source.includes("session")) {
    return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/70 dark:bg-violet-950/30 dark:text-violet-300";
  }
  if (source.includes("memory") || source.includes("root")) {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300";
  }
  if (source.includes("daily") || source.includes("timeline")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  }
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function normalizeRootMemoryDocumentName(name: string) {
  return name.toLowerCase() === "memory.md" ? "memory.md" : name;
}

async function copyTextToClipboard(text: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to fallback path.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

function resultSubtitle(path: string, openTarget: string) {
  const fileName = path.split("/").pop() ?? path;
  return `${openTarget} · ${fileName}`;
}

function resultRouteLabel(
  openTarget: string,
  t: (key: string, ...args: (string | number)[]) => string,
) {
  switch (openTarget) {
    case "documents":
      return t("memory.search.route.documents");
    case "footprints":
      return t("memory.search.route.footprints");
    default:
      return t("memory.search.route.detail");
  }
}

function normalizeUiErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error;
    }
    if (typeof record.code === "string" && record.code.trim()) {
      return record.code;
    }
    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return "Unknown error";
    }
  }

  return String(error);
}

function buildErrorTextFragments(...values: Array<string | null | undefined>) {
  return values
    .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
    .filter(Boolean);
}

function detectOllamaContext(options: {
  healthProbeSummary: HealthProbeSummary | null;
  memoryStatus: GatewayAgentMemoryStatusResult | null;
  runtimeStatusSummary: RuntimeStatusSummary | null;
  memoryResult: GatewayAgentMemoryResult | null;
}) {
  const { healthProbeSummary, memoryStatus, runtimeStatusSummary, memoryResult } = options;
  const hints = buildErrorTextFragments(
    healthProbeSummary?.provider,
    healthProbeSummary?.model,
    memoryStatus?.provider,
    memoryStatus?.requestedProvider,
    memoryStatus?.embeddingsError,
    runtimeStatusSummary?.provider,
    runtimeStatusSummary?.model,
    runtimeStatusSummary?.embeddingError,
    memoryResult?.diagnostics?.provider,
    memoryResult?.diagnostics?.embeddingModel,
    memoryResult?.diagnostics?.backend,
    ...(memoryResult?.diagnostics?.sources ?? []),
    ...(memoryResult?.diagnostics?.extraPaths ?? []),
  );

  return hints.some((value) => value.includes("ollama"));
}

function resolveTimelineModeLabel(
  access: GatewayAgentMemoryTimelineAccessResult | null,
  result: GatewayAgentMemoryTimelineResult | null,
  t: (key: string, ...args: (string | number)[]) => string,
) {
  if (access?.mode === "local_workspace") {
    return t("memory.timeline.mode.local");
  }

  if (access?.mode === "remote_probe" || result?.source === "remote_probe") {
    return t("memory.timeline.mode.remote");
  }

  if (access?.mode === "unavailable" || result?.source === "unavailable") {
    return t("memory.timeline.mode.unavailable");
  }

  return t("memory.timeline.mode.unknown");
}

function openTargetForResource(kind: "document" | "timeline" | "external_source" | "runtime_signal") {
  if (kind === "document") {
    return "documents" as const;
  }
  if (kind === "timeline") {
    return "footprints" as const;
  }
  return "overview" as const;
}

export function MemoryView() {
  const { t } = useI18n();
  const { agents, grantedScopes, isConnected, connectedOrigin } = useOpenClaw();
  const [activeSection, setActiveSection] = useState<MemorySection>("overview");
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? "");
  const [memoryResult, setMemoryResult] = useState<GatewayAgentMemoryResult | null>(null);
  const [_memoryLoading, setMemoryLoading] = useState(false);
  const [_memoryError, setMemoryError] = useState<string | null>(null);
  const [timelineAccess, setTimelineAccess] = useState<GatewayAgentMemoryTimelineAccessResult | null>(null);
  const [timelineResult, setTimelineResult] = useState<GatewayAgentMemoryTimelineResult | null>(null);
  const [_timelineLoading, setTimelineLoading] = useState(false);
  const [_timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineProbeRange, setTimelineProbeRange] = useState(() =>
    resolveTimelineProbeRangePreset(new Date().toISOString().slice(0, 10)),
  );
  const [timelineProbeState, setTimelineProbeState] = useState<"idle" | "probing" | "done" | "error">("idle");
  const [timelineProbeCache, setTimelineProbeCache] = useState<Record<string, GatewayAgentMemoryTimelineResult>>({});
  const [timelineProbeFeedback, setTimelineProbeFeedback] = useState<{
    coveredDates: string[];
    missingDates: string[];
    probingDates: string[];
    failureReasons: Record<string, string>;
  }>({ coveredDates: [], missingDates: [], probingDates: [], failureReasons: {} });
  const [memoryStatus, setMemoryStatus] = useState<GatewayAgentMemoryStatusResult | null>(null);
  const [memoryStatusError, setMemoryStatusError] = useState<string | null>(null);
  const [memoryRuntimeStatus, setMemoryRuntimeStatus] = useState<GatewayAgentMemoryRuntimeStatusResult | null>(null);
  const [diagnosticsDrawer, setDiagnosticsDrawer] = useState<DiagnosticsDrawerState>({ open: false, source: "search" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchRunning, setSearchRunning] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<GatewayAgentMemorySearchResult | null>(null);
  const [searchDetail, setSearchDetail] = useState<SearchDetailState>(null);
  const [searchOpenHint, setSearchOpenHint] = useState<string | null>(null);
  const [copiedCommandGuide, setCopiedCommandGuide] = useState(false);
  const [mindMapDebugVisible, setMindMapDebugVisible] = useState(false);
  const [mindMapOpenHint, setMindMapOpenHint] = useState<string | null>(null);
  const [selectedDocumentName, setSelectedDocumentName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [documentSearchState, setDocumentSearchState] = useState<DocumentSearchState>({
    query: "",
    input: "",
    matchIndex: -1,
    feedbackState: "idle",
    source: "manual",
    hint: null,
  });
  const [documentSaveState, setDocumentSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [documentSaveMessage, setDocumentSaveMessage] = useState<string | null>(null);
  const [documentIndexRefreshState, setDocumentIndexRefreshState] = useState<DocumentIndexRefreshState>("idle");
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [timelineFocus] = useState<MemoryTimelineFocusFilter>("all");
  const [selectedTimelineEntryName, setSelectedTimelineEntryName] = useState("");
  const [selectedTimelineDateLabel, setSelectedTimelineDateLabel] = useState("");
  const [timelineSelectionHint, setTimelineSelectionHint] = useState<string | null>(null);
  const [timelineEvidenceSnippet, setTimelineEvidenceSnippet] = useState<string | null>(null);
  const [timelineEvidenceTerm, setTimelineEvidenceTerm] = useState<string | null>(null);
  const [timelineEvidenceMatchIndex, setTimelineEvidenceMatchIndex] = useState(0);
  const [timelineEvidenceExpanded, setTimelineEvidenceExpanded] = useState(false);
  const [_timelineEntryContent, setTimelineEntryContent] = useState("");
  const [_timelineEntryLoading, setTimelineEntryLoading] = useState(false);
  const [_timelineEntryError, setTimelineEntryError] = useState<string | null>(null);

  const isLocalGatewaySession = useMemo(() => {
    if (!connectedOrigin) {
      return false;
    }

    return /^(ws|http):\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(
      connectedOrigin,
    );
  }, [connectedOrigin]);

  useEffect(() => {
    const nextAgentId = resolveSelectedMemoryAgentId(
      selectedAgentId,
      agents.map((agent) => agent.id),
    );
    if (nextAgentId !== selectedAgentId) {
      setSelectedAgentId(nextAgentId);
    }
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId || !isConnected) {
      setMemoryResult(null);
      setTimelineAccess(null);
      setTimelineResult(null);
      return;
    }

    let cancelled = false;

    const loadMemory = async () => {
      setMemoryLoading(true);
      setMemoryError(null);
      try {
        const result = await gatewayAgentMemoryGet(selectedAgentId);
        if (cancelled) {
          return;
        }
        setMemoryResult(result);
        setDrafts(createMemoryDrafts(result));
        setSelectedDocumentName((current) =>
          resolveSelectedMemoryDocumentName(current, result.documents),
        );
      } catch (error) {
        if (!cancelled) {
          setMemoryError(normalizeUiErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setMemoryLoading(false);
        }
      }
    };

    const loadTimeline = async () => {
      setTimelineLoading(true);
      setTimelineError(null);
      try {
        const access = await gatewayAgentMemoryTimelineAccessResolve(selectedAgentId);
        if (cancelled) {
          return;
        }
        setTimelineAccess(access);
        const result = canLoadLocalTimeline(access)
          ? await gatewayAgentMemoryTimelineLocalScan(selectedAgentId)
          : await gatewayAgentMemoryTimelineGet(selectedAgentId);
        if (cancelled) {
          return;
        }
        setTimelineResult(result);
        setSelectedTimelineEntryName((current) =>
          resolveSelectedTimelineEntryName(current, result),
        );
      } catch (error) {
        if (!cancelled) {
          setTimelineError(normalizeUiErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setTimelineLoading(false);
        }
      }
    };

    const loadStatus = async () => {
      try {
        const result = await gatewayAgentMemoryStatus(selectedAgentId);
        if (cancelled) {
          return;
        }
        if (selectedAgentId === "guigui-2") {
          console.debug("[MemoryView] gatewayAgentMemoryStatus raw", result);
        }
        setMemoryStatus(result);
        setMemoryStatusError(null);
      } catch (error) {
        if (!cancelled) {
          setMemoryStatusError(normalizeUiErrorMessage(error));
        }
      }
    };

    const loadRuntimeStatus = async () => {
      if (!isLocalGatewaySession) {
        if (!cancelled) {
          setMemoryRuntimeStatus(null);
        }
        return;
      }

      try {
        const result = await gatewayAgentMemoryRuntimeStatus(selectedAgentId);
        if (cancelled) {
          return;
        }
        setMemoryRuntimeStatus(result);
      } catch (error) {
        if (!cancelled) {
          setMemoryRuntimeStatus(null);
        }
      }
    };

    void loadMemory();
    void loadTimeline();
    void loadStatus();
    void loadRuntimeStatus();

    return () => {
      cancelled = true;
    };
  }, [selectedAgentId, isConnected, isLocalGatewaySession]);

  useEffect(() => {
    if (!selectedAgentId || !selectedTimelineEntryName) {
      setTimelineEntryContent("");
      setTimelineEntryError(null);
      return;
    }

    let cancelled = false;

    const loadEntry = async () => {
      setTimelineEntryLoading(true);
      setTimelineEntryError(null);
      try {
        const result = await gatewayAgentMemoryTimelineEntryRead(
          selectedAgentId,
          selectedTimelineEntryName,
        );
        if (!cancelled) {
          setTimelineEntryContent(result.file.content ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setTimelineEntryError(normalizeUiErrorMessage(error));
          setTimelineEntryContent("");
        }
      } finally {
        if (!cancelled) {
          setTimelineEntryLoading(false);
        }
      }
    };

    void loadEntry();

    return () => {
      cancelled = true;
    };
  }, [selectedAgentId, selectedTimelineEntryName]);

  const selectedDocument = useMemo(
    () => resolveMemoryRootDocument(memoryResult?.documents ?? [], selectedDocumentName),
    [memoryResult, selectedDocumentName],
  );
  const visibleDocuments = useMemo(() => {
    const documents = memoryResult?.documents ?? [];
    const canonical = new Map<string, typeof documents[number]>();

    for (const document of documents) {
      const normalizedName = normalizeRootMemoryDocumentName(document.name);
      const existing = canonical.get(normalizedName);

      if (!existing) {
        canonical.set(normalizedName, document);
        continue;
      }

      if (!document.missing && existing.missing) {
        canonical.set(normalizedName, document);
        continue;
      }

      if (!existing.content && document.content) {
        canonical.set(normalizedName, document);
      }
    }

    return Array.from(canonical.values());
  }, [memoryResult]);
  const selectedDocumentContent = useMemo(() => {
    if (!selectedDocument) {
      return "";
    }
    return drafts[selectedDocument.name] ?? resolveMemoryDocumentContent(selectedDocument);
  }, [drafts, selectedDocument]);
  const documentMatches = useMemo(
    () => collectTextSearchMatches(selectedDocumentContent, documentSearchState.query),
    [selectedDocumentContent, documentSearchState.query],
  );
  const documentDirty = useMemo(
    () =>
      selectedDocument
        ? isMemoryDocumentDirty(
            resolveMemoryDocumentContent(selectedDocument),
            selectedDocumentContent,
          )
        : false,
    [selectedDocument, selectedDocumentContent],
  );
  const footprintGroups = useMemo(
    () => buildMemoryFootprintGroups(timelineResult?.entries ?? [], timelineResult?.probe?.days ?? []),
    [timelineResult],
  );
  const filteredFootprintGroups = useMemo(
    () => filterMemoryFootprintGroups(footprintGroups, timelineFocus),
    [footprintGroups, timelineFocus],
  );
  const footprintSummary = useMemo(
    () => summarizeMemoryFootprintGroups(footprintGroups),
    [footprintGroups],
  );
  const activeAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const externalSources = useMemo(
    () => resolveExternalMemorySources(memoryResult?.diagnostics),
    [memoryResult?.diagnostics],
  );
  const semanticEntries = useMemo(
    () => buildSemanticMemoryEntries({
      documents: visibleDocuments,
      timelineEntries: timelineResult?.entries ?? [],
      agentId: selectedAgentId,
    }),
    [selectedAgentId, timelineResult?.entries, visibleDocuments],
  );
  const semanticMindMapModel = useMemo(
    () => {
      const model = buildSemanticMindMapModel(semanticEntries);
      return {
        ...model,
        debug: buildSemanticCorpusDebug({
          documents: visibleDocuments,
          timelineEntries: timelineResult?.entries ?? [],
          agentId: selectedAgentId,
          timelineSource: timelineResult?.source ?? null,
          timelineProbeDays: timelineResult?.probe?.days?.length ?? 0,
          timelineSelectedEntry: selectedTimelineEntryName || null,
        }),
      };
    },
    [selectedAgentId, selectedTimelineEntryName, semanticEntries, timelineResult?.entries, timelineResult?.probe?.days, timelineResult?.source, visibleDocuments],
  );
  const hasSharedMemory = useMemo(
    () => hasSharedWorkspaceMemory(memoryResult?.sharedAgents ?? []),
    [memoryResult?.sharedAgents],
  );
  const canEdit = canEditMemory(grantedScopes);
  const searchGroups = useMemo(() => {
    const counts: Record<SemanticMemorySearchGroup, number> = {
      all: searchResult?.results.length ?? 0,
      documents: 0,
      timeline: 0,
      sessions: 0,
      other: 0,
    };
    for (const entry of searchResult?.results ?? []) {
      counts[resolveSemanticMemorySearchGroup(entry.sourceKind)] += 1;
    }
    return sortSemanticMemorySearchGroups(counts, { includeAll: true }).map((group) => ({
      group,
      count: counts[group],
    }));
  }, [searchResult]);

  const openMindMapEvidence = (evidence: {
    entryId: string;
    title: string;
    sourceKind: "document" | "timeline";
    path?: string;
    snippet: string;
    matchedTerms: string[];
  }) => {
    if (evidence.sourceKind === "document") {
      const normalizedTitle = normalizeRootMemoryDocumentName(evidence.title);
      const targetDocument = visibleDocuments.find(
        (document) => normalizeRootMemoryDocumentName(document.name) === normalizedTitle,
      );
        if (targetDocument) {
          setSelectedDocumentName(targetDocument.name);
          const nextQuery = evidence.matchedTerms?.[0] ?? evidence.snippet.split(" ")[0] ?? "";
          const nextMatches = collectTextSearchMatches(resolveMemoryDocumentContent(targetDocument), nextQuery);
          setDocumentSearchState({
            query: nextQuery,
            input: nextQuery,
            matchIndex: resolveInitialSearchMatchIndex(nextMatches.length),
            feedbackState: nextQuery ? (nextMatches.length > 0 ? "matched" : "empty") : "idle",
            source: "mind_map",
            hint: `Mind Map evidence opened ${targetDocument.name}.`,
          });
          setActiveSection("documents");
          setMindMapOpenHint(`Opened evidence in Documents: ${targetDocument.name}`);
          return;
      }
    }

    if (evidence.sourceKind === "timeline") {
      const timelineName = evidence.title;
      const timelineMatch = (timelineResult?.entries ?? []).find((entry) => entry.name === timelineName);
      if (timelineMatch) {
        setSelectedTimelineEntryName(timelineMatch.name);
        setTimelineSelectionHint(`Mind Map evidence opened ${timelineMatch.name}.`);
        setTimelineEvidenceSnippet(evidence.snippet);
        setTimelineEvidenceTerm(evidence.matchedTerms[0] ?? null);
        setTimelineEvidenceMatchIndex(0);
        setTimelineEvidenceExpanded(true);
        setActiveSection("footprints");
        setMindMapOpenHint(`Opened evidence in Footprints: ${timelineMatch.name}`);
        return;
      }
    }

    setMindMapOpenHint("Could not resolve the evidence target back to documents or footprints.");
  };

  const handleOpenResourceFromOverview = (resource: {
    kind: "document" | "timeline" | "external_source" | "runtime_signal";
    label: string;
    meta?: string;
  }) => {
    const target = openTargetForResource(resource.kind);
    setActiveSection(target);

    if (resource.kind === "document") {
      const match = visibleDocuments.find((document) => document.name === resource.label);
      if (match) {
        setSelectedDocumentName(match.name);
          setDocumentSearchState((current) => ({
            ...current,
            hint: `Opened from Overview resources: ${match.name}`,
          }));
        }
    }

    if (resource.kind === "timeline") {
      const match = (timelineResult?.entries ?? []).find((entry) => entry.name === resource.label);
      if (match) {
        setSelectedTimelineEntryName(match.name);
        setTimelineSelectionHint(`Opened from Overview resources: ${match.name}`);
      }
    }
  };

  const handleRefreshKnowledge = async () => {
    if (!selectedAgentId || !isConnected) {
      return;
    }

    const [memory, status, runtime] = await Promise.all([
      gatewayAgentMemoryGet(selectedAgentId),
      gatewayAgentMemoryStatus(selectedAgentId).catch(() => null),
      isLocalGatewaySession
        ? gatewayAgentMemoryRuntimeStatus(selectedAgentId).catch(() => null)
        : Promise.resolve(null),
    ]);

    setMemoryResult(memory);
    setDrafts(createMemoryDrafts(memory));
    setMemoryStatus(status);
    setMemoryRuntimeStatus(runtime);
  };

  useEffect(() => {
    setDocumentSearchState((current) => ({
      ...current,
      matchIndex: clampActiveSearchMatchIndex(current.matchIndex, documentMatches.length),
    }));
  }, [documentMatches.length, selectedDocumentName, selectedDocumentContent]);

  useEffect(() => {
    if (!documentSearchState.input.trim() && documentSearchState.query) {
      setDocumentSearchState((current) => ({
        ...current,
        query: "",
        matchIndex: -1,
        feedbackState: "idle",
        hint: t("memory.documents.searchCleared"),
      }));
    }
  }, [documentSearchState.input, documentSearchState.query, t]);

  useEffect(() => {
    setDocumentSearchState((current) => ({
      ...current,
      feedbackState: !current.query.trim()
        ? "idle"
        : documentMatches.length > 0
          ? "matched"
          : "empty",
    }));
  }, [documentMatches.length]);

  useEffect(() => {
    if (!selectedTimelineEntryName) {
      setSelectedTimelineDateLabel("");
      return;
    }

    const match = filteredFootprintGroups.find((group) =>
      group.entries.some((entry) => entry.name === selectedTimelineEntryName),
    );
    setSelectedTimelineDateLabel(match?.dateLabel ?? "");
  }, [filteredFootprintGroups, selectedTimelineEntryName]);

  const healthProbeSummary = useMemo<HealthProbeSummary | null>(() => {
    if (!memoryStatus) {
      return null;
    }

    let primaryIssue: string | null = null;
    if (memoryStatus.embeddingsError) {
      primaryIssue = memoryStatus.embeddingsError;
    } else if (memoryStatus.embeddingsAvailable === false) {
      primaryIssue = "Embeddings unavailable";
    }

    return {
      provider: memoryStatus.provider ?? t("memory.diag.unknown"),
      model: memoryStatus.model ?? t("memory.diag.unknown"),
      embeddingsReady: memoryStatus.embeddingsAvailable ?? null,
      embeddingsError: memoryStatus.embeddingsError ?? null,
      rawPayload: JSON.stringify(memoryStatus, null, 2),
      primaryIssue,
    };
  }, [memoryStatus]);
  const runtimeStatusSummary = useMemo<RuntimeStatusSummary | null>(() => {
    if (!memoryRuntimeStatus) {
      return null;
    }

    return {
      available: true,
      agentId: memoryRuntimeStatus.agentId,
      provider: memoryRuntimeStatus.status.provider,
      model: memoryRuntimeStatus.status.model ?? null,
      embeddingOk: memoryRuntimeStatus.embeddingOk,
      embeddingError: memoryRuntimeStatus.embeddingError ?? null,
      indexedFiles: memoryRuntimeStatus.status.files,
      totalFiles: memoryRuntimeStatus.status.totalFiles ?? null,
      chunks: memoryRuntimeStatus.status.chunks,
      bySource: memoryRuntimeStatus.status.sourceCounts.map((item) => ({
        source: item.source,
        files: item.files,
        chunks: item.chunks,
      })),
      rawPayload: memoryRuntimeStatus.rawPayload,
    };
  }, [memoryRuntimeStatus]);
  const isOllamaProvider = detectOllamaContext({
    healthProbeSummary,
    memoryStatus,
    runtimeStatusSummary,
    memoryResult,
  });
  const shouldForceReindex = (runtimeStatusSummary?.indexedFiles ?? 0) === 0;
  const resolvedIndexStrategy: MemoryIndexStrategy = shouldForceReindex ? "full" : "incremental";
  const resolvedAgentIdForGuide = selectedAgentId || "<agent-id>";
  const commandGuide = useMemo(() => {
    const indexCommand = resolvedIndexStrategy === "full"
      ? `openclaw memory index --agent ${resolvedAgentIdForGuide} --force`
      : `openclaw memory index --agent ${resolvedAgentIdForGuide}`;
    const statusCommand = `openclaw memory status --agent ${resolvedAgentIdForGuide} --deep --index`;

    if (isOllamaProvider) {
      return [
        "ollama serve",
        "ollama pull nomic-embed-text",
        'openclaw config set models.providers.ollama.baseUrl "http://127.0.0.1:11434"',
        'openclaw config set models.providers.ollama.apiKey "ollama-local"',
        'openclaw config set models.providers.ollama.api "ollama"',
        'openclaw config set agents.defaults.memorySearch.provider "ollama"',
        indexCommand,
        statusCommand,
      ].join("\n");
    }

    return [
      indexCommand,
      statusCommand,
    ].join("\n");
  }, [isOllamaProvider, resolvedAgentIdForGuide, resolvedIndexStrategy]);
  const documentIndexRefreshDescription = useMemo(() => {
    if (documentIndexRefreshState === "idle") {
      return null;
    }

    if (!isLocalGatewaySession) {
      return t("memory.documents.index.remote");
    }

    return resolvedIndexStrategy === "full"
      ? t("memory.documents.index.full")
      : t("memory.documents.index.incremental");
  }, [documentIndexRefreshState, isLocalGatewaySession, resolvedIndexStrategy, t]);
  const memoryConfigStatus = buildMemoryConfigStatusSummary({
    selectedAgentId,
    isLocalGatewaySession,
    memoryResult,
    memoryStatus,
    runtimeStatus: memoryRuntimeStatus,
  });
  const searchPrimaryReasonKey = !isLocalGatewaySession
    ? null
    : memoryStatus?.embeddingsError
    ? memoryConfigStatus.providerAvailabilityReasonKey
    : memoryConfigStatus.searchAvailabilityReasonKey;
  const searchPrimaryReason = searchPrimaryReasonKey ? t(searchPrimaryReasonKey) : null;

  const getAgentBadge = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-transparent`}>
        <Cpu className="w-3 h-3" />
        {agent.name}
      </span>
    );
  };

  const handleRunSemanticSearch = async () => {
    if (!selectedAgentId || !canRunSemanticMemorySearch(searchQuery, searchRunning)) {
      return;
    }

    setSearchRunning(true);
    setMemoryLoading(true);
    try {
      const result = await gatewayAgentMemorySearch(selectedAgentId, searchQuery, 20, "all");
      setSearchResult(result);
      setSearchError(null);
      setActiveSection("search");
    } catch (error) {
      setSearchError(normalizeUiErrorMessage(error));
      setSearchResult(null);
    } finally {
      setMemoryLoading(false);
      setSearchRunning(false);
    }
  };

  const handleCopyCommandGuide = async () => {
    const copied = await copyTextToClipboard(commandGuide);
    if (!copied) {
      toast.error(t("memory.search.commands.copyFailed"));
      return;
    }
    setCopiedCommandGuide(true);
    toast.success(t("memory.search.commands.copySuccess"));
    window.setTimeout(() => setCopiedCommandGuide(false), 1500);
  };

  const handleProbeTimelineRange = async () => {
    if (!selectedAgentId) {
      return;
    }

    const cacheKey = `${selectedAgentId}:${timelineProbeRange.startDate}:${timelineProbeRange.endDate}`;
    const cached = timelineProbeCache[cacheKey];
    if (cached) {
      setTimelineResult(cached);
      setTimelineError(null);
      setSelectedTimelineEntryName((current) =>
        resolveSelectedTimelineEntryName(current, cached),
      );
      setActiveSection("footprints");
      setTimelineProbeState("done");
      return;
    }

    const requestedDates = buildCanonicalDateRange(
      timelineProbeRange.startDate,
      timelineProbeRange.endDate,
    );
    const coveredDates = collectTimelineEntryCoveredDates(timelineResult?.entries ?? []);
    const missingDates = requestedDates.filter((date) => !coveredDates.has(date));
    const locallyCovered = requestedDates.filter((date) => coveredDates.has(date));

    setTimelineProbeFeedback({
      coveredDates: locallyCovered,
      missingDates,
      probingDates: [],
      failureReasons: {},
    });

    if (missingDates.length === 0 && timelineResult) {
      setTimelineProbeCache((current) => ({
        ...current,
        [cacheKey]: timelineResult,
      }));
      setTimelineResult(timelineResult);
      setTimelineError(null);
      setSelectedTimelineEntryName((current) =>
        resolveSelectedTimelineEntryName(current, timelineResult),
      );
      setActiveSection("footprints");
      setTimelineProbeState("done");
      setTimelineProbeFeedback({
        coveredDates: locallyCovered,
        missingDates: [],
        probingDates: [],
        failureReasons: {},
      });
      return;
    }

    setTimelineProbeState("probing");
    setTimelineLoading(true);
    setTimelineProbeFeedback({
      coveredDates: locallyCovered,
      missingDates,
      probingDates: missingDates,
      failureReasons: {},
    });
    try {
      const result = missingDates.length > 0
        ? await gatewayAgentMemoryTimelineRemoteProbeDates(selectedAgentId, missingDates)
        : await gatewayAgentMemoryTimelineRemoteProbe(
            selectedAgentId,
            timelineProbeRange.startDate,
            timelineProbeRange.endDate,
          );
      const merged = mergeTimelineProbeResults({
        current: timelineResult,
        retryResult: result,
      });
      setTimelineResult(merged);
      setTimelineProbeCache((current) => ({
        ...current,
        [cacheKey]: merged,
      }));
      setTimelineError(null);
      setSelectedTimelineEntryName((current) =>
        resolveSelectedTimelineEntryName(current, merged),
      );
      setActiveSection("footprints");
      setTimelineProbeState("done");
      setTimelineProbeFeedback({
        coveredDates: requestedDates,
        missingDates: [],
        probingDates: [],
        failureReasons: {},
      });
    } catch (error) {
      const message = normalizeUiErrorMessage(error);
      setTimelineError(message);
      setTimelineProbeState("error");
      setTimelineProbeFeedback({
        coveredDates: locallyCovered,
        missingDates,
        probingDates: [],
        failureReasons: Object.fromEntries(missingDates.map((date) => [date, message])),
      });
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleRetryProbeDate = async (date: string) => {
    if (!selectedAgentId) {
      return;
    }

    setTimelineProbeState("probing");
    setTimelineLoading(true);
    setTimelineProbeFeedback((current) => ({
      ...current,
      probingDates: [date],
    }));

    try {
      const result = await gatewayAgentMemoryTimelineRemoteProbeDates(selectedAgentId, [date]);
      const merged = mergeTimelineProbeResults({
        current: timelineResult,
        retryResult: result,
      });
      setTimelineResult(merged);
      setTimelineError(null);
      setSelectedTimelineEntryName((current) =>
        resolveSelectedTimelineEntryName(current, merged),
      );
      setTimelineProbeState("done");
      setTimelineProbeFeedback((current) => ({
        coveredDates: Array.from(new Set([...current.coveredDates, date])).sort(),
        missingDates: current.missingDates.filter((item) => item !== date),
        probingDates: [],
        failureReasons: Object.fromEntries(Object.entries(current.failureReasons).filter(([key]) => key !== date)),
      }));
    } catch (error) {
      const message = normalizeUiErrorMessage(error);
      setTimelineError(message);
      setTimelineProbeState("error");
      setTimelineProbeFeedback((current) => ({
        ...current,
        probingDates: [],
        failureReasons: {
          ...current.failureReasons,
          [date]: message,
        },
      }));
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleDocumentDraftChange = (value: string) => {
    if (!selectedDocument) {
      return;
    }
    setDrafts((current) => ({
      ...current,
      [selectedDocument.name]: value,
    }));
    if (documentSaveState !== "idle") {
      setDocumentSaveState("idle");
      setDocumentSaveMessage(null);
    }
  };

  const handleRunDocumentSearch = () => {
    const nextQuery = documentSearchState.input.trim();
    const nextMatches = collectTextSearchMatches(selectedDocumentContent, nextQuery);
    setDocumentSearchState((current) => ({
      ...current,
      query: nextQuery,
      source: "manual",
      matchIndex: resolveInitialSearchMatchIndex(nextMatches.length),
      feedbackState: nextQuery ? (nextMatches.length > 0 ? "matched" : "empty") : "idle",
      hint: nextQuery ? t("memory.documents.searchRun", nextQuery) : t("memory.documents.searchCleared"),
    }));
  };

  const handleCancelDocumentEdit = () => {
    if (!selectedDocument) {
      return;
    }
    setDrafts((current) => ({
      ...current,
      [selectedDocument.name]: resolveMemoryDocumentContent(selectedDocument),
    }));
    setIsEditingDocument(false);
    setDocumentSaveState("idle");
    setDocumentSaveMessage(null);
  };

  const handleReloadDocument = async () => {
    if (!selectedAgentId) {
      return;
    }

    try {
      const result = await gatewayAgentMemoryGet(selectedAgentId);
      setMemoryResult(result);
      setDrafts(createMemoryDrafts(result));
      setSelectedDocumentName((current) =>
        resolveSelectedMemoryDocumentName(current, result.documents),
      );
      setDocumentSaveState("idle");
      setDocumentSaveMessage(t("memory.documents.reloadDone"));
      setDocumentIndexRefreshState("idle");
    } catch (error) {
      setDocumentSaveState("error");
      setDocumentSaveMessage(normalizeUiErrorMessage(error));
      setDocumentIndexRefreshState("idle");
    }
  };

  const handleSaveDocument = async () => {
    if (!selectedDocument || !canEdit || !documentDirty) {
      return;
    }

    setDocumentSaveState("saving");
    setDocumentSaveMessage(null);
    setDocumentIndexRefreshState("idle");

    try {
      await gatewayAgentMemorySet(selectedAgentId, selectedDocument.name, selectedDocumentContent);
      if (isLocalGatewaySession) {
        await gatewayAgentMemoryIndex(
          selectedAgentId,
          resolvedIndexStrategy === "full",
        );
      }
      const result = await gatewayAgentMemoryGet(selectedAgentId);
      setMemoryResult(result);
      setDrafts(createMemoryDrafts(result));
      setSelectedDocumentName((current) =>
        resolveSelectedMemoryDocumentName(current, result.documents),
      );
      setDocumentSaveState("saved");
      setDocumentSaveMessage(t("memory.documents.saved", selectedDocument.name));
      setDocumentIndexRefreshState("done");
      setIsEditingDocument(false);
      toast.success(t("memory.documents.saved", selectedDocument.name));
    } catch (error) {
      const message = normalizeUiErrorMessage(error);
      setDocumentSaveState("error");
      setDocumentSaveMessage(message);
      setDocumentIndexRefreshState("idle");
      toast.error(message);
    }
  };

  const handleOpenSearchEntry = async (entry: NonNullable<GatewayAgentMemorySearchResult>["results"][number]) => {
    if (entry.openTarget === "documents") {
        setSelectedDocumentName(entry.canonicalDocumentName ?? entry.path.split("/").pop() ?? "");
        const derivedQuery = entry.snippet.trim().split(/\s+/).find((token) => token.length >= 3) ?? entry.snippet.slice(0, 24).trim();
        setDocumentSearchState({
          query: derivedQuery,
          input: derivedQuery,
          matchIndex: -1,
          feedbackState: derivedQuery ? "matched" : "idle",
          source: "search_result",
          hint: t("memory.search.hint.documents", entry.path),
        });
        setTimelineSelectionHint(null);
        setSearchOpenHint(t("memory.search.opened.documents", entry.path));
        setActiveSection("documents");
      return;
    }

    if (entry.openTarget === "footprints") {
      setSelectedTimelineEntryName(entry.timelineEntryName ?? entry.path.split("/").slice(-2).join("/"));
      const derivedDate = entry.timelineEntryName?.replace(/^memory\//, "").replace(/\.md$/i, "")
        ?? entry.path.split("/").slice(-1)[0]?.replace(/\.md$/i, "")
        ?? "";
      setSelectedTimelineDateLabel(derivedDate);
      setTimelineSelectionHint(t("memory.search.hint.footprints", derivedDate));
        setDocumentSearchState((current) => ({
          ...current,
          hint: null,
        }));
        setSearchOpenHint(t("memory.search.opened.footprints", entry.path));
        setActiveSection("footprints");
        return;
    }

    setSearchOpenHint(t("memory.search.opened.detail", entry.path));

    setSearchDetail({
      title: entry.path.split("/").pop() ?? entry.path,
      path: entry.path,
      sourceKind: entry.sourceKind,
      snippet: entry.snippet,
      content: "",
      loading: true,
      error: null,
    });

    try {
      const normalizedName = entry.path.includes("/sessions/")
        ? entry.path.split("/sessions/")[1]
        : entry.path.split("/").slice(-2).join("/");
      const result = await gatewayAgentFileRead(selectedAgentId, normalizedName);
      setSearchDetail({
        title: entry.path.split("/").pop() ?? entry.path,
        path: entry.path,
        sourceKind: entry.sourceKind,
        snippet: entry.snippet,
        content: result.file.content ?? "",
        loading: false,
        error: null,
      });
    } catch (error) {
      setSearchDetail({
        title: entry.path.split("/").pop() ?? entry.path,
        path: entry.path,
        sourceKind: entry.sourceKind,
        snippet: entry.snippet,
        content: "",
        loading: false,
        error: normalizeUiErrorMessage(error),
      });
    }
  };

  const memoryPanels: Record<MemorySection, ReactNode> = {
    overview: (
      <ArchiveTabFrame icon={BookOpen} title={t("memory.tab.overview")} description={t("memory.overview.sources.title")}>
        <div className={`grid lg:grid-cols-[1.15fr_0.85fr] ${ARCHIVE_SPACING.sectionGap}`}>
          <ArchiveSectionCard>
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Network className="w-4 h-4 text-sky-500" />
              {t("memory.overview.agent.title")}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ArchiveStatCard label={t("memory.overview.agent.active")} value={activeAgent?.name ?? t("memory.overview.agent.none")} meta={selectedAgentId || "-"} />
              <ArchiveStatCard label={t("memory.overview.workspace")} value={<span className="break-all text-sm font-medium text-slate-700 dark:text-slate-200">{memoryResult?.workspace ?? t("memory.overview.workspaceUnavailable")}</span>} />
              <ArchiveStatCard label={t("memory.overview.shared")} value={<span className="text-sm font-medium">{hasSharedMemory ? t("memory.overview.sharedYes") : t("memory.overview.sharedNo")}</span>} meta={memoryResult?.sharedAgents.map((agent) => agent.name).join(", ") || t("memory.overview.sharedAgents.none")} />
              <ArchiveStatCard label={t("memory.overview.edit")} value={<span className="text-sm font-medium">{canEdit ? t("memory.overview.edit.writable") : t("memory.overview.edit.readonly")}</span>} meta={canEdit ? t("memory.overview.edit.scopeGranted") : t("memory.overview.edit.scopeDenied")} />
            </div>
            {_memoryError ? <div className="mt-4"><ArchiveNotice tone="error">{_memoryError}</ArchiveNotice></div> : null}
          </ArchiveSectionCard>

          <MemoryResourcesPanel
            memoryResult={memoryResult}
            timelineResult={timelineResult}
            externalSources={externalSources}
            healthProbeSummary={healthProbeSummary}
            runtimeStatusSummary={runtimeStatusSummary}
            isLocalGatewaySession={isLocalGatewaySession}
            t={t}
            onOpenDiagnostics={() => setDiagnosticsDrawer({ open: true, source: "knowledge" })}
            onOpenResource={handleOpenResourceFromOverview}
            compact
          />
        </div>
      </ArchiveTabFrame>
    ),
    documents: (
      <>
        <MemoryDocumentsDesktop
          title={t("memory.documents.title")}
          description={documentSearchState.hint ?? t("memory.documents.desc")}
          documentSearchInput={documentSearchState.input}
          documentQuery={documentSearchState.query}
          documentMatches={documentMatches}
          documentMatchIndex={documentSearchState.matchIndex}
          documentSearchFeedbackState={documentSearchState.feedbackState}
          documentSearchHint={documentSearchState.hint}
          documentDirty={documentDirty}
          documentSearchSource={documentSearchState.source === "mind_map" ? "search_result" : documentSearchState.source}
          documentSaveMessage={documentSaveMessage}
          documentSaveState={documentSaveState}
          documentIndexRefreshState={documentIndexRefreshState}
          documentIndexRefreshDescription={documentIndexRefreshDescription}
          selectedDocument={selectedDocument}
          selectedDocumentName={selectedDocumentName}
          selectedDocumentContent={selectedDocumentContent}
          selectedSnippet={null}
          evidenceExpanded={false}
          onToggleEvidenceExpanded={() => undefined}
          visibleDocuments={visibleDocuments}
          canEdit={canEdit}
          isEditing={isEditingDocument}
          workspaceLabel={memoryResult?.workspace ?? t("memory.documents.workspaceFallback")}
          t={t}
          getAgentBadge={getAgentBadge}
          selectedAgentId={selectedAgentId}
          onDocumentSearchInputChange={(value) => setDocumentSearchState((current) => ({ ...current, input: value }))}
          onRunDocumentSearch={handleRunDocumentSearch}
          onClearDocumentSearch={() => setDocumentSearchState((current) => ({
            ...current,
            query: "",
            input: "",
            matchIndex: -1,
            feedbackState: "idle",
            source: "manual",
            hint: t("memory.documents.searchCleared"),
          }))}
          onPreviousHighlight={() => setDocumentSearchState((current) => ({ ...current, matchIndex: moveActiveSearchMatchIndex(current.matchIndex, documentMatches.length, -1) }))}
          onNextHighlight={() => setDocumentSearchState((current) => ({ ...current, matchIndex: moveActiveSearchMatchIndex(current.matchIndex, documentMatches.length, 1) }))}
          onSelectDocument={setSelectedDocumentName}
          onDocumentDraftChange={handleDocumentDraftChange}
          onStartEdit={() => setIsEditingDocument(true)}
          onCancelEdit={handleCancelDocumentEdit}
          onReload={() => void handleReloadDocument()}
          onSave={() => void handleSaveDocument()}
          footerLabel={t("memory.documents.footer", visibleDocuments.length)}
        />

        <MemoryDocumentsMobile
          visibleDocuments={visibleDocuments}
          selectedDocumentName={selectedDocumentName}
          selectedAgentId={selectedAgentId}
          workspaceLabel={memoryResult?.workspace ?? t("memory.documents.workspaceFallback")}
          t={t}
          getAgentBadge={getAgentBadge}
          onSelectDocument={setSelectedDocumentName}
        />
      </>
    ),
    footprints: (
      <ArchivePane className={`${ARCHIVE_SURFACE.tabPane} hide-scrollbar ${ARCHIVE_SPACING.page}`}>
        <MemoryFootprintsPanel
          timelineAccess={timelineAccess}
          timelineResult={timelineResult}
          timelineProbeRange={timelineProbeRange}
          timelineProbeState={timelineProbeState}
          timelineProbeFeedback={timelineProbeFeedback}
          timelineError={_timelineError}
          filteredFootprintGroups={filteredFootprintGroups}
          selectedTimelineEntryName={selectedTimelineEntryName}
          selectedTimelineDateLabel={selectedTimelineDateLabel}
          timelineSelectionHint={timelineSelectionHint}
          selectedSnippet={timelineEvidenceSnippet}
          selectedHighlightTerm={timelineEvidenceTerm}
          activeHighlightIndex={timelineEvidenceMatchIndex}
          evidenceExpanded={timelineEvidenceExpanded}
          onToggleEvidenceExpanded={() => setTimelineEvidenceExpanded((current) => !current)}
          timelineEntryContent={_timelineEntryContent}
          timelineEntryLoading={_timelineEntryLoading}
          timelineEntryError={_timelineEntryError}
          selectedAgentId={selectedAgentId}
          resolveTimelineModeLabel={(access, result) => resolveTimelineModeLabel(access, result, t)}
          getAgentBadge={getAgentBadge}
          t={t}
          onProbeRangeChange={setTimelineProbeRange}
          onProbeTimelineRange={() => void handleProbeTimelineRange()}
          onRetryProbeDate={(date) => void handleRetryProbeDate(date)}
          onPreviousHighlight={() => setTimelineEvidenceMatchIndex((current) => Math.max(0, current - 1))}
          onNextHighlight={() => setTimelineEvidenceMatchIndex((current) => current + 1)}
          onSelectTimelineEntry={setSelectedTimelineEntryName}
        />
      </ArchivePane>
    ),
    search: (
      <ArchivePane className={`${ARCHIVE_SURFACE.tabPane} ${ARCHIVE_SPACING.page}`}>
        <MemorySearchPanel
          healthProbeSummary={healthProbeSummary}
          runtimeStatusSummary={runtimeStatusSummary}
          isLocalGatewaySession={isLocalGatewaySession}
          commandGuide={memoryConfigStatus.commandGuide}
          commandGuideDescription={t(memoryConfigStatus.commandDescriptionKey)}
          configStatusMessage={t(memoryConfigStatusMessageKey(memoryConfigStatus.statusKey))}
          searchAvailabilityReason={t(memoryConfigStatus.searchAvailabilityReasonKey)}
          providerAvailabilityReason={t(memoryConfigStatus.providerAvailabilityReasonKey)}
          searchPrimaryReason={searchPrimaryReason}
          copiedCommandGuide={copiedCommandGuide}
          searchQuery={searchQuery}
          searchRunning={searchRunning}
          searchError={searchError}
          searchResult={searchResult}
          searchGroups={searchGroups}
          searchDetail={searchDetail}
          searchOpenHint={searchOpenHint}
          memoryStatusError={memoryStatusError}
          t={t}
          sourceTone={sourceTone}
          resultSubtitle={resultSubtitle}
          resultRouteLabel={(openTarget) => resultRouteLabel(openTarget, t)}
          onOpenDiagnostics={() => setDiagnosticsDrawer({ open: true, source: "search" })}
          onCopyCommandGuide={() => void handleCopyCommandGuide()}
          onSearchQueryChange={setSearchQuery}
          onRunSemanticSearch={() => void handleRunSemanticSearch()}
          onOpenSearchEntry={(entry) => void handleOpenSearchEntry(entry)}
          onCloseSearchDetail={() => setSearchDetail(null)}
        />
      </ArchivePane>
    ),
    knowledge: (
      <ArchivePane className={`${ARCHIVE_SURFACE.tabPane} ${ARCHIVE_SPACING.page}`}>
        <MemoryKnowledgePanel
          memoryResult={memoryResult}
          memoryStatus={memoryStatus}
          runtimeStatus={memoryRuntimeStatus}
          externalSources={externalSources}
          isLocalGatewaySession={isLocalGatewaySession}
          selectedAgentId={selectedAgentId}
          model={semanticMindMapModel}
          t={t}
          showDebug={mindMapDebugVisible}
          onToggleDebug={() => setMindMapDebugVisible((current) => !current)}
          onOpenEvidence={openMindMapEvidence}
          openHint={mindMapOpenHint}
          onRefreshKnowledge={handleRefreshKnowledge}
        />
      </ArchivePane>
    ),
  };

  return (
    <div className="max-w-[1400px] mx-auto h-full min-h-0 flex flex-col text-slate-900 dark:text-slate-100 transition-colors">
      <ArchivePageHeader
        title={t("memory.title")}
        description={t("memory.desc")}
        leadingIcon={<LibraryBig className="h-5 w-5 text-sky-500" />}
        actions={(
          <div className="inline-flex items-center gap-2 rounded-[22px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-2 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:border-slate-800/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.82))] dark:shadow-none">
            <div className="flex min-w-[112px] flex-col rounded-[16px] bg-[linear-gradient(135deg,rgba(14,165,233,0.14),rgba(56,189,248,0.06))] px-3 py-2 text-slate-700 dark:bg-[linear-gradient(135deg,rgba(14,165,233,0.18),rgba(2,6,23,0.18))] dark:text-slate-200">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700/80 dark:text-sky-300/80">Agents</span>
              <span className="mt-1 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {agents.length} available
              </span>
            </div>
            <div className="relative inline-flex items-center">
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="min-w-[220px] appearance-none rounded-[16px] border border-slate-300 bg-white/95 py-2.5 pl-4 pr-10 text-sm font-medium text-slate-700 shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.id.split('-')[0]}-{a.id.split('-')[2]})</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" />
            </div>
          </div>
        )}
      />

      <div className="mb-2">
        <ArchiveTabBar>
          {([
            ["overview", t("memory.tab.overview"), t("memory.tab.tooltip.overview"), BookOpen],
            ["documents", t("memory.tab.documents"), t("memory.tab.tooltip.documents"), FileText],
            ["footprints", t("memory.tab.footprints"), t("memory.tab.tooltip.footprints"), Calendar],
            ["search", t("memory.tab.search"), t("memory.tab.tooltip.search"), Search],
            ["knowledge", t("memory.tab.knowledge"), t("memory.tab.tooltip.knowledge"), BrainCircuit],
          ] as const).map(([section, label, description, Icon]) => {
            const active = activeSection === section;
            return (
              <div key={section} className="group relative">
                <ArchiveSegmentedTabButton
                  active={active}
                  icon={Icon}
                  label={label}
                  description=""
                  onClick={() => setActiveSection(section)}
                />
                <div className="pointer-events-none absolute right-3 top-3 z-10">
                  <Info className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-sky-500 dark:text-slate-500 dark:group-hover:text-sky-400" />
                </div>
                <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600 shadow-lg group-hover:block dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {description}
                </div>
              </div>
            );
          })}
        </ArchiveTabBar>
      </div>

      <div className="hidden">
        {selectedDocumentContent}
        {footprintSummary.all}
      </div>

      <ArchiveTabSwitch active={true}>
        <AnimatePresence mode="wait">
          <MemoryDiagnosticsDrawer
            diagnosticsDrawer={diagnosticsDrawer}
            healthProbeSummary={healthProbeSummary}
            memoryResult={memoryResult}
            runtimeStatusSummary={runtimeStatusSummary}
            isLocalGatewaySession={isLocalGatewaySession}
            selectedAgentId={selectedAgentId}
            t={t}
            onClose={() => setDiagnosticsDrawer((current) => ({ ...current, open: false }))}
          />

          {activeSection === "overview" && selectedAgentId && isConnected && !memoryResult && !timelineResult ? (
            <ArchivePane className={`${ARCHIVE_SURFACE.tabPane} ${ARCHIVE_SPACING.page}`}>
              <ArchiveNotice>Overview 正在等待 agent 解析与首批记忆数据初始化。</ArchiveNotice>
            </ArchivePane>
          ) : memoryPanels[activeSection]}
        </AnimatePresence>
      </ArchiveTabSwitch>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
