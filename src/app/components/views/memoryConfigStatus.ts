import type {
  GatewayAgentMemoryResult,
  GatewayAgentMemoryRuntimeStatusResult,
  GatewayAgentMemoryStatusResult,
} from "../../contexts/OpenClawContext";

export type MemoryIndexStrategy = "incremental" | "full";

export type MemoryConfigStatusSummary = {
  hasExternalKnowledge: boolean;
  localWritable: boolean;
  reindexRequired: boolean;
  reindexStrategy: MemoryIndexStrategy;
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
    | "memory.search.commands.localForce"
    | "memory.search.commands.openai"
    | "memory.search.commands.generic";
};

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
  const indexedFiles = runtimeStatus?.status.files ?? 0;
  const runtimeAvailable = runtimeStatus !== null;
  const reindexStrategy: MemoryIndexStrategy = indexedFiles === 0 ? "full" : "incremental";
  const reindexRequired = Boolean(runtimeStatus?.status.dirty);
  const hasExternalKnowledge = Boolean(
    (memoryResult?.diagnostics?.extraPaths?.length ?? 0) > 0 ||
      (memoryResult?.diagnostics?.qmdPaths?.length ?? 0) > 0 ||
      memoryResult?.diagnostics?.sessionMemoryEnabled,
  );
  const configuredButNotIndexed = hasExternalKnowledge && runtimeAvailable && indexedFiles === 0;

  const indexCommand =
    reindexStrategy === "full"
      ? `openclaw memory index --agent ${selectedAgentId || "<agent-id>"} --force`
      : `openclaw memory index --agent ${selectedAgentId || "<agent-id>"}`;
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
      ? reindexStrategy === "full"
        ? "memory.search.commands.localForce"
        : "memory.search.commands.localIncremental"
      : isHosted
        ? "memory.search.commands.openai"
        : "memory.search.commands.generic";

  let statusKey: MemoryConfigStatusSummary["statusKey"] = "diag_unavailable";
  if (!memoryResult?.diagnostics) {
    statusKey = "diag_unavailable";
  } else if (!isLocalGatewaySession) {
    statusKey = "remote_readonly";
  } else if (hasExternalKnowledge && reindexRequired) {
    statusKey = "configured_stale";
  } else if (configuredButNotIndexed) {
    statusKey = "configured_only";
  } else if (hasExternalKnowledge) {
    statusKey = "configured_indexed";
  } else {
    statusKey = "configured_only";
  }

  return {
    hasExternalKnowledge,
    localWritable: isLocalGatewaySession,
    reindexRequired,
    reindexStrategy,
    configuredButNotIndexed,
    runtimeAvailable,
    statusKey,
    commandGuide,
    commandDescriptionKey,
  };
}
