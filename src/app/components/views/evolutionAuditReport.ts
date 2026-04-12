import type { EvolutionAuditEntry, EvolutionAuditSummary } from "../../contexts/OpenClawContext";
import { translateEvolutionCopy } from "../../contexts/evolutionI18n";
import { renderEvolutionAuditMessage } from "./evolutionMessageI18n";

export const EVOLUTION_AUDIT_REPORT_SCHEMA_VERSION = "evolution-audit-report.v2";

export type EvolutionOperatorHealth = {
  score: number;
  statusLabel: string;
  statusTone: "emerald" | "amber" | "red" | "slate";
  recommendations: string[];
};

type EvolutionTranslate = (key: string, ...args: (string | number)[]) => string;

function formatBlockedReasonLabel(code: string | null | undefined, t: EvolutionTranslate) {
  switch (code) {
    case "EVOLUTION_UNSAFE_APPLY_BLOCKED":
      return t("evo.reason.unsafeApplyBlocked");
    case "EVOLUTION_HIGH_RISK_CONFIRMATION_REQUIRED":
      return t("evo.reason.confirmationRequired");
    case "EVOLUTION_ACTIVE_CONFLICT":
    case "EVOLUTION_RUNTIME_AGENT_CONFLICT":
      return t("evo.reason.activeAgentConflict");
    case "EVOLUTION_RUNTIME_SOURCE_DOCUMENT_CONFLICT":
      return t("evo.reason.sourceDocumentConflict");
    case "EVOLUTION_RUNTIME_SOURCE_REF_CONFLICT":
      return t("evo.reason.sourceRefRuntimeConflict");
    case "EVOLUTION_ALREADY_APPLIED":
      return t("evo.reason.alreadyApplied");
    case "EVOLUTION_SOURCE_REF_CONFLICT":
      return t("evo.reason.sourceRefConflict");
    case "EVOLUTION_PREVIEW_STALE":
      return t("evo.reason.previewStale");
    default:
      return code ?? t("evo.reason.none");
  }
}

function formatOverrideReasonLabel(code: string | null | undefined, t: EvolutionTranslate) {
  switch (code) {
    case "EVOLUTION_HIGH_RISK_CONFIRMATION_OVERRIDE":
      return t("evo.override.highRiskConfirmation");
    default:
      return code ?? t("evo.reason.none");
  }
}

function formatOperationTypeLabel(operationType: string, t: EvolutionTranslate) {
  switch (operationType) {
    case "inject_knowledge":
      return t("evo.historySheet.operation.inject");
    case "custom_transform":
      return t("evo.historySheet.operation.custom");
    case "restore_snapshot":
      return t("evo.historySheet.operation.restore");
    case "optimize":
    default:
      return t("evo.historySheet.operation.optimize");
  }
}

function formatTemplateLabel(template: string, t: EvolutionTranslate) {
  switch (template) {
    case "aggressive":
      return t("evo.historySheet.template.aggressive");
    case "knowledge_injection":
      return t("evo.historySheet.template.knowledge");
    case "custom_template":
      return t("evo.historySheet.template.custom");
    case "conservative":
      return t("evo.historySheet.template.conservative");
    default:
      return template;
  }
}

function formatReportModeLabel(mode: "manual" | "quick", t: EvolutionTranslate) {
  switch (mode) {
    case "quick":
      return t("evo.report.mode.quick");
    case "manual":
    default:
      return t("evo.report.mode.manual");
  }
}

function formatStatusLabel(
  status: EvolutionAuditEntry["status"],
  preflightBlocked: boolean,
  t: EvolutionTranslate,
) {
  if (preflightBlocked) {
    return t("evo.historySheet.stats.preflightBlocked");
  }
  switch (status) {
    case "rolled_back":
      return t("evo.historySheet.status.rolled_back");
    case "failed":
      return t("evo.historySheet.status.failed");
    case "cancelled":
      return t("evo.historySheet.status.cancelled");
    case "success":
    default:
      return t("evo.historySheet.status.success");
  }
}

function renderBuckets(
  titleKey: string,
  buckets: { key: string; count: number }[],
  t: EvolutionTranslate,
  keyFormatter?: (key: string) => string,
) {
  return [
    `## ${t(titleKey)}`,
    ...(buckets.length > 0
      ? buckets.map((bucket) => `- ${keyFormatter ? keyFormatter(bucket.key) : bucket.key}: ${bucket.count}`)
      : [`- ${t("evo.historySheet.metrics.noData")}`]),
    "",
  ];
}

function renderAuditEntry(entry: EvolutionAuditEntry, t: EvolutionTranslate) {
  return [
    `### ${entry.operationId}`,
    `- ${t("evo.historySheet.status.all")}: ${formatStatusLabel(entry.status, entry.preflightBlocked, t)}`,
    `- ${t("evo.historySheet.detail.operationType")}: ${formatOperationTypeLabel(entry.operationType, t)}`,
    `- ${t("evo.historySheet.detail.template")}: ${entry.template}`,
    `- ${t("evo.historySheet.detail.snapshot")}: ${entry.snapshotId}`,
    `- ${t("evo.historySheet.detail.sourceRef")}: ${entry.sourceRef ?? t("evo.reason.none")}`,
    `- ${t("evo.historySheet.detail.sourceRefs")}: ${entry.sourceRefs.join(", ") || t("evo.reason.none")}`,
    `- ${t("evo.historySheet.audit.preflight")}: ${entry.preflightBlocked ? t("evo.historySheet.audit.preflight.blocked") : t("evo.historySheet.audit.preflight.passed")}`,
    `- ${t("evo.historySheet.audit.blockedReason")}: ${formatBlockedReasonLabel(entry.blockedReasonCode, t)}`,
    `- ${t("evo.historySheet.audit.override")}: ${entry.overrideApplied ? t("evo.historySheet.audit.override.applied") : t("evo.historySheet.audit.override.no")}`,
    `- ${t("evo.historySheet.audit.overrideReason")}: ${formatOverrideReasonLabel(entry.overrideReasonCode, t)}`,
    `- ${t("evo.historySheet.audit.capabilityTags")}: ${entry.capabilityTags.join(", ") || t("evo.reason.none")}`,
    `- ${t("evo.historySheet.audit.started")}: ${new Date(entry.startedAtMs).toISOString()}`,
    `- ${t("evo.historySheet.audit.ended")}: ${new Date(entry.endedAtMs).toISOString()}`,
    `- ${t("evo.historySheet.audit.duration")}: ${entry.durationMs} ms`,
    `- ${t("evo.report.entry.message")}: ${renderEvolutionAuditMessage(entry, t)}`,
    "",
  ];
}

export function buildEvolutionOperatorHealth(
  auditSummary: EvolutionAuditSummary,
  t: EvolutionTranslate,
): EvolutionOperatorHealth {
  if (auditSummary.totalOperations === 0) {
    return {
      score: 100,
      statusLabel: t("evo.historySheet.metrics.coldStart"),
      statusTone: "slate",
      recommendations: [
        t("evo.historySheet.metrics.noData"),
      ],
    };
  }

  const successRate = auditSummary.totalOperations > 0
    ? auditSummary.successCount / auditSummary.totalOperations
    : 1;
  const failureRate = auditSummary.totalOperations > 0
    ? auditSummary.failedCount / auditSummary.totalOperations
    : 0;
  const blockedRate = auditSummary.totalOperations > 0
    ? auditSummary.preflightBlockedCount / auditSummary.totalOperations
    : 0;
  const overrideRate = auditSummary.totalOperations > 0
    ? auditSummary.overrideCount / auditSummary.totalOperations
    : 0;

  let score = 100;
  score -= Math.round(failureRate * 35);
  score -= Math.round(blockedRate * 25);
  score -= Math.round(overrideRate * 15);
  score -= Math.min(auditSummary.highRiskCount * 2, 12);
  score = Math.max(0, Math.min(100, score));

  const recommendations: string[] = [];
  if (auditSummary.preflightBlockedCount > 0) {
    recommendations.push(`${t("evo.historySheet.metrics.blockedReasons")} -> ${t("evo.reason.previewStale")} / ${t("evo.reason.sourceRefConflict")} / ${t("evo.reason.unsafeApplyBlocked")}`);
  }
  if (auditSummary.overrideCount > 0) {
    recommendations.push(`${t("evo.historySheet.stats.overrides")} -> ${t("evo.override.highRiskConfirmation")}`);
  }
  if (auditSummary.failedCount > 0) {
    recommendations.push(`${t("evo.historySheet.title")} / ${t("evo.historySheet.audit.title")}`);
  }
  if (auditSummary.highRiskCount > 0 && auditSummary.overrideCount === 0) {
    recommendations.push(t("evo.dialog.confirm"));
  }
  if (recommendations.length === 0) {
    recommendations.push(t("evo.historySheet.metrics.dashboard"));
  }

  if (score >= 85 && successRate >= 0.8) {
    return { score, statusLabel: t("evo.historySheet.status.success"), statusTone: "emerald", recommendations };
  }
  if (score >= 60) {
    return { score, statusLabel: t("evo.historySheet.stats.auditFeed"), statusTone: "amber", recommendations };
  }
  return { score, statusLabel: t("evo.historySheet.status.failed"), statusTone: "red", recommendations };
}

export function buildEvolutionAuditReportMarkdown(
  auditSummary: EvolutionAuditSummary,
  options?: {
    generatedAt?: Date;
    reportMode?: "manual" | "quick";
    lang?: string;
  },
) {
  const generatedAt = options?.generatedAt ?? new Date();
  const reportMode = options?.reportMode ?? "manual";
  const t = (key: string, ...args: (string | number)[]) =>
    translateEvolutionCopy(options?.lang ?? "en", key, ...args);
  const recentBlocked = auditSummary.recentEntries.filter((entry) => entry.preflightBlocked);
  const recentTerminal = auditSummary.recentEntries.filter((entry) => !entry.preflightBlocked);
  const operatorHealth = buildEvolutionOperatorHealth(auditSummary, t);

  return [
    `# ${t("evo.report.title")}`,
    ``,
    `## ${t("evo.report.section.metadata")}`,
    `- ${t("evo.report.meta.schemaVersion")}: ${EVOLUTION_AUDIT_REPORT_SCHEMA_VERSION}`,
    `- ${t("evo.report.meta.reportMode")}: ${formatReportModeLabel(reportMode, t)}`,
    `- ${t("evo.report.meta.generatedAt")}: ${generatedAt.toISOString()}`,
    `- ${t("evo.report.meta.agent")}: ${auditSummary.agentId}`,
    ``,
    `## ${t("evo.report.section.summary")}`,
    `- ${t("evo.report.summary.totalOperations")}: ${auditSummary.totalOperations}`,
    `- ${t("evo.report.summary.successCount")}: ${auditSummary.successCount}`,
    `- ${t("evo.report.summary.failedCount")}: ${auditSummary.failedCount}`,
    `- ${t("evo.report.summary.cancelledCount")}: ${auditSummary.cancelledCount}`,
    `- ${t("evo.report.summary.rolledBackCount")}: ${auditSummary.rolledBackCount}`,
    `- ${t("evo.report.summary.averageDuration")}: ${auditSummary.averageDurationMs ?? "--"} ms`,
    ``,
    `## ${t("evo.report.section.governance")}`,
    `- ${t("evo.report.governance.highRiskCount")}: ${auditSummary.highRiskCount}`,
    `- ${t("evo.report.governance.unsafeBlockedCount")}: ${auditSummary.unsafeBlockedCount}`,
    `- ${t("evo.report.governance.preflightBlockedCount")}: ${auditSummary.preflightBlockedCount}`,
    `- ${t("evo.report.governance.overrideCount")}: ${auditSummary.overrideCount}`,
    ``,
    `## ${t("evo.report.section.readiness")}`,
    `- ${t("evo.report.readiness.status")}: ${operatorHealth.statusLabel}`,
    `- ${t("evo.report.readiness.healthScore")}: ${operatorHealth.score}`,
    `- ${t("evo.report.readiness.recommendations")}:`,
    ...operatorHealth.recommendations.map((item) => `  - ${item}`),
    ``,
    `## ${t("evo.report.section.trend")}`,
    `- ${t("evo.report.trend.last24hOperations")}: ${auditSummary.last24hOperations}`,
    `- ${t("evo.report.trend.last24hFailures")}: ${auditSummary.last24hFailures}`,
    `- ${t("evo.report.trend.last24hBlocked")}: ${auditSummary.last24hBlocked}`,
    `- ${t("evo.report.trend.last7dOperations")}: ${auditSummary.last7dOperations}`,
    `- ${t("evo.report.trend.last7dFailures")}: ${auditSummary.last7dFailures}`,
    `- ${t("evo.report.trend.last7dOverrides")}: ${auditSummary.last7dOverrides}`,
    `- ${t("evo.report.trend.recentDailyBreakdown")}:`,
    ...(auditSummary.recentDailyBreakdown.length > 0
      ? auditSummary.recentDailyBreakdown.map((bucket) => `  - ${bucket.key}: ${bucket.count}`)
      : [`  - ${t("evo.historySheet.metrics.noData")}`]),
    ``,
    ...renderBuckets(
      "evo.report.section.statusBreakdown",
      auditSummary.statusBreakdown,
      t,
      (key) => formatStatusLabel(key as EvolutionAuditEntry["status"], false, t),
    ),
    ...renderBuckets(
      "evo.report.section.templateBreakdown",
      auditSummary.templateBreakdown,
      t,
      (key) => formatTemplateLabel(key, t),
    ),
    ...renderBuckets(
      "evo.report.section.operationTypeBreakdown",
      auditSummary.operationTypeBreakdown,
      t,
      (key) => formatOperationTypeLabel(key, t),
    ),
    ...renderBuckets(
      "evo.report.section.blockedReasonBreakdown",
      auditSummary.blockedReasonBreakdown,
      t,
      (key) => `${formatBlockedReasonLabel(key, t)} (${key})`,
    ),
    `## ${t("evo.report.section.recentPreflightBlocked")}`,
    ...(recentBlocked.length > 0
      ? recentBlocked.flatMap((entry) => renderAuditEntry(entry, t))
      : [`- ${t("evo.historySheet.metrics.noData")}`, ""]),
    `## ${t("evo.report.section.recentTerminalAudit")}`,
    ...(recentTerminal.length > 0
      ? recentTerminal.flatMap((entry) => renderAuditEntry(entry, t))
      : [`- ${t("evo.historySheet.metrics.noData")}`, ""]),
    `## ${t("evo.report.section.residualNote")}`,
    `- ${t("evo.report.residual.pointInTime")}`,
    `- ${t("evo.report.residual.investigate")}`,
    "",
  ].join("\n");
}
