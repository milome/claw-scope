import { describe, expect, it } from "vitest";

import {
  canEditAgentSettings,
  resolveSelectedAgentId,
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
