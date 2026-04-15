import type { Agent, Node } from "../../contexts/OpenClawContext";

export interface EvolutionTargetNodeEntry {
  id: string;
  name: string;
  status: Node["status"];
  agents: Agent[];
}

const FALLBACK_NODES: EvolutionTargetNodeEntry[] = [
  {
    id: "node-local",
    name: "OpenClaw-Local",
    status: "online",
    agents: [],
  },
  {
    id: "node-east",
    name: "OpenClaw-East",
    status: "online",
    agents: [],
  },
  {
    id: "node-west",
    name: "OpenClaw-West",
    status: "offline",
    agents: [],
  },
];

function deriveNodeStatus(agents: Agent[]): Node["status"] {
  return agents.some((agent) => agent.status !== "sleeping") ? "online" : "offline";
}

export function buildEvolutionTargetNodeEntries({
  isConnected,
  nodes,
  agents,
}: {
  isConnected: boolean;
  nodes: Node[];
  agents: Agent[];
}): EvolutionTargetNodeEntry[] {
  if (!isConnected || agents.length === 0) {
    if (nodes.length > 0) {
      return nodes.map((node) => ({
        id: node.id,
        name: node.name,
        status: node.status,
        agents: [],
      }));
    }
    return FALLBACK_NODES;
  }

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

  const nodeEntries = nodes.map((node) => ({
    id: node.id,
    name: node.name,
    status: node.status,
    agents: groupedAgents[node.id] ?? [],
  }));

  const derivedNodeEntries = Object.entries(groupedAgents)
    .filter(([nodeId]) => !nodes.some((node) => node.id === nodeId))
    .map(([nodeId, nodeAgents]) => ({
      id: nodeId,
      name: nodeId,
      status: deriveNodeStatus(nodeAgents),
      agents: nodeAgents,
    }));

  return [...nodeEntries, ...derivedNodeEntries];
}

export function resolveSelectedEvolutionNodeId(
  selectedNodeId: string,
  nodeEntries: EvolutionTargetNodeEntry[],
) {
  if (nodeEntries.some((entry) => entry.id === selectedNodeId)) {
    return selectedNodeId;
  }
  return nodeEntries.find((entry) => entry.agents.length > 0)?.id ?? nodeEntries[0]?.id ?? "";
}

export function resolveSelectedEvolutionAgentId(
  selectedAgentId: string,
  selectedNodeId: string,
  nodeEntries: EvolutionTargetNodeEntry[],
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
