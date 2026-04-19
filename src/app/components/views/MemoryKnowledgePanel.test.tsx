// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cleanup } from "@testing-library/react";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./MemoryMindMapPanel", () => ({
  MemoryMindMapPanel: () => <div data-testid="mindmap-panel" />,
}));

vi.mock("./memoryKnowledgeActions", () => ({
  setExternalKnowledgePaths: vi.fn(),
  setExternalKnowledgeSources: vi.fn(),
  setSessionMemoryEnabled: vi.fn(),
}));

import { MemoryKnowledgePanel } from "./MemoryKnowledgePanel";
import {
  setExternalKnowledgePaths,
  setExternalKnowledgeSources,
  setSessionMemoryEnabled,
} from "./memoryKnowledgeActions";

function t(key: string, ...args: (string | number)[]) {
  return args.length ? `${key}:${args.join(",")}` : key;
}

const baseProps = {
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
      extraPaths: ["D:/shared/notes"],
      sessionMemoryEnabled: false,
      qmdActive: false,
      qmdHome: null,
      qmdPaths: [],
      qmdSessionsEnabled: false,
    },
  },
  memoryStatus: null,
  runtimeStatus: null,
  externalSources: [{ id: "extra:D:/shared/notes", kind: "extra_path" as const, value: "D:/shared/notes" }],
  isLocalGatewaySession: true,
  selectedAgentId: "agent-main",
  selectedNodeName: "OpenClaw Local",
  selectedSessionId: "session-local",
  model: {
    entries: [],
    concepts: [],
    clusters: [],
    nodes: [],
    edges: [],
  },
  t,
  showDebug: false,
  onToggleDebug: vi.fn(),
  onOpenEvidence: vi.fn(),
  openHint: null,
  onRefreshKnowledge: vi.fn().mockResolvedValue({
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
        extraPaths: ["D:/shared/notes"],
        sessionMemoryEnabled: false,
        qmdActive: false,
        qmdHome: null,
        qmdPaths: [],
        qmdSessionsEnabled: false,
      },
    },
    memoryStatus: null,
    runtimeStatus: null,
  }),
  onOpenDiagnostics: vi.fn(),
  reindexActivity: null,
  reindexDetailsExpanded: true,
  reindexFeedback: null,
  isReindexBusy: false,
  onToggleReindexDetails: vi.fn(),
  onRunReindex: vi.fn().mockResolvedValue(undefined),
  onRunAutoReindex: vi.fn().mockResolvedValue(undefined),
};

describe("MemoryKnowledgePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    cleanup();
  });

  it("disables write controls in remote read-only mode", () => {
    render(
      <MemoryKnowledgePanel
        {...baseProps}
        isLocalGatewaySession={false}
      />,
    );

    expect(screen.getByPlaceholderText("memory.knowledge.pathPlaceholder").hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("memory.knowledge.addPath").closest("button")?.hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByText("memory.knowledge.removePath")[0].closest("button")?.hasAttribute("disabled")).toBe(true);
  });

  it("enables session memory and auto-adds sessions source", async () => {
    vi.mocked(setSessionMemoryEnabled).mockResolvedValue({ kind: "set_session_memory", stdout: "ok" });
    vi.mocked(setExternalKnowledgeSources).mockResolvedValue({ kind: "set_sources", stdout: "ok" });

    render(<MemoryKnowledgePanel {...baseProps} />);
    const user = userEvent.setup();
    const toggles = screen.getAllByRole("checkbox");
    await user.click(toggles[0]!);

    await waitFor(() => {
      expect(setSessionMemoryEnabled).toHaveBeenCalledWith(true, t, "session-local");
      expect(setExternalKnowledgeSources).toHaveBeenCalledWith(["memory", "sessions"], t, "session-local");
      expect(baseProps.onRunAutoReindex).toHaveBeenCalled();
    });
  });

  it("asks for confirmation before removing extra path", async () => {
    vi.mocked(setExternalKnowledgePaths).mockResolvedValue({ kind: "set_extra_paths", stdout: "ok" });
    const user = userEvent.setup();

    render(<MemoryKnowledgePanel {...baseProps} />);
    await user.click(screen.getAllByText("memory.knowledge.removePath")[0]!);

    expect(globalThis.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(setExternalKnowledgePaths).toHaveBeenCalledWith([], t, "session-local");
      expect(baseProps.onRunAutoReindex).toHaveBeenCalled();
    });
  });

  it("renders lifted reindex activity state from parent props", () => {
    render(
      <MemoryKnowledgePanel
        {...baseProps}
        reindexActivity={{
          phase: "running",
          startedAtMs: Date.now() - 5000,
          finishedAtMs: null,
          polls: 2,
          afterCommandPolls: 0,
          lastPolledAtMs: Date.now() - 1000,
          before: {
            runtimeAvailable: true,
            files: 0,
            chunks: 0,
            dirty: true,
            runtimeMatchState: "missing",
            statusKey: "configured_only",
          },
          latest: {
            runtimeAvailable: true,
            files: 2,
            chunks: 8,
            dirty: true,
            runtimeMatchState: "partial",
            statusKey: "configured_stale",
          },
          commandStdout: null,
          syncIssue: null,
          progressObserved: true,
          entries: [],
        }}
        isReindexBusy
      />,
    );

    expect(screen.getByText("memory.knowledge.reindexLive.title")).toBeTruthy();
    expect(screen.getByText("memory.knowledge.reindexLive.taskbarTitle")).toBeTruthy();
  });

  it("shows retry and diagnostics actions after a reindex failure", async () => {
    render(
      <MemoryKnowledgePanel
        {...baseProps}
        reindexActivity={{
          phase: "failed",
          startedAtMs: Date.now() - 5000,
          finishedAtMs: Date.now(),
          polls: 3,
          afterCommandPolls: 1,
          lastPolledAtMs: Date.now(),
          before: {
            runtimeAvailable: true,
            files: 0,
            chunks: 0,
            dirty: true,
            runtimeMatchState: "missing",
            statusKey: "configured_only",
          },
          latest: {
            runtimeAvailable: true,
            files: 0,
            chunks: 0,
            dirty: true,
            runtimeMatchState: "missing",
            statusKey: "configured_only",
          },
          commandStdout: null,
          syncIssue: "boom",
          progressObserved: false,
          entries: [],
        }}
      />,
    );
    const user = userEvent.setup();

    expect(screen.getByText("memory.knowledge.reindexLive.retry")).toBeTruthy();
    expect(screen.getByText("memory.knowledge.reindexLive.openDiagnostics")).toBeTruthy();

    await user.click(screen.getByText("memory.knowledge.reindexLive.openDiagnostics"));

    expect(baseProps.onOpenDiagnostics).toHaveBeenCalled();
  });

  it("keeps only one persistent reindex error in the panel", async () => {
    render(
      <MemoryKnowledgePanel
        {...baseProps}
        reindexActivity={{
          phase: "failed",
          startedAtMs: Date.now() - 5000,
          finishedAtMs: Date.now(),
          polls: 3,
          afterCommandPolls: 1,
          lastPolledAtMs: Date.now(),
          before: {
            runtimeAvailable: true,
            files: 0,
            chunks: 0,
            dirty: true,
            runtimeMatchState: "missing",
            statusKey: "configured_only",
          },
          latest: {
            runtimeAvailable: true,
            files: 0,
            chunks: 0,
            dirty: true,
            runtimeMatchState: "missing",
            statusKey: "configured_only",
          },
          commandStdout: null,
          syncIssue: "boom",
          progressObserved: false,
          entries: [],
        }}
      />,
    );

    expect(screen.getAllByText(/boom/)).toHaveLength(1);
    expect(vi.mocked(toast.error)).toHaveBeenCalledTimes(0);
  });
});
