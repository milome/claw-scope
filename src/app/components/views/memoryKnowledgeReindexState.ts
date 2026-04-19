import type {
  GatewayAgentMemoryResult,
  GatewayAgentMemoryRuntimeStatusResult,
  GatewayAgentMemoryStatusResult,
} from "../../contexts/OpenClawContext";
import type { MemoryConfigStatusSummary } from "./memoryConfigStatus";

export type MemoryKnowledgeRefreshResult = {
  memoryResult: GatewayAgentMemoryResult;
  memoryStatus: GatewayAgentMemoryStatusResult | null;
  runtimeStatus: GatewayAgentMemoryRuntimeStatusResult | null;
};

export type MemoryKnowledgeReindexSnapshot = {
  runtimeAvailable: boolean;
  files: number | null;
  chunks: number | null;
  dirty: boolean | null;
  runtimeMatchState: MemoryConfigStatusSummary["runtimeMatchState"];
  statusKey: MemoryConfigStatusSummary["statusKey"];
};

export type MemoryKnowledgeReindexPhase =
  | "starting"
  | "running"
  | "syncing"
  | "settled"
  | "warning"
  | "failed";

export function captureMemoryKnowledgeReindexSnapshot({
  statusSummary,
  runtimeStatus,
}: {
  statusSummary: MemoryConfigStatusSummary;
  runtimeStatus: GatewayAgentMemoryRuntimeStatusResult | null;
}): MemoryKnowledgeReindexSnapshot {
  return {
    runtimeAvailable: runtimeStatus !== null,
    files: runtimeStatus?.status.files ?? null,
    chunks: runtimeStatus?.status.chunks ?? null,
    dirty: runtimeStatus?.status.dirty ?? null,
    runtimeMatchState: statusSummary.runtimeMatchState,
    statusKey: statusSummary.statusKey,
  };
}

export function hasMemoryKnowledgeReindexProgress(
  before: MemoryKnowledgeReindexSnapshot,
  after: MemoryKnowledgeReindexSnapshot,
) {
  return (
    before.runtimeAvailable !== after.runtimeAvailable ||
    before.files !== after.files ||
    before.chunks !== after.chunks ||
    before.dirty !== after.dirty ||
    before.runtimeMatchState !== after.runtimeMatchState ||
    before.statusKey !== after.statusKey
  );
}

export function isMemoryKnowledgeReindexSettled(
  snapshot: MemoryKnowledgeReindexSnapshot,
) {
  return (
    snapshot.runtimeAvailable &&
    snapshot.dirty === false &&
    snapshot.runtimeMatchState === "matched"
  );
}

export function describeMemoryKnowledgeReindexDelta(
  before: MemoryKnowledgeReindexSnapshot,
  after: MemoryKnowledgeReindexSnapshot,
) {
  const changes: string[] = [];

  if (before.files !== after.files && after.files !== null) {
    changes.push(`files ${before.files ?? 0} -> ${after.files}`);
  }
  if (before.chunks !== after.chunks && after.chunks !== null) {
    changes.push(`chunks ${before.chunks ?? 0} -> ${after.chunks}`);
  }
  if (before.dirty !== after.dirty && after.dirty !== null) {
    changes.push(`dirty ${before.dirty === null ? "?" : before.dirty ? "yes" : "no"} -> ${after.dirty ? "yes" : "no"}`);
  }
  if (before.runtimeMatchState !== after.runtimeMatchState) {
    changes.push(`match ${before.runtimeMatchState} -> ${after.runtimeMatchState}`);
  }

  return changes.join(" · ");
}
