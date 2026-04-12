import type { EvolutionAuditEntry, EvolutionAuditSummary } from "../../contexts/OpenClawContext";

export const EVOLUTION_AUDIT_REPORT_SCHEMA_VERSION = "evolution-audit-report.v2";

export type EvolutionOperatorHealth = {
  score: number;
  statusLabel: string;
  statusTone: "emerald" | "amber" | "red" | "slate";
  recommendations: string[];
};

function formatBlockedReasonLabel(code?: string | null) {
  switch (code) {
    case "EVOLUTION_UNSAFE_APPLY_BLOCKED":
      return "Unsafe Apply Blocked";
    case "EVOLUTION_HIGH_RISK_CONFIRMATION_REQUIRED":
      return "Confirmation Required";
    case "EVOLUTION_ACTIVE_CONFLICT":
    case "EVOLUTION_RUNTIME_AGENT_CONFLICT":
      return "Active Agent Conflict";
    case "EVOLUTION_RUNTIME_SOURCE_DOCUMENT_CONFLICT":
      return "Source Document Conflict";
    case "EVOLUTION_RUNTIME_SOURCE_REF_CONFLICT":
      return "Source Ref Runtime Conflict";
    case "EVOLUTION_ALREADY_APPLIED":
      return "Already Applied";
    case "EVOLUTION_SOURCE_REF_CONFLICT":
      return "Source Ref Conflict";
    case "EVOLUTION_PREVIEW_STALE":
      return "Preview Stale";
    default:
      return code ?? "—";
  }
}

function formatOverrideReasonLabel(code?: string | null) {
  switch (code) {
    case "EVOLUTION_HIGH_RISK_CONFIRMATION_OVERRIDE":
      return "High Risk Confirmation Override";
    default:
      return code ?? "—";
  }
}

function formatOperationTypeLabel(operationType: string) {
  switch (operationType) {
    case "inject_knowledge":
      return "知识注入";
    case "custom_transform":
      return "自定义模板";
    case "restore_snapshot":
      return "回滚恢复";
    case "optimize":
    default:
      return "结构优化";
  }
}

function formatStatusLabel(status: EvolutionAuditEntry["status"], preflightBlocked: boolean) {
  if (preflightBlocked) {
    return "预检阻断";
  }
  switch (status) {
    case "rolled_back":
      return "已回滚";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    case "success":
    default:
      return "成功";
  }
}

function renderBuckets(title: string, buckets: { key: string; count: number }[], keyFormatter?: (key: string) => string) {
  return [
    `## ${title}`,
    ...(buckets.length > 0
      ? buckets.map((bucket) => `- ${keyFormatter ? keyFormatter(bucket.key) : bucket.key}: ${bucket.count}`)
      : ["- none"]),
    "",
  ];
}

function renderAuditEntry(entry: EvolutionAuditEntry) {
  return [
    `### ${entry.operationId}`,
    `- Status: ${formatStatusLabel(entry.status, entry.preflightBlocked)}`,
    `- Operation Type: ${formatOperationTypeLabel(entry.operationType)}`,
    `- Template: ${entry.template}`,
    `- Snapshot: ${entry.snapshotId}`,
    `- Source Ref: ${entry.sourceRef ?? "—"}`,
    `- Source Refs: ${entry.sourceRefs.join(", ") || "—"}`,
    `- Preflight Blocked: ${entry.preflightBlocked ? "yes" : "no"}`,
    `- Blocked Reason: ${formatBlockedReasonLabel(entry.blockedReasonCode)}`,
    `- Override Applied: ${entry.overrideApplied ? "yes" : "no"}`,
    `- Override Reason: ${formatOverrideReasonLabel(entry.overrideReasonCode)}`,
    `- Capability Tags: ${entry.capabilityTags.join(", ") || "—"}`,
    `- Started At: ${new Date(entry.startedAtMs).toISOString()}`,
    `- Ended At: ${new Date(entry.endedAtMs).toISOString()}`,
    `- Duration: ${entry.durationMs} ms`,
    `- Message: ${entry.message}`,
    "",
  ];
}

export function buildEvolutionOperatorHealth(auditSummary: EvolutionAuditSummary): EvolutionOperatorHealth {
  if (auditSummary.totalOperations === 0) {
    return {
      score: 100,
      statusLabel: "Cold Start",
      statusTone: "slate",
      recommendations: [
        "尚无 Evolution 审计数据；先完成至少一次 preview/execute 链路，再观察治理指标。",
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
    recommendations.push("检查 blocked reasons，优先清理 stale preview / source ref conflict / unsafe apply。");
  }
  if (auditSummary.overrideCount > 0) {
    recommendations.push("复核 override 使用场景，确认高风险确认不是在掩盖真实冲突。");
  }
  if (auditSummary.failedCount > 0) {
    recommendations.push("针对失败操作回查 history 与 audit trail，确认失败链是否可回滚。");
  }
  if (auditSummary.highRiskCount > 0 && auditSummary.overrideCount === 0) {
    recommendations.push("高风险操作较多，但 override 使用较少；继续保持确认门禁。");
  }
  if (recommendations.length === 0) {
    recommendations.push("当前治理信号平稳，可继续关注长期趋势与 dashboard 持久化。");
  }

  if (score >= 85 && successRate >= 0.8) {
    return { score, statusLabel: "Healthy", statusTone: "emerald", recommendations };
  }
  if (score >= 60) {
    return { score, statusLabel: "Watch", statusTone: "amber", recommendations };
  }
  return { score, statusLabel: "Action Required", statusTone: "red", recommendations };
}

export function buildEvolutionAuditReportMarkdown(
  auditSummary: EvolutionAuditSummary,
  options?: {
    generatedAt?: Date;
    reportMode?: "manual" | "quick";
  },
) {
  const generatedAt = options?.generatedAt ?? new Date();
  const reportMode = options?.reportMode ?? "manual";
  const recentBlocked = auditSummary.recentEntries.filter((entry) => entry.preflightBlocked);
  const recentTerminal = auditSummary.recentEntries.filter((entry) => !entry.preflightBlocked);
  const operatorHealth = buildEvolutionOperatorHealth(auditSummary);

  return [
    `# Evolution Operator Report`,
    ``,
    `## Report Metadata`,
    `- Schema Version: ${EVOLUTION_AUDIT_REPORT_SCHEMA_VERSION}`,
    `- Report Mode: ${reportMode}`,
    `- Generated At: ${generatedAt.toISOString()}`,
    `- Agent: ${auditSummary.agentId}`,
    ``,
    `## Executive Summary`,
    `- Total Operations: ${auditSummary.totalOperations}`,
    `- Success Count: ${auditSummary.successCount}`,
    `- Failed Count: ${auditSummary.failedCount}`,
    `- Cancelled Count: ${auditSummary.cancelledCount}`,
    `- Rolled Back Count: ${auditSummary.rolledBackCount}`,
    `- Average Duration: ${auditSummary.averageDurationMs ?? "--"} ms`,
    ``,
    `## Governance Signals`,
    `- High Risk Count: ${auditSummary.highRiskCount}`,
    `- Unsafe Blocked Count: ${auditSummary.unsafeBlockedCount}`,
    `- Preflight Blocked Count: ${auditSummary.preflightBlockedCount}`,
    `- Override Count: ${auditSummary.overrideCount}`,
    ``,
    `## Operator Readiness`,
    `- Status: ${operatorHealth.statusLabel}`,
    `- Health Score: ${operatorHealth.score}`,
    `- Recommendations:`,
    ...operatorHealth.recommendations.map((item) => `  - ${item}`),
    ``,
    `## Trend Snapshot`,
    `- Last 24h Operations: ${auditSummary.last24hOperations}`,
    `- Last 24h Failures: ${auditSummary.last24hFailures}`,
    `- Last 24h Blocked: ${auditSummary.last24hBlocked}`,
    `- Last 7d Operations: ${auditSummary.last7dOperations}`,
    `- Last 7d Failures: ${auditSummary.last7dFailures}`,
    `- Last 7d Overrides: ${auditSummary.last7dOverrides}`,
    `- Recent Daily Breakdown:`,
    ...(auditSummary.recentDailyBreakdown.length > 0
      ? auditSummary.recentDailyBreakdown.map((bucket) => `  - ${bucket.key}: ${bucket.count}`)
      : ["  - none"]),
    ``,
    ...renderBuckets("Status Breakdown", auditSummary.statusBreakdown),
    ...renderBuckets("Template Breakdown", auditSummary.templateBreakdown),
    ...renderBuckets("Operation Type Breakdown", auditSummary.operationTypeBreakdown, formatOperationTypeLabel),
    ...renderBuckets(
      "Blocked Reason Breakdown",
      auditSummary.blockedReasonBreakdown,
      (key) => `${formatBlockedReasonLabel(key)} (${key})`,
    ),
    `## Recent Preflight Blocked Attempts`,
    ...(recentBlocked.length > 0
      ? recentBlocked.flatMap((entry) => renderAuditEntry(entry))
      : ["- none", ""]),
    `## Recent Terminal Audit Entries`,
    ...(recentTerminal.length > 0
      ? recentTerminal.flatMap((entry) => renderAuditEntry(entry))
      : ["- none", ""]),
    `## Residual Note`,
    `- This report is a point-in-time operator export, not a persistent dashboard.`,
    `- If blocked reasons trend upward, continue investigating E5-S6 conflict/override residuals.`,
    "",
  ].join("\n");
}
