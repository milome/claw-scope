import { describe, expect, it } from "vitest";
import {
  formatKnowledgePackExample,
  parseKnowledgeInjectionPack,
  splitCommaOrNewlineList,
} from "./evolutionKnowledgePack";

describe("evolutionKnowledgePack", () => {
  it("parses a complete knowledge pack with delimiter", () => {
    const parsed = parseKnowledgeInjectionPack(`Source Ref: playbook://pm-expert-v2
Additional Sources: doc://team-playbook, qmd://notes
Capability Tags: project-management, startup-delivery

---
## Role
You are an operator PM.`);

    expect(parsed.sourceRef).toBe("playbook://pm-expert-v2");
    expect(parsed.additionalSourceRefs).toEqual(["doc://team-playbook", "qmd://notes"]);
    expect(parsed.capabilityTags).toEqual(["project-management", "startup-delivery"]);
    expect(parsed.knowledgeBody).toContain("## Role");
    expect(parsed.warnings).toEqual([]);
  });

  it("falls back to remaining text as body when delimiter is missing", () => {
    const parsed = parseKnowledgeInjectionPack(`Source Ref: playbook://memory-search
Capability Tags: memory, search
Use memory_search before local fallback.`);

    expect(parsed.sourceRef).toBe("playbook://memory-search");
    expect(parsed.knowledgeBody).toBe("Use memory_search before local fallback.");
    expect(parsed.warnings).toContain("missing_delimiter");
  });

  it("dedupes lists and removes additional sources that repeat the main source", () => {
    const parsed = parseKnowledgeInjectionPack(`Source Ref: doc://team-playbook
Additional Sources: doc://team-playbook, DOC://TEAM-PLAYBOOK, qmd://notes
Capability Tags: memory, search, MEMORY

---
正文内容`);

    expect(parsed.additionalSourceRefs).toEqual(["qmd://notes"]);
    expect(parsed.capabilityTags).toEqual(["memory", "search"]);
  });

  it("formats an example pack using the current UI field format", () => {
    const text = formatKnowledgePackExample({
      sourceRef: "playbook://memory-search-v1/1",
      additionalSourceRefs: ["doc://team-playbook", "qmd://memory-search-notes"],
      capabilityTags: ["memory", "search", "retrieval"],
      knowledgeBody: "Use memory_search before local fallback.",
    });

    expect(text).toContain("Source Ref: playbook://memory-search-v1/1");
    expect(text).toContain("---");
    expect(text).toContain("Use memory_search before local fallback.");
  });

  it("splits comma or newline lists and removes duplicates", () => {
    expect(splitCommaOrNewlineList("memory, search\nmemory\nretrieval")).toEqual([
      "memory",
      "search",
      "retrieval",
    ]);
  });
});
