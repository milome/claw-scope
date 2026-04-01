import type {
  GatewayAgentMemoryDiagnostics,
  GatewayAgentMemoryRuntimeStatusResult,
} from "../../contexts/OpenClawContext";
import type { MemoryExternalSourceItem } from "./memoryState";

export type ExternalKnowledgeEntryKind =
  | "extra_path"
  | "qmd_path"
  | "session_source";

export type ExternalKnowledgeEntryStatus =
  | "configured"
  | "indexed"
  | "stale";

export type ExternalKnowledgeEntry = {
  id: string;
  kind: ExternalKnowledgeEntryKind;
  label: string;
  path?: string;
  status: ExternalKnowledgeEntryStatus;
  note?: string | null;
};

export type ExternalKnowledgeSection = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  entries: ExternalKnowledgeEntry[];
};

export type ExternalKnowledgeViewModel = {
  backend: string | null;
  provider: string | null;
  diagnosticsAvailable: boolean;
  localWritable: boolean;
  hasExternalKnowledge: boolean;
  needsReindexHint: boolean;
  runtimeAvailable: boolean;
  runtimeSummary: {
    files: number;
    chunks: number;
    dirty: boolean;
    sourceCounts: { source: string; files: number; chunks: number }[];
  } | null;
  extraPaths: string[];
  qmdPaths: string[];
  sources: string[];
  sessionMemoryEnabled: boolean;
  sections: ExternalKnowledgeSection[];
};

export function isBlockedExternalKnowledgePath(path: string) {
  const normalized = path.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes(".sqlite") ||
    normalized.includes("/qmd") ||
    normalized.includes("\\qmd") ||
    normalized.includes("/sessions") ||
    normalized.includes("\\sessions")
  );
}

function normalizeString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildIndexedPathSet(
  runtimeStatus: GatewayAgentMemoryRuntimeStatusResult | null,
) {
  return new Set(
    (runtimeStatus?.status.extraPaths ?? [])
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function resolveEntryStatus(
  path: string,
  indexedPathSet: Set<string>,
  dirty: boolean,
): ExternalKnowledgeEntryStatus {
  if (!indexedPathSet.has(path)) {
    return "configured";
  }

  if (dirty) {
    return "stale";
  }

  return "indexed";
}

export function buildExternalKnowledgeViewModel({
  diagnostics,
  externalSources,
  runtimeStatus,
  isLocalGatewaySession,
}: {
  diagnostics: GatewayAgentMemoryDiagnostics | null | undefined;
  externalSources: MemoryExternalSourceItem[];
  runtimeStatus: GatewayAgentMemoryRuntimeStatusResult | null;
  isLocalGatewaySession: boolean;
}): ExternalKnowledgeViewModel {
  const diagnosticsAvailable = Boolean(diagnostics);
  const backend = normalizeString(diagnostics?.backend ?? null);
  const provider = normalizeString(diagnostics?.provider ?? null);
  const indexedPathSet = buildIndexedPathSet(runtimeStatus);
  const dirty = Boolean(runtimeStatus?.status.dirty);
  const runtimeSummary = runtimeStatus
    ? {
        files: runtimeStatus.status.files,
        chunks: runtimeStatus.status.chunks,
        dirty: runtimeStatus.status.dirty,
        sourceCounts: runtimeStatus.status.sourceCounts.map((item) => ({
          source: item.source,
          files: item.files,
          chunks: item.chunks,
        })),
      }
    : null;

  const extraPathEntries = externalSources
    .filter((item) => item.kind === "extra_path")
    .map<ExternalKnowledgeEntry>((item) => ({
      id: item.id,
      kind: "extra_path",
      label: item.value,
      path: item.value,
      status: resolveEntryStatus(item.value, indexedPathSet, dirty),
      note: null,
    }));

  const qmdPathEntries = externalSources
    .filter((item) => item.kind === "qmd_path")
    .map<ExternalKnowledgeEntry>((item) => ({
      id: item.id,
      kind: "qmd_path",
      label: item.value,
      path: item.value,
      status: "configured",
      note: diagnostics?.qmdActive ? "qmd_active" : "qmd_inactive",
    }));

  const sessionEntries: ExternalKnowledgeEntry[] = diagnostics
    ? [
        {
          id: "session:memory-search",
          kind: "session_source",
          label: diagnostics.sessionMemoryEnabled
            ? "session_memory_enabled"
            : "session_memory_disabled",
          status: diagnostics.sessionMemoryEnabled
            ? dirty
              ? "stale"
              : "indexed"
            : "configured",
          note: diagnostics.sources.includes("sessions")
            ? "sessions_source_enabled"
            : "sessions_source_missing",
        },
      ]
    : [];

  const sections: ExternalKnowledgeSection[] = [
    {
      id: "extra_paths",
      titleKey: "memory.knowledge.externalPaths",
      descriptionKey: "memory.knowledge.externalPathsDesc",
      entries: extraPathEntries,
    },
    {
      id: "qmd_paths",
      titleKey: "memory.knowledge.qmdPaths",
      descriptionKey: "memory.knowledge.qmdPathsDesc",
      entries: qmdPathEntries,
    },
    {
      id: "session_retrieval",
      titleKey: "memory.knowledge.sessionRetrieval",
      descriptionKey: "memory.knowledge.sessionRetrievalDesc",
      entries: sessionEntries,
    },
  ];

  const hasExternalKnowledge = sections.some((section) => section.entries.length > 0);

  return {
    backend,
    provider,
    diagnosticsAvailable,
    localWritable: isLocalGatewaySession,
    hasExternalKnowledge,
    needsReindexHint: dirty,
    runtimeAvailable: runtimeStatus !== null,
    runtimeSummary,
    extraPaths: diagnostics?.extraPaths ?? [],
    qmdPaths: diagnostics?.qmdPaths ?? [],
    sources: diagnostics?.sources ?? [],
    sessionMemoryEnabled: diagnostics?.sessionMemoryEnabled ?? false,
    sections,
  };
}
