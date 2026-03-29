export function resolveSelectedAgentId(currentId: string, agentIds: string[]) {
  if (currentId && agentIds.includes(currentId)) {
    return currentId;
  }

  return agentIds[0] ?? "";
}

export function canEditAgentSettings(grantedScopes: string[]) {
  return grantedScopes.includes("operator.admin");
}
