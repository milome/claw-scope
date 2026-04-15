import { describe, expect, it } from "vitest";

import {
  buildAvailableOpenClawConfigSections,
  resolveSelectedOpenClawConfigSection,
} from "./openClawConfigSectionState";

describe("openClawConfigSectionState", () => {
  it("includes sessions section only when connected nodes exist", () => {
    expect(
      buildAvailableOpenClawConfigSections({ hasConnectedNodes: false }),
    ).toEqual(["status", "connection", "discovery", "advanced"]);

    expect(
      buildAvailableOpenClawConfigSections({ hasConnectedNodes: true }),
    ).toEqual(["status", "sessions", "connection", "discovery", "advanced"]);
  });

  it("keeps a valid selected section and otherwise falls back to the first available section", () => {
    const sections = buildAvailableOpenClawConfigSections({
      hasConnectedNodes: true,
    });

    expect(
      resolveSelectedOpenClawConfigSection("discovery", sections),
    ).toBe("discovery");

    expect(
      resolveSelectedOpenClawConfigSection("sessions", buildAvailableOpenClawConfigSections({ hasConnectedNodes: false })),
    ).toBe("status");
  });
});
