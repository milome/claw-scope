import { useEffect, useMemo, useState } from "react";
import { Search, Footprints, ChevronRight, Calendar, Clock, Network, Cpu, BrainCircuit, FileDigit, Database, ChevronDown, BookOpen, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "../../contexts/I18nContext";
import {
  gatewayAgentMemoryGet,
  gatewayAgentFileRead,
  gatewayAgentMemorySearch,
  gatewayAgentMemoryStatus,
  gatewayAgentMemoryTimelineAccessResolve,
  gatewayAgentMemoryTimelineEntryRead,
  gatewayAgentMemoryTimelineGet,
  gatewayAgentMemoryTimelineLocalScan,
  gatewayAgentMemoryTimelineRemoteProbe,
  type GatewayAgentMemoryResult,
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
  createMemoryDrafts,
  filterMemoryFootprintGroups,
  hasSharedWorkspaceMemory,
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

type DiagnosticsSummary = {
  provider: string;
  model: string;
  indexedFiles: number;
  totalFiles: number;
  chunks: number;
  bySource: { source: string; indexedFiles: number; totalFiles: number; chunks: number }[];
  primaryIssue: string | null;
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

export function MemoryView() {
  const { t } = useI18n();
  const { agents, grantedScopes, isConnected } = useOpenClaw();
  const [activeSection, setActiveSection] = useState<MemorySection>("overview");
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? "");
  const [memoryResult, setMemoryResult] = useState<GatewayAgentMemoryResult | null>(null);
  const [_memoryLoading, setMemoryLoading] = useState(false);
  const [_memoryError, setMemoryError] = useState<string | null>(null);
  const [timelineAccess, setTimelineAccess] = useState<GatewayAgentMemoryTimelineAccessResult | null>(null);
  const [timelineResult, setTimelineResult] = useState<GatewayAgentMemoryTimelineResult | null>(null);
  const [_timelineLoading, setTimelineLoading] = useState(false);
  const [_timelineError, setTimelineError] = useState<string | null>(null);
  const [memoryStatus, setMemoryStatus] = useState<GatewayAgentMemoryStatusResult | null>(null);
  const [memoryStatusError, setMemoryStatusError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchRunning] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<GatewayAgentMemorySearchResult | null>(null);
  const [searchDetail, setSearchDetail] = useState<SearchDetailState>(null);
  const [selectedDocumentName, setSelectedDocumentName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [timelineFocus] = useState<MemoryTimelineFocusFilter>("all");
  const [selectedTimelineEntryName, setSelectedTimelineEntryName] = useState("");
  const [_timelineEntryContent, setTimelineEntryContent] = useState("");
  const [_timelineEntryLoading, setTimelineEntryLoading] = useState(false);
  const [_timelineEntryError, setTimelineEntryError] = useState<string | null>(null);
  const [_timelineProbeRange] = useState(() =>
    resolveTimelineProbeRangePreset(new Date().toISOString().slice(0, 10)),
  );

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
        setMemoryStatus(result);
        setMemoryStatusError(null);
      } catch (error) {
        if (!cancelled) {
          setMemoryStatusError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void loadMemory();
    void loadTimeline();
    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [selectedAgentId, isConnected]);

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
  const selectedDocumentContent = useMemo(() => {
    if (!selectedDocument) {
      return "";
    }
    return drafts[selectedDocument.name] ?? resolveMemoryDocumentContent(selectedDocument);
  }, [drafts, selectedDocument]);
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

  const diagnosticsSummary = useMemo<DiagnosticsSummary | null>(() => {
    if (!memoryStatus) {
      return null;
    }

    const bySource = [...memoryStatus.bySource]
      .map((item) => ({
        source: item.source,
        indexedFiles: item.indexedFiles ?? 0,
        totalFiles: item.totalFiles ?? 0,
        chunks: item.chunks ?? 0,
      }))
      .sort((left, right) => right.indexedFiles - left.indexedFiles || right.chunks - left.chunks);

    let primaryIssue: string | null = null;
    if (memoryStatus.embeddingsError) {
      primaryIssue = memoryStatus.embeddingsError;
    } else if (memoryStatus.embeddingsAvailable === false) {
      primaryIssue = "Embeddings unavailable";
    } else if ((memoryStatus.indexedFiles ?? 0) === 0) {
      primaryIssue = "No indexed files";
    }

    return {
      provider: memoryStatus.provider ?? "unknown",
      model: memoryStatus.model ?? "unknown",
      indexedFiles: memoryStatus.indexedFiles ?? 0,
      totalFiles: memoryStatus.totalFiles ?? 0,
      chunks: memoryStatus.chunks ?? 0,
      bySource,
      primaryIssue,
    };
  }, [memoryStatus]);

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

  const handleProbeTimelineRange = async () => {
    if (!selectedAgentId) {
      return;
    }

    setTimelineLoading(true);
    try {
      const result = await gatewayAgentMemoryTimelineRemoteProbe(
        selectedAgentId,
        _timelineProbeRange.startDate,
        _timelineProbeRange.endDate,
      );
      setTimelineResult(result);
      setTimelineError(null);
      setSelectedTimelineEntryName((current) =>
        resolveSelectedTimelineEntryName(current, result),
      );
      setActiveSection("footprints");
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : String(error));
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleOpenSearchEntry = async (entry: NonNullable<GatewayAgentMemorySearchResult>["results"][number]) => {
    if (entry.openTarget === "documents") {
      setSelectedDocumentName(entry.canonicalDocumentName ?? entry.path.split("/").pop() ?? "");
      setActiveSection("documents");
      return;
    }

    if (entry.openTarget === "footprints") {
      setSelectedTimelineEntryName(entry.timelineEntryName ?? entry.path.split("/").slice(-2).join("/"));
      setActiveSection("footprints");
      return;
    }

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
          <h1 className="text-[20px] md:text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-1">Memory</h1>
          <p className="text-[13px] md:text-sm text-slate-500 dark:text-slate-400">
            Real gateway-backed memory overview, documents, daily footprints, search, and knowledge diagnostics.
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
          ["overview", "Overview", BookOpen],
          ["documents", "Documents", FileText],
          ["footprints", "Footprints", Calendar],
          ["search", "Search", Search],
          ["knowledge", "Knowledge", BrainCircuit],
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
              Agent overview
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Active agent</div>
                <div className="mt-2 text-base font-semibold">{activeAgent?.name ?? "No agent selected"}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedAgentId || "-"}</div>
                  </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Workspace</div>
                <div className="mt-2 break-all text-sm text-slate-700 dark:text-slate-200">{memoryResult?.workspace ?? "Workspace unavailable"}</div>
                  </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Shared workspace memory</div>
                <div className="mt-2 text-sm font-medium">{hasSharedMemory ? "Shared across agents" : "Standalone workspace"}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{memoryResult?.sharedAgents.map((agent) => agent.name).join(", ") || "No shared agents reported"}</div>
                  </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Edit capability</div>
                <div className="mt-2 text-sm font-medium">{canEdit ? "Writable" : "Read only"}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{canEdit ? "operator.admin granted" : "Current gateway scopes do not allow writes"}</div>
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
              Memory sources snapshot
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="font-medium">Root documents</div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  {(memoryResult?.documents ?? []).map((document) => document.name).join(", ") || "No root memory documents loaded"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="font-medium">Timeline source</div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  {timelineAccess ? `${timelineAccess.mode} / ${timelineAccess.reason}` : "Timeline access unresolved"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="font-medium">Knowledge diagnostics</div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  {memoryResult?.diagnostics
                    ? `${memoryResult.diagnostics.backend} / ${memoryResult.diagnostics.provider ?? "no provider"}`
                    : "Diagnostics not returned by gateway"}
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
          
          {activeSection === 'documents' && (
            <motion.div 
              key="view-table"
              className="absolute inset-0 flex flex-col"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}
            >
              {/* Documents View */}
              <div className="hidden md:flex flex-col flex-1 overflow-auto bg-white dark:bg-slate-900 relative">
                {(memoryResult?.documents?.length ?? 0) === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl m-4">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">No memories found</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Try adjusting your filters or search query.</p>
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
                      {(memoryResult?.documents ?? []).map((item) => (
                        <tr key={item.name} className="hover:bg-[#f0f9ff] dark:hover:bg-slate-800 cursor-pointer transition-colors group focus-within:bg-sky-50 dark:focus-within:bg-slate-800" tabIndex={0}>
                           <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs" dir="ltr">{item.updatedAtMs ? new Date(item.updatedAtMs).toLocaleString() : "-"}</td>
                           <td className="px-4 py-3">
                             <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium">document</span>
                           </td>
                           <td className="px-4 py-3">
                             <span className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 px-2 py-1 rounded-md border border-cyan-100 dark:border-cyan-800/50">
                               <Network className="w-3 h-3" />
                               {memoryResult?.workspace ?? "workspace"}
                             </span>
                           </td>
                           <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{getAgentBadge(selectedAgentId)}</td>
                           <td className="px-4 py-3 text-slate-900 dark:text-slate-100 truncate max-w-[400px]" title={item.path}>{item.path}</td>
                           <td className="px-4 py-3 text-center">
                             {!item.missing && <div className="w-2 h-2 rounded-full bg-[#16a34a] mx-auto" title="available"></div>}
                             {item.missing && <div className="w-2 h-2 rounded-full bg-[#dc2626] mx-auto" title="missing"></div>}
                           </td>
                           <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                             <button className="text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 p-1 rounded hover:bg-sky-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"><ChevronRight className="w-4 h-4 rtl:rotate-180" /></button>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden flex-1 overflow-auto hide-scrollbar -mx-4 px-4 pb-4 space-y-3">
                 {(memoryResult?.documents?.length ?? 0) === 0 ? (
                   <div className="flex flex-col items-center justify-center p-8 mt-4 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                     <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                       <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                     </div>
                     <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">No memories found</h3>
                     <p className="text-xs text-slate-500 dark:text-slate-400">Try adjusting your filters.</p>
                   </div>
                 ) : (
                   (memoryResult?.documents ?? []).map((item) => (
                     <div key={item.name} tabIndex={0} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-sky-500 transition-transform relative overflow-hidden group cursor-pointer">
                       <div className="flex justify-between items-start mb-2.5">
                         <div className="flex flex-col gap-1.5">
                           <div className="flex items-center gap-2">
                             {getAgentBadge(selectedAgentId)}
                           </div>
                           <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium flex items-center gap-1">
                             <Network className="w-3 h-3" /> {memoryResult?.workspace ?? "workspace"}
                           </span>
                         </div>
                         <span className="text-[11px] text-slate-400 font-mono bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded" dir="ltr">{item.updatedAtMs ? new Date(item.updatedAtMs).toLocaleTimeString() : "-"}</span>
                       </div>
                       <p className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed mb-4 line-clamp-3">{item.path}</p>
                       <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                         <span className="text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 px-2 py-0.5 rounded flex items-center gap-1">
                           <FileDigit className="w-3 h-3"/> document
                         </span>
                         <div className="flex items-center gap-1.5 text-[11px] font-medium">
                           {!item.missing && <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span className="text-emerald-600 dark:text-emerald-400">available</span></>}
                           {item.missing && <><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div><span className="text-red-600 dark:text-red-400">missing</span></>}
                         </div>
                       </div>
                     </div>
                   ))
                 )}
              </div>

              <div className="hidden md:flex bg-[#f8fafc] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 justify-between items-center shrink-0">
                 <span>{(memoryResult?.documents?.length ?? 0)} real documents loaded</span>
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
                     <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Access mode</div>
                     <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                       {timelineAccess ? `${timelineAccess.mode} / ${timelineAccess.reason}` : "Timeline access unresolved"}
                     </div>
                     <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                       {timelineResult?.source ? `Current data source: ${timelineResult.source}` : "Timeline source not loaded yet."}
                     </div>
                   </div>
                   <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                     <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Probe preset</div>
                     <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                       {_timelineProbeRange.startDate} → {_timelineProbeRange.endDate}
                     </div>
                     <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                       Remote probing stays honest: no fake directory listing, only range-based checks.
                     </div>
                     <button
                       onClick={handleProbeTimelineRange}
                       className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                     >
                       <Clock className="w-3.5 h-3.5" />
                       Probe range
                     </button>
                   </div>
                 </div>
                 {_timelineError && (
                   <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
                     {_timelineError}
                   </div>
                 )}
               </div>
               <div className="max-w-3xl mx-auto -mx-4 md:mx-auto px-2 md:px-0">
                {filteredFootprintGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 mt-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mx-4 shadow-sm">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Footprints className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">No footprint found</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">There are no memory footprints for the current selection.</p>
                    </div>
                ) : (
                  <div className="relative border-l-[2px] rtl:border-l-0 rtl:border-r-[2px] border-slate-200 dark:border-slate-800 ml-4 rtl:ml-0 rtl:mr-4 md:ml-8 rtl:md:mr-8 space-y-8 md:space-y-10 pb-8 pt-2">
                      {filteredFootprintGroups.map((group) => (
                        <div key={group.id} className="relative pl-6 rtl:pl-0 rtl:pr-6 md:pl-10 rtl:md:pr-10">
                          <div className="absolute -left-[15px] rtl:left-auto rtl:-right-[15px] md:-left-[17px] rtl:md:-right-[17px] top-0 w-7 h-7 md:w-8 md:h-8 bg-white dark:bg-slate-800 border-[2px] border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center shadow-sm z-10">
                            <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-sky-500" />
                          </div>
                          <div className="mb-4 md:mb-5 flex items-center gap-3 pt-0.5 md:pt-1">
                            <h3 className="text-[15px] md:text-[16px] font-bold text-slate-800 dark:text-slate-200 tracking-tight" dir="ltr">{group.dateLabel}</h3>
                            <span className="text-[10px] md:text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200/80 dark:border-slate-700">
                              {group.entries.length} entries
                            </span>
                            {group.probeDay && (
                              <span className="text-[10px] md:text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 px-2 py-0.5 rounded-full">
                                probe: {group.probeDay.status}
                              </span>
                            )}
                          </div>
                          <div className="space-y-3 md:space-y-4">
                            {group.entries.map((item) => (
                              <div key={item.name} className="relative group outline-none" tabIndex={0}>
                                <div className="absolute -left-[29.5px] rtl:left-auto rtl:-right-[29.5px] md:-left-[45px] rtl:md:-right-[45px] top-[16px] md:top-[20px] w-2.5 h-2.5 md:w-3 md:h-3 bg-white dark:bg-slate-800 border-[2px] md:border-[2.5px] border-slate-300 dark:border-slate-600 rounded-full z-10 group-hover:border-sky-400 group-focus:border-sky-500 transition-colors"></div>
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl md:rounded-lg p-3.5 md:p-4 shadow-sm md:hover:border-sky-300 dark:md:hover:border-sky-700 group-focus:ring-2 group-focus:ring-sky-500 transition-all cursor-pointer">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5 md:gap-2">
                                      <span className="text-[10px] md:text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1" dir="ltr">
                                        <Clock className="w-2.5 h-2.5 md:w-3 md:h-3"/> {item.updatedAtMs ? new Date(item.updatedAtMs).toLocaleTimeString() : "-"}
                                      </span>
                                      <span className="text-[10px] font-medium text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/20 px-1.5 py-0.5 rounded border border-cyan-100 dark:border-cyan-800/50 flex items-center gap-1">
                                        <Network className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                        <span className="max-w-[120px] md:max-w-none truncate">{timelineAccess?.mode ?? timelineResult?.source ?? "timeline"}</span>
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
               <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                 <div className="flex items-center justify-between gap-3">
                   <div>
                     <div className="text-sm font-semibold">Daily detail card</div>
                     <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedTimelineEntryName || "Select a footprint result"}</div>
                   </div>
                   <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300">
                     read only
                   </span>
                 </div>
                 <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                   {_timelineEntryLoading
                     ? "Loading daily detail..."
                     : _timelineEntryError
                       ? _timelineEntryError
                       : _timelineEntryContent || "No daily detail content loaded."}
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
                  <div className="text-sm font-semibold">Semantic search</div>
                  <div className="mt-4 flex gap-2">
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search memory, footprints, and transcripts"
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
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
                  {searchResult?.diagnostics && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="font-medium">Diagnostics snapshot</div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">{searchResult.diagnostics.backend} / {searchResult.diagnostics.storeDriver}</div>
                      <div className="mt-1 break-all text-slate-500 dark:text-slate-400">{searchResult.diagnostics.storePath}</div>
                    </div>
                  )}
                  {diagnosticsSummary && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="font-medium">Shared diagnostics summary</div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">{diagnosticsSummary.provider} / {diagnosticsSummary.model}</div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">indexed {diagnosticsSummary.indexedFiles} / total {diagnosticsSummary.totalFiles} / chunks {diagnosticsSummary.chunks}</div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">{diagnosticsSummary.primaryIssue ?? "No primary issue detected"}</div>
                    </div>
                  )}
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {searchGroups.map(({ group, count }) => (
                      <span key={group} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {group} · {count}
                      </span>
                    ))}
                  </div>
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
                    Search open routing is intentionally deferred to M3. In M2 this section only proves the real gateway-backed query path, diagnostics payload, and result grouping skeleton.
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
              {diagnosticsSummary && (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="font-medium">Search bar / drawer shared diagnostics</div>
                  <div className="mt-1 text-slate-500 dark:text-slate-400">Primary issue: {diagnosticsSummary.primaryIssue ?? "none"}</div>
                  <div className="mt-1 text-slate-500 dark:text-slate-400">Top source: {diagnosticsSummary.bySource[0]?.source ?? "n/a"}</div>
                </div>
              )}
              {searchError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
                      {searchError}
                    </div>
                  ) : searchResult ? (
                    <div className="space-y-3">
                      {searchResult.results.map((entry) => (
                        <article key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300">{entry.sourceKind}</span>
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{entry.openTarget}</span>
                          </div>
                          <div className="mt-3 break-all text-sm font-semibold">{entry.path}</div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{entry.snippet}</p>
                          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">Open routing for real navigation is deferred to M3. Current target: {entry.openTarget}.</div>
                          <button
                            onClick={() => void handleOpenSearchEntry(entry)}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                          >
                            Open result
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </article>
                      ))}
                      {searchResult.results.length === 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                          No semantic search results returned for this query.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                      Run a real gateway-backed search to populate this section.
                    </div>
                  )}
                  {searchDetail && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Read-only detail</div>
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
                        {searchDetail.sourceKind} · read only source file
                      </div>
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                        {searchDetail.loading
                          ? "Loading source content..."
                          : searchDetail.error
                            ? searchDetail.error
                            : searchDetail.content || searchDetail.snippet}
                      </div>
                    </div>
                  )}
                  {memoryStatusError && (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
                      {memoryStatusError}
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
                    <div className="mb-4 text-sm font-semibold">External knowledge inputs</div>
                    {memoryResult?.diagnostics ? (
                      <div className="space-y-3 text-sm">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                          <div className="font-medium">Backend</div>
                          <div className="mt-1 text-slate-500 dark:text-slate-400">
                            {memoryResult.diagnostics.backend} / {memoryResult.diagnostics.provider ?? "no provider"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                          <div className="font-medium">Builtin store</div>
                          <div className="mt-1 break-all text-slate-500 dark:text-slate-400">{memoryResult.diagnostics.builtinStorePath}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                          <div className="font-medium">Sources</div>
                          <div className="mt-1 text-slate-500 dark:text-slate-400">{memoryResult.diagnostics.sources.join(", ") || "No sources reported"}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
                        Gateway returned memory documents, but did not include diagnostics for external knowledge inputs.
                      </div>
                    )}
                  </section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 text-sm font-semibold">Resolved source paths</div>
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
                        Diagnostics are present, but no extra paths or QMD paths were reported.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                        No path inventory can be shown because diagnostics are unavailable.
                      </div>
                    )}
                  </section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
                    <div className="mb-4 text-sm font-semibold">Diagnostics drawer fields</div>
                    {diagnosticsSummary ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                          <div className="font-medium">Primary issue</div>
                          <div className="mt-1 text-slate-500 dark:text-slate-400">{diagnosticsSummary.primaryIssue ?? "No blocking issue reported"}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {diagnosticsSummary.primaryIssue ? (
                              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300">
                                Primary Issue
                              </span>
                            ) : (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300">
                                Healthy
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="font-medium">Indexed files</div>
                            <div className="mt-1 text-slate-500 dark:text-slate-400">{diagnosticsSummary.indexedFiles}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="font-medium">Total files</div>
                            <div className="mt-1 text-slate-500 dark:text-slate-400">{diagnosticsSummary.totalFiles}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="font-medium">Chunks</div>
                            <div className="mt-1 text-slate-500 dark:text-slate-400">{diagnosticsSummary.chunks}</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {diagnosticsSummary.bySource.map((source) => (
                            <div key={source.source} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-medium">{source.source}</div>
                                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${sourceTone(source.source)}`}>
                                  {source.source}
                                </span>
                              </div>
                              <div className="mt-1 text-slate-500 dark:text-slate-400">indexed {source.indexedFiles} / total {source.totalFiles} / chunks {source.chunks}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                        Diagnostics drawer cannot render because memory status data is unavailable.
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
