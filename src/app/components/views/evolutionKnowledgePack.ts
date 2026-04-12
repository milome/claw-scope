import type { EvolutionKnowledgeInjectionInput } from "../../contexts/OpenClawContext";

export type ParsedKnowledgePack = {
  sourceRef: string;
  additionalSourceRefs: string[];
  knowledgeBody: string;
  capabilityTags: string[];
  warnings: KnowledgePackWarningCode[];
};

export type KnowledgePackWarningCode =
  | "empty_pack"
  | "missing_delimiter"
  | "missing_source_ref"
  | "missing_body";

function dedupeCaseInsensitive<T extends string>(values: T[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

export function splitCommaOrNewlineList(text: string) {
  return dedupeCaseInsensitive(
    text
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function parseHeaderLine(line: string) {
  const match = line.match(/^([A-Za-z ]+)[：:]\s*(.*)$/);
  if (!match) {
    return null;
  }

  const key = match[1].trim().toLowerCase();
  const value = match[2].trim();
  if (key === "source ref") {
    return { kind: "sourceRef" as const, value };
  }
  if (key === "additional sources") {
    return { kind: "additionalSources" as const, value };
  }
  if (key === "capability tags") {
    return { kind: "capabilityTags" as const, value };
  }
  return null;
}

export function parseKnowledgeInjectionPack(text: string): ParsedKnowledgePack {
  const normalizedText = text.replace(/\r\n?/g, "\n");
  const lines = normalizedText.split("\n");
  const warnings: KnowledgePackWarningCode[] = [];

  if (!normalizedText.trim()) {
    return {
      sourceRef: "",
      additionalSourceRefs: [],
      knowledgeBody: "",
      capabilityTags: [],
      warnings: ["empty_pack"],
    };
  }

  const separatorIndex = lines.findIndex((line) => line.trim() === "---");
  let headerLines: string[] = [];
  let bodyLines: string[] = [];

  if (separatorIndex >= 0) {
    headerLines = lines.slice(0, separatorIndex);
    bodyLines = lines.slice(separatorIndex + 1);
  } else {
    const bodyStart = lines.findIndex((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return false;
      }
      return !parseHeaderLine(trimmed);
    });

    headerLines = bodyStart >= 0 ? lines.slice(0, bodyStart) : lines;
    bodyLines = bodyStart >= 0 ? lines.slice(bodyStart) : [];
    warnings.push("missing_delimiter");
  }

  let sourceRef = "";
  let additionalSourcesLine = "";
  let capabilityTagsLine = "";

  for (const line of headerLines) {
    const parsed = parseHeaderLine(line.trim());
    if (!parsed) {
      continue;
    }
    if (parsed.kind === "sourceRef") {
      sourceRef = parsed.value;
    } else if (parsed.kind === "additionalSources") {
      additionalSourcesLine = parsed.value;
    } else {
      capabilityTagsLine = parsed.value;
    }
  }

  const capabilityTags = splitCommaOrNewlineList(capabilityTagsLine);
  const additionalSourceRefs = splitCommaOrNewlineList(additionalSourcesLine).filter(
    (value) => value.toLowerCase() !== sourceRef.trim().toLowerCase(),
  );
  const knowledgeBody = bodyLines.join("\n").trim();

  if (!sourceRef.trim()) {
    warnings.push("missing_source_ref");
  }
  if (!knowledgeBody) {
    warnings.push("missing_body");
  }

  return {
    sourceRef: sourceRef.trim(),
    additionalSourceRefs,
    knowledgeBody,
    capabilityTags,
    warnings: dedupeCaseInsensitive(warnings),
  };
}

export function formatKnowledgePackExample(input: EvolutionKnowledgeInjectionInput) {
  const additionalSourceRefs = input.additionalSourceRefs ?? [];
  const headerLines = [
    `Source Ref: ${input.sourceRef}`,
    `Additional Sources: ${additionalSourceRefs.join(", ")}`,
    `Capability Tags: ${input.capabilityTags.join(", ")}`,
    "",
    "---",
    input.knowledgeBody,
  ];
  return headerLines.join("\n").trim();
}
