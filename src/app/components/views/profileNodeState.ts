import type { Node } from "../../contexts/OpenClawContext";

export function groupAgentsByNode<T extends { node: string }>(agents: T[]) {
  return agents.reduce(
    (acc, agent) => {
      if (!acc[agent.node]) {
        acc[agent.node] = [];
      }
      acc[agent.node].push(agent);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}

export function resolveSelectedProfileNodeName(
  selectedNodeName: string,
  nodeNames: string[],
) {
  if (nodeNames.includes(selectedNodeName)) {
    return selectedNodeName;
  }

  return nodeNames[0] ?? "";
}

export function resolveSelectedAgentIdForNode<T extends { id: string }>(
  selectedAgentId: string,
  nodeAgents: T[],
) {
  if (nodeAgents.some((agent) => agent.id === selectedAgentId)) {
    return selectedAgentId;
  }

  return nodeAgents[0]?.id ?? "";
}

export interface ProfileNodeEntry {
  id: string;
  name: string;
  status: Node["status"];
  sessionId?: string;
  isActive?: boolean;
  agentCount: number;
}

export function buildVisibleProfileNodeEntries<T extends { node: string }>(
  nodes: Pick<Node, "id" | "name" | "status" | "sessionId" | "isActive">[],
  groupedAgents: Record<string, T[]>,
) {
  const entries: ProfileNodeEntry[] = nodes.map((node) => ({
    id: node.id,
    name: node.name,
    status: node.status,
    sessionId: node.sessionId,
    isActive: node.isActive,
    agentCount: groupedAgents[node.name]?.length ?? 0,
  }));

  for (const [nodeName, nodeAgents] of Object.entries(groupedAgents)) {
    if (entries.some((entry) => entry.name === nodeName)) {
      continue;
    }

    entries.push({
      id: nodeName,
      name: nodeName,
      status: "online",
      agentCount: nodeAgents.length,
    });
  }

  return entries;
}
