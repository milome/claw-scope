import { describe, expect, it } from "vitest";

import type { Agent, Node } from "../../contexts/OpenClawContext";
import {
  buildEvolutionTargetNodeEntries,
  resolveSelectedEvolutionAgentId,
  resolveSelectedEvolutionNodeId,
} from "./evolutionTargetState";

const sampleNodes: Node[] = [
  { id: "node-local", name: "OpenClaw Local", status: "online" },
  { id: "node-west", name: "OpenClaw West", status: "offline" },
];

const sampleAgents: Agent[] = [
  { id: "agent-alpha", name: "Alpha", nodeId: "node-local", status: "active" },
  { id: "agent-beta", name: "Beta", nodeId: "node-local", status: "standby" },
  { id: "agent-gamma", name: "Gamma", nodeId: "node-west", status: "sleeping" },
];

describe("evolutionTargetState", () => {
  it("builds node entries from real multi-node agent topology", () => {
    const entries = buildEvolutionTargetNodeEntries({
      isConnected: true,
      nodes: sampleNodes,
      agents: sampleAgents,
    });

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.id)).toEqual(["node-local", "node-west"]);
    expect(entries[0]?.name).toBe("OpenClaw Local");
    expect(entries[0]?.agents.map((agent) => agent.id)).toEqual(["agent-alpha", "agent-beta"]);
    expect(entries[1]?.agents.map((agent) => agent.id)).toEqual(["agent-gamma"]);
  });

  it("derives missing node entries from agent node ids when runtime node list is absent", () => {
    const entries = buildEvolutionTargetNodeEntries({
      isConnected: true,
      nodes: [],
      agents: sampleAgents,
    });

    expect(entries.map((entry) => entry.id)).toEqual(["node-local", "node-west"]);
    expect(entries[0]?.agents.map((agent) => agent.id)).toEqual(["agent-alpha", "agent-beta"]);
    expect(entries[1]?.status).toBe("offline");
  });

  it("keeps a valid selected node id and otherwise falls back to the first available node", () => {
    const entries = buildEvolutionTargetNodeEntries({
      isConnected: true,
      nodes: sampleNodes,
      agents: sampleAgents,
    });

    expect(resolveSelectedEvolutionNodeId("node-west", entries)).toBe("node-west");
    expect(resolveSelectedEvolutionNodeId("missing-node", entries)).toBe("node-local");
    expect(resolveSelectedEvolutionNodeId("", [])).toBe("");
  });

  it("falls back to the first node that actually has agents when the current selection is invalid", () => {
    const entries = buildEvolutionTargetNodeEntries({
      isConnected: true,
      nodes: [
        { id: "node-empty", name: "Empty", status: "online" },
        ...sampleNodes,
      ],
      agents: sampleAgents,
    });

    expect(resolveSelectedEvolutionNodeId("", entries)).toBe("node-local");
  });

  it("keeps the current agent when it belongs to the selected node, otherwise falls back to that node's first agent", () => {
    const entries = buildEvolutionTargetNodeEntries({
      isConnected: true,
      nodes: sampleNodes,
      agents: sampleAgents,
    });

    expect(resolveSelectedEvolutionAgentId("agent-beta", "node-local", entries)).toBe("agent-beta");
    expect(resolveSelectedEvolutionAgentId("agent-gamma", "node-local", entries)).toBe("agent-alpha");
    expect(resolveSelectedEvolutionAgentId("", "node-west", entries)).toBe("agent-gamma");
    expect(resolveSelectedEvolutionAgentId("agent-alpha", "missing-node", entries)).toBe("");
  });
});
