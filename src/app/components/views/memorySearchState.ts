export type SemanticMemorySearchSourceKind =
  | "root_memory"
  | "daily_memory"
  | "workspace_markdown"
  | "extra_path"
  | "session_transcript"
  | "unknown";

export type SemanticMemorySearchOpenTarget =
  | "documents"
  | "footprints"
  | "detail_sheet";

export type SemanticMemorySearchGroup =
  | "all"
  | "documents"
  | "timeline"
  | "sessions"
  | "other";

const SEMANTIC_MEMORY_SEARCH_GROUP_ORDER: SemanticMemorySearchGroup[] = [
  "all",
  "documents",
  "timeline",
  "sessions",
  "other",
];

const DAILY_MEMORY_PATH_RE =
  /(?:^|\/)memory\/\d{4}-\d{2}-\d{2}\.md$/i;

export function resolveSemanticMemorySearchSourceKind(
  path: string,
): SemanticMemorySearchSourceKind {
  const normalizedPath = path.trim();

  if (
    normalizedPath.endsWith("/MEMORY.md") ||
    normalizedPath.endsWith("/memory.md")
  ) {
    return "root_memory";
  }

  if (DAILY_MEMORY_PATH_RE.test(normalizedPath)) {
    return "daily_memory";
  }

  if (normalizedPath.includes("/sessions/")) {
    return "session_transcript";
  }

  if (normalizedPath.endsWith(".md")) {
    return "workspace_markdown";
  }

  return "unknown";
}

export function resolveSemanticMemorySearchOpenTarget(path: string) {
  const sourceKind = resolveSemanticMemorySearchSourceKind(path);

  switch (sourceKind) {
    case "root_memory":
      return "documents";
    case "daily_memory":
      return "footprints";
    default:
      return "detail_sheet";
  }
}

export function canRunSemanticMemorySearch(
  query: string,
  isSearching: boolean,
) {
  return query.trim().length > 0 && !isSearching;
}

export function resolveSemanticMemorySearchGroup(
  sourceKind: SemanticMemorySearchSourceKind,
): SemanticMemorySearchGroup {
  switch (sourceKind) {
    case "root_memory":
    case "workspace_markdown":
    case "extra_path":
      return "documents";
    case "daily_memory":
      return "timeline";
    case "session_transcript":
      return "sessions";
    case "unknown":
    default:
      return "other";
  }
}

export function sortSemanticMemorySearchGroups(
  counts: Record<SemanticMemorySearchGroup, number>,
  options?: {
    includeAll?: boolean;
  },
) {
  const includeAll = options?.includeAll ?? true;
  const groups = includeAll
    ? [...SEMANTIC_MEMORY_SEARCH_GROUP_ORDER]
    : SEMANTIC_MEMORY_SEARCH_GROUP_ORDER.filter((group) => group !== "all");

  return groups.sort((left, right) => {
    if (left === "all" || right === "all") {
      if (left === right) {
        return 0;
      }
      return left === "all" ? -1 : 1;
    }

    const countDiff = counts[right] - counts[left];
    if (countDiff !== 0) {
      return countDiff;
    }

    return (
      SEMANTIC_MEMORY_SEARCH_GROUP_ORDER.indexOf(left) -
      SEMANTIC_MEMORY_SEARCH_GROUP_ORDER.indexOf(right)
    );
  });
}
