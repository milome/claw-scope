import type {
  GatewayAgentFileEntry,
  GatewayAgentMemoryDiagnostics,
  GatewayAgentMemoryTimelineAccessResult,
  GatewayAgentMemoryTimelineProbeDayResult,
  GatewayAgentMemoryTimelineProbeDayStatus,
  GatewayAgentMemoryResult,
  GatewayAgentMemoryTimelineResult,
  GatewayAgentMemoryTimelineProbeSummary,
  GatewayMemorySharedAgentSummary,
} from "../../contexts/OpenClawContext";

export interface MemorySearchMatch {
  start: number;
  end: number;
}

export interface MemorySearchTarget {
  enabled: boolean;
  scope: "documents" | "footprints" | null;
  text: string;
  selectionKey: string;
}

export interface MemoryHighlightSegment {
  text: string;
  matchIndex: number | null;
}

export interface MemoryExternalSourceItem {
  id: string;
  kind: "extra_path" | "qmd_path";
  value: string;
}

export interface MemoryFootprintGroup {
  id: string;
  dateLabel: string;
  entries: GatewayAgentFileEntry[];
  latestUpdatedAtMs: number | null;
  totalSize: number;
  probeDay?: GatewayAgentMemoryTimelineProbeDayResult;
}

export type MemoryTimelineFocusFilter =
  | "all"
  | "failures"
  | "recovered"
  | "readable"
  | "missing";

export type TimelineProbeRangeError =
  | "invalid_format"
  | "start_after_end"
  | "range_too_large";

const TIMELINE_PROBE_MAX_DAYS = 31;
const TIMELINE_PROBE_DEFAULT_DAYS = 7;
const DATE_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseCanonicalDate(value: string) {
  const match = value.match(DATE_INPUT_RE);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatCanonicalDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function countInclusiveProbeDays(startDate: Date, endDate: Date) {
  const deltaMs = endDate.getTime() - startDate.getTime();
  return Math.floor(deltaMs / 86_400_000) + 1;
}

export function resolveTimelineProbeRangePreset(referenceDate: string) {
  const endDate = parseCanonicalDate(referenceDate);
  if (!endDate) {
    return {
      startDate: "",
      endDate: "",
    };
  }

  const startDate = new Date(endDate.getTime());
  startDate.setUTCDate(startDate.getUTCDate() - (TIMELINE_PROBE_DEFAULT_DAYS - 1));

  return {
    startDate: formatCanonicalDate(startDate),
    endDate: formatCanonicalDate(endDate),
  };
}

export function resolveTimelineProbeRangeError({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}): TimelineProbeRangeError | null {
  const parsedStartDate = parseCanonicalDate(startDate);
  const parsedEndDate = parseCanonicalDate(endDate);
  if (!parsedStartDate || !parsedEndDate) {
    return "invalid_format";
  }

  if (parsedStartDate.getTime() > parsedEndDate.getTime()) {
    return "start_after_end";
  }

  if (
    countInclusiveProbeDays(parsedStartDate, parsedEndDate) >
    TIMELINE_PROBE_MAX_DAYS
  ) {
    return "range_too_large";
  }

  return null;
}

export function resolveSelectedMemoryDocumentName(
  currentName: string,
  documents: GatewayAgentFileEntry[],
) {
  if (currentName && documents.some((document) => document.name === currentName)) {
    return currentName;
  }

  if (documents.some((document) => document.name === "MEMORY.md")) {
    return "MEMORY.md";
  }

  return documents[0]?.name ?? "";
}

export function resolveMemoryRootDocument(
  documents: GatewayAgentFileEntry[],
  selectedDocumentName: string,
) {
  if (!documents.length) {
    return null;
  }

  if (selectedDocumentName) {
    const selectedDocument = documents.find(
      (document) => document.name === selectedDocumentName,
    );
    if (selectedDocument) {
      return selectedDocument;
    }
  }

  return documents[0] ?? null;
}

export function resolveSelectedMemoryAgentId(
  currentId: string,
  agentIds: string[],
) {
  if (currentId && agentIds.includes(currentId)) {
    return currentId;
  }

  return agentIds[0] ?? "";
}

export function canEditMemory(grantedScopes: string[]) {
  return grantedScopes.includes("operator.admin");
}

export function resolveMemoryDocumentContent(
  document: GatewayAgentFileEntry | null | undefined,
) {
  if (!document || document.missing) {
    return "";
  }

  return document.content ?? "";
}

export function createMemoryDrafts(
  result: GatewayAgentMemoryResult | null | undefined,
) {
  if (!result) {
    return {};
  }

  return Object.fromEntries(
    result.documents.map((document) => [
      document.name,
      resolveMemoryDocumentContent(document),
    ]),
  );
}

export function resolveSelectedTimelineEntryName(
  currentName: string,
  result: GatewayAgentMemoryTimelineResult | null | undefined,
) {
  const entries = result?.entries ?? [];

  if (currentName && entries.some((entry) => entry.name === currentName)) {
    return currentName;
  }

  return entries[0]?.name ?? "";
}

export function canLoadLocalTimeline(
  accessResult: GatewayAgentMemoryTimelineAccessResult | null | undefined,
) {
  return accessResult?.mode === "local_workspace";
}

export function resolveTimelineEntryDateLabel(name: string) {
  const normalized = name.replace(/^memory\//, "").replace(/\.md$/i, "");
  const dateMatch = normalized.match(/\d{4}-\d{2}-\d{2}/);

  return dateMatch?.[0] ?? normalized;
}

export function buildMemoryFootprintGroups(
  entries: GatewayAgentFileEntry[],
  probeDays: GatewayAgentMemoryTimelineProbeDayResult[] = [],
): MemoryFootprintGroup[] {
  const groups = new Map<string, MemoryFootprintGroup>();

  const ensureGroup = (dateLabel: string) => {
    const existing = groups.get(dateLabel);
    if (existing) {
      return existing;
    }

    const created: MemoryFootprintGroup = {
      id: dateLabel,
      dateLabel,
      entries: [],
      latestUpdatedAtMs: null,
      totalSize: 0,
    };
    groups.set(dateLabel, created);
    return created;
  };

  probeDays.forEach((probeDay) => {
    const group = ensureGroup(probeDay.date);
    group.probeDay = probeDay;
  });

  entries.forEach((entry) => {
    const dateLabel = resolveTimelineEntryDateLabel(entry.name);
    const group = ensureGroup(dateLabel);

    group.entries.push(entry);
    group.latestUpdatedAtMs =
      typeof entry.updatedAtMs === "number"
        ? group.latestUpdatedAtMs === null
          ? entry.updatedAtMs
          : Math.max(group.latestUpdatedAtMs, entry.updatedAtMs)
        : group.latestUpdatedAtMs;
    group.totalSize += typeof entry.size === "number" ? entry.size : 0;
  });

  return Array.from(groups.values()).sort((left, right) =>
    right.dateLabel.localeCompare(left.dateLabel),
  );
}

function matchesTimelineFocusFilter(
  group: MemoryFootprintGroup,
  filter: MemoryTimelineFocusFilter,
) {
  if (filter === "all") {
    return true;
  }

  const day = group.probeDay;
  if (!day) {
    return false;
  }

  switch (filter) {
    case "failures":
      return day.status === "timeout" || day.status === "error";
    case "recovered":
      return day.recoveredAfterRetry;
    case "readable":
      return day.status === "hit";
    case "missing":
      return day.status === "miss";
    default:
      return true;
  }
}

export function filterMemoryFootprintGroups(
  groups: MemoryFootprintGroup[],
  filter: MemoryTimelineFocusFilter,
) {
  return groups.filter((group) => matchesTimelineFocusFilter(group, filter));
}

export function summarizeMemoryFootprintGroups(
  groups: MemoryFootprintGroup[],
): Record<MemoryTimelineFocusFilter, number> {
  return {
    all: groups.length,
    failures: groups.filter((group) =>
      matchesTimelineFocusFilter(group, "failures"),
    ).length,
    recovered: groups.filter((group) =>
      matchesTimelineFocusFilter(group, "recovered"),
    ).length,
    readable: groups.filter((group) =>
      matchesTimelineFocusFilter(group, "readable"),
    ).length,
    missing: groups.filter((group) =>
      matchesTimelineFocusFilter(group, "missing"),
    ).length,
  };
}

export function resolveFirstTimelineEntryNameFromGroups(
  groups: MemoryFootprintGroup[],
) {
  for (const group of groups) {
    const entry = group.entries[0];
    if (entry) {
      return entry.name;
    }
  }

  return "";
}

function sortTimelineEntriesNewestFirst(entries: GatewayAgentFileEntry[]) {
  return [...entries].sort((left, right) => right.name.localeCompare(left.name));
}

function sortProbeDaysNewestFirst(days: GatewayAgentMemoryTimelineProbeDayResult[]) {
  return [...days].sort((left, right) => right.date.localeCompare(left.date));
}

function resolveProbeSummaryStatus(
  days: GatewayAgentMemoryTimelineProbeDayResult[],
): GatewayAgentMemoryTimelineProbeSummary["status"] {
  const attemptedDays = days.length;
  const timeoutDays = days.filter((day) => day.status === "timeout").length;
  const errorDays = days.filter((day) => day.status === "error").length;
  const skippedDays = timeoutDays + errorDays;
  const hitDays = days.filter((day) => day.status === "hit").length;

  if (timeoutDays > 0 && timeoutDays === attemptedDays) {
    return "timeout";
  }

  if (errorDays > 0 && errorDays === attemptedDays) {
    return "error";
  }

  if (skippedDays > 0) {
    return "partial";
  }

  if (hitDays === 0) {
    return "empty";
  }

  return "complete";
}

function resolveProbeSummaryLastError(
  days: GatewayAgentMemoryTimelineProbeDayResult[],
) {
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (day.status === "timeout" || day.status === "error") {
      return {
        lastErrorCategory: day.errorCategory ?? null,
        lastErrorCode: day.errorCode ?? null,
        lastErrorMessage: day.errorMessage ?? null,
      };
    }
  }

  return {
    lastErrorCategory: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  };
}

function buildProbeSummaryFromDays(
  template: GatewayAgentMemoryTimelineProbeSummary,
  days: GatewayAgentMemoryTimelineProbeDayResult[],
): GatewayAgentMemoryTimelineProbeSummary {
  const orderedDays = sortProbeDaysNewestFirst(days);
  const hitDays = orderedDays.filter((day) => day.status === "hit").length;
  const missDays = orderedDays.filter((day) => day.status === "miss").length;
  const timeoutDays = orderedDays.filter((day) => day.status === "timeout").length;
  const errorDays = orderedDays.filter((day) => day.status === "error").length;
  const retryDays = orderedDays.filter((day) => day.retried).length;
  const retryRecoveredDays = orderedDays.filter(
    (day) => day.recoveredAfterRetry,
  ).length;
  const skippedDays = timeoutDays + errorDays;
  const dateLabels = orderedDays.map((day) => day.date).sort();
  const lastError = resolveProbeSummaryLastError(orderedDays);

  return {
    ...template,
    startDate: dateLabels[0] ?? template.startDate,
    endDate: dateLabels[dateLabels.length - 1] ?? template.endDate,
    attemptedDays: orderedDays.length,
    hitDays,
    missDays,
    skippedDays,
    timeoutDays,
    errorDays,
    retryDays,
    retryRecoveredDays,
    days: orderedDays,
    status: resolveProbeSummaryStatus(orderedDays),
    cached: false,
    ...lastError,
  };
}

export function resolveTimelineProbeFailedDates(
  summary: GatewayAgentMemoryTimelineProbeSummary | null | undefined,
) {
  if (!summary) {
    return [];
  }

  return summary.days
    .filter((day) => day.status === "timeout" || day.status === "error")
    .map((day) => day.date);
}

export function mergeTimelineProbeResults({
  current,
  retryResult,
}: {
  current: GatewayAgentMemoryTimelineResult | null | undefined;
  retryResult: GatewayAgentMemoryTimelineResult;
}) {
  if (!current?.probe || !retryResult.probe) {
    return retryResult;
  }

  const entryMap = new Map<string, GatewayAgentFileEntry>();
  current.entries.forEach((entry) => {
    entryMap.set(entry.name, entry);
  });
  retryResult.entries.forEach((entry) => {
    entryMap.set(entry.name, entry);
  });

  const dayMap = new Map<string, GatewayAgentMemoryTimelineProbeDayResult>();
  current.probe.days.forEach((day) => {
    dayMap.set(day.date, day);
  });
  retryResult.probe.days.forEach((day) => {
    dayMap.set(day.date, day);
  });

  return {
    ...current,
    entries: sortTimelineEntriesNewestFirst(Array.from(entryMap.values())),
    probe: buildProbeSummaryFromDays(
      current.probe,
      Array.from(dayMap.values()),
    ),
  };
}

export function resolveTimelineProbeDayTone(
  status: GatewayAgentMemoryTimelineProbeDayStatus,
) {
  switch (status) {
    case "hit":
      return "emerald";
    case "miss":
      return "slate";
    case "timeout":
      return "amber";
    case "error":
    default:
      return "rose";
  }
}

export function hasSharedWorkspaceMemory(
  sharedAgents: GatewayMemorySharedAgentSummary[],
) {
  return sharedAgents.length > 0;
}

export function isMemoryDocumentDirty(
  loadedContent: string,
  draftContent: string,
) {
  return loadedContent !== draftContent;
}

export function resolveMemorySearchTarget({
  activeSection,
  documentName,
  documentText,
  timelineEntryName,
  timelineText,
}: {
  activeSection:
    | "overview"
    | "documents"
    | "footprints"
    | "search"
    | "knowledge";
  documentName: string;
  documentText: string;
  timelineEntryName: string;
  timelineText: string;
}): MemorySearchTarget {
  if (activeSection === "documents") {
    return {
      enabled: true,
      scope: "documents",
      text: documentText,
      selectionKey: `documents:${documentName}`,
    };
  }

  if (activeSection === "footprints") {
    return {
      enabled: true,
      scope: "footprints",
      text: timelineText,
      selectionKey: `footprints:${timelineEntryName}`,
    };
  }

  return {
    enabled: false,
    scope: null,
    text: "",
    selectionKey: "",
  };
}

export function collectTextSearchMatches(
  text: string,
  query: string,
): MemorySearchMatch[] {
  if (!text || !query) {
    return [];
  }

  const source = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  const matches: MemorySearchMatch[] = [];
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const matchIndex = source.indexOf(needle, searchFrom);
    if (matchIndex === -1) {
      break;
    }

    matches.push({
      start: matchIndex,
      end: matchIndex + needle.length,
    });
    searchFrom = matchIndex + needle.length;
  }

  return matches;
}

export function moveActiveSearchMatchIndex(
  currentIndex: number,
  totalMatches: number,
  direction: -1 | 1,
) {
  if (totalMatches <= 0) {
    return -1;
  }

  if (currentIndex < 0 || currentIndex >= totalMatches) {
    return direction === -1 ? totalMatches - 1 : 0;
  }

  return (currentIndex + direction + totalMatches) % totalMatches;
}

export function buildHighlightedTextSegments(
  text: string,
  matches: MemorySearchMatch[],
): MemoryHighlightSegment[] {
  if (!matches.length) {
    return [{ text, matchIndex: null }];
  }

  const segments: MemoryHighlightSegment[] = [];
  let currentIndex = 0;

  matches.forEach((match, matchIndex) => {
    if (match.start > currentIndex) {
      segments.push({
        text: text.slice(currentIndex, match.start),
        matchIndex: null,
      });
    }

    segments.push({
      text: text.slice(match.start, match.end),
      matchIndex,
    });
    currentIndex = match.end;
  });

  if (currentIndex < text.length) {
    segments.push({
      text: text.slice(currentIndex),
      matchIndex: null,
    });
  }

  return segments;
}

export function resolveExternalMemorySources(
  diagnostics: GatewayAgentMemoryDiagnostics | null | undefined,
): MemoryExternalSourceItem[] {
  if (!diagnostics) {
    return [];
  }

  const items: MemoryExternalSourceItem[] = [];
  const seen = new Set<string>();

  diagnostics.extraPaths.forEach((path) => {
    const normalized = path.trim();
    if (!normalized) {
      return;
    }

    const id = `extra_path:${normalized}`;
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    items.push({
      id,
      kind: "extra_path",
      value: normalized,
    });
  });

  diagnostics.qmdPaths.forEach((path) => {
    const normalized = path.trim();
    if (!normalized) {
      return;
    }

    const id = `qmd_path:${normalized}`;
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    items.push({
      id,
      kind: "qmd_path",
      value: normalized,
    });
  });

  return items;
}

export function canReloadMemoryDocument({
  selectedAgentId,
  isLoading,
  isSaving,
}: {
  selectedAgentId: string;
  isLoading: boolean;
  isSaving: boolean;
}) {
  return Boolean(selectedAgentId) && !isLoading && !isSaving;
}

export function canSaveMemoryDocument({
  selectedAgentId,
  isLoading,
  isSaving,
  canEdit,
  isDirty,
}: {
  selectedAgentId: string;
  isLoading: boolean;
  isSaving: boolean;
  canEdit: boolean;
  isDirty: boolean;
}) {
  return (
    Boolean(selectedAgentId) &&
    !isLoading &&
    !isSaving &&
    canEdit &&
    isDirty
  );
}
