import type {
  GatewayAgentMemoryIndexResult,
  GatewayConfigSetResult,
} from "../../contexts/OpenClawContext";
import {
  gatewayAgentMemoryIndex,
  gatewayConfigSetLocal,
} from "../../contexts/OpenClawContext";
import type { MemoryIndexStrategy } from "./memoryConfigStatus";

export type MemoryKnowledgeActionKind =
  | "set_extra_paths"
  | "set_session_memory"
  | "set_sources"
  | "reindex";

export type MemoryKnowledgeActionSuccess = {
  kind: MemoryKnowledgeActionKind;
  stdout: string;
};

export type MemoryKnowledgeActionFailureCode =
  | "local_only"
  | "empty_key"
  | "cli_failed"
  | "unknown";

export type MemoryKnowledgeActionFailure = {
  kind: MemoryKnowledgeActionKind;
  code: MemoryKnowledgeActionFailureCode;
  message: string;
  rawMessage: string;
};

function normalizeActionError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }
  }

  return "Unknown error";
}

function classifyActionError(message: string): MemoryKnowledgeActionFailureCode {
  const normalized = message.toLowerCase();
  if (normalized.includes("local-only") || normalized.includes("remote gateway sessions")) {
    return "local_only";
  }
  if (normalized.includes("config key cannot be empty")) {
    return "empty_key";
  }
  if (normalized.includes("local openclaw cli failed") || normalized.includes("failed to run local openclaw cli")) {
    return "cli_failed";
  }
  return "unknown";
}

function formatActionErrorMessage(
  code: MemoryKnowledgeActionFailureCode,
  t: (key: string, ...args: (string | number)[]) => string,
  rawMessage: string,
) {
  switch (code) {
    case "local_only":
      return t("memory.knowledge.error.localOnly");
    case "empty_key":
      return t("memory.knowledge.error.emptyKey");
    case "cli_failed":
      return `${t("memory.knowledge.error.cliFailed")} ${rawMessage}`.trim();
    default:
      return rawMessage;
  }
}

async function runConfigAction(
  kind: Exclude<MemoryKnowledgeActionKind, "reindex">,
  key: string,
  value: string,
  t: (key: string, ...args: (string | number)[]) => string,
  sessionId?: string,
): Promise<MemoryKnowledgeActionSuccess> {
  try {
    const result: GatewayConfigSetResult = await gatewayConfigSetLocal(
      key,
      value,
      sessionId,
    );
    return {
      kind,
      stdout: result.stdout,
    };
  } catch (error) {
    const rawMessage = normalizeActionError(error);
    const code = classifyActionError(rawMessage);
    throw {
      kind,
      code,
      rawMessage,
      message: formatActionErrorMessage(code, t, rawMessage),
    } satisfies MemoryKnowledgeActionFailure;
  }
}

export async function setExternalKnowledgePaths(
  paths: string[],
  t: (key: string, ...args: (string | number)[]) => string,
  sessionId?: string,
) {
  return runConfigAction(
    "set_extra_paths",
    "agents.defaults.memorySearch.extraPaths",
    JSON.stringify(paths),
    t,
    sessionId,
  );
}

export async function setSessionMemoryEnabled(
  enabled: boolean,
  t: (key: string, ...args: (string | number)[]) => string,
  sessionId?: string,
) {
  return runConfigAction(
    "set_session_memory",
    "agents.defaults.memorySearch.experimental.sessionMemory",
    enabled ? "true" : "false",
    t,
    sessionId,
  );
}

export async function setExternalKnowledgeSources(
  sources: string[],
  t: (key: string, ...args: (string | number)[]) => string,
  sessionId?: string,
) {
  return runConfigAction(
    "set_sources",
    "agents.defaults.memorySearch.sources",
    JSON.stringify(sources),
    t,
    sessionId,
  );
}

export async function runExternalKnowledgeReindex(
  agentId: string,
  _strategy: MemoryIndexStrategy,
  t: (key: string, ...args: (string | number)[]) => string,
  sessionId?: string,
): Promise<MemoryKnowledgeActionSuccess> {
  try {
    const result: GatewayAgentMemoryIndexResult = await gatewayAgentMemoryIndex(
      agentId,
      false,
      sessionId,
    );
    return {
      kind: "reindex",
      stdout: result.stdout,
    };
  } catch (error) {
    const rawMessage = normalizeActionError(error);
    throw {
      kind: "reindex",
      code: "unknown",
      rawMessage,
      message: rawMessage || t("memory.knowledge.error.reindexFailed"),
    } satisfies MemoryKnowledgeActionFailure;
  }
}
