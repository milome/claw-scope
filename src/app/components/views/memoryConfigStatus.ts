import type {
  GatewayAgentMemoryResult,
  GatewayAgentMemoryRuntimeStatusResult,
  GatewayAgentMemoryStatusResult,
} from "../../contexts/OpenClawContext";

export type MemoryIndexStrategy = "incremental" | "full";
export type MemoryReindexMode = "auto" | "manual";

export type MemoryConfigStatusSummary = {
  hasExternalKnowledge: boolean;
  localWritable: boolean;
  reindexRequired: boolean;
  reindexStrategy: MemoryIndexStrategy;
  reindexMode: MemoryReindexMode;
  configuredButNotIndexed: boolean;
  runtimeAvailable: boolean;
  statusKey:
    | "configured_only"
    | "configured_indexed"
    | "configured_stale"
    | "remote_readonly"
    | "diag_unavailable";
  commandGuide: string;
  commandDescriptionKey:
    | "memory.search.commands.ollama"
    | "memory.search.commands.localIncremental"
    | "memory.search.commands.openai"
    | "memory.search.commands.generic";
  searchAvailabilityReasonKey:
    | "memory.search.reason.configuredOnly"
    | "memory.search.reason.stale"
    | "memory.search.reason.indexed"
    | "memory.search.reason.diagUnavailable"
    | "memory.search.reason.remoteReadonly";
  providerAvailabilityReasonKey:
    | "memory.search.providerReason.ready"
    | "memory.search.providerReason.embeddingsError"
    | "memory.search.providerReason.embeddingsUnavailable"
    | "memory.search.providerReason.providerMissing";
  runtimeMatchState: "missing" | "partial" | "matched";
};

export function memoryConfigStatusMessageKey(
  statusKey: MemoryConfigStatusSummary["statusKey"],
) {
  return `memory.knowledge.summary.${statusKey}` as const;
}

export function memoryConfigBridgeMessageKey(localWritable: boolean) {
  return localWritable
    ? "memory.knowledge.bridgeStatus.local"
    : "memory.knowledge.bridgeStatus.remote";
}

export function memoryReindexModeMessageKey(mode: MemoryReindexMode) {
  return mode === "auto"
    ? "memory.knowledge.reindexMode.auto"
    : "memory.knowledge.reindexMode.manual";
}

function buildHints(...values: Array<string | null | undefined>) {
  return values
    .map((value) => value?.trim().toLowerCase() ?? "")
    .filter(Boolean);
}

function detectOllama(hints: string[]) {
  return hints.some((value) => value.includes("ollama"));
}

function detectHosted(hints: string[]) {
  return hints.some(
    (value) =>
      value.includes("openai") ||
      value.includes("anthropic") ||
      value.includes("gemini") ||
      value.includes("azure"),
  );
}

export function buildMemoryConfigStatusSummary({
  selectedAgentId,
  isLocalGatewaySession,
  memoryResult,
  memoryStatus,
  runtimeStatus,
}: {
  selectedAgentId: string;
  isLocalGatewaySession: boolean;
  memoryResult: GatewayAgentMemoryResult | null;
  memoryStatus: GatewayAgentMemoryStatusResult | null;
  runtimeStatus: GatewayAgentMemoryRuntimeStatusResult | null;
}): MemoryConfigStatusSummary {
  const hints = buildHints(
    memoryStatus?.provider,
    memoryStatus?.requestedProvider,
    memoryStatus?.model,
    memoryStatus?.embeddingsError,
    runtimeStatus?.status.provider,
    runtimeStatus?.status.requestedProvider,
    runtimeStatus?.status.model,
    runtimeStatus?.embeddingError,
    memoryResult?.diagnostics?.provider,
    memoryResult?.diagnostics?.embeddingModel,
    memoryResult?.diagnostics?.backend,
  );

  const isOllama = detectOllama(hints);
  const isHosted = detectHosted(hints);
  const runtimeAvailable = runtimeStatus !== null;
  const indexedFiles = runtimeStatus?.status.files ?? 0;
  const reindexStrategy: MemoryIndexStrategy = "incremental";
  const reindexMode: MemoryReindexMode = isLocalGatewaySession ? "auto" : "manual";
  const reindexRequired = Boolean(runtimeStatus?.status.dirty);
  const hasExternalKnowledge = Boolean(
    (memoryResult?.diagnostics?.extraPaths?.length ?? 0) > 0 ||
      (memoryResult?.diagnostics?.qmdPaths?.length ?? 0) > 0 ||
      memoryResult?.diagnostics?.sessionMemoryEnabled,
  );
  const configuredButNotIndexed = hasExternalKnowledge && runtimeAvailable && indexedFiles === 0;
  const configuredPaths = memoryResult?.diagnostics?.extraPaths ?? [];
  const runtimePaths = runtimeStatus?.status.extraPaths ?? [];
  const runtimeSourceNames = new Set((runtimeStatus?.status.sourceCounts ?? []).map((item) => item.source));
  const matchedConfiguredPaths = configuredPaths.filter((path) => runtimePaths.includes(path));
  const sessionConfiguredAndIndexed = Boolean(
    memoryResult?.diagnostics?.sessionMemoryEnabled && runtimeSourceNames.has("sessions"),
  );
  const totalExpectedMatches = configuredPaths.length + (memoryResult?.diagnostics?.sessionMemoryEnabled ? 1 : 0);
  const totalActualMatches = matchedConfiguredPaths.length + (sessionConfiguredAndIndexed ? 1 : 0);
  const runtimeMatchState: MemoryConfigStatusSummary["runtimeMatchState"] = totalExpectedMatches === 0
    ? "matched"
    : totalActualMatches === 0
      ? "missing"
      : totalActualMatches < totalExpectedMatches
        ? "partial"
        : "matched";

  const indexCommand =
    `openclaw memory index --agent ${selectedAgentId || "<agent-id>"}`;
  const statusCommand = `openclaw memory status --agent ${selectedAgentId || "<agent-id>"} --deep --index`;

  const commandGuide = isOllama
    ? [
        "ollama serve",
        "ollama pull nomic-embed-text",
        'openclaw config set models.providers.ollama.baseUrl "http://127.0.0.1:11434"',
        'openclaw config set models.providers.ollama.apiKey "ollama-local"',
        'openclaw config set models.providers.ollama.api "ollama"',
        'openclaw config set agents.defaults.memorySearch.provider "ollama"',
        indexCommand,
        statusCommand,
      ].join("\n")
    : [indexCommand, statusCommand].join("\n");

  const commandDescriptionKey = isOllama
    ? "memory.search.commands.ollama"
    : isLocalGatewaySession
      ? "memory.search.commands.localIncremental"
      : isHosted
        ? "memory.search.commands.openai"
        : "memory.search.commands.generic";

  let statusKey: MemoryConfigStatusSummary["statusKey"] = "diag_unavailable";
  let searchAvailabilityReasonKey: MemoryConfigStatusSummary["searchAvailabilityReasonKey"] = "memory.search.reason.diagUnavailable";
  let providerAvailabilityReasonKey: MemoryConfigStatusSummary["providerAvailabilityReasonKey"] = "memory.search.providerReason.providerMissing";

  if (memoryStatus?.embeddingsError) {
    providerAvailabilityReasonKey = "memory.search.providerReason.embeddingsError";
  } else if (memoryStatus?.embeddingsAvailable === false) {
    providerAvailabilityReasonKey = "memory.search.providerReason.embeddingsUnavailable";
  } else if (memoryStatus?.embeddingsAvailable === true) {
    providerAvailabilityReasonKey = "memory.search.providerReason.ready";
  }

  if (!memoryResult?.diagnostics) {
    statusKey = "diag_unavailable";
    searchAvailabilityReasonKey = "memory.search.reason.diagUnavailable";
  } else if (!isLocalGatewaySession) {
    statusKey = "remote_readonly";
    searchAvailabilityReasonKey = "memory.search.reason.remoteReadonly";
  } else if (hasExternalKnowledge && reindexRequired) {
    statusKey = "configured_stale";
    searchAvailabilityReasonKey = "memory.search.reason.stale";
  } else if (configuredButNotIndexed) {
    statusKey = "configured_only";
    searchAvailabilityReasonKey = "memory.search.reason.configuredOnly";
  } else if (hasExternalKnowledge) {
    statusKey = "configured_indexed";
    searchAvailabilityReasonKey = "memory.search.reason.indexed";
  } else {
    statusKey = "configured_only";
    searchAvailabilityReasonKey = "memory.search.reason.configuredOnly";
  }

  return {
    hasExternalKnowledge,
    localWritable: isLocalGatewaySession,
    reindexRequired,
    reindexStrategy,
    reindexMode,
    configuredButNotIndexed,
    runtimeAvailable,
    statusKey,
    commandGuide,
    commandDescriptionKey,
    searchAvailabilityReasonKey,
    providerAvailabilityReasonKey,
    runtimeMatchState,
  };
}
