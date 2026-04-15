import { describe, expect, it } from "vitest";
import type { GatewayAgentMemoryTimelineResult } from "../../contexts/OpenClawContext";

import {
  buildHighlightedTextSegments,
  buildMemoryFootprintGroups,
  canLoadLocalTimeline,
  canEditMemory,
  canReloadMemoryDocument,
  canSaveMemoryDocument,
  collectTextSearchMatches,
  clampActiveSearchMatchIndex,
  filterMemoryFootprintGroups,
  hasTimelineProbeRangeChanged,
  hasSharedWorkspaceMemory,
  isMemoryDocumentDirty,
  moveActiveSearchMatchIndex,
  resolveInitialSearchMatchIndex,
  resolveDocumentSearchQueryFromSearchResult,
  resolveFirstTimelineEntryNameFromGroups,
  resolveExternalMemorySources,
  resolveMemoryDocumentContent,
  resolveMemoryRootDocument,
  resolveMemorySearchTarget,
  resolveSelectedMemoryDocumentName,
  resolveSelectedMemoryAgentId,
  resolveTimelineProbeRangeError,
  resolveTimelineProbeRangePreset,
  resolveSelectedTimelineEntryName,
  resolveTimelineEntryDateLabel,
  summarizeMemoryFootprintGroups,
} from "./memoryState";

describe("resolveSelectedMemoryAgentId", () => {
  it("keeps the current id when it still exists", () => {
    expect(
      resolveSelectedMemoryAgentId("agent-b", ["agent-a", "agent-b"]),
    ).toBe("agent-b");
  });

  it("falls back to the first agent when current id is missing", () => {
    expect(
      resolveSelectedMemoryAgentId("missing", ["agent-a", "agent-b"]),
    ).toBe("agent-a");
  });

  it("returns an empty string when no agents are available", () => {
    expect(resolveSelectedMemoryAgentId("anything", [])).toBe("");
  });
});

describe("canLoadLocalTimeline", () => {
  it("allows timeline loading only when access mode is local_workspace", () => {
    expect(
      canLoadLocalTimeline({
        agentId: "main",
        workspace: "~/.openclaw/workspace-main",
        mode: "local_workspace",
        reason: "workspace_local_and_readable",
      }),
    ).toBe(true);

    expect(
      canLoadLocalTimeline({
        agentId: "main",
        workspace: "~/.openclaw/workspace-main",
        mode: "remote_probe",
        reason: "workspace_remote_or_not_readable",
      }),
    ).toBe(false);

    expect(
      canLoadLocalTimeline({
        agentId: "main",
        workspace: "",
        mode: "unavailable",
        reason: "workspace_missing",
      }),
    ).toBe(false);
  });
});

describe("collectTextSearchMatches", () => {
  it("finds case-insensitive non-overlapping matches", () => {
    expect(
      collectTextSearchMatches("Memory memory MEM", "mem"),
    ).toEqual([
      { start: 0, end: 3 },
      { start: 7, end: 10 },
      { start: 14, end: 17 },
    ]);
  });

  it("returns an empty array when text or query is empty", () => {
    expect(collectTextSearchMatches("", "abc")).toEqual([]);
    expect(collectTextSearchMatches("abc", "")).toEqual([]);
  });
});

describe("resolveDocumentSearchQueryFromSearchResult", () => {
  it("prefers the executed search query over snippet-derived fallback", () => {
    expect(
      resolveDocumentSearchQueryFromSearchResult("exact query", "### heading exact query"),
    ).toBe("exact query");
  });

  it("falls back to snippet parsing when the executed query is empty", () => {
    expect(
      resolveDocumentSearchQueryFromSearchResult("", "### heading useful-token"),
    ).toBe("heading");
  });
});

describe("moveActiveSearchMatchIndex", () => {
  it("wraps forward and backward across the match list", () => {
    expect(moveActiveSearchMatchIndex(0, 3, 1)).toBe(1);
    expect(moveActiveSearchMatchIndex(2, 3, 1)).toBe(0);
    expect(moveActiveSearchMatchIndex(0, 3, -1)).toBe(2);
  });

  it("returns -1 when there are no matches", () => {
    expect(moveActiveSearchMatchIndex(0, 0, 1)).toBe(-1);
  });
});

describe("resolveInitialSearchMatchIndex", () => {
  it("starts from the first match when results exist", () => {
    expect(resolveInitialSearchMatchIndex(3)).toBe(0);
  });

  it("returns -1 when there are no matches", () => {
    expect(resolveInitialSearchMatchIndex(0)).toBe(-1);
  });
});

describe("clampActiveSearchMatchIndex", () => {
  it("keeps an in-range index unchanged", () => {
    expect(clampActiveSearchMatchIndex(1, 3)).toBe(1);
  });

  it("clamps missing or overflow indexes into the available range", () => {
    expect(clampActiveSearchMatchIndex(-1, 3)).toBe(0);
    expect(clampActiveSearchMatchIndex(9, 3)).toBe(2);
  });

  it("returns -1 when there are no matches", () => {
    expect(clampActiveSearchMatchIndex(2, 0)).toBe(-1);
  });
});

describe("resolveMemorySearchTarget", () => {
  it("uses root memory content in the documents section", () => {
    expect(
      resolveMemorySearchTarget({
        activeSection: "documents",
        documentName: "MEMORY.md",
        documentText: "Project memory",
        timelineEntryName: "memory/2026-03-27.md",
        timelineText: "Daily footprint",
      }),
    ).toEqual({
      enabled: true,
      scope: "documents",
      text: "Project memory",
      selectionKey: "documents:MEMORY.md",
    });
  });

  it("uses timeline content in the footprints section", () => {
    expect(
      resolveMemorySearchTarget({
        activeSection: "footprints",
        documentName: "MEMORY.md",
        documentText: "Project memory",
        timelineEntryName: "memory/2026-03-27.md",
        timelineText: "Daily footprint",
      }),
    ).toEqual({
      enabled: true,
      scope: "footprints",
      text: "Daily footprint",
      selectionKey: "footprints:memory/2026-03-27.md",
    });
  });

  it("disables search in sections without a readable document surface", () => {
    expect(
      resolveMemorySearchTarget({
        activeSection: "overview",
        documentName: "MEMORY.md",
        documentText: "Project memory",
        timelineEntryName: "memory/2026-03-27.md",
        timelineText: "Daily footprint",
      }),
    ).toEqual({
      enabled: false,
      scope: null,
      text: "",
      selectionKey: "",
    });
  });
});

describe("buildHighlightedTextSegments", () => {
  it("splits text into plain and highlighted segments", () => {
    expect(
      buildHighlightedTextSegments("abc def ghi", [
        { start: 4, end: 7 },
      ]),
    ).toEqual([
      { text: "abc ", matchIndex: null },
      { text: "def", matchIndex: 0 },
      { text: " ghi", matchIndex: null },
    ]);
  });
});

describe("resolveExternalMemorySources", () => {
  it("normalizes extra paths and qmd paths into read-only source items", () => {
    expect(
      resolveExternalMemorySources({
        memorySearchEnabled: true,
        backend: "qmd",
        provider: "openai",
        embeddingModel: "text-embedding-3-large",
        builtinStorePath: "~/.openclaw/memory/main.sqlite",
        sources: ["memory", "sessions"],
        extraPaths: ["../team-docs"],
        sessionMemoryEnabled: true,
        qmdActive: true,
        qmdHome: "~/.openclaw/agents/main/qmd/",
        qmdPaths: ["../shared-kb"],
        qmdSessionsEnabled: true,
      }),
    ).toEqual([
      {
        id: "extra_path:../team-docs",
        kind: "extra_path",
        value: "../team-docs",
      },
      {
        id: "qmd_path:../shared-kb",
        kind: "qmd_path",
        value: "../shared-kb",
      },
    ]);
  });

  it("deduplicates repeated source paths", () => {
    expect(
      resolveExternalMemorySources({
        memorySearchEnabled: true,
        backend: "builtin",
        provider: null,
        embeddingModel: null,
        builtinStorePath: "~/.openclaw/memory/main.sqlite",
        sources: ["memory"],
        extraPaths: ["../team-docs", "../team-docs"],
        sessionMemoryEnabled: false,
        qmdActive: false,
        qmdHome: null,
        qmdPaths: ["../team-docs"],
        qmdSessionsEnabled: false,
      }),
    ).toEqual([
      {
        id: "extra_path:../team-docs",
        kind: "extra_path",
        value: "../team-docs",
      },
      {
        id: "qmd_path:../team-docs",
        kind: "qmd_path",
        value: "../team-docs",
      },
    ]);
  });
});

describe("canEditMemory", () => {
  it("allows editing when operator.admin is granted", () => {
    expect(canEditMemory(["operator.read", "operator.admin"])).toBe(true);
  });

  it("blocks editing when operator.admin is missing", () => {
    expect(canEditMemory(["operator.read"])).toBe(false);
  });
});

describe("resolveMemoryDocumentContent", () => {
  it("returns an empty string when the document is missing", () => {
    expect(
      resolveMemoryDocumentContent({
        name: "MEMORY.md",
        path: "~/.openclaw/workspace-main/MEMORY.md",
        missing: true,
        content: null,
      }),
    ).toBe("");
  });

  it("returns the file content when the document exists", () => {
    expect(
      resolveMemoryDocumentContent({
        name: "MEMORY.md",
        path: "~/.openclaw/workspace-main/MEMORY.md",
        missing: false,
        content: "# Memory\n- item",
      }),
    ).toBe("# Memory\n- item");
  });
});

describe("resolveSelectedMemoryDocumentName", () => {
  const documents = [
    {
      name: "MEMORY.md",
      path: "~/.openclaw/workspace-main/MEMORY.md",
      missing: false,
      content: "# Memory",
    },
    {
      name: "memory.md",
      path: "~/.openclaw/workspace-main/memory.md",
      missing: false,
      content: "# Legacy",
    },
  ];

  it("keeps the currently selected root memory document when it still exists", () => {
    expect(resolveSelectedMemoryDocumentName("memory.md", documents)).toBe(
      "memory.md",
    );
  });

  it("falls back to MEMORY.md when the current selection is missing", () => {
    expect(resolveSelectedMemoryDocumentName("missing.md", documents)).toBe(
      "MEMORY.md",
    );
  });

  it("returns an empty string when no root memory documents are available", () => {
    expect(resolveSelectedMemoryDocumentName("MEMORY.md", [])).toBe("");
  });
});

describe("resolveMemoryRootDocument", () => {
  const documents = [
    {
      name: "MEMORY.md",
      path: "~/.openclaw/workspace-main/MEMORY.md",
      missing: false,
      content: "# Primary",
    },
    {
      name: "memory.md",
      path: "~/.openclaw/workspace-main/memory.md",
      missing: true,
      content: null,
    },
  ];

  it("returns the selected root memory document when present", () => {
    expect(resolveMemoryRootDocument(documents, "memory.md")?.path).toBe(
      "~/.openclaw/workspace-main/memory.md",
    );
  });

  it("falls back to the first available root memory document when selection is empty", () => {
    expect(resolveMemoryRootDocument(documents, "")?.name).toBe("MEMORY.md");
  });
});

describe("hasSharedWorkspaceMemory", () => {
  it("returns true when another agent shares the resolved workspace", () => {
    expect(
      hasSharedWorkspaceMemory([
        { id: "writer", name: "Writer" },
        { id: "research", name: "Research" },
      ]),
    ).toBe(true);
  });

  it("returns false when the selected workspace is not shared", () => {
    expect(hasSharedWorkspaceMemory([])).toBe(false);
  });
});

describe("resolveSelectedTimelineEntryName", () => {
  const result: GatewayAgentMemoryTimelineResult = {
    agentId: "main",
    workspace: "~/.openclaw/workspace-main",
    source: "local_workspace",
    entries: [
      {
        name: "memory/2026-03-27.md",
        path: "~/.openclaw/workspace-main/memory/2026-03-27.md",
        missing: false,
      },
      {
        name: "memory/2026-03-26.md",
        path: "~/.openclaw/workspace-main/memory/2026-03-26.md",
        missing: false,
      },
    ],
    diagnostics: {
      gatewayVisibleFilesCount: 2,
      gatewayVisibleRootDocsCount: 0,
      gatewayVisibleDailyCount: 2,
      gatewayOnlyReturnedRootDocs: false,
      localScanDirectory: "~/.openclaw/workspace-main/memory",
      localScanFilesCount: 2,
      localScanSkippedCount: 0,
    },
  };

  it("keeps the selected timeline entry when it still exists", () => {
    expect(
      resolveSelectedTimelineEntryName("memory/2026-03-26.md", result),
    ).toBe("memory/2026-03-26.md");
  });

  it("falls back to the latest listed entry when current selection is missing", () => {
    expect(resolveSelectedTimelineEntryName("missing", result)).toBe(
      "memory/2026-03-27.md",
    );
  });

  it("returns an empty string when no timeline entries are available", () => {
    expect(
      resolveSelectedTimelineEntryName("", {
        agentId: "main",
        workspace: "~/.openclaw/workspace-main",
        source: "unavailable",
        entries: [],
        diagnostics: {
          gatewayVisibleFilesCount: 0,
          gatewayVisibleRootDocsCount: 0,
          gatewayVisibleDailyCount: 0,
          gatewayOnlyReturnedRootDocs: false,
          localScanDirectory: null,
          localScanFilesCount: 0,
          localScanSkippedCount: 0,
        },
      }),
    ).toBe("");
  });
});

describe("resolveTimelineProbeRangePreset", () => {
  it("builds a 7-day inclusive default probe window ending on the reference day", () => {
    expect(resolveTimelineProbeRangePreset("2026-03-28")).toEqual({
      startDate: "2026-03-22",
      endDate: "2026-03-28",
    });
  });
});

describe("hasTimelineProbeRangeChanged", () => {
  it("detects start or end date updates", () => {
    expect(
      hasTimelineProbeRangeChanged(
        { startDate: "2026-04-01", endDate: "2026-04-07" },
        { startDate: "2026-04-02", endDate: "2026-04-07" },
      ),
    ).toBe(true);
    expect(
      hasTimelineProbeRangeChanged(
        { startDate: "2026-04-01", endDate: "2026-04-07" },
        { startDate: "2026-04-01", endDate: "2026-04-08" },
      ),
    ).toBe(true);
    expect(
      hasTimelineProbeRangeChanged(
        { startDate: "2026-04-01", endDate: "2026-04-07" },
        { startDate: "2026-04-01", endDate: "2026-04-07" },
      ),
    ).toBe(false);
  });
});

describe("resolveTimelineProbeRangeError", () => {
  it("returns null for a valid canonical range", () => {
    expect(
      resolveTimelineProbeRangeError({
        startDate: "2026-03-22",
        endDate: "2026-03-28",
      }),
    ).toBeNull();
  });

  it("rejects malformed dates", () => {
    expect(
      resolveTimelineProbeRangeError({
        startDate: "2026-03",
        endDate: "2026-03-28",
      }),
    ).toBe("invalid_format");
  });

  it("rejects reversed date ranges", () => {
    expect(
      resolveTimelineProbeRangeError({
        startDate: "2026-03-29",
        endDate: "2026-03-28",
      }),
    ).toBe("start_after_end");
  });

  it("rejects oversized probe windows", () => {
    expect(
      resolveTimelineProbeRangeError({
        startDate: "2026-02-01",
        endDate: "2026-03-28",
      }),
    ).toBe("range_too_large");
  });
});

describe("resolveTimelineEntryDateLabel", () => {
  it("extracts the date portion from a daily memory path", () => {
    expect(resolveTimelineEntryDateLabel("memory/2026-03-27.md")).toBe(
      "2026-03-27",
    );
  });
});

describe("buildMemoryFootprintGroups", () => {
  it("groups timeline entries by resolved date label", () => {
    expect(
      buildMemoryFootprintGroups([
        {
          name: "memory/2026-03-27.md",
          path: "~/.openclaw/workspace-main/memory/2026-03-27.md",
          missing: false,
          updatedAtMs: 100,
          size: 1200,
        },
        {
          name: "memory/2026-03-27-session.md",
          path: "~/.openclaw/workspace-main/memory/2026-03-27-session.md",
          missing: false,
          updatedAtMs: 240,
          size: 600,
        },
        {
          name: "memory/2026-03-26.md",
          path: "~/.openclaw/workspace-main/memory/2026-03-26.md",
          missing: false,
          updatedAtMs: 80,
          size: 300,
        },
      ]),
    ).toEqual([
      {
        id: "2026-03-27",
        dateLabel: "2026-03-27",
        entries: [
          {
            name: "memory/2026-03-27.md",
            path: "~/.openclaw/workspace-main/memory/2026-03-27.md",
            missing: false,
            updatedAtMs: 100,
            size: 1200,
          },
          {
            name: "memory/2026-03-27-session.md",
            path: "~/.openclaw/workspace-main/memory/2026-03-27-session.md",
            missing: false,
            updatedAtMs: 240,
            size: 600,
          },
        ],
        latestUpdatedAtMs: 240,
        totalSize: 1800,
      },
      {
        id: "2026-03-26",
        dateLabel: "2026-03-26",
        entries: [
          {
            name: "memory/2026-03-26.md",
            path: "~/.openclaw/workspace-main/memory/2026-03-26.md",
            missing: false,
            updatedAtMs: 80,
            size: 300,
          },
        ],
        latestUpdatedAtMs: 80,
        totalSize: 300,
      },
    ]);
  });

  it("returns an empty list when there are no timeline entries", () => {
    expect(buildMemoryFootprintGroups([])).toEqual([]);
  });

  it("includes probe-only days so missing and failed dates still appear on the timeline", () => {
    expect(
      buildMemoryFootprintGroups(
        [
          {
            name: "memory/2026-03-27.md",
            path: "~/.openclaw/workspace-main/memory/2026-03-27.md",
            missing: false,
            updatedAtMs: 100,
            size: 1200,
          },
        ],
        [
          {
            date: "2026-03-27",
            name: "memory/2026-03-27.md",
            status: "hit",
            retried: false,
            recoveredAfterRetry: false,
          },
          {
            date: "2026-03-26",
            name: "memory/2026-03-26.md",
            status: "timeout",
            retried: true,
            recoveredAfterRetry: false,
            errorMessage: "timed out waiting for remote memory probe run",
          },
          {
            date: "2026-03-25",
            name: "memory/2026-03-25.md",
            status: "miss",
            retried: false,
            recoveredAfterRetry: false,
          },
        ],
      ),
    ).toEqual([
      {
        id: "2026-03-27",
        dateLabel: "2026-03-27",
        entries: [
          {
            name: "memory/2026-03-27.md",
            path: "~/.openclaw/workspace-main/memory/2026-03-27.md",
            missing: false,
            updatedAtMs: 100,
            size: 1200,
          },
        ],
        latestUpdatedAtMs: 100,
        totalSize: 1200,
        probeDay: {
          date: "2026-03-27",
          name: "memory/2026-03-27.md",
          status: "hit",
          retried: false,
          recoveredAfterRetry: false,
        },
      },
      {
        id: "2026-03-26",
        dateLabel: "2026-03-26",
        entries: [],
        latestUpdatedAtMs: null,
        totalSize: 0,
        probeDay: {
          date: "2026-03-26",
          name: "memory/2026-03-26.md",
          status: "timeout",
          retried: true,
          recoveredAfterRetry: false,
          errorMessage: "timed out waiting for remote memory probe run",
        },
      },
      {
        id: "2026-03-25",
        dateLabel: "2026-03-25",
        entries: [],
        latestUpdatedAtMs: null,
        totalSize: 0,
        probeDay: {
          date: "2026-03-25",
          name: "memory/2026-03-25.md",
          status: "miss",
          retried: false,
          recoveredAfterRetry: false,
        },
      },
    ]);
  });
});

describe("timeline footprint filtering", () => {
  const groups = buildMemoryFootprintGroups(
    [
      {
        name: "memory/2026-03-27.md",
        path: "~/.openclaw/workspace-main/memory/2026-03-27.md",
        missing: false,
        updatedAtMs: 100,
        size: 1200,
      },
      {
        name: "memory/2026-03-24.md",
        path: "~/.openclaw/workspace-main/memory/2026-03-24.md",
        missing: false,
        updatedAtMs: 80,
        size: 320,
      },
    ],
    [
      {
        date: "2026-03-27",
        name: "memory/2026-03-27.md",
        status: "hit",
        retried: false,
        recoveredAfterRetry: false,
      },
      {
        date: "2026-03-26",
        name: "memory/2026-03-26.md",
        status: "timeout",
        retried: true,
        recoveredAfterRetry: false,
      },
      {
        date: "2026-03-25",
        name: "memory/2026-03-25.md",
        status: "hit",
        retried: true,
        recoveredAfterRetry: true,
      },
      {
        date: "2026-03-24",
        name: "memory/2026-03-24.md",
        status: "miss",
        retried: false,
        recoveredAfterRetry: false,
      },
    ],
  );

  it("summarizes counts for each focus filter", () => {
    expect(summarizeMemoryFootprintGroups(groups)).toEqual({
      all: 4,
      failures: 1,
      recovered: 1,
      readable: 2,
      missing: 1,
    });
  });

  it("filters groups by focus state", () => {
    expect(
      filterMemoryFootprintGroups(groups, "failures").map((group) => group.id),
    ).toEqual(["2026-03-26"]);

    expect(
      filterMemoryFootprintGroups(groups, "recovered").map((group) => group.id),
    ).toEqual(["2026-03-25"]);

    expect(
      filterMemoryFootprintGroups(groups, "readable").map((group) => group.id),
    ).toEqual(["2026-03-27", "2026-03-25"]);

    expect(
      filterMemoryFootprintGroups(groups, "missing").map((group) => group.id),
    ).toEqual(["2026-03-24"]);
  });

  it("resolves the first previewable entry name from filtered groups", () => {
    expect(resolveFirstTimelineEntryNameFromGroups(groups)).toBe(
      "memory/2026-03-27.md",
    );
    expect(
      resolveFirstTimelineEntryNameFromGroups(
        filterMemoryFootprintGroups(groups, "failures"),
      ),
    ).toBe("");
    expect(
      resolveFirstTimelineEntryNameFromGroups(
        filterMemoryFootprintGroups(groups, "missing"),
      ),
    ).toBe("memory/2026-03-24.md");
  });
});

describe("isMemoryDocumentDirty", () => {
  it("returns false when the draft matches the loaded content", () => {
    expect(isMemoryDocumentDirty("# Memory", "# Memory")).toBe(false);
  });

  it("returns true when the draft differs from the loaded content", () => {
    expect(isMemoryDocumentDirty("# Memory", "# Memory\n- new item")).toBe(
      true,
    );
  });
});

describe("canReloadMemoryDocument", () => {
  it("allows reload when an agent is selected and no request is in flight", () => {
    expect(
      canReloadMemoryDocument({
        selectedAgentId: "main",
        isLoading: false,
        isSaving: false,
      }),
    ).toBe(true);
  });

  it("blocks reload while loading or saving", () => {
    expect(
      canReloadMemoryDocument({
        selectedAgentId: "main",
        isLoading: true,
        isSaving: false,
      }),
    ).toBe(false);
    expect(
      canReloadMemoryDocument({
        selectedAgentId: "main",
        isLoading: false,
        isSaving: true,
      }),
    ).toBe(false);
  });
});

describe("canSaveMemoryDocument", () => {
  it("allows save only when the document is dirty and editable", () => {
    expect(
      canSaveMemoryDocument({
        selectedAgentId: "main",
        isLoading: false,
        isSaving: false,
        canEdit: true,
        isDirty: true,
      }),
    ).toBe(true);
  });

  it("blocks save when there is no dirty change", () => {
    expect(
      canSaveMemoryDocument({
        selectedAgentId: "main",
        isLoading: false,
        isSaving: false,
        canEdit: true,
        isDirty: false,
      }),
    ).toBe(false);
  });

  it("blocks save when editing is not allowed or a request is in flight", () => {
    expect(
      canSaveMemoryDocument({
        selectedAgentId: "main",
        isLoading: false,
        isSaving: false,
        canEdit: false,
        isDirty: true,
      }),
    ).toBe(false);
    expect(
      canSaveMemoryDocument({
        selectedAgentId: "main",
        isLoading: true,
        isSaving: false,
        canEdit: true,
        isDirty: true,
      }),
    ).toBe(false);
    expect(
      canSaveMemoryDocument({
        selectedAgentId: "main",
        isLoading: false,
        isSaving: true,
        canEdit: true,
        isDirty: true,
      }),
    ).toBe(false);
  });
});
