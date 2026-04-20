// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../../contexts/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string, ...args: (string | number)[]) =>
      args.length ? `${key}:${args.join(",")}` : key,
  }),
}));

const openClawState = {
  nodes: [
    {
      id: "gateway:http://127.0.0.1:3100",
      name: "OpenClaw Local",
      status: "online" as const,
      sessionId: "session-local",
      origin: "http://127.0.0.1:3100",
      grantedScopes: ["operator.admin"],
      isActive: true,
    },
  ],
  agents: [
    {
      id: "agent-main",
      name: "Main Agent",
      nodeId: "gateway:http://127.0.0.1:3100",
      status: "active" as const,
    },
  ],
  grantedScopes: ["operator.admin"],
  isConnected: true,
  connectedOrigin: "http://127.0.0.1:3100",
  setActiveSession: vi.fn(),
};

vi.mock("../../contexts/OpenClawContext", () => ({
  useOpenClaw: () => openClawState,
  gatewayAgentMemoryGet: vi.fn().mockResolvedValue({
    agentId: "agent-main",
    workspace: "workspace",
    documents: [
      {
        name: "MEMORY.md",
        path: "workspace/MEMORY.md",
        missing: false,
        content: "# Memory",
      },
    ],
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
  }),
  gatewayAgentMemorySet: vi.fn(),
  gatewayAgentMemoryIndex: vi.fn(),
  gatewayAgentFileRead: vi.fn(),
  gatewayAgentMemorySearch: vi.fn(),
  gatewayAgentMemoryRuntimeStatus: vi.fn().mockResolvedValue({
    agentId: "agent-main",
    embeddingOk: true,
    vectorOk: true,
    status: {
      backend: "builtin",
      files: 0,
      totalFiles: 0,
      chunks: 0,
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
  }),
  gatewayAgentMemoryStatus: vi.fn().mockResolvedValue(null),
  gatewayAgentMemoryTimelineAccessResolve: vi.fn().mockResolvedValue({
    agentId: "agent-main",
    workspace: "workspace",
    mode: "local_workspace",
    reason: "workspace_local_and_readable",
  }),
  gatewayAgentMemoryTimelineEntryRead: vi.fn().mockResolvedValue({
    agentId: "agent-main",
    workspace: "workspace",
    file: {
      name: "memory/2026-04-20.md",
      path: "workspace/memory/2026-04-20.md",
      missing: false,
      content: "",
    },
  }),
  gatewayAgentMemoryTimelineGet: vi.fn().mockResolvedValue({
    agentId: "agent-main",
    workspace: "workspace",
    source: "local_workspace",
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
    probe: null,
  }),
  gatewayAgentMemoryTimelineLocalScan: vi.fn().mockResolvedValue({
    agentId: "agent-main",
    workspace: "workspace",
    source: "local_workspace",
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
    probe: null,
  }),
  gatewayAgentMemoryTimelineRemoteProbeDates: vi.fn(),
  gatewayAgentMemoryTimelineRemoteProbe: vi.fn(),
}));

vi.mock("./memoryKnowledgeActions", () => ({
  runExternalKnowledgeReindex: vi.fn(
    () => new Promise(() => undefined),
  ),
}));

vi.mock("./MemoryDiagnosticsDrawer", () => ({
  MemoryDiagnosticsDrawer: () => null,
}));
vi.mock("./MemorySearchPanel", () => ({
  MemorySearchPanel: () => <div>search-panel</div>,
}));
vi.mock("./MemoryFootprintsPanel", () => ({
  MemoryFootprintsPanel: () => <div>footprints-panel</div>,
}));
vi.mock("./MemoryResourcesPanel", () => ({
  MemoryResourcesPanel: () => <div>resources-panel</div>,
}));
vi.mock("./MemoryDocumentsDesktop", () => ({
  MemoryDocumentsDesktop: () => <div>documents-desktop</div>,
}));
vi.mock("./MemoryDocumentsMobile", () => ({
  MemoryDocumentsMobile: () => <div>documents-mobile</div>,
}));
vi.mock("./MemoryKnowledgePanel", () => ({
  MemoryKnowledgePanel: ({
    reindexActivity,
    onRunReindex,
  }: {
    reindexActivity: { phase: string } | null;
    onRunReindex: () => Promise<void>;
  }) => (
    <div>
      <button onClick={() => void onRunReindex()}>start-reindex</button>
      <div>{`task-phase:${reindexActivity?.phase ?? "none"}`}</div>
    </div>
  ),
}));

import { MemoryView } from "./MemoryView";

describe("MemoryView reindex persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps lifted reindex state after switching away from knowledge and back", async () => {
    render(<MemoryView />);
    const user = userEvent.setup();

    await user.click(await screen.findByText("memory.tab.knowledge"));
    await user.click(screen.getByText("start-reindex"));

    await waitFor(() => {
      expect(screen.getByText(/task-phase:(starting|running|syncing)/)).toBeTruthy();
    });

    await user.click(screen.getByText("memory.tab.documents"));
    expect(screen.getByText("documents-desktop")).toBeTruthy();

    await user.click(screen.getByText("memory.tab.knowledge"));

    await waitFor(() => {
      expect(screen.getByText(/task-phase:(starting|running|syncing)/)).toBeTruthy();
    });
  });
});
