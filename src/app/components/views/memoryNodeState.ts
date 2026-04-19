import type { Agent, Node } from "../../contexts/OpenClawContext";

export interface MemoryNodeEntry {
  id: string;
  name: string;
  status: Node["status"];
  sessionId?: string;
  origin?: string | null;
  grantedScopes?: string[];
  isActive?: boolean;
  agents: Agent[];
}

function deriveNodeStatus(agents: Agent[]): Node["status"] {
  return agents.some((agent) => agent.status !== "sleeping") ? "online" : "offline";
}

export function buildMemoryNodeEntries({
  isConnected,
  nodes,
  agents,
}: {
  isConnected: boolean;
  nodes: Node[];
  agents: Agent[];
}) {
  const groupedAgents = agents.reduce(
    (acc, agent) => {
      if (!acc[agent.nodeId]) {
        acc[agent.nodeId] = [];
      }
      acc[agent.nodeId].push(agent);
      return acc;
    },
    {} as Record<string, Agent[]>,
  );

  if (!isConnected && nodes.length === 0 && agents.length === 0) {
    return [] as MemoryNodeEntry[];
  }

  const nodeEntries = nodes.map<MemoryNodeEntry>((node) => ({
    id: node.id,
    name: node.name,
    status: node.status,
    sessionId: node.sessionId,
    origin: node.origin,
    grantedScopes: node.grantedScopes ?? [],
    isActive: node.isActive,
    agents: groupedAgents[node.id] ?? [],
  }));

  const derivedNodeEntries = Object.entries(groupedAgents)
    .filter(([nodeId]) => !nodes.some((node) => node.id === nodeId))
    .map<MemoryNodeEntry>(([nodeId, nodeAgents]) => ({
      id: nodeId,
      name: nodeId,
      status: deriveNodeStatus(nodeAgents),
      sessionId: undefined,
      origin: null,
      grantedScopes: [],
      isActive: undefined,
      agents: nodeAgents,
    }));

  return [...nodeEntries, ...derivedNodeEntries];
}

export function resolveSelectedMemoryNodeId(
  selectedNodeId: string,
  nodeEntries: MemoryNodeEntry[],
) {
  if (nodeEntries.some((entry) => entry.id === selectedNodeId)) {
    return selectedNodeId;
  }

  return nodeEntries.find((entry) => entry.agents.length > 0)?.id ?? nodeEntries[0]?.id ?? "";
}

export function resolveSelectedMemoryAgentIdForNode(
  selectedAgentId: string,
  selectedNodeId: string,
  nodeEntries: MemoryNodeEntry[],
) {
  const nodeEntry = nodeEntries.find((entry) => entry.id === selectedNodeId);
  if (!nodeEntry || nodeEntry.agents.length === 0) {
    return "";
  }

  if (nodeEntry.agents.some((agent) => agent.id === selectedAgentId)) {
    return selectedAgentId;
  }

  return nodeEntry.agents[0]?.id ?? "";
}

export function resolveMemorySessionIdToActivate(
  selectedNodeId: string,
  nodeEntries: MemoryNodeEntry[],
) {
  const nodeEntry = nodeEntries.find((entry) => entry.id === selectedNodeId);
  if (!nodeEntry?.sessionId || nodeEntry.isActive) {
    return null;
  }

  return nodeEntry.sessionId;
}

export function isLocalNodeOrigin(origin?: string | null) {
  if (!origin) {
    return false;
  }

  return /^(ws|http):\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin);
}
