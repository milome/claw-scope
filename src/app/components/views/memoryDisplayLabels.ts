export function sourceKindLabel(
  sourceKind: string,
  t: (key: string, ...args: (string | number)[]) => string,
) {
  switch (sourceKind) {
    case "document":
      return t("memory.sourceKind.document");
    case "timeline":
      return t("memory.sourceKind.timeline");
    default:
      return sourceKind;
  }
}

export function openTargetLabel(
  openTarget: string,
  t: (key: string, ...args: (string | number)[]) => string,
) {
  switch (openTarget) {
    case "documents":
      return t("memory.tab.documents");
    case "footprints":
      return t("memory.tab.footprints");
    case "detail":
      return t("memory.search.detailTitle");
    default:
      return openTarget;
  }
}

export function probeStatusLabel(
  status: string,
  t: (key: string, ...args: (string | number)[]) => string,
) {
  return t("memory.footprints.probeStatus", status);
}

export function timelineModeLabel(
  mode: string,
  t: (key: string, ...args: (string | number)[]) => string,
) {
  switch (mode) {
    case "local_workspace":
      return t("memory.timeline.mode.local");
    case "remote_probe":
      return t("memory.timeline.mode.remote");
    case "unavailable":
      return t("memory.timeline.mode.unavailable");
    default:
      return t("memory.timeline.mode.unknown");
  }
}

export function timelineReasonLabel(
  reason: string,
  t: (key: string, ...args: (string | number)[]) => string,
) {
  if (!reason) {
    return t("memory.search.na");
  }
  return reason;
}

export function debugReasonLabel(
  reason: string,
  t: (key: string, ...args: (string | number)[]) => string,
) {
  if (reason === "missing") {
    return t("memory.debug.reason.missing");
  }
  if (reason.startsWith("too_short")) {
    return `${t("memory.debug.reason.tooShort")} ${reason}`;
  }
  return reason;
}
