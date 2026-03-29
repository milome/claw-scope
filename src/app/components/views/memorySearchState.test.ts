import { describe, expect, it } from "vitest";

import {
  canRunSemanticMemorySearch,
  resolveSemanticMemorySearchGroup,
  resolveSemanticMemorySearchOpenTarget,
  resolveSemanticMemorySearchSourceKind,
  sortSemanticMemorySearchGroups,
} from "./memorySearchState";

describe("resolveSemanticMemorySearchSourceKind", () => {
  it("classifies root memory files", () => {
    expect(
      resolveSemanticMemorySearchSourceKind(
        "~/.openclaw/workspace-main/MEMORY.md",
      ),
    ).toBe("root_memory");
    expect(
      resolveSemanticMemorySearchSourceKind(
        "~/.openclaw/workspace-main/memory.md",
      ),
    ).toBe("root_memory");
  });

  it("classifies canonical daily memory files", () => {
    expect(
      resolveSemanticMemorySearchSourceKind(
        "~/.openclaw/workspace-main/memory/2026-03-28.md",
      ),
    ).toBe("daily_memory");
  });

  it("classifies session transcript paths separately", () => {
    expect(
      resolveSemanticMemorySearchSourceKind(
        "~/.openclaw/agents/main/sessions/2026-03-28-run.jsonl",
      ),
    ).toBe("session_transcript");
  });
});

describe("resolveSemanticMemorySearchOpenTarget", () => {
  it("routes root memory hits back to the documents surface", () => {
    expect(
      resolveSemanticMemorySearchOpenTarget(
        "~/.openclaw/workspace-main/MEMORY.md",
      ),
    ).toBe("documents");
  });

  it("routes canonical daily memory hits back to footprints", () => {
    expect(
      resolveSemanticMemorySearchOpenTarget(
        "~/.openclaw/workspace-main/memory/2026-03-28.md",
      ),
    ).toBe("footprints");
  });

  it("routes non-canonical hits to the read-only detail sheet", () => {
    expect(
      resolveSemanticMemorySearchOpenTarget(
        "~/.openclaw/agents/main/sessions/2026-03-28-run.jsonl",
      ),
    ).toBe("detail_sheet");
  });
});

describe("canRunSemanticMemorySearch", () => {
  it("allows submit only when the query is non-empty and not already searching", () => {
    expect(canRunSemanticMemorySearch("memory search", false)).toBe(true);
    expect(canRunSemanticMemorySearch("   ", false)).toBe(false);
    expect(canRunSemanticMemorySearch("memory search", true)).toBe(false);
  });
});

describe("resolveSemanticMemorySearchGroup", () => {
  it("groups document-like sources under documents", () => {
    expect(resolveSemanticMemorySearchGroup("root_memory")).toBe("documents");
    expect(resolveSemanticMemorySearchGroup("workspace_markdown")).toBe(
      "documents",
    );
    expect(resolveSemanticMemorySearchGroup("extra_path")).toBe("documents");
  });

  it("separates timeline and sessions sources", () => {
    expect(resolveSemanticMemorySearchGroup("daily_memory")).toBe("timeline");
    expect(resolveSemanticMemorySearchGroup("session_transcript")).toBe(
      "sessions",
    );
  });

  it("keeps unknown sources in other", () => {
    expect(resolveSemanticMemorySearchGroup("unknown")).toBe("other");
  });
});

describe("sortSemanticMemorySearchGroups", () => {
  it("keeps all first and sorts the rest by descending count", () => {
    expect(
      sortSemanticMemorySearchGroups({
        all: 9,
        documents: 2,
        timeline: 4,
        sessions: 1,
        other: 3,
      }),
    ).toEqual(["all", "timeline", "other", "documents", "sessions"]);
  });

  it("uses stable fallback order when counts tie", () => {
    expect(
      sortSemanticMemorySearchGroups(
        {
          all: 6,
          documents: 2,
          timeline: 2,
          sessions: 2,
          other: 2,
        },
        { includeAll: false },
      ),
    ).toEqual(["documents", "timeline", "sessions", "other"]);
  });
});
