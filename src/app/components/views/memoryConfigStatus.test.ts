import { describe, expect, it } from "vitest";

import { buildMemoryConfigStatusSummary } from "./memoryConfigStatus";

describe("buildMemoryConfigStatusSummary", () => {
  const baseArgs = {
    selectedAgentId: "agent-main",
    isLocalGatewaySession: true,
    memoryStatus: null,
  } as const;

  it("marks configured external knowledge without indexed files as configured_only", () => {
    const summary = buildMemoryConfigStatusSummary({
      ...baseArgs,
      memoryResult: {
        agentId: "agent-main",
        workspace: "workspace",
        documents: [],
        sharedAgents: [],
        diagnostics: {
          memorySearchEnabled: true,
          backend: "builtin",
          provider: "openai",
          embeddingModel: "text-embedding-3-large",
          builtinStorePath: "~/.openclaw/memory/main.sqlite",
          sources: ["memory"],
          extraPaths: ["../team-docs"],
          sessionMemoryEnabled: false,
          qmdActive: false,
          qmdHome: null,
          qmdPaths: [],
          qmdSessionsEnabled: false,
        },
      },
      runtimeStatus: {
        agentId: "agent-main",
        embeddingOk: true,
        embeddingError: null,
        vectorOk: true,
        status: {
          backend: "builtin",
          files: 0,
          totalFiles: 0,
          chunks: 0,
          dirty: false,
          workspaceDir: null,
          dbPath: null,
          provider: "openai",
          model: "text-embedding-3-large",
          requestedProvider: "openai",
          sources: ["memory"],
          extraPaths: [],
          sourceCounts: [],
        },
        rawPayload: "{}",
      },
    });

    expect(summary.configuredButNotIndexed).toBe(true);
    expect(summary.reindexMode).toBe("auto");
    expect(summary.reindexStrategy).toBe("incremental");
    expect(summary.statusKey).toBe("configured_only");
    expect(summary.searchAvailabilityReasonKey).toBe("memory.search.reason.configuredOnly");
    expect(summary.runtimeMatchState).toBe("missing");
    expect(summary.providerAvailabilityReasonKey).toBe("memory.search.providerReason.providerMissing");
  });

  it("marks dirty runtime state as configured_stale", () => {
    const summary = buildMemoryConfigStatusSummary({
      ...baseArgs,
      memoryResult: {
        agentId: "agent-main",
        workspace: "workspace",
        documents: [],
        sharedAgents: [],
        diagnostics: {
          memorySearchEnabled: true,
          backend: "builtin",
          provider: "openai",
          embeddingModel: "text-embedding-3-large",
          builtinStorePath: "~/.openclaw/memory/main.sqlite",
          sources: ["memory", "sessions"],
          extraPaths: ["../team-docs"],
          sessionMemoryEnabled: true,
          qmdActive: false,
          qmdHome: null,
          qmdPaths: [],
          qmdSessionsEnabled: false,
        },
      },
      runtimeStatus: {
        agentId: "agent-main",
        embeddingOk: true,
        embeddingError: null,
        vectorOk: true,
        status: {
          backend: "builtin",
          files: 3,
          totalFiles: 3,
          chunks: 12,
          dirty: true,
          workspaceDir: null,
          dbPath: null,
          provider: "openai",
          model: "text-embedding-3-large",
          requestedProvider: "openai",
          sources: ["memory", "sessions"],
          extraPaths: ["../team-docs"],
          sourceCounts: [],
        },
        rawPayload: "{}",
      },
    });

    expect(summary.reindexRequired).toBe(true);
    expect(summary.reindexMode).toBe("auto");
    expect(summary.reindexStrategy).toBe("incremental");
    expect(summary.statusKey).toBe("configured_stale");
    expect(summary.searchAvailabilityReasonKey).toBe("memory.search.reason.stale");
    expect(summary.runtimeMatchState).toBe("partial");
    expect(summary.providerAvailabilityReasonKey).toBe("memory.search.providerReason.providerMissing");
  });

  it("marks missing diagnostics as diag_unavailable", () => {
    const summary = buildMemoryConfigStatusSummary({
      ...baseArgs,
      memoryResult: {
        agentId: "agent-main",
        workspace: "workspace",
        documents: [],
        sharedAgents: [],
        diagnostics: null,
      },
      runtimeStatus: null,
    });

    expect(summary.statusKey).toBe("diag_unavailable");
    expect(summary.runtimeAvailable).toBe(false);
    expect(summary.reindexMode).toBe("auto");
    expect(summary.searchAvailabilityReasonKey).toBe("memory.search.reason.diagUnavailable");
    expect(summary.providerAvailabilityReasonKey).toBe("memory.search.providerReason.providerMissing");
  });
});
