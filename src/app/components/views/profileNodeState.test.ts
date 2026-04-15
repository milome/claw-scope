import { describe, expect, it } from "vitest";

import {
  groupAgentsByNode,
  resolveSelectedAgentIdForNode,
  resolveSelectedProfileNodeName,
} from "./profileNodeState";

describe("profileNodeState", () => {
  const agents = [
    { id: "agent-a", node: "OpenClaw Local" },
    { id: "agent-b", node: "OpenClaw Local" },
    { id: "agent-c", node: "OpenClaw West" },
  ];

  it("groups agents by node label", () => {
    const grouped = groupAgentsByNode(agents);

    expect(Object.keys(grouped)).toEqual(["OpenClaw Local", "OpenClaw West"]);
    expect(grouped["OpenClaw Local"]?.map((agent) => agent.id)).toEqual([
      "agent-a",
      "agent-b",
    ]);
  });

  it("keeps the current node when it still exists and otherwise falls back to the first node", () => {
    expect(
      resolveSelectedProfileNodeName("OpenClaw West", [
        "OpenClaw Local",
        "OpenClaw West",
      ]),
    ).toBe("OpenClaw West");

    expect(
      resolveSelectedProfileNodeName("Missing Node", [
        "OpenClaw Local",
        "OpenClaw West",
      ]),
    ).toBe("OpenClaw Local");

    expect(resolveSelectedProfileNodeName("Missing Node", [])).toBe("");
  });

  it("keeps the current agent inside the selected node and otherwise falls back to the first node agent", () => {
    expect(
      resolveSelectedAgentIdForNode("agent-b", agents.slice(0, 2)),
    ).toBe("agent-b");

    expect(
      resolveSelectedAgentIdForNode("agent-c", agents.slice(0, 2)),
    ).toBe("agent-a");

    expect(resolveSelectedAgentIdForNode("agent-a", [])).toBe("");
  });
});
