import { describe, expect, it } from "vitest";

import {
  buildMemoryNodeEntries,
  isLocalNodeOrigin,
  resolveMemorySessionIdToActivate,
  resolveSelectedMemoryAgentIdForNode,
  resolveSelectedMemoryNodeId,
} from "./memoryNodeState";

describe("memoryNodeState", () => {
  const nodes = [
    {
      id: "gateway:http://127.0.0.1:3100",
      name: "OpenClaw Local",
      status: "online" as const,
      sessionId: "session-local",
      origin: "http://127.0.0.1:3100",
      grantedScopes: ["operator.admin"],
      isActive: true,
    },
    {
      id: "gateway:http://192.168.1.8:3100",
      name: "OpenClaw 192.168.1.8:3100",
      status: "online" as const,
      sessionId: "session-lan",
      origin: "http://192.168.1.8:3100",
      grantedScopes: ["operator.read"],
      isActive: false,
    },
  ];

  const agents = [
    {
      id: "agent-alpha",
      name: "Alpha",
      nodeId: "gateway:http://127.0.0.1:3100",
      status: "active" as const,
    },
    {
      id: "agent-beta",
      name: "Beta",
      nodeId: "gateway:http://127.0.0.1:3100",
      status: "standby" as const,
    },
  ];

  it("keeps visible nodes even when a node has no current agent roster", () => {
    const entries = buildMemoryNodeEntries({
      isConnected: true,
      nodes,
      agents,
    });

    expect(entries).toHaveLength(2);
    expect(entries[1]?.id).toBe("gateway:http://192.168.1.8:3100");
    expect(entries[1]?.agents).toHaveLength(0);
  });

  it("falls back to the first node with agents when current node is missing", () => {
    const entries = buildMemoryNodeEntries({
      isConnected: true,
      nodes,
      agents,
    });

    expect(resolveSelectedMemoryNodeId("missing", entries)).toBe(
      "gateway:http://127.0.0.1:3100",
    );
  });

  it("returns empty agent id when selected node has no agents", () => {
    const entries = buildMemoryNodeEntries({
      isConnected: true,
      nodes,
      agents,
    });

    expect(
      resolveSelectedMemoryAgentIdForNode(
        "agent-alpha",
        "gateway:http://192.168.1.8:3100",
        entries,
      ),
    ).toBe("");
  });

  it("returns a session to activate only for inactive nodes with a session", () => {
    const entries = buildMemoryNodeEntries({
      isConnected: true,
      nodes,
      agents,
    });

    expect(
      resolveMemorySessionIdToActivate(
        "gateway:http://192.168.1.8:3100",
        entries,
      ),
    ).toBe("session-lan");
    expect(
      resolveMemorySessionIdToActivate(
        "gateway:http://127.0.0.1:3100",
        entries,
      ),
    ).toBeNull();
  });

  it("detects loopback node origins", () => {
    expect(isLocalNodeOrigin("http://127.0.0.1:3100")).toBe(true);
    expect(isLocalNodeOrigin("ws://localhost:4100")).toBe(true);
    expect(isLocalNodeOrigin("http://192.168.1.8:3100")).toBe(false);
  });
});
