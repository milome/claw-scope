import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Activity, Clock3, Filter, History, Search, ShieldCheck, Tags, Undo2 } from "lucide-react";

import type {
  EvolutionAuditSummary,
  EvolutionHistoryEntry,
  EvolutionOperationType,
  EvolutionTemplateKind,
} from "../../contexts/OpenClawContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";

type HistoryStatusFilter = "all" | "success" | "failed" | "cancelled" | "rolled_back";
type HistoryTemplateFilter = "all" | EvolutionTemplateKind;
type HistoryOperationFilter = "all" | EvolutionOperationType;

function formatRelativeTime(createdAtMs: number) {
  const diffMs = Date.now() - createdAtMs;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hrs ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
}

function formatAbsoluteTime(createdAtMs: number) {
  return new Date(createdAtMs).toLocaleString();
}

function formatTemplateLabel(template: EvolutionTemplateKind) {
  switch (template) {
    case "aggressive":
      return "激进型重构";
    case "custom_template":
      return "自定义模板";
    case "knowledge_injection":
      return "知识注入";
    case "conservative":
    default:
      return "保守型修剪";
  }
}

function formatOperationTypeLabel(operationType: EvolutionOperationType) {
  switch (operationType) {
    case "custom_transform":
      return "自定义模板";
    case "inject_knowledge":
      return "知识注入";
    case "restore_snapshot":
      return "回滚恢复";
    case "optimize":
    default:
      return "结构优化";
  }
}

function formatStatusLabel(status: EvolutionHistoryEntry["status"]) {
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
                Evolution 历史与审计
              </SheetTitle>
              <SheetDescription>
                查看完整历史、筛选记录，并核对最小 operator audit / metrics。
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              {onQuickExportReport ? (
                <Button
                  variant="outline"
                  className="h-9 border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300"
                  onClick={() => void onQuickExportReport()}
                >
                  快速导出
                </Button>
              ) : null}
              {onExportReport ? (
                <Button
                  variant="outline"
                  className="h-9 border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300"
                  onClick={() => void onExportReport()}
                >
                  导出报告
                </Button>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        <div className="grid h-full min-h-0 grid-cols-[360px_minmax(0,1fr)]">
          <div className="border-r border-slate-200 px-5 py-5 dark:border-slate-800">
            <div className="mb-4 grid gap-3">
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  <Filter className="h-3.5 w-3.5 text-sky-500" />
                  Filters
                </div>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索节点、摘要、快照或标签"
                  className="h-9 border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950/70"
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as HistoryStatusFilter)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200"
                  >
                    <option value="all">全部状态</option>
                    <option value="success">成功</option>
                    <option value="failed">失败</option>
                    <option value="cancelled">已取消</option>
                    <option value="rolled_back">已回滚</option>
                  </select>
                  <select
                    value={templateFilter}
                    onChange={(event) => setTemplateFilter(event.target.value as HistoryTemplateFilter)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200"
                  >
                    <option value="all">全部模板</option>
                    <option value="conservative">保守型</option>
                    <option value="aggressive">激进型</option>
                    <option value="knowledge_injection">知识注入</option>
                    <option value="custom_template">自定义模板</option>
                  </select>
                  <select
                    value={operationFilter}
                    onChange={(event) => setOperationFilter(event.target.value as HistoryOperationFilter)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200"
                  >
                    <option value="all">全部类型</option>
                    <option value="optimize">结构优化</option>
                    <option value="inject_knowledge">知识注入</option>
                    <option value="custom_transform">自定义模板</option>
                    <option value="restore_snapshot">回滚恢复</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Total Ops
                  </div>
                  <div className="text-lg font-semibold">{auditSummary?.totalOperations ?? 0}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Success Rate
                  </div>
                  <div className="text-lg font-semibold">{successRate ?? 0}%</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Avg Duration
                  </div>
                  <div className="text-lg font-semibold">
                    {auditSummary?.averageDurationMs != null ? `${auditSummary.averageDurationMs} ms` : "--"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Audit Feed
                  </div>
                  <div className="text-sm font-medium">{isAuditLoading ? "loading..." : `${auditSummary?.recentEntries.length ?? 0} recent`}</div>
                </div>
              </div>
            </div>

            <div className="min-h-0 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {filteredEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                  当前筛选条件下没有历史记录。
                </div>
              ) : null}
              {filteredEntries.map((entry) => {
                const isSelected = entry.operationId === selectedEntry?.operationId;
                const canRollback = entry.operationKind === "execute" && entry.status === "success";
                return (
                  <button
                    key={entry.operationId}
                    type="button"
                    onClick={() => onSelectedOperationIdChange(entry.operationId)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-sky-300 bg-sky-50 shadow-sm dark:border-sky-700 dark:bg-sky-950/20"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{entry.nodeLabel}</span>
                      <Badge className={statusTone(entry.status)}>{formatStatusLabel(entry.status)}</Badge>
                    </div>
                    <div className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">{entry.summary}</div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <span>{formatTemplateLabel(entry.template)}</span>
                      <span>·</span>
                      <span>{formatOperationTypeLabel(entry.operationType)}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(entry.createdAtMs)}</span>
                    </div>
                    {canRollback ? (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                        <Undo2 className="h-3 w-3" />
                        可从详情中回滚
                      </div>
                    ) : null}
                  </button>
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
                        Selected Operation
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{selectedEntry.summary}</h3>
                    </div>
                    <Badge className={statusTone(selectedEntry.status)}>{formatStatusLabel(selectedEntry.status)}</Badge>
                  </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">节点</div>
                      <div className="text-sm font-medium">{selectedEntry.nodeLabel}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">模板</div>
                      <div className="text-sm font-medium">{formatTemplateLabel(selectedEntry.template)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">操作类型</div>
                      <div className="text-sm font-medium">{formatOperationTypeLabel(selectedEntry.operationType)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">源文档</div>
                      <div className="font-mono text-sm">{selectedEntry.sourceDocument}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">快照</div>
                      <div className="font-mono text-sm">{selectedEntry.snapshotId}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">字节变化</div>
                      <div className="text-sm font-medium">{selectedEntry.bytesBefore} → {selectedEntry.bytesAfter}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">时间</div>
                      <div className="text-sm font-medium">{formatRelativeTime(selectedEntry.createdAtMs)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">耗时</div>
                      <div className="text-sm font-medium">
                        {selectedEntry.durationMs != null ? `${selectedEntry.durationMs} ms` : "--"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">来源引用</div>
                      <div className="text-sm font-medium">{selectedEntry.sourceRef ?? "—"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Source Refs</div>
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
                      Capability Tags
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
                        <span className="text-sm text-slate-500 dark:text-slate-400">未记录 capability tags</span>
                      )}
                    </div>
                  </div>

                  {selectedEntry.operationKind === "rollback" ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                      该记录表示一次快照恢复操作，目标快照为 <span className="font-mono">{selectedEntry.snapshotId}</span>。
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
                        从此记录回滚
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
                      Audit Trail
                    </div>
                    {selectedAuditEntry ? (
                      <div className="space-y-3 text-sm">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                          {selectedAuditEntry.message}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Risk</div>
                            <div className="font-medium">{selectedAuditEntry.riskLevel}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Duration</div>
                            <div className="font-medium">{selectedAuditEntry.durationMs} ms</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Started</div>
                            <div className="font-medium">{formatAbsoluteTime(selectedAuditEntry.startedAtMs)}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Ended</div>
                            <div className="font-medium">{formatAbsoluteTime(selectedAuditEntry.endedAtMs)}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2 dark:border-slate-800 dark:bg-slate-950/60">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Source Refs</div>
                            <div className="font-medium break-all">
                              {selectedAuditEntry.sourceRefs.length > 0
                                ? selectedAuditEntry.sourceRefs.join(", ")
                                : selectedAuditEntry.sourceRef ?? "—"}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                            Capability Tags
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
                              <span className="text-sm text-slate-500 dark:text-slate-400">未记录 capability tags</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                        当前记录尚未命中独立 audit entry。
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      <Clock3 className="h-3.5 w-3.5 text-sky-500" />
                      Metrics Breakdown
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          Status
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {auditSummary?.statusBreakdown.length ? auditSummary.statusBreakdown.map((bucket) => (
                            <Badge key={bucket.key} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                              {bucket.key}: {bucket.count}
                            </Badge>
                          )) : <span className="text-sm text-slate-500 dark:text-slate-400">暂无数据</span>}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          By Template
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {auditSummary?.templateBreakdown.length ? auditSummary.templateBreakdown.map((bucket) => (
                            <Badge key={bucket.key} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                              {bucket.key}: {bucket.count}
                            </Badge>
                          )) : <span className="text-sm text-slate-500 dark:text-slate-400">暂无数据</span>}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          By Operation Type
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {auditSummary?.operationTypeBreakdown.length ? auditSummary.operationTypeBreakdown.map((bucket) => (
                            <Badge key={bucket.key} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                              {bucket.key}: {bucket.count}
                            </Badge>
                          )) : <span className="text-sm text-slate-500 dark:text-slate-400">暂无数据</span>}
                        </div>
                      </div>
                      <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                        <div className="flex items-center justify-between">
                          <span>High Risk Ops</span>
                          <span className="font-semibold">{auditSummary?.highRiskCount ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Unsafe Blocked</span>
                          <span className="font-semibold">{auditSummary?.unsafeBlockedCount ?? 0}</span>
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
                  选择一条历史记录以查看详情
                </div>
                当前筛选结果为空，或尚未选择具体记录。
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
