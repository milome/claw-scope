export type OpenClawConfigSectionId =
  | "status"
  | "sessions"
  | "connection"
  | "discovery"
  | "advanced";

export function buildAvailableOpenClawConfigSections({
  hasConnectedNodes,
}: {
  hasConnectedNodes: boolean;
}): OpenClawConfigSectionId[] {
  return [
    "status",
    ...(hasConnectedNodes ? (["sessions"] as const) : []),
    "connection",
    "discovery",
    "advanced",
  ];
}

export function resolveSelectedOpenClawConfigSection(
  selectedSection: OpenClawConfigSectionId,
  availableSections: OpenClawConfigSectionId[],
) {
  if (availableSections.includes(selectedSection)) {
    return selectedSection;
  }

  return availableSections[0] ?? "status";
}
