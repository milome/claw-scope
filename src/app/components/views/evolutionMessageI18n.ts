import type {
  EvolutionAuditEntry,
  EvolutionHistoryEntry,
  EvolutionLocalizedMessage,
  EvolutionOperationStatusSnapshot,
} from "../../contexts/OpenClawContext";

type EvolutionTranslate = (key: string, ...args: (string | number)[]) => string;

export function renderEvolutionLocalizedMessage(
  descriptor: EvolutionLocalizedMessage | null | undefined,
  fallback: string,
  t: EvolutionTranslate,
) {
  if (descriptor?.key) {
    return t(descriptor.key, ...descriptor.args);
  }
  return fallback;
}

export function renderEvolutionHistorySummary(
  entry: Pick<EvolutionHistoryEntry, "summary" | "summaryI18n">,
  t: EvolutionTranslate,
) {
  return renderEvolutionLocalizedMessage(entry.summaryI18n, entry.summary, t);
}

export function renderEvolutionAuditMessage(
  entry: Pick<EvolutionAuditEntry, "message" | "messageI18n">,
  t: EvolutionTranslate,
) {
  return renderEvolutionLocalizedMessage(entry.messageI18n, entry.message, t);
}

export function renderEvolutionRuntimeMessage(
  snapshot: Pick<EvolutionOperationStatusSnapshot, "message" | "messageI18n">,
  t: EvolutionTranslate,
) {
  return renderEvolutionLocalizedMessage(snapshot.messageI18n, snapshot.message, t);
}
