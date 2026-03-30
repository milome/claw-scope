import { useEffect, useMemo, useState } from "react";
import { Search, Calendar, Network, Cpu, BrainCircuit, Database, ChevronDown, BookOpen, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useI18n } from "../../contexts/I18nContext";
import type { ReactNode } from "react";
import {
  gatewayAgentMemoryGet,
  gatewayAgentMemorySet,
  gatewayAgentFileRead,
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
  canEditMemory,
  canLoadLocalTimeline,
  collectTextSearchMatches,
  createMemoryDrafts,
  filterMemoryFootprintGroups,
  hasSharedWorkspaceMemory,
  isMemoryDocumentDirty,
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
import { MemoryDiagnosticsDrawer } from "./MemoryDiagnosticsDrawer";
import { MemorySearchPanel } from "./MemorySearchPanel";
import { MemoryFootprintsPanel } from "./MemoryFootprintsPanel";
import { MemoryKnowledgePanel } from "./MemoryKnowledgePanel";
import { MemoryDocumentsDesktop } from "./MemoryDocumentsDesktop";
import { MemoryDocumentsMobile } from "./MemoryDocumentsMobile";

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

type MemoryViewShellProps = {
  active: boolean;
  children: ReactNode;
};

type MemoryViewScrollRegionProps = {
  className?: string;
  children: ReactNode;
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

function MemoryViewShell({ active, children }: MemoryViewShellProps) {
  return (
    <div
      className={`rounded-xl md:rounded-lg overflow-hidden flex-1 flex flex-col relative transition-colors duration-500 min-h-[400px] ${
        active
          ? "bg-transparent md:bg-white md:dark:bg-slate-900 border-none md:border md:border-slate-200 md:dark:border-slate-800 md:shadow-sm"
          : "hidden"
      }`}
    >
      {children}
    </div>
  );
}

function MemoryViewScrollRegion({ className = "", children }: MemoryViewScrollRegionProps) {
  return <div className={`absolute inset-0 overflow-auto ${className}`.trim()}>{children}</div>;
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
  const [isEditingDocument, setIsEditingDocument] = useState(false);
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

  const handleSaveDocument = async () => {
    if (!selectedDocument || !canEdit || !documentDirty) {
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
      setIsEditingDocument(false);
      toast.success(t("memory.documents.saved", selectedDocument.name));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDocumentSaveState("error");
      setDocumentSaveMessage(message);
      toast.error(message);
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

      <MemoryViewShell
        active={
          activeSection === "documents" ||
          activeSection === "footprints" ||
          activeSection === "search" ||
          activeSection === "knowledge"
        }
      >
        <AnimatePresence mode="wait">
          <MemoryDiagnosticsDrawer
            diagnosticsDrawer={diagnosticsDrawer}
            healthProbeSummary={healthProbeSummary}
            memoryResult={memoryResult}
            runtimeStatusSummary={runtimeStatusSummary}
            isLocalGatewaySession={isLocalGatewaySession}
            t={t}
            onClose={() => setDiagnosticsDrawer((current) => ({ ...current, open: false }))}
          />

          {activeSection === 'documents' && (
            <motion.div 
              key="view-table"
              className="flex flex-1 flex-col"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}
            >
              {/* Documents View */}
              <MemoryDocumentsDesktop
                title={t("memory.documents.title")}
                description={documentSearchHint ?? t("memory.documents.desc")}
                documentQuery={documentQuery}
                documentMatches={documentMatches}
                documentMatchIndex={documentMatchIndex}
                documentDirty={documentDirty}
                documentSearchSource={documentSearchSource}
                documentSaveMessage={documentSaveMessage}
                documentSaveState={documentSaveState}
                selectedDocument={selectedDocument}
                selectedDocumentName={selectedDocumentName}
                selectedDocumentContent={selectedDocumentContent}
                selectedDocumentUpdatedAtLabel={selectedDocumentUpdatedAtLabel}
                visibleDocuments={visibleDocuments}
                canEdit={canEdit}
                isEditing={isEditingDocument}
                workspaceLabel={memoryResult?.workspace ?? t("memory.documents.workspaceFallback")}
                t={t}
                getAgentBadge={getAgentBadge}
                selectedAgentId={selectedAgentId}
                onDocumentQueryChange={setDocumentQuery}
                onSelectDocument={setSelectedDocumentName}
                onDocumentDraftChange={handleDocumentDraftChange}
                onStartEdit={() => setIsEditingDocument(true)}
                onCancelEdit={handleCancelDocumentEdit}
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

            </motion.div>
          )}

          {activeSection === 'footprints' && (
            <MemoryViewScrollRegion className="bg-transparent md:bg-slate-50/50 md:dark:bg-slate-900/50 md:p-6 hide-scrollbar">
              <MemoryFootprintsPanel
                timelineAccess={timelineAccess}
                timelineResult={timelineResult}
                timelineProbeRange={timelineProbeRange}
                timelineProbeState={timelineProbeState}
                timelineError={_timelineError}
                filteredFootprintGroups={filteredFootprintGroups}
                selectedTimelineEntryName={selectedTimelineEntryName}
                selectedTimelineDateLabel={selectedTimelineDateLabel}
                timelineSelectionHint={timelineSelectionHint}
                timelineEntryContent={_timelineEntryContent}
                timelineEntryLoading={_timelineEntryLoading}
                timelineEntryError={_timelineEntryError}
                selectedAgentId={selectedAgentId}
                resolveTimelineModeLabel={(access, result) => resolveTimelineModeLabel(access, result, t)}
                getAgentBadge={getAgentBadge}
                t={t}
                onProbeRangeChange={setTimelineProbeRange}
                onProbeTimelineRange={() => void handleProbeTimelineRange()}
                onSelectTimelineEntry={setSelectedTimelineEntryName}
              />
            </MemoryViewScrollRegion>
          )}

          {activeSection === 'search' && (
            <MemoryViewScrollRegion className="bg-transparent md:bg-slate-50/50 md:dark:bg-slate-900/50 p-4 md:p-6">
              <MemorySearchPanel
                healthProbeSummary={healthProbeSummary}
                runtimeStatusSummary={runtimeStatusSummary}
                isLocalGatewaySession={isLocalGatewaySession}
                commandGuide={commandGuide}
                commandGuideDescription={commandGuideDescription}
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
            </MemoryViewScrollRegion>
          )}

          {activeSection === 'knowledge' && (
            <MemoryViewScrollRegion className="bg-transparent md:bg-slate-50/50 md:dark:bg-slate-900/50 p-4 md:p-6">
              <MemoryKnowledgePanel
                memoryResult={memoryResult}
                healthProbeSummary={healthProbeSummary}
                runtimeStatusSummary={runtimeStatusSummary}
                externalSources={externalSources}
                isLocalGatewaySession={isLocalGatewaySession}
                t={t}
                onOpenDiagnostics={() => setDiagnosticsDrawer({ open: true, source: "knowledge" })}
              />
            </MemoryViewScrollRegion>
          )}
        </AnimatePresence>
      </MemoryViewShell>
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
