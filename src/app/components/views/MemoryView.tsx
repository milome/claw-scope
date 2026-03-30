import { useEffect, useMemo, useState } from "react";
import { Search, Footprints, ChevronRight, Calendar, Clock, Network, Cpu, BrainCircuit, FileDigit, Database, ChevronDown, BookOpen, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useI18n } from "../../contexts/I18nContext";
import type { ReactNode } from "react";
import {
  gatewayAgentMemoryGet,
  gatewayAgentFileRead,
  gatewayAgentMemorySet,
  gatewayAgentMemorySearch,
  gatewayAgentMemoryRuntimeStatus,
  gatewayAgentMemoryStatus,
  gatewayAgentMemoryTimelineAccessResolve,
  gatewayAgentMemoryTimelineEntryRead,
  gatewayAgentMemoryTimelineGet,
  gatewayAgentMemoryTimelineLocalScan,
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
  buildMemoryFootprintGroups,
  buildHighlightedTextSegments,
  canEditMemory,
  canLoadLocalTimeline,
  canReloadMemoryDocument,
  canSaveMemoryDocument,
  collectTextSearchMatches,
  createMemoryDrafts,
  filterMemoryFootprintGroups,
  hasSharedWorkspaceMemory,
  isMemoryDocumentDirty,
  moveActiveSearchMatchIndex,
  resolveExternalMemorySources,
  resolveMemoryDocumentContent,
  resolveMemoryRootDocument,
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

type MemorySection = "overview" | "documents" | "footprints" | "search" | "knowledge";

type SearchDetailState = {
  title: string;
  path: string;
  sourceKind: string;
  snippet: string;
  content: string;
  loading: boolean;
  error: string | null;
} | null;

type HealthProbeSummary = {
  provider: string;
  model: string;
  embeddingsReady: boolean | null;
  embeddingsError: string | null;
  rawPayload: string;
  primaryIssue: string | null;
};

type RuntimeStatusSummary = {
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

type DiagnosticsDrawerState = {
  open: boolean;
  source: "search" | "knowledge";
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

function diagnosticsTone(summary: HealthProbeSummary | null) {
  if (!summary) {
    return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
  if (summary.primaryIssue) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300";
}

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
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 ${className}`.trim()}
    >
      <div className="font-medium">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
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
  const [memoryStatus, setMemoryStatus] = useState<GatewayAgentMemoryStatusResult | null>(null);
  const [memoryStatusError, setMemoryStatusError] = useState<string | null>(null);
  const [memoryRuntimeStatus, setMemoryRuntimeStatus] = useState<GatewayAgentMemoryRuntimeStatusResult | null>(null);
  const [diagnosticsDrawer, setDiagnosticsDrawer] = useState<DiagnosticsDrawerState>({ open: false, source: "search" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchRunning] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<GatewayAgentMemorySearchResult | null>(null);
  const [searchDetail, setSearchDetail] = useState<SearchDetailState>(null);
  const [searchOpenHint, setSearchOpenHint] = useState<string | null>(null);
  const [copiedCommandGuide, setCopiedCommandGuide] = useState(false);
  const [selectedDocumentName, setSelectedDocumentName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [documentQuery, setDocumentQuery] = useState("");
  const [documentMatchIndex, setDocumentMatchIndex] = useState(-1);
  const [documentSearchSource, setDocumentSearchSource] = useState<"manual" | "search_result">("manual");
  const [documentSearchHint, setDocumentSearchHint] = useState<string | null>(null);
  const [documentSaveState, setDocumentSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [documentSaveMessage, setDocumentSaveMessage] = useState<string | null>(null);
  const [timelineFocus] = useState<MemoryTimelineFocusFilter>("all");
  const [selectedTimelineEntryName, setSelectedTimelineEntryName] = useState("");
  const [selectedTimelineDateLabel, setSelectedTimelineDateLabel] = useState("");
  const [timelineSelectionHint, setTimelineSelectionHint] = useState<string | null>(null);
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
          setMemoryError(error instanceof Error ? error.message : String(error));
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
          setTimelineError(error instanceof Error ? error.message : String(error));
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
          setMemoryStatusError(error instanceof Error ? error.message : String(error));
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
          setTimelineEntryError(error instanceof Error ? error.message : String(error));
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
  const selectedDocumentUpdatedAtLabel = useMemo(
    () => (selectedDocument?.updatedAtMs ? new Date(selectedDocument.updatedAtMs).toLocaleString() : "-"),
    [selectedDocument],
  );
  const selectedDocumentContent = useMemo(() => {
    if (!selectedDocument) {
      return "";
    }
    return drafts[selectedDocument.name] ?? resolveMemoryDocumentContent(selectedDocument);
  }, [drafts, selectedDocument]);
  const documentMatches = useMemo(
    () => collectTextSearchMatches(selectedDocumentContent, documentQuery),
    [selectedDocumentContent, documentQuery],
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

  useEffect(() => {
    setDocumentMatchIndex(documentMatches.length > 0 ? 0 : -1);
  }, [documentMatches.length, selectedDocumentName]);

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
  const providerHint = (healthProbeSummary?.provider ?? "").toLowerCase();
  const isOllamaProvider = providerHint.includes("ollama");
  const isHostedProvider =
    providerHint.includes("openai") ||
    providerHint.includes("anthropic") ||
    providerHint.includes("gemini") ||
    providerHint.includes("azure");
  const commandGuide = useMemo(() => {
    if (isOllamaProvider) {
      return [
        "ollama serve",
        "ollama pull nomic-embed-text",
        'openclaw config set models.providers.ollama.baseUrl "http://127.0.0.1:11434"',
        'openclaw config set models.providers.ollama.apiKey "ollama-local"',
        'openclaw config set models.providers.ollama.api "ollama"',
        'openclaw config set agents.defaults.memorySearch.provider "ollama"',
        'openclaw memory index --agent guigui-2 --force',
        'openclaw memory status --agent guigui-2 --deep --index',
      ].join("\n");
    }

    return [
      'openclaw memory index --agent <agent-id> --force',
      'openclaw memory status --agent <agent-id> --deep --index',
    ].join("\n");
  }, [isOllamaProvider]);
  const commandGuideDescription = useMemo(() => {
    if (isOllamaProvider) {
      return t("memory.search.commands.ollama");
    }
    if (isHostedProvider) {
      return t("memory.search.commands.openai");
    }
    return t("memory.search.commands.generic");
  }, [isHostedProvider, isOllamaProvider, t]);

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

    setMemoryLoading(true);
    try {
      const result = await gatewayAgentMemorySearch(selectedAgentId, searchQuery, 20, "all");
      setSearchResult(result);
      setSearchError(null);
      setActiveSection("search");
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : String(error));
      setSearchResult(null);
    } finally {
      setMemoryLoading(false);
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

    setTimelineProbeState("probing");
    setTimelineLoading(true);
    try {
      const result = await gatewayAgentMemoryTimelineRemoteProbe(
        selectedAgentId,
        timelineProbeRange.startDate,
        timelineProbeRange.endDate,
      );
      setTimelineResult(result);
      setTimelineError(null);
      setSelectedTimelineEntryName((current) =>
        resolveSelectedTimelineEntryName(current, result),
      );
      setActiveSection("footprints");
      setTimelineProbeState("done");
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : String(error));
      setTimelineProbeState("error");
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleReloadDocuments = async () => {
    if (!canReloadMemoryDocument({ selectedAgentId, isLoading: false, isSaving: documentSaveState === "saving" })) {
      return;
    }

    setMemoryLoading(true);
    try {
      const result = await gatewayAgentMemoryGet(selectedAgentId);
      setMemoryResult(result);
      setDrafts(createMemoryDrafts(result));
      setSelectedDocumentName((current) =>
        resolveSelectedMemoryDocumentName(current, result.documents),
      );
      setDocumentSaveState("idle");
      setDocumentSaveMessage(null);
      setMemoryError(null);
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : String(error));
    } finally {
      setMemoryLoading(false);
    }
  };

  const handleSaveDocument = async () => {
    if (!selectedDocument) {
      return;
    }
    if (
      !canSaveMemoryDocument({
        selectedAgentId,
        isLoading: false,
        isSaving: documentSaveState === "saving",
        canEdit,
        isDirty: documentDirty,
      })
    ) {
      return;
    }

    setDocumentSaveState("saving");
    setDocumentSaveMessage(null);
    try {
      await gatewayAgentMemorySet(selectedAgentId, selectedDocument.name, selectedDocumentContent);
      const result = await gatewayAgentMemoryGet(selectedAgentId);
      setMemoryResult(result);
      setDrafts(createMemoryDrafts(result));
      setSelectedDocumentName((current) =>
        resolveSelectedMemoryDocumentName(current, result.documents),
      );
      setDocumentSaveState("saved");
      setDocumentSaveMessage(t("memory.documents.saved", selectedDocument.name));
      setMemoryError(null);
    } catch (error) {
      setDocumentSaveState("error");
      setDocumentSaveMessage(error instanceof Error ? error.message : String(error));
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

  const handleOpenSearchEntry = async (entry: NonNullable<GatewayAgentMemorySearchResult>["results"][number]) => {
    if (entry.openTarget === "documents") {
      setSelectedDocumentName(entry.canonicalDocumentName ?? entry.path.split("/").pop() ?? "");
      const derivedQuery = entry.snippet.trim().split(/\s+/).find((token) => token.length >= 3) ?? entry.snippet.slice(0, 24).trim();
      setDocumentQuery(derivedQuery);
      setDocumentSearchSource("search_result");
      setDocumentSearchHint(t("memory.search.hint.documents", entry.path));
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
      setDocumentSearchHint(null);
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
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto h-full flex flex-col text-slate-900 dark:text-slate-100 transition-colors">
      <div className="mb-4 md:mb-5 shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[20px] md:text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-1">{t("memory.title")}</h1>
          <p className="text-[13px] md:text-sm text-slate-500 dark:text-slate-400">
            {t("memory.desc")}
          </p>
        </div>
        
        {/* Agent Dropdown Selector */}
        <div className="relative inline-flex items-center">
          <select 
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 pl-4 pr-10 rounded-lg shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer min-w-[200px]"
          >
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.id.split('-')[0]}-{a.id.split('-')[2]})</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {([
          ["overview", t("memory.tab.overview"), BookOpen],
          ["documents", t("memory.tab.documents"), FileText],
          ["footprints", t("memory.tab.footprints"), Calendar],
          ["search", t("memory.tab.search"), Search],
          ["knowledge", t("memory.tab.knowledge"), BrainCircuit],
        ] as const).map(([section, label, Icon]) => {
          const active = activeSection === section;
          return (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-sky-600 text-white shadow"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>

      {activeSection === "overview" && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Network className="w-4 h-4 text-sky-500" />
              {t("memory.overview.agent.title")}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("memory.overview.agent.active")}</div>
                <div className="mt-2 text-base font-semibold">{activeAgent?.name ?? t("memory.overview.agent.none")}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedAgentId || "-"}</div>
                  </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("memory.overview.workspace")}</div>
                <div className="mt-2 break-all text-sm text-slate-700 dark:text-slate-200">{memoryResult?.workspace ?? t("memory.overview.workspaceUnavailable")}</div>
                  </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("memory.overview.shared")}</div>
                <div className="mt-2 text-sm font-medium">{hasSharedMemory ? t("memory.overview.sharedYes") : t("memory.overview.sharedNo")}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{memoryResult?.sharedAgents.map((agent) => agent.name).join(", ") || t("memory.overview.sharedAgents.none")}</div>
                  </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("memory.overview.edit")}</div>
                <div className="mt-2 text-sm font-medium">{canEdit ? t("memory.overview.edit.writable") : t("memory.overview.edit.readonly")}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{canEdit ? t("memory.overview.edit.scopeGranted") : t("memory.overview.edit.scopeDenied")}</div>
                  </div>
            </div>
            {_memoryError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
                {_memoryError}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Database className="w-4 h-4 text-sky-500" />
              {t("memory.overview.sources.title")}
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="font-medium">{t("memory.overview.sources.documents")}</div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  {visibleDocuments.map((document) => document.name).join(", ") || t("memory.overview.sources.documentsEmpty")}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="font-medium">{t("memory.overview.sources.timeline")}</div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  {timelineAccess ? `${timelineAccess.mode} / ${timelineAccess.reason}` : t("memory.overview.sources.timelineUnknown")}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="font-medium">{t("memory.overview.sources.knowledge")}</div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  {memoryResult?.diagnostics
                    ? `${memoryResult.diagnostics.backend} / ${memoryResult.diagnostics.provider ?? t("memory.knowledge.providerFallback")}`
                    : t("memory.overview.sources.knowledgeMissing")}
                </div>
              </div>
            </div>
            {_timelineError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
                {_timelineError}
              </div>
            )}
          </section>
        </div>
      )}

      <div className="hidden">
        {selectedDocumentContent}
        {footprintSummary.all}
      </div>

      <div className={`rounded-xl md:rounded-lg overflow-hidden flex-1 flex flex-col relative transition-colors duration-500 min-h-[400px] ${activeSection === 'documents' || activeSection === 'footprints' || activeSection === 'search' || activeSection === 'knowledge' ? 'bg-transparent md:bg-white md:dark:bg-slate-900 border-none md:border md:border-slate-200 md:dark:border-slate-800 md:shadow-sm' : 'hidden'}`}>
        <AnimatePresence mode="wait">
          {diagnosticsDrawer.open && (healthProbeSummary || memoryResult?.diagnostics) && (
            <div className="absolute inset-y-0 right-0 z-20 w-full max-w-md border-l border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("memory.diag.drawer")}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("memory.diag.openedFrom", diagnosticsDrawer.source)}</div>
                </div>
                <button
                  onClick={() => setDiagnosticsDrawer((current) => ({ ...current, open: false }))}
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
          )}
          
          {activeSection === 'documents' && (
            <motion.div 
              key="view-table"
              className="absolute inset-0 flex flex-col"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}
            >
              <div className="border-b border-slate-200 bg-gradient-to-r from-white to-sky-50/70 px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{t("memory.documents.title")}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("memory.documents.desc")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReloadDocuments}
                    disabled={documentSaveState === "saving"}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
                  >
                    Reload
                  </button>
                  <button
                    onClick={handleSaveDocument}
                    disabled={!documentDirty || documentSaveState === "saving" || !canEdit}
                    className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
                  >
                    {documentSaveState === "saving" ? t("memory.documents.saving") : t("memory.documents.save")}
                  </button>
                </div>
                </div>
              </div>
              {documentSearchHint && (
                <div className="border-b border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 px-4 py-2 text-xs text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300">
                  {documentSearchHint}
                </div>
              )}
              {/* Documents View */}
              <div className="hidden md:flex flex-col flex-1 overflow-auto bg-white dark:bg-slate-900 relative">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <input
                      value={documentQuery}
                      onChange={(event) => setDocumentQuery(event.target.value)}
                      placeholder={t("memory.documents.searchPlaceholder")}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{t("memory.documents.matches", documentMatches.length)}</span>
                      <span>{documentMatches.length > 0 ? `${documentMatchIndex + 1}/${documentMatches.length}` : "0/0"}</span>
                      <button
                        onClick={() => setDocumentMatchIndex((current) => moveActiveSearchMatchIndex(current, documentMatches.length, -1))}
                        disabled={documentMatches.length === 0}
                        className="rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setDocumentMatchIndex((current) => moveActiveSearchMatchIndex(current, documentMatches.length, 1))}
                        disabled={documentMatches.length === 0}
                        className="rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        Next
                      </button>
                      <span>{documentDirty ? t("profile.unsaved") : t("profile.doc.exported")}</span>
                      <span>{documentSearchSource === "search_result" ? t("memory.documents.searchSource.search") : t("memory.documents.searchSource.manual")}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {t("memory.documents.current", selectedDocument?.name ?? t("memory.documents.none"))}
                    </span>
                    {!canEdit && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300">
                        {t("memory.documents.readonlyScope")}
                      </span>
                    )}
                  </div>
                  {documentSaveMessage && (
                    <div className={`mt-2 rounded-xl border p-2 text-xs ${documentSaveState === "error" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
                      {documentSaveMessage}
                    </div>
                  )}
                </div>
                {visibleDocuments.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl m-4">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">{t("memory.documents.emptyTitle")}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t("memory.documents.emptyDesc")}</p>
                  </div>
                ) : (
                  <table className="w-full text-[13px] text-left rtl:text-right whitespace-nowrap bg-white dark:bg-slate-900">
                    <thead className="bg-[#f8fafc] dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10 shadow-[0_1px_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_rgba(30,41,59,1)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold w-[160px]">{t("memory.table.time")}</th>
                        <th className="px-4 py-3 font-semibold w-[140px]">{t("memory.table.type")}</th>
                        <th className="px-4 py-3 font-semibold w-[160px]">{t("memory.table.node")}</th>
                        <th className="px-4 py-3 font-semibold w-[120px]">{t("memory.table.agent")}</th>
                        <th className="px-4 py-3 font-semibold min-w-[300px]">{t("memory.table.summary")}</th>
                        <th className="px-4 py-3 font-semibold w-[80px] text-center">{t("memory.table.status")}</th>
                        <th className="px-4 py-3 font-semibold w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {visibleDocuments.map((item) => (
                        <tr key={item.name} className={`cursor-pointer transition-colors group focus-within:bg-sky-50 dark:focus-within:bg-slate-800 ${item.name === selectedDocumentName ? "bg-sky-50 dark:bg-slate-800" : "hover:bg-[#f0f9ff] dark:hover:bg-slate-800"}`} tabIndex={0} onClick={() => setSelectedDocumentName(item.name)}>
                           <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs" dir="ltr">{item.updatedAtMs ? new Date(item.updatedAtMs).toLocaleString() : "-"}</td>
                           <td className="px-4 py-3">
                             <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium">{t("memory.documents.kind")}</span>
                           </td>
                           <td className="px-4 py-3">
                             <span className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 px-2 py-1 rounded-md border border-cyan-100 dark:border-cyan-800/50">
                               <Network className="w-3 h-3" />
                               {memoryResult?.workspace ?? t("memory.documents.workspaceFallback")}
                             </span>
                           </td>
                           <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{getAgentBadge(selectedAgentId)}</td>
                           <td className="px-4 py-3 text-slate-900 dark:text-slate-100 truncate max-w-[400px]" title={item.content ?? item.path}>{item.content ? item.content.slice(0, 120) : item.path}</td>
                           <td className="px-4 py-3 text-center">
                             {!item.missing && <div className="w-2 h-2 rounded-full bg-[#16a34a] mx-auto" title={t("memory.documents.status.available")}></div>}
                             {item.missing && <div className="w-2 h-2 rounded-full bg-[#dc2626] mx-auto" title={t("memory.documents.status.missing")}></div>}
                           </td>
                           <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                             <button className="text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 p-1 rounded hover:bg-sky-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"><ChevronRight className="w-4 h-4 rtl:rotate-180" /></button>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {selectedDocument && (
                  <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
                    <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white px-5 py-4 text-slate-700 shadow-sm dark:border-slate-700/80 dark:from-slate-900 dark:to-slate-900 dark:text-slate-300">
                      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-violet-400 dark:from-sky-500 dark:to-violet-500" />
                      <div className="relative pl-1">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">{t("memory.documents.source")}</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{selectedDocument.name}</div>
                        <div className="mt-1 break-all text-slate-500 dark:text-slate-400">{selectedDocument.path}</div>
                        <div className="mt-2 text-slate-500 dark:text-slate-400">{t("memory.documents.updated", selectedDocumentUpdatedAtLabel)}</div>
                      </div>
                    </div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("memory.documents.preview")}</div>
                    <div className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-100">
                      {buildHighlightedTextSegments(selectedDocumentContent, documentMatches).map((segment, index) => (
                        segment.matchIndex === null ? (
                          <span key={index}>{segment.text}</span>
                        ) : (
                          <mark
                            key={index}
                            className={segment.matchIndex === documentMatchIndex ? "rounded bg-sky-300 px-0.5 text-slate-950" : "rounded bg-amber-200 px-0.5 text-slate-900"}
                          >
                            {segment.text}
                          </mark>
                        )
                      ))}
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("memory.documents.editor")}</div>
                      <textarea
                        value={selectedDocumentContent}
                        onChange={(event) => handleDocumentDraftChange(event.target.value)}
                        readOnly={!canEdit}
                        className="min-h-[220px] w-full rounded-[24px] border border-slate-200/90 bg-white px-4 py-4 text-sm leading-7 text-slate-800 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:shadow-[0_0_0_4px_rgba(186,230,253,0.55)] dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:shadow-[0_0_0_4px_rgba(14,165,233,0.18)]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden flex-1 overflow-auto hide-scrollbar -mx-4 px-4 pb-4 space-y-3">
                 {visibleDocuments.length === 0 ? (
                   <div className="flex flex-col items-center justify-center p-8 mt-4 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                     <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                       <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                     </div>
                     <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">{t("memory.documents.emptyTitle")}</h3>
                     <p className="text-xs text-slate-500 dark:text-slate-400">{t("memory.documents.emptyDesc")}</p>
                   </div>
                 ) : (
                   visibleDocuments.map((item) => (
                     <div key={item.name} tabIndex={0} onClick={() => setSelectedDocumentName(item.name)} className={`border rounded-2xl p-4 shadow-sm active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-sky-500 transition-transform relative overflow-hidden group cursor-pointer ${item.name === selectedDocumentName ? "bg-sky-50 border-sky-300 dark:bg-slate-800 dark:border-sky-700" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"}`}>
                       <div className="flex justify-between items-start mb-2.5">
                         <div className="flex flex-col gap-1.5">
                           <div className="flex items-center gap-2">
                             {getAgentBadge(selectedAgentId)}
                           </div>
                           <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium flex items-center gap-1">
                             <Network className="w-3 h-3" /> {memoryResult?.workspace ?? t("memory.documents.workspaceFallback")}
                           </span>
                         </div>
                         <span className="text-[11px] text-slate-400 font-mono bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded" dir="ltr">{item.updatedAtMs ? new Date(item.updatedAtMs).toLocaleTimeString() : "-"}</span>
                       </div>
                       <p className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed mb-4 line-clamp-3">{item.content ? item.content.slice(0, 120) : item.path}</p>
                       <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                         <span className="text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 px-2 py-0.5 rounded flex items-center gap-1">
                           <FileDigit className="w-3 h-3"/> document
                         </span>
                         <div className="flex items-center gap-1.5 text-[11px] font-medium">
                           {!item.missing && <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span className="text-emerald-600 dark:text-emerald-400">{t("memory.documents.status.available")}</span></>}
                           {item.missing && <><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div><span className="text-red-600 dark:text-red-400">{t("memory.documents.status.missing")}</span></>}
                         </div>
                       </div>
                     </div>
                   ))
                 )}
              </div>

              <div className="hidden md:flex bg-[#f8fafc] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 justify-between items-center shrink-0">
                 <span>{t("memory.documents.footer", visibleDocuments.length)}</span>
                 <div className="flex gap-1.5">
                   <button disabled className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-sm">{t("memory.page.prev")}</button>
                   <button className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 active:scale-95 transition-all">{t("memory.page.next")}</button>
                 </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'footprints' && (
            <motion.div 
              key="view-day"
              className="absolute inset-0 overflow-auto bg-transparent md:bg-slate-50/50 md:dark:bg-slate-900/50 md:p-6 hide-scrollbar"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}
            >
               <div className="mx-auto mb-4 max-w-3xl px-2 md:px-0">
                 <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
                   <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                     <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("memory.footprints.accessMode")}</div>
                     <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                       {resolveTimelineModeLabel(timelineAccess, timelineResult, t)}
                     </div>
                     <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                       {timelineAccess ? `${timelineAccess.mode} / ${timelineAccess.reason}` : t("memory.overview.sources.timelineUnknown")}
                     </div>
                   </div>
                   <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                     <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("memory.footprints.probePreset")}</div>
                     <div className="mt-2 grid gap-2">
                       <input
                         value={timelineProbeRange.startDate}
                         onChange={(event) => setTimelineProbeRange((current) => ({ ...current, startDate: event.target.value }))}
                         className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                         placeholder={t("memory.footprints.probePlaceholder")}
                       />
                       <input
                         value={timelineProbeRange.endDate}
                         onChange={(event) => setTimelineProbeRange((current) => ({ ...current, endDate: event.target.value }))}
                         className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                         placeholder={t("memory.footprints.probePlaceholder")}
                       />
                     </div>
                     <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                       {t("memory.footprints.probeHint")}
                     </div>
                     <button
                       onClick={handleProbeTimelineRange}
                       className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                     >
                       <Clock className="w-3.5 h-3.5" />
                       {timelineProbeState === "probing" ? t("memory.footprints.probe.probing") : timelineProbeState === "done" ? t("memory.footprints.probe.done") : timelineProbeState === "error" ? t("memory.footprints.probe.error") : t("memory.footprints.probe.idle")}
                     </button>
                   </div>
                 </div>
                 {_timelineError && (
                   <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
                     {_timelineError}
                   </div>
                 )}
               </div>
               <div className="mx-auto grid max-w-6xl gap-6 px-2 md:grid-cols-[0.9fr_1.1fr] md:px-0">
                 <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                {filteredFootprintGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 mt-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mx-4 shadow-sm">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Footprints className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">{t("memory.footprints.emptyTitle")}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t("memory.footprints.emptyDesc")}</p>
                    </div>
                ) : (
                  <div className="relative border-l-[2px] rtl:border-l-0 rtl:border-r-[2px] border-slate-200 dark:border-slate-800 ml-4 rtl:ml-0 rtl:mr-4 md:ml-8 rtl:md:mr-8 space-y-8 md:space-y-10 pb-8 pt-2">
                      {filteredFootprintGroups.map((group) => (
                        <div key={group.id} className="relative pl-6 rtl:pl-0 rtl:pr-6 md:pl-10 rtl:md:pr-10">
                          <div className="absolute -left-[15px] rtl:left-auto rtl:-right-[15px] md:-left-[17px] rtl:md:-right-[17px] top-0 w-7 h-7 md:w-8 md:h-8 bg-white dark:bg-slate-800 border-[2px] border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center shadow-sm z-10">
                            <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-sky-500" />
                          </div>
                          <div className={`mb-4 md:mb-5 rounded-2xl border p-4 transition ${group.entries.some((entry) => entry.name === selectedTimelineEntryName) ? "border-sky-300 bg-sky-50 shadow-sm dark:border-sky-700 dark:bg-slate-800" : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/70"}`}>
                            <div className="flex flex-wrap items-center gap-3 pt-0.5 md:pt-1">
                              <h3 className="text-[15px] md:text-[16px] font-bold text-slate-800 dark:text-slate-200 tracking-tight" dir="ltr">{group.dateLabel}</h3>
                              <span className="text-[10px] md:text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200/80 dark:border-slate-700">
                                {t("memory.footprints.entries", group.entries.length)}
                              </span>
                              {group.probeDay && (
                                <span className="text-[10px] md:text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 px-2 py-0.5 rounded-full">
                                  {t("memory.footprints.probeStatus", group.probeDay.status)}
                                </span>
                              )}
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
                              <div className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                                {group.entries[0]?.content ? group.entries[0].content.slice(0, 180) : group.entries[0]?.path ?? t("memory.footprints.noDetail")}
                              </div>
                              <div className={`rounded-xl border px-3 py-2 text-[11px] font-medium shadow-sm ${group.entries.some((entry) => entry.name === selectedTimelineEntryName) ? "border-sky-200 bg-white text-sky-700 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-300" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>
                                {group.entries[0]?.updatedAtMs ? new Date(group.entries[0].updatedAtMs).toLocaleTimeString() : t("memory.footprints.noTime")}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3 md:space-y-4">
                            {group.entries.map((item) => (
                              <div key={item.name} className="relative group outline-none" tabIndex={0} onClick={() => setSelectedTimelineEntryName(item.name)}>
                                <div className="absolute -left-[29.5px] rtl:left-auto rtl:-right-[29.5px] md:-left-[45px] rtl:md:-right-[45px] top-[16px] md:top-[20px] w-2.5 h-2.5 md:w-3 md:h-3 bg-white dark:bg-slate-800 border-[2px] md:border-[2.5px] border-slate-300 dark:border-slate-600 rounded-full z-10 group-hover:border-sky-400 group-focus:border-sky-500 transition-colors"></div>
                                <div className={`border rounded-xl md:rounded-lg p-3.5 md:p-4 shadow-sm md:hover:border-sky-300 dark:md:hover:border-sky-700 group-focus:ring-2 group-focus:ring-sky-500 transition-all cursor-pointer ${selectedTimelineEntryName === item.name ? "bg-sky-50 border-sky-300 dark:bg-slate-800 dark:border-sky-700" : "bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800"}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5 md:gap-2">
                                      <span className="text-[10px] md:text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1" dir="ltr">
                                        <Clock className="w-2.5 h-2.5 md:w-3 md:h-3"/> {item.updatedAtMs ? new Date(item.updatedAtMs).toLocaleTimeString() : "-"}
                                      </span>
                                      <span className="text-[10px] font-medium text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/20 px-1.5 py-0.5 rounded border border-cyan-100 dark:border-cyan-800/50 flex items-center gap-1">
                                        <Network className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                        <span className="max-w-[120px] md:max-w-none truncate">{timelineAccess?.mode ?? timelineResult?.source ?? t("memory.footprints.timelineFallback")}</span>
                                      </span>
                                      {getAgentBadge(selectedAgentId)}
                                    </div>
                                    <span className="text-[10px] md:text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 px-1.5 md:px-2 py-0.5 rounded">
                                      {item.name}
                                    </span>
                                  </div>
                                  <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">{item.path}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
               </div>
                 <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-5 text-slate-700 shadow-sm dark:border-slate-700/80 dark:from-slate-900 dark:to-slate-900 dark:text-slate-300">
                 <div className="flex items-center justify-between gap-3">
                   <div>
                      <div className="text-sm font-semibold">{t("memory.footprints.detailTitle")}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedTimelineDateLabel || selectedTimelineEntryName || t("memory.footprints.detailPrompt")}</div>
                    </div>
                   <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                     read only
                   </span>
                 </div>
                 {timelineSelectionHint && (
                   <div className="mt-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-300">
                     {timelineSelectionHint}
                   </div>
                 )}
                 <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                   <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{t("memory.footprints.selectedDate")}</div>
                   <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                     {selectedTimelineEntryName ? selectedTimelineEntryName.replace(/^memory\//, "").replace(/\.md$/i, "") : t("memory.footprints.noDate")}
                   </div>
                   <div className="mt-4 grid gap-3 md:grid-cols-2">
                     <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-950/50">
                       <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{t("memory.footprints.sourceMode")}</div>
                       <div className="mt-1 text-slate-800 dark:text-slate-100">{resolveTimelineModeLabel(timelineAccess, timelineResult, t)}</div>
                     </div>
                     <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-950/50">
                       <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{t("memory.footprints.currentEntry")}</div>
                       <div className="mt-1 break-all text-slate-800 dark:text-slate-100">{selectedTimelineEntryName || t("memory.search.na")}</div>
                     </div>
                   </div>
                 </div>
                 <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                   <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{t("memory.footprints.body")}</div>
                   <div className="text-sm leading-7 text-slate-800 dark:text-slate-100">
                     {_timelineEntryLoading
                       ? t("memory.footprints.loading")
                       : _timelineEntryError
                         ? _timelineEntryError
                         : _timelineEntryContent || t("memory.footprints.noBody")}
                   </div>
                 </div>
                 </div>
               </div>
            </motion.div>
          )}

          {activeSection === 'search' && (
            <motion.div
              key="view-search"
              className="absolute inset-0 overflow-auto bg-transparent md:bg-slate-50/50 md:dark:bg-slate-900/50 p-4 md:p-6"
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}
            >
              <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-sm font-semibold">{t("memory.search.title")}</div>
                  <div className={`mt-3 rounded-2xl border p-3 text-xs shadow-sm ${diagnosticsTone(healthProbeSummary)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{t("memory.search.diagBar")}</div>
                        <div className="mt-1">{healthProbeSummary ? `${healthProbeSummary.provider} / ${healthProbeSummary.model}` : t("memory.diag.unavailable")}</div>
                        <div className="mt-1">{healthProbeSummary ? (healthProbeSummary.embeddingsReady === true ? t("memory.search.diagHealthy") : healthProbeSummary.primaryIssue ?? t("memory.diag.unavailable")) : t("memory.diag.unavailable")}</div>
                      </div>
                      <button
                        onClick={() => setDiagnosticsDrawer({ open: true, source: "search" })}
                        className="rounded-full border border-current/20 bg-white/90 px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur dark:bg-slate-900/60"
                      >
                        Open diagnostics
                      </button>
                    </div>
                  </div>
                  <DiagnosticsCard title={t("memory.diag.runtimeStatus")} className="mt-3 text-xs">
                    {runtimeStatusSummary ? (
                      <div className="space-y-1 text-slate-500 dark:text-slate-400">
                        <div>
                          indexed: {runtimeStatusSummary.indexedFiles}
                          {runtimeStatusSummary.totalFiles != null
                            ? `/${runtimeStatusSummary.totalFiles}`
                            : ""} files · {runtimeStatusSummary.chunks} chunks
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-500 dark:text-slate-400">
                        {isLocalGatewaySession
                          ? t("memory.diag.runtimePlaceholder")
                          : t("memory.diag.runtimeRemoteUnavailable")}
                      </div>
                    )}
                  </DiagnosticsCard>
                  <DiagnosticsCard title={t("memory.search.probeNote")} className="mt-3 text-xs">
                    <div className="text-slate-500 dark:text-slate-400">{t("memory.search.probeNote")}</div>
                  </DiagnosticsCard>
                  <DiagnosticsCard title={t("memory.search.commands.title")} className="mt-3 text-xs">
                    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {healthProbeSummary?.embeddingsReady
                        ? t("memory.search.commands.providerReady")
                        : t("memory.search.commands.providerMissing")}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {commandGuideDescription}
                    </div>
                    <pre className="mt-3 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{commandGuide}</pre>
                    <button
                      onClick={() => void handleCopyCommandGuide()}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
                    >
                      {copiedCommandGuide ? t("memory.search.commands.copied") : t("memory.search.commands.copy")}
                    </button>
                  </DiagnosticsCard>
                <div className="mt-4 flex gap-2">
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t("memory.search.inputPlaceholder")}
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:bg-white dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500"
                    />
                    <button
                      onClick={handleRunSemanticSearch}
                      disabled={!canRunSemanticMemorySearch(searchQuery, searchRunning)}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
                    >
                      {searchRunning ? <Search className="w-4 h-4 animate-pulse" /> : <Search className="w-4 h-4" />}
                      Run
                    </button>
                  </div>
                  {searchError && (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
                      {searchError}
                    </div>
                  )}
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {searchGroups.map(({ group, count }) => (
                      <span key={group} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {t("memory.search.groupCount", group, count)}
                      </span>
                    ))}
                  </div>
                  <div className="mb-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
                    {t("memory.search.routingNote")}
                  </div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {(searchResult?.results ?? []).slice(0, 8).map((entry) => (
                      <span
                        key={`source-${entry.id}`}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${sourceTone(entry.sourceKind)}`}
                      >
                        {entry.sourceKind}
                      </span>
                    ))}
                  </div>
                  {healthProbeSummary && (
                    <DiagnosticsCard title={t("memory.diag.healthProbe")} className="mb-4 text-xs">
                      <div className="mt-1 text-slate-500 dark:text-slate-400">{healthProbeSummary.provider} / {healthProbeSummary.model}</div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">embeddings: {healthProbeSummary.embeddingsReady === true ? t("memory.diag.ready") : healthProbeSummary.embeddingsReady === false ? t("memory.diag.unavailableShort") : t("memory.diag.unknownShort")}</div>
                    </DiagnosticsCard>
                  )}
                  {healthProbeSummary && memoryStatusError && (
                    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
                      {memoryStatusError}
                    </div>
                  )}
                  {searchResult?.diagnostics && (
                    <DiagnosticsCard title={t("memory.diag.search")} className="mb-4 text-xs">
                      <div className="mt-1 text-slate-500 dark:text-slate-400">{searchResult.diagnostics.backend} / {searchResult.diagnostics.storeDriver}</div>
                      <div className="mt-1 break-all text-slate-500 dark:text-slate-400">{searchResult.diagnostics.storePath}</div>
                    </DiagnosticsCard>
                  )}
                  {searchError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
                      {searchError}
                    </div>
                    ) : searchResult ? (
                      <div className="space-y-3">
                      {searchResult.results.map((entry) => (
                        <article key={entry.id} className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-4 text-slate-700 shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-slate-700/80 dark:from-slate-900 dark:to-slate-900 dark:text-slate-300 dark:hover:border-sky-700">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300">{entry.sourceKind}</span>
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{entry.openTarget}</span>
                          </div>
                          <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{resultSubtitle(entry.path, entry.openTarget)}</div>
                          <div className="mt-3 break-all text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.path}</div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">{entry.snippet}</p>
                          <div className="mt-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                            {entry.canonicalDocumentName ?? entry.timelineEntryName ?? t("memory.search.resultFallback")}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{t("memory.search.targetRoute", entry.openTarget)}</span>
                            {typeof entry.score === "number" && <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{t("memory.search.score", entry.score.toFixed(3))}</span>}
                          </div>
                          <button
                            onClick={() => void handleOpenSearchEntry(entry)}
                            className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                          >
                            {resultRouteLabel(entry.openTarget, t)}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </article>
                      ))}
                      {searchResult.results.length === 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                          {t("memory.search.empty")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                      {t("memory.search.idle")}
                    </div>
                  )}
                  {!healthProbeSummary && memoryStatusError && (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
                      {memoryStatusError}
                    </div>
                  )}
                  {searchDetail && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{t("memory.search.detailTitle")}</div>
                          <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{searchDetail.path}</div>
                        </div>
                        <button
                          onClick={() => setSearchDetail(null)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          Close
                        </button>
                      </div>
                      <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t("memory.search.detailMeta", searchDetail.sourceKind)}
                      </div>
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                        {searchDetail.loading
                          ? t("memory.search.detailLoading")
                          : searchDetail.error
                            ? searchDetail.error
                            : searchDetail.content || searchDetail.snippet}
                      </div>
                    </div>
                  )}
                  {searchOpenHint && (
                    <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300">
                      {searchOpenHint}
                    </div>
                  )}
                </section>
              </div>
            </motion.div>
          )}

          {activeSection === 'knowledge' && (
             <motion.div 
               key="view-knowledge"
               className="absolute inset-0 overflow-auto bg-transparent md:bg-slate-50/50 md:dark:bg-slate-900/50 p-4 md:p-6"
               initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}
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
                          onClick={() => setDiagnosticsDrawer({ open: true, source: "knowledge" })}
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
                            {runtimeStatusSummary.totalFiles != null
                              ? `/${runtimeStatusSummary.totalFiles}`
                              : ""} files · {runtimeStatusSummary.chunks} chunks
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-500 dark:text-slate-400">
                          {isLocalGatewaySession
                            ? t("memory.diag.runtimePlaceholder")
                            : t("memory.diag.runtimeRemoteUnavailable")}
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
          )}
        </AnimatePresence>
      </div>
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
