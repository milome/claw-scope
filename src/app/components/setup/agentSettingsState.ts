import type {
  GatewayAgentSettingsFieldMetadata,
  GatewayAgentSettingsFieldSourceKind,
} from "../../contexts/OpenClawContext";

export type AgentSettingsSectionId =
  | "overview"
  | "effective"
  | "policies"
  | "memory";

export type AgentSettingsScopeId = Exclude<
  GatewayAgentSettingsFieldSourceKind,
  "effective_runtime" | "unset"
>;

export function resolveSelectedAgentId(currentId: string, agentIds: string[]) {
  if (currentId && agentIds.includes(currentId)) {
    return currentId;
  }

  return agentIds[0] ?? "";
}

export function buildAvailableAgentSettingsSections() {
  return ["overview", "effective", "policies", "memory"] as const;
}

export function resolveSelectedAgentSettingsSection(
  currentSection: AgentSettingsSectionId,
  sections: readonly AgentSettingsSectionId[],
) {
  if (sections.includes(currentSection)) {
    return currentSection;
  }

  return sections[0] ?? "overview";
}

export function buildAvailableAgentSettingsScopes() {
  return [
    "gateway_global",
    "default_agent_routing",
    "universal_defaults",
    "selected_agent_override",
    "mixed",
  ] as const;
}

export function resolveSelectedAgentSettingsScope(
  currentScope: AgentSettingsScopeId,
  scopes: readonly AgentSettingsScopeId[],
) {
  if (scopes.includes(currentScope)) {
    return currentScope;
  }

  return scopes[0] ?? "gateway_global";
}

export function deriveAgentSettingsScope(
  metadata?: GatewayAgentSettingsFieldMetadata | null,
): AgentSettingsScopeId {
  if (!metadata) {
    return "mixed";
  }

  if (
    metadata.source !== "effective_runtime" &&
    metadata.source !== "unset"
  ) {
    return metadata.source;
  }

  const inferredScopes = new Set<AgentSettingsScopeId>();

  for (const action of metadata.writeActions) {
    const path = action.path ?? "";
    if (path === "bindings") {
      inferredScopes.add("gateway_global");
      continue;
    }
    if (path === "agents.default_id" || path.includes(".default")) {
      inferredScopes.add("default_agent_routing");
      continue;
    }
    if (path.startsWith("agents.defaults.")) {
      inferredScopes.add("universal_defaults");
      continue;
    }
    if (action.kind === "agents_update" || path.startsWith("agents.list.")) {
      inferredScopes.add("selected_agent_override");
    }
  }

  if (inferredScopes.size === 1) {
    return Array.from(inferredScopes)[0];
  }

  return "mixed";
}

export function canEditAgentSettings(grantedScopes: string[]) {
  return grantedScopes.includes("operator.admin");
}
