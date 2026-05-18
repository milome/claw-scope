import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Activity, Clock3, Filter, History, Search, ShieldCheck, Tags, Undo2 } from "lucide-react";

import type {
  EvolutionAuditEntry,
  EvolutionAuditSummary,
  EvolutionHistoryEntry,
  EvolutionOperationType,
  EvolutionTemplateKind,
} from "../../contexts/OpenClawContext";
import { useI18n } from "../../contexts/I18nContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { buildEvolutionOperatorHealth } from "./evolutionAuditReport";
import {
  renderEvolutionAuditMessage,
  renderEvolutionHistorySummary,
} from "./evolutionMessageI18n";

type HistoryStatusFilter = "all" | "success" | "failed" | "cancelled" | "rolled_back";
type HistoryTemplateFilter = "all" | EvolutionTemplateKind;
type HistoryOperationFilter = "all" | EvolutionOperationType;

function formatRelativeTime(createdAtMs: number, t: (key: string, ...args: (string | number)[]) => string) {
  const diffMs = Date.now() - createdAtMs;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return t("evo.time.just_now");
  if (diffMinutes < 60) return t("evo.time.min_ago", diffMinutes);
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return t("evo.time.hr_ago", diffHours);
  const diffDays = Math.floor(diffHours / 24);
  return t("evo.time.day_ago", diffDays);
}

function formatAbsoluteTime(createdAtMs: number) {
  return new Date(createdAtMs).toLocaleString();
}

function formatTemplateLabel(template: EvolutionTemplateKind, t: (key: string, ...args: (string | number)[]) => string) {
  switch (template) {
    case "aggressive":
      return t("evo.template.aggressive.title");
    case "custom_template":
      return t("evo.template.custom.title");
    case "knowledge_injection":
      return t("evo.template.knowledge.title");
    case "conservative":
    default:
      return t("evo.template.conservative.title");
  }
}

function formatOperationTypeLabel(operationType: EvolutionOperationType, t: (key: string, ...args: (string | number)[]) => string) {
  switch (operationType) {
    case "custom_transform":
      return t("evo.historySheet.operation.custom");
    case "inject_knowledge":
      return t("evo.historySheet.operation.inject");
    case "restore_snapshot":
      return t("evo.historySheet.operation.restore");
    case "optimize":
    default:
      return t("evo.historySheet.operation.optimize");
  }
}

function formatStatusLabel(status: EvolutionHistoryEntry["status"], t: (key: string, ...args: (string | number)[]) => string) {
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

function formatTemplateBreakdownLabel(template: string, t: (key: string, ...args: (string | number)[]) => string) {
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

function statusTone(status: EvolutionHistoryEntry["status"]) {
  switch (status) {
    case "failed":
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300";
    case "rolled_back":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300";
    case "success":
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300";
  }
}

function formatAuditEntryLabel(entry: EvolutionAuditEntry, t: (key: string, ...args: (string | number)[]) => string) {
  if (entry.preflightBlocked) {
    return t("evo.historySheet.stats.preflightBlocked");
  }
  switch (entry.status) {
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

function auditEntryTone(entry: EvolutionAuditEntry) {
  if (entry.preflightBlocked) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300";
  }
  switch (entry.status) {
    case "failed":
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300";
    case "rolled_back":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300";
    case "success":
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300";
  }
}

function formatBlockedReasonLabel(code: string | null | undefined, t: (key: string, ...args: (string | number)[]) => string) {
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

function formatOverrideReasonLabel(code: string | null | undefined, t: (key: string, ...args: (string | number)[]) => string) {
  switch (code) {
    case "EVOLUTION_HIGH_RISK_CONFIRMATION_OVERRIDE":
      return t("evo.override.highRiskConfirmation");
    default:
      return code ?? t("evo.reason.none");
  }
}

type EvolutionHistorySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  historyEntries: EvolutionHistoryEntry[];
  auditSummary: EvolutionAuditSummary | null;
  isAuditLoading: boolean;
  selectedOperationId: string | null;
  onSelectedOperationIdChange: (operationId: string | null) => void;
  onExportReport?: () => void | Promise<void>;
  onQuickExportReport?: () => void | Promise<void>;
  onRollback: (entry: EvolutionHistoryEntry) => void | Promise<void>;
};

export function EvolutionHistorySheet({
  open,
  onOpenChange,
  historyEntries,
  auditSummary,
  isAuditLoading,
  selectedOperationId,
  onSelectedOperationIdChange,
  onExportReport,
  onQuickExportReport,
  onRollback,
}: EvolutionHistorySheetProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [templateFilter, setTemplateFilter] = useState<HistoryTemplateFilter>("all");
  const [operationFilter, setOperationFilter] = useState<HistoryOperationFilter>("all");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredEntries = useMemo(() => {
    return historyEntries.filter((entry) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) {
        return false;
      }
      if (templateFilter !== "all" && entry.template !== templateFilter) {
        return false;
      }
      if (operationFilter !== "all" && entry.operationType !== operationFilter) {
        return false;
      }
      if (!deferredQuery) {
        return true;
      }
      const haystack = [
        entry.nodeLabel,
        entry.summary,
        entry.snapshotId,
        entry.sourceDocument,
        entry.sourceRef ?? "",
        entry.sourceRefs.join(" "),
        entry.capabilityTags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(deferredQuery);
    });
  }, [deferredQuery, historyEntries, operationFilter, statusFilter, templateFilter]);

  useEffect(() => {
    if (filteredEntries.length === 0) {
      onSelectedOperationIdChange(null);
      return;
    }
    if (!selectedOperationId || !filteredEntries.some((entry) => entry.operationId === selectedOperationId)) {
      onSelectedOperationIdChange(filteredEntries[0].operationId);
    }
  }, [filteredEntries, onSelectedOperationIdChange, selectedOperationId]);

  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.operationId === selectedOperationId) ?? filteredEntries[0] ?? null,
    [filteredEntries, selectedOperationId],
  );
  const selectedAuditEntry = useMemo(
    () => auditSummary?.recentEntries.find((entry) => entry.operationId === selectedEntry?.operationId) ?? null,
    [auditSummary, selectedEntry],
  );

  const successRate = auditSummary?.totalOperations
    ? Math.round((auditSummary.successCount / auditSummary.totalOperations) * 100)
    : null;
  const operatorHealth = useMemo(
    () => (auditSummary ? buildEvolutionOperatorHealth(auditSummary, t) : null),
    [auditSummary, t],
  );
  const operatorHealthTone =
    operatorHealth?.statusTone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
      : operatorHealth?.statusTone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
        : operatorHealth?.statusTone === "red"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
          : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[96vw] border-slate-200 bg-white p-0 text-slate-900 sm:max-w-[1100px] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
      >
        <SheetHeader className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-sky-500" />
                {t("evo.historySheet.title")}
              </SheetTitle>
              <SheetDescription>
                {t("evo.historySheet.desc")}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              {onQuickExportReport ? (
                <Button
                  variant="outline"
                  className="h-9 border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300"
                  onClick={() => void onQuickExportReport()}
                >
                  {t("evo.historySheet.export.quick")}
                </Button>
              ) : null}
              {onExportReport ? (
                <Button
                  variant="outline"
                  className="h-9 border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300"
                  onClick={() => void onExportReport()}
                >
                  {t("evo.historySheet.export.full")}
                </Button>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col overflow-hidden border-r border-slate-200 px-5 py-5 dark:border-slate-800">
            <div className="mb-4 grid gap-3">
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  <Filter className="h-3.5 w-3.5 text-sky-500" />
                  {t("evo.historySheet.filters")}
                </div>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("evo.historySheet.search.placeholder")}
                  className="h-9 border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950/70"
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as HistoryStatusFilter)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200"
                  >
                    <option value="all">{t("evo.historySheet.status.all")}</option>
                    <option value="success">{t("evo.historySheet.status.success")}</option>
                    <option value="failed">{t("evo.historySheet.status.failed")}</option>
                    <option value="cancelled">{t("evo.historySheet.status.cancelled")}</option>
                    <option value="rolled_back">{t("evo.historySheet.status.rolled_back")}</option>
                  </select>
                  <select
                    value={templateFilter}
                    onChange={(event) => setTemplateFilter(event.target.value as HistoryTemplateFilter)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200"
                  >
                    <option value="all">{t("evo.historySheet.template.all")}</option>
                    <option value="conservative">{t("evo.historySheet.template.conservative")}</option>
                    <option value="aggressive">{t("evo.historySheet.template.aggressive")}</option>
                    <option value="knowledge_injection">{t("evo.historySheet.template.knowledge")}</option>
                    <option value="custom_template">{t("evo.historySheet.template.custom")}</option>
                  </select>
                  <select
                    value={operationFilter}
                    onChange={(event) => setOperationFilter(event.target.value as HistoryOperationFilter)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200"
                  >
                    <option value="all">{t("evo.historySheet.operation.all")}</option>
                    <option value="optimize">{t("evo.historySheet.operation.optimize")}</option>
                    <option value="inject_knowledge">{t("evo.historySheet.operation.inject")}</option>
                    <option value="custom_transform">{t("evo.historySheet.operation.custom")}</option>
                    <option value="restore_snapshot">{t("evo.historySheet.operation.restore")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {t("evo.historySheet.stats.total")}
                  </div>
                  <div className="text-lg font-semibold">{auditSummary?.totalOperations ?? 0}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {t("evo.historySheet.stats.successRate")}
                  </div>
                  <div className="text-lg font-semibold">{successRate ?? 0}%</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {t("evo.historySheet.stats.avgDuration")}
                  </div>
                  <div className="text-lg font-semibold">
                    {auditSummary?.averageDurationMs != null ? `${auditSummary.averageDurationMs} ms` : "--"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {t("evo.historySheet.stats.auditFeed")}
                  </div>
                  <div className="text-sm font-medium">{isAuditLoading ? t("evo.historySheet.loading") : t("evo.historySheet.stats.recentCount", auditSummary?.recentEntries.length ?? 0)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {t("evo.historySheet.stats.preflightBlocked")}
                  </div>
                  <div className="text-sm font-medium">{auditSummary?.preflightBlockedCount ?? 0}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {t("evo.historySheet.stats.overrides")}
                  </div>
                  <div className="text-sm font-medium">{auditSummary?.overrideCount ?? 0}</div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {filteredEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                  {t("evo.historySheet.empty.filtered")}
                </div>
              ) : null}
              {filteredEntries.map((entry) => {
                const isSelected = entry.operationId === selectedEntry?.operationId;
                const detailLines = [
                  `${t("evo.historySheet.detail.template")}: ${formatTemplateLabel(entry.template, t)}`,
                  `${t("evo.historySheet.detail.operationType")}: ${formatOperationTypeLabel(entry.operationType, t)}`,
                  `${t("evo.historySheet.detail.sourceDocument")}: ${entry.sourceDocument}`,
                  `${t("evo.historySheet.detail.snapshot")}: ${entry.snapshotId}`,
                  `${t("evo.historySheet.detail.sourceRef")}: ${entry.sourceRef ?? t("evo.reason.none")}`,
                  `${t("evo.historySheet.detail.sourceRefs")}: ${entry.sourceRefs.length > 0 ? entry.sourceRefs.join(", ") : entry.sourceRef ?? t("evo.reason.none")}`,
                  `${t("evo.historySheet.detail.tags")}: ${entry.capabilityTags.length > 0 ? entry.capabilityTags.join(", ") : t("evo.reason.none")}`,
                ];
                return (
                  <Tooltip key={entry.operationId}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSelectedOperationIdChange(entry.operationId)}
                        className={`group w-full rounded-xl border p-3 text-left transition-colors ${
                          isSelected
                            ? "border-sky-300 bg-sky-50 shadow-sm dark:border-sky-700 dark:bg-sky-950/20"
                            : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                            {entry.nodeLabel}
                          </span>
                          <Badge className={statusTone(entry.status)}>{formatStatusLabel(entry.status, t)}</Badge>
                        </div>
                        <div className="mb-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {renderEvolutionHistorySummary(entry, t)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {formatRelativeTime(entry.createdAtMs, t)}
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="max-w-[360px] space-y-1.5 text-left">
                      <div className="font-medium">{entry.nodeLabel}</div>
                      <div className="break-words">{renderEvolutionHistorySummary(entry, t)}</div>
                      <div className="break-words border-t border-white/20 pt-1 text-[11px] leading-5 opacity-90">
                        {detailLines.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto px-6 py-5 custom-scrollbar">
            {selectedEntry ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        <Activity className="h-3.5 w-3.5 text-sky-500" />
                        {t("evo.history.selectedOperation")}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{renderEvolutionHistorySummary(selectedEntry, t)}</h3>
                    </div>
                    <Badge className={statusTone(selectedEntry.status)}>{formatStatusLabel(selectedEntry.status, t)}</Badge>
                  </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.detail.node")}</div>
                      <div className="text-sm font-medium">{selectedEntry.nodeLabel}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.detail.template")}</div>
                      <div className="text-sm font-medium">{formatTemplateLabel(selectedEntry.template, t)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.detail.operationType")}</div>
                      <div className="text-sm font-medium">{formatOperationTypeLabel(selectedEntry.operationType, t)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.detail.sourceDocument")}</div>
                      <div className="font-mono text-sm">{selectedEntry.sourceDocument}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.detail.snapshot")}</div>
                      <div className="font-mono text-sm">{selectedEntry.snapshotId}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.detail.bytes")}</div>
                      <div className="text-sm font-medium">{selectedEntry.bytesBefore} → {selectedEntry.bytesAfter}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.detail.time")}</div>
                      <div className="text-sm font-medium">{formatRelativeTime(selectedEntry.createdAtMs, t)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.detail.duration")}</div>
                      <div className="text-sm font-medium">
                        {selectedEntry.durationMs != null ? `${selectedEntry.durationMs} ms` : "--"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.detail.sourceRef")}</div>
                      <div className="text-sm font-medium">{selectedEntry.sourceRef ?? t("evo.reason.none")}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.detail.sourceRefs")}</div>
                      <div className="text-sm font-medium">
                        {selectedEntry.sourceRefs.length > 0
                          ? selectedEntry.sourceRefs.join(", ")
                          : selectedEntry.sourceRef ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        <Tags className="h-3.5 w-3.5 text-sky-500" />
                        {t("evo.historySheet.detail.tags")}
                      </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntry.capabilityTags.length > 0 ? (
                        selectedEntry.capabilityTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300"
                          >
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500 dark:text-slate-400">{t("evo.historySheet.metrics.noData")}</span>
                      )}
                    </div>
                  </div>

                  {selectedEntry.operationKind === "rollback" ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                      {t("evo.historySheet.detail.rollbackNote", selectedEntry.snapshotId)}
                    </div>
                  ) : null}

                  {selectedEntry.operationKind === "execute" && selectedEntry.status === "success" ? (
                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="outline"
                        className="border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-950/20"
                        onClick={() => void onRollback(selectedEntry)}
                      >
                        <Undo2 className="mr-2 h-4 w-4" />
                        {t("evo.historySheet.detail.rollbackAction")}
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
                      {t("evo.historySheet.audit.title")}
                    </div>
                    {selectedAuditEntry ? (
                      <div className="space-y-3 text-sm">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                          {renderEvolutionAuditMessage(selectedAuditEntry, t)}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.audit.risk")}</div>
                            <div className="font-medium">{selectedAuditEntry.riskLevel}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.audit.duration")}</div>
                            <div className="font-medium">{selectedAuditEntry.durationMs} ms</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.audit.started")}</div>
                            <div className="font-medium">{formatAbsoluteTime(selectedAuditEntry.startedAtMs)}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.audit.ended")}</div>
                            <div className="font-medium">{formatAbsoluteTime(selectedAuditEntry.endedAtMs)}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.audit.sourceRefs")}</div>
                            <div className="font-medium break-all">
                              {selectedAuditEntry.sourceRefs.length > 0
                                ? selectedAuditEntry.sourceRefs.join(", ")
                                : selectedAuditEntry.sourceRef ?? t("evo.reason.none")}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.audit.preflight")}</div>
                            <div className="font-medium">{selectedAuditEntry.preflightBlocked ? t("evo.historySheet.audit.preflight.blocked") : t("evo.historySheet.audit.preflight.passed")}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.audit.blockedReason")}</div>
                            <div className="font-medium break-all">{formatBlockedReasonLabel(selectedAuditEntry.blockedReasonCode, t)}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.audit.override")}</div>
                            <div className="font-medium">{selectedAuditEntry.overrideApplied ? t("evo.historySheet.audit.override.applied") : t("evo.historySheet.audit.override.no")}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("evo.historySheet.audit.overrideReason")}</div>
                            <div className="font-medium break-all">{formatOverrideReasonLabel(selectedAuditEntry.overrideReasonCode, t)}</div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                            {t("evo.historySheet.audit.capabilityTags")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedAuditEntry.capabilityTags.length > 0 ? (
                              selectedAuditEntry.capabilityTags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300"
                                >
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-slate-500 dark:text-slate-400">{t("evo.historySheet.metrics.noData")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                        {t("evo.historySheet.audit.none")}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      <Clock3 className="h-3.5 w-3.5 text-sky-500" />
                      {t("evo.historySheet.metrics.title")}
                    </div>
                    <div className="space-y-4">
                      <div className={`rounded-xl border px-4 py-3 ${operatorHealthTone}`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
                              {t("evo.historySheet.metrics.dashboard")}
                            </div>
                            <div className="text-sm font-semibold">
                              {operatorHealth?.statusLabel ?? t("evo.historySheet.metrics.coldStart")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] uppercase tracking-[0.14em] opacity-70">{t("evo.historySheet.metrics.healthScore")}</div>
                            <div className="text-lg font-semibold">{operatorHealth?.score ?? 100}</div>
                          </div>
                        </div>
                        <div className="space-y-1 text-xs leading-5">
                          {(operatorHealth?.recommendations ?? [t("evo.historySheet.metrics.noData")]).map((item) => (
                            <div key={item}>- {item}</div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          {t("evo.historySheet.metrics.trend")}
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="flex items-center justify-between">
                            <span>{t("evo.historySheet.metrics.24hOps")}</span>
                            <span className="font-semibold">{auditSummary?.last24hOperations ?? 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{t("evo.historySheet.metrics.24hFailures")}</span>
                            <span className="font-semibold">{auditSummary?.last24hFailures ?? 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{t("evo.historySheet.metrics.24hBlocked")}</span>
                            <span className="font-semibold">{auditSummary?.last24hBlocked ?? 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{t("evo.historySheet.metrics.7dOps")}</span>
                            <span className="font-semibold">{auditSummary?.last7dOperations ?? 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{t("evo.historySheet.metrics.7dFailures")}</span>
                            <span className="font-semibold">{auditSummary?.last7dFailures ?? 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{t("evo.historySheet.metrics.7dOverrides")}</span>
                            <span className="font-semibold">{auditSummary?.last7dOverrides ?? 0}</span>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {auditSummary?.recentDailyBreakdown.length ? auditSummary.recentDailyBreakdown.map((bucket) => (
                            <Badge key={bucket.key} variant="outline" className="border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                              {bucket.key}: {bucket.count}
                            </Badge>
                          )) : <span className="text-sm text-slate-500 dark:text-slate-400">{t("evo.historySheet.metrics.noData")}</span>}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          {t("evo.historySheet.metrics.status")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {auditSummary?.statusBreakdown.length ? auditSummary.statusBreakdown.map((bucket) => (
                            <Badge key={bucket.key} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                              {formatStatusLabel(bucket.key as EvolutionHistoryEntry["status"], t)}: {bucket.count}
                            </Badge>
                          )) : <span className="text-sm text-slate-500 dark:text-slate-400">{t("evo.historySheet.metrics.noData")}</span>}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          {t("evo.historySheet.metrics.byTemplate")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {auditSummary?.templateBreakdown.length ? auditSummary.templateBreakdown.map((bucket) => (
                            <Badge key={bucket.key} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                              {formatTemplateBreakdownLabel(bucket.key, t)}: {bucket.count}
                            </Badge>
                          )) : <span className="text-sm text-slate-500 dark:text-slate-400">{t("evo.historySheet.metrics.noData")}</span>}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          {t("evo.historySheet.metrics.byOperation")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {auditSummary?.operationTypeBreakdown.length ? auditSummary.operationTypeBreakdown.map((bucket) => (
                            <Badge key={bucket.key} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                              {formatOperationTypeLabel(bucket.key as EvolutionOperationType, t)}: {bucket.count}
                            </Badge>
                          )) : <span className="text-sm text-slate-500 dark:text-slate-400">{t("evo.historySheet.metrics.noData")}</span>}
                        </div>
                      </div>
                      <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                        <div className="flex items-center justify-between">
                          <span>{t("evo.historySheet.metrics.highRisk")}</span>
                          <span className="font-semibold">{auditSummary?.highRiskCount ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t("evo.historySheet.metrics.unsafeBlocked")}</span>
                          <span className="font-semibold">{auditSummary?.unsafeBlockedCount ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t("evo.historySheet.stats.preflightBlocked")}</span>
                          <span className="font-semibold">{auditSummary?.preflightBlockedCount ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t("evo.historySheet.stats.overrides")}</span>
                          <span className="font-semibold">{auditSummary?.overrideCount ?? 0}</span>
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          {t("evo.historySheet.metrics.blockedReasons")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {auditSummary?.blockedReasonBreakdown.length ? auditSummary.blockedReasonBreakdown.map((bucket) => (
                            <Badge key={bucket.key} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                              {formatBlockedReasonLabel(bucket.key, t)}: {bucket.count}
                            </Badge>
                          )) : <span className="text-sm text-slate-500 dark:text-slate-400">{t("evo.historySheet.metrics.noData")}</span>}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          {t("evo.historySheet.metrics.recentFeed")}
                        </div>
                        <div className="space-y-2">
                          {auditSummary?.recentEntries.length ? auditSummary.recentEntries.slice(0, 5).map((entry) => (
                            <div
                              key={`${entry.operationId}-${entry.endedAtMs}-${entry.blockedReasonCode ?? "ok"}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60"
                            >
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <Badge className={auditEntryTone(entry)}>{formatAuditEntryLabel(entry, t)}</Badge>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {formatRelativeTime(entry.endedAtMs, t)}
                                </span>
                              </div>
                              <div className="text-xs text-slate-700 dark:text-slate-200">{renderEvolutionAuditMessage(entry, t)}</div>
                              <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 break-all">
                                {entry.preflightBlocked
                                  ? formatBlockedReasonLabel(entry.blockedReasonCode, t)
                                  : entry.overrideApplied
                                    ? formatOverrideReasonLabel(entry.overrideReasonCode, t)
                                    : formatOperationTypeLabel(entry.operationType, t)}
                              </div>
                            </div>
                          )) : <span className="text-sm text-slate-500 dark:text-slate-400">{t("evo.historySheet.metrics.noData")}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                  <Search className="h-4 w-4 text-sky-500" />
                  {t("evo.historySheet.detail.searchTitle")}
                </div>
                {t("evo.historySheet.detail.searchDesc")}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
