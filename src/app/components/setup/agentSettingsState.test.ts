import { describe, expect, it } from "vitest";

import {
  buildAvailableAgentSettingsSections,
  canEditAgentSettings,
  deriveAgentSettingsScope,
  resolveSelectedAgentId,
  resolveSelectedAgentSettingsScope,
  resolveSelectedAgentSettingsSection,
} from "./agentSettingsState";

describe("resolveSelectedAgentId", () => {
  it("keeps the current id when it still exists", () => {
    expect(resolveSelectedAgentId("agent-b", ["agent-a", "agent-b"])).toBe(
      "agent-b",
    );
  });

  it("falls back to the first agent when current id is missing", () => {
    expect(resolveSelectedAgentId("missing", ["agent-a", "agent-b"])).toBe(
      "agent-a",
    );
  });

  it("returns an empty string when no agents are available", () => {
    expect(resolveSelectedAgentId("anything", [])).toBe("");
  });
});

describe("canEditAgentSettings", () => {
  it("allows editing when operator.admin is granted", () => {
    expect(canEditAgentSettings(["operator.read", "operator.admin"])).toBe(
      true,
    );
  });

  it("blocks editing when operator.admin is missing", () => {
    expect(canEditAgentSettings(["operator.read"])).toBe(false);
  });
});

describe("resolveSelectedAgentSettingsSection", () => {
  it("keeps the current section when it still exists", () => {
    const sections = buildAvailableAgentSettingsSections();

    expect(
      resolveSelectedAgentSettingsSection("policies", sections),
    ).toBe("policies");
  });

  it("falls back to overview when the current section is invalid", () => {
    const sections = buildAvailableAgentSettingsSections();

    expect(
      resolveSelectedAgentSettingsSection(
        "overview" as typeof sections[number],
        [],
      ),
    ).toBe("overview");
    expect(
      resolveSelectedAgentSettingsSection(
        "memory" as typeof sections[number],
        ["overview", "effective"] as const,
      ),
    ).toBe("overview");
  });
});

describe("resolveSelectedAgentSettingsScope", () => {
  it("keeps the current scope when it still exists", () => {
    const scopes = [
      "gateway_global",
      "default_agent_routing",
      "universal_defaults",
      "selected_agent_override",
      "mixed",
    ] as const;

    expect(resolveSelectedAgentSettingsScope("mixed", scopes)).toBe("mixed");
  });
});

describe("deriveAgentSettingsScope", () => {
  it("returns the explicit metadata source when it already matches a legend scope", () => {
    expect(
      deriveAgentSettingsScope({
        source: "gateway_global",
        path: "bindings",
        writeActions: [{ kind: "config_patch", path: "bindings" }],
      }),
    ).toBe("gateway_global");
  });

  it("infers mixed scope for effective runtime fields backed by multiple write targets", () => {
    expect(
      deriveAgentSettingsScope({
        source: "effective_runtime",
        path: "agents.defaults.workspace",
        writeActions: [
          { kind: "agents_update", path: "workspace" },
          { kind: "config_patch", path: "agents.defaults.workspace" },
        ],
      }),
    ).toBe("mixed");
  });

  it("infers selected override for unset values that only write through agent overrides", () => {
    expect(
      deriveAgentSettingsScope({
        source: "unset",
        path: "agents.list.agent-a.tools",
        writeActions: [
          { kind: "config_patch", path: "agents.list.agent-a.tools" },
        ],
      }),
    ).toBe("selected_agent_override");
  });
});
