import { describe, expect, it } from "vitest";

import {
  captureMemoryKnowledgeReindexSnapshot,
  describeMemoryKnowledgeReindexDelta,
  hasMemoryKnowledgeReindexProgress,
  isMemoryKnowledgeReindexSettled,
} from "./memoryKnowledgeReindexState";

describe("memoryKnowledgeReindexState", () => {
  it("captures a runtime snapshot from config summary and runtime status", () => {
    const snapshot = captureMemoryKnowledgeReindexSnapshot({
      statusSummary: {
        hasExternalKnowledge: true,
        localWritable: true,
        reindexRequired: true,
        reindexStrategy: "incremental",
        reindexMode: "auto",
        configuredButNotIndexed: false,
        runtimeAvailable: true,
        statusKey: "configured_stale",
        commandGuide: "",
        commandDescriptionKey: "memory.search.commands.localIncremental",
        searchAvailabilityReasonKey: "memory.search.reason.stale",
        providerAvailabilityReasonKey: "memory.search.providerReason.ready",
        runtimeMatchState: "partial",
      },
      runtimeStatus: {
        agentId: "agent-main",
        embeddingOk: true,
        vectorOk: true,
        status: {
          backend: "builtin",
          files: 2,
          totalFiles: 2,
          chunks: 11,
          dirty: true,
          workspaceDir: null,
          dbPath: null,
          provider: "openai",
          model: "text-embedding-3-large",
          requestedProvider: "openai",
          sources: ["memory"],
          extraPaths: ["D:/shared/notes"],
          sourceCounts: [],
        },
        rawPayload: "{}",
      },
    });

    expect(snapshot).toEqual({
      runtimeAvailable: true,
      files: 2,
      chunks: 11,
      dirty: true,
      runtimeMatchState: "partial",
      statusKey: "configured_stale",
    });
  });

  it("detects meaningful runtime progress", () => {
    expect(
      hasMemoryKnowledgeReindexProgress(
        {
          runtimeAvailable: true,
          files: 1,
          chunks: 4,
          dirty: true,
          runtimeMatchState: "missing",
          statusKey: "configured_only",
        },
        {
          runtimeAvailable: true,
          files: 3,
          chunks: 9,
          dirty: false,
          runtimeMatchState: "matched",
          statusKey: "configured_indexed",
        },
      ),
    ).toBe(true);
  });

  it("marks settled only when runtime is clean and matched", () => {
    expect(
      isMemoryKnowledgeReindexSettled({
        runtimeAvailable: true,
        files: 5,
        chunks: 18,
        dirty: false,
        runtimeMatchState: "matched",
        statusKey: "configured_indexed",
      }),
    ).toBe(true);

    expect(
      isMemoryKnowledgeReindexSettled({
        runtimeAvailable: true,
        files: 5,
        chunks: 18,
        dirty: true,
        runtimeMatchState: "matched",
        statusKey: "configured_stale",
      }),
    ).toBe(false);
  });

  it("describes snapshot deltas for timeline display", () => {
    expect(
      describeMemoryKnowledgeReindexDelta(
        {
          runtimeAvailable: true,
          files: 0,
          chunks: 0,
          dirty: true,
          runtimeMatchState: "missing",
          statusKey: "configured_only",
        },
        {
          runtimeAvailable: true,
          files: 2,
          chunks: 8,
          dirty: false,
          runtimeMatchState: "matched",
          statusKey: "configured_indexed",
        },
      ),
    ).toContain("files 0 -> 2");
  });
});
