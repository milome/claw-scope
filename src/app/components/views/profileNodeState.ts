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
