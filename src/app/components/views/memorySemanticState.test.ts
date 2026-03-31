import { describe, expect, it } from "vitest";
import {
  buildSemanticMemoryEntries,
  buildSemanticMindMapModel,
  buildSnippet,
  collectKeywords,
  groupConceptsByKeywordOverlap,
  normalizeSemanticKeyword,
  normalizeWhitespace,
} from "./memorySemanticState";
import type { SemanticConcept } from "./memorySemanticTypes";

describe("memorySemanticState", () => {
  it("normalizes corpus entries and drops too-short content", () => {
    const entries = buildSemanticMemoryEntries({
      documents: [
        {
          name: "MEMORY.md",
          path: "/memory/MEMORY.md",
          content: "  Semantic   map   should derive from actual memory content instead of file paths.  ",
          missing: false,
          updatedAtMs: 20,
        },
        {
          name: "SHORT.md",
          path: "/memory/SHORT.md",
          content: "too short",
          missing: false,
          updatedAtMs: 10,
        },
      ],
      timelineEntries: [
        {
          name: "memory/2026-03-31.md",
          path: "/memory/2026-03-31.md",
          content: "Timeline content captures semantic clustering for diagnostics drawer and semantic search routing.",
          missing: false,
          updatedAtMs: 30,
        },
      ],
      agentId: "agent-1",
    });

    expect(entries).toHaveLength(2);
    expect(entries[0].sourceKind).toBe("timeline");
    expect(entries[1].text).toBe("Semantic map should derive from actual memory content instead of file paths.");
  });

  it("extracts keywords and strips obvious UI suffix noise", () => {
    const keywords = collectKeywords(
      "MemoryView panel keeps semantic search routing visible while diagnostics drawer and diagnostics status stay aligned.",
    );

    expect(keywords).toContain("diagnostics");
    expect(keywords).toContain("routing");
    expect(keywords).not.toContain("memoryview");
    expect(normalizeSemanticKeyword("DiagnosticsPanel")).toBe("diagnostics");
    expect(normalizeSemanticKeyword("search-view")).toBe("search");
  });

  it("groups concepts by shared normalized keyword", () => {
    const concepts: SemanticConcept[] = [
      {
        id: "c1",
        label: "Diagnostics",
        score: 4,
        keywords: ["diagnostics"],
        entryIds: ["e1", "e2"],
        evidence: [],
        explanation: "diag",
      },
      {
        id: "c2",
        label: "Diagnostics Drawer",
        score: 3,
        keywords: ["diagnostics"],
        entryIds: ["e2", "e3"],
        evidence: [],
        explanation: "diag drawer",
      },
      {
        id: "c3",
        label: "Routing",
        score: 2,
        keywords: ["routing"],
        entryIds: ["e3", "e4"],
        evidence: [],
        explanation: "routing",
      },
    ];

    const groups = groupConceptsByKeywordOverlap(concepts);
    expect(groups).toHaveLength(2);
    expect(groups[0].length).toBe(2);
  });

  it("builds clusters and related concepts from recurring memory text", () => {
    const model = buildSemanticMindMapModel([
      {
        id: "e1",
        title: "MEMORY.md",
        sourceKind: "document",
        agentId: "agent-1",
        timestamp: 10,
        text: normalizeWhitespace("Diagnostics drawer and semantic search routing need better evidence and diagnostics summaries."),
        path: "/memory/MEMORY.md",
      },
      {
        id: "e2",
        title: "2026-03-31.md",
        sourceKind: "timeline",
        agentId: "agent-1",
        timestamp: 20,
        text: normalizeWhitespace("Semantic search routing and diagnostics drawer both recur in the current memory narrative."),
        path: "/memory/2026-03-31.md",
      },
      {
        id: "e3",
        title: "2026-03-30.md",
        sourceKind: "timeline",
        agentId: "agent-1",
        timestamp: 30,
        text: normalizeWhitespace("Diagnostics health checks and routing issues both affect search quality and evidence clarity."),
        path: "/memory/2026-03-30.md",
      },
    ]);

    expect(model.concepts.length).toBeGreaterThan(0);
    expect(model.clusters.length).toBeGreaterThan(0);
    expect(model.edges.some((edge) => edge.kind === "contains")).toBe(true);
  });

  it("attaches bounded evidence snippets with tightened clipping", () => {
    const snippet = buildSnippet(
      "This semantic memory map should keep the diagnostics drawer evidence visible while clipping noisy unrelated trailing content for readability in the side pane.",
      ["diagnostics"],
    );

    expect(snippet.toLowerCase()).toContain("diagnostics");
    expect(snippet.length).toBeLessThanOrEqual(130);

    const model = buildSemanticMindMapModel([
      {
        id: "e1",
        title: "MEMORY.md",
        sourceKind: "document",
        agentId: "agent-1",
        timestamp: 10,
        text: normalizeWhitespace("Diagnostics drawer diagnostics drawer diagnostics drawer diagnostics drawer with semantic routing evidence."),
        path: "/memory/MEMORY.md",
      },
      {
        id: "e2",
        title: "2026-03-31.md",
        sourceKind: "timeline",
        agentId: "agent-1",
        timestamp: 20,
        text: normalizeWhitespace("Diagnostics drawer also appears in timeline evidence with routing context."),
        path: "/memory/2026-03-31.md",
      },
    ]);

    expect(model.concepts.every((concept) => concept.evidence.length <= 4)).toBe(true);
    expect(model.clusters.every((cluster) => cluster.evidence.length <= 6)).toBe(true);
  });
});
