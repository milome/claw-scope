import type {
  GatewayAgentFileEntry,
  GatewayAgentMemoryDiagnostics,
  GatewayAgentMemoryTimelineResult,
} from "../../contexts/OpenClawContext";
import type { MemoryExternalSourceItem } from "./memoryState";

export type MemoryResourceLeaf = {
  id: string;
  label: string;
  kind: "document" | "timeline" | "external_source" | "runtime_signal";
  meta?: string;
  content?: string;
};

export type MemoryResourceGroup = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  leaves: MemoryResourceLeaf[];
};

export function buildMemoryResourceGroups({
  workspace,
  documents,
  timeline,
  externalSources,
  diagnostics,
}: {
  workspace: string | null | undefined;
  documents: GatewayAgentFileEntry[];
  timeline: GatewayAgentMemoryTimelineResult | null | undefined;
  externalSources: MemoryExternalSourceItem[];
  diagnostics: GatewayAgentMemoryDiagnostics | null | undefined;
}): MemoryResourceGroup[] {
  const documentLeaves: MemoryResourceLeaf[] = documents.map((document) => ({
    id: `document:${document.name}`,
    label: document.name,
    kind: "document",
    meta: document.path,
    content: document.content ?? "",
  }));

  const timelineLeaves: MemoryResourceLeaf[] = (timeline?.entries ?? []).map((entry) => ({
    id: `timeline:${entry.name}`,
    label: entry.name,
    kind: "timeline",
    meta: entry.path,
    content: entry.content ?? "",
  }));

  const externalLeaves: MemoryResourceLeaf[] = externalSources.map((source) => ({
    id: `external:${source.id}`,
    label: source.value,
    kind: "external_source",
    meta: source.kind,
    content: source.value,
  }));

  const runtimeLeaves: MemoryResourceLeaf[] = diagnostics
    ? [
        {
          id: "runtime:backend",
          label: diagnostics.backend,
          kind: "runtime_signal",
          meta: diagnostics.provider ?? "no provider",
          content: diagnostics.backend,
        },
        {
          id: "runtime:store",
          label: diagnostics.builtinStorePath,
          kind: "runtime_signal",
          meta: workspace ?? undefined,
          content: diagnostics.builtinStorePath,
        },
        ...diagnostics.sources.map((source, index) => ({
          id: `runtime:source:${index}`,
          label: source,
          kind: "runtime_signal" as const,
          meta: diagnostics.backend,
          content: source,
        })),
      ]
    : [];

  return [
    {
      id: "resources:documents",
      titleKey: "memory.tab.documents",
      descriptionKey: "memory.documents.desc",
      leaves: documentLeaves,
    },
    {
      id: "resources:timeline",
      titleKey: "memory.tab.footprints",
      descriptionKey: "memory.footprints.detailPrompt",
      leaves: timelineLeaves,
    },
    {
      id: "resources:external",
      titleKey: "memory.knowledge.sources",
      descriptionKey: "memory.knowledge.pathsEmpty",
      leaves: externalLeaves,
    },
    {
      id: "resources:runtime",
      titleKey: "memory.diag.runtimeStatus",
      descriptionKey: "memory.diag.runtimePlaceholder",
      leaves: runtimeLeaves,
    },
  ];
}
