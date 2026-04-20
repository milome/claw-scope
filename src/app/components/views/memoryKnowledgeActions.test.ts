import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../contexts/OpenClawContext", () => ({
  gatewayAgentMemoryIndex: vi.fn(),
  gatewayConfigSetLocal: vi.fn(),
}));

import {
  runExternalKnowledgeReindex,
  setExternalKnowledgePaths,
  setExternalKnowledgeSources,
  setSessionMemoryEnabled,
} from "./memoryKnowledgeActions";
import {
  gatewayAgentMemoryIndex,
  gatewayConfigSetLocal,
} from "../../contexts/OpenClawContext";

const t = (key: string) => key;

describe("memoryKnowledgeActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wraps local-only config bridge errors with stable message", async () => {
    vi.mocked(gatewayConfigSetLocal).mockRejectedValueOnce(
      new Error("local-only config.set bridge for remote gateway sessions"),
    );

    await expect(setExternalKnowledgePaths(["D:/docs"], t)).rejects.toMatchObject({
      code: "local_only",
      message: "memory.knowledge.error.localOnly",
    });
  });

  it("writes sources through restricted action key", async () => {
    vi.mocked(gatewayConfigSetLocal).mockResolvedValueOnce({
      key: "agents.defaults.memorySearch.sources",
      value: '["memory","sessions"]',
      stdout: "ok",
    });

    const result = await setExternalKnowledgeSources(["memory", "sessions"], t);

    expect(gatewayConfigSetLocal).toHaveBeenCalledWith(
      "agents.defaults.memorySearch.sources",
      '["memory","sessions"]',
      undefined,
    );
    expect(result.stdout).toBe("ok");
  });

  it("writes session memory through restricted action key", async () => {
    vi.mocked(gatewayConfigSetLocal).mockResolvedValueOnce({
      key: "agents.defaults.memorySearch.experimental.sessionMemory",
      value: "true",
      stdout: "ok",
    });

    await setSessionMemoryEnabled(true, t);

    expect(gatewayConfigSetLocal).toHaveBeenCalledWith(
      "agents.defaults.memorySearch.experimental.sessionMemory",
      "true",
      undefined,
    );
  });

  it("coerces requested full reindex into incremental mode", async () => {
    vi.mocked(gatewayAgentMemoryIndex).mockResolvedValueOnce({
      agentId: "agent-main",
      forced: false,
      stdout: "reindexed",
    });

    const result = await runExternalKnowledgeReindex("agent-main", "full", t);

    expect(gatewayAgentMemoryIndex).toHaveBeenCalledWith("agent-main", false, undefined);
    expect(result.stdout).toBe("reindexed");
  });

  it("runs reindex incrementally when strategy is incremental", async () => {
    vi.mocked(gatewayAgentMemoryIndex).mockResolvedValueOnce({
      agentId: "agent-main",
      forced: false,
      stdout: "reindexed incremental",
    });

    const result = await runExternalKnowledgeReindex("agent-main", "incremental", t);

    expect(gatewayAgentMemoryIndex).toHaveBeenCalledWith("agent-main", false, undefined);
    expect(result.stdout).toBe("reindexed incremental");
  });
});
