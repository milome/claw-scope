import { useMemo, useState } from "react";
import {
  Cpu,
  Database,
  History,
  Network,
  Split,
  Undo2,
} from "lucide-react";

import { useI18n } from "../../contexts/I18nContext";
import type {
  EvolutionHistoryEntry,
  EvolutionOperationType,
  EvolutionOperationStatusSnapshot,
  EvolutionPreviewResult,
} from "../../contexts/OpenClawContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface TopologyProps {
  currentNode: { name: string } | undefined;
  template: "conservative" | "aggressive" | "knowledge_injection" | "custom_template" | null;
  state: string;
  previewResult: EvolutionPreviewResult | null;
  runtimeStatus: EvolutionOperationStatusSnapshot | null;
  latestHistoryEntry: EvolutionHistoryEntry | null;
  onOpenDiff?: () => void;
  onOpenHistory?: () => void;
}

type GraphDetail = {
  label: string;
  value: string;
};

type GraphNode = {
  id: string;
  label: string;
  meta: string;
  x: number;
  y: number;
  icon: typeof Database;
  status: string;
  tone: "neutral" | "active" | "target" | "success" | "warning";
  description: string;
  details: GraphDetail[];
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  type: "solid" | "dashed";
  label: string;
  animated?: boolean;
  emphasis?: boolean;
};

function truncateId(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  if (value.length <= 18) {
    return value;
  }
  return `${value.slice(0, 10)}…${value.slice(-4)}`;
}

function truncateText(value: string | null | undefined, max = 44) {
  if (!value) {
    return "—";
  }
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

function joinOrDash(values: string[] | undefined) {
  return values && values.length > 0 ? values.join(", ") : "—";
}

function formatOperationType(value?: EvolutionOperationType | string | null) {
  switch (value) {
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

function formatHistoryStatus(status?: EvolutionHistoryEntry["status"] | null) {
  switch (status) {
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    case "rolled_back":
      return "已回滚";
    case "success":
      return "成功";
    default:
      return "等待中";
  }
}

function formatRuntimeFlags(runtimeStatus: EvolutionOperationStatusSnapshot | null) {
  if (!runtimeStatus) {
    return "—";
  }
  const flags = [];
  if (runtimeStatus.previewStale) flags.push("preview stale");
  if (runtimeStatus.conflictDetected) flags.push("conflict");
  if (runtimeStatus.overrideApplied) flags.push("override");
  return flags.length > 0 ? flags.join(", ") : "clean";
}

export function MemoryTopologyGraph({
  currentNode,
  template,
  state,
  previewResult,
  runtimeStatus,
  latestHistoryEntry,
  onOpenDiff,
  onOpenHistory,
}: TopologyProps) {
  const { t } = useI18n();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("history");

  const containerWidth = 700;
  const containerHeight = 320;

  const targetTone =
    template === "aggressive"
      ? {
          text: "text-red-600 dark:text-red-400",
          border: "border-red-300 dark:border-red-500/50",
          bg: "bg-red-50 dark:bg-red-950/30",
          glow: "shadow-[0_0_20px_rgba(239,68,68,0.18)] dark:shadow-[0_0_20px_rgba(239,68,68,0.2)]",
          fill: "#ef4444",
        }
      : template === "knowledge_injection"
        ? {
            text: "text-violet-600 dark:text-violet-300",
            border: "border-violet-300 dark:border-violet-500/50",
            bg: "bg-violet-50 dark:bg-violet-950/30",
            glow: "shadow-[0_0_20px_rgba(139,92,246,0.18)] dark:shadow-[0_0_20px_rgba(139,92,246,0.24)]",
            fill: "#8b5cf6",
          }
        : {
            text: "text-sky-600 dark:text-sky-400",
            border: "border-sky-300 dark:border-sky-500/50",
            bg: "bg-sky-50 dark:bg-sky-950/30",
            glow: "shadow-[0_0_20px_rgba(14,165,233,0.16)] dark:shadow-[0_0_20px_rgba(14,165,233,0.2)]",
            fill: "#38bdf8",
          };

  const sourceRefs = useMemo(
    () =>
      runtimeStatus?.sourceRefs?.length
        ? runtimeStatus.sourceRefs
        : previewResult?.sourceRefs?.length
          ? previewResult.sourceRefs
          : latestHistoryEntry?.sourceRefs ?? [],
    [latestHistoryEntry?.sourceRefs, previewResult?.sourceRefs, runtimeStatus?.sourceRefs],
  );
  const capabilityTags = useMemo(
    () =>
      runtimeStatus?.capabilityTags?.length
        ? runtimeStatus.capabilityTags
        : previewResult?.capabilityTags?.length
          ? previewResult.capabilityTags
          : latestHistoryEntry?.capabilityTags ?? [],
    [latestHistoryEntry?.capabilityTags, previewResult?.capabilityTags, runtimeStatus?.capabilityTags],
  );
  const sourceDocument =
    runtimeStatus?.sourceDocument ??
    previewResult?.sourceDocument ??
    latestHistoryEntry?.sourceDocument ??
    "MEMORY.md";
  const snapshotId =
    runtimeStatus?.snapshotId ??
    previewResult?.snapshotId ??
    latestHistoryEntry?.snapshotId ??
    "—";
  const latestHistorySummary = latestHistoryEntry?.summary ?? "No linked history yet";
  const previewChangeCount = previewResult?.changes.length ?? 0;
  const bytesBefore = previewResult?.bytesBefore ?? latestHistoryEntry?.bytesBefore ?? 0;
  const bytesAfter = previewResult?.bytesAfter ?? latestHistoryEntry?.bytesAfter ?? bytesBefore;

  const nodes = useMemo<GraphNode[]>(
    () => [
      {
        id: "memory",
        label: "Memory Root",
        meta: sourceDocument,
        x: 72,
        y: 160,
        icon: Database,
        status: "baseline",
        tone: "neutral",
        description: "目标 MEMORY 文档在本次操作链开始前的基线入口。",
        details: [
          { label: "Source Document", value: sourceDocument },
          { label: "Bytes Before", value: `${bytesBefore}` },
          { label: "Current Node", value: currentNode?.name ?? "—" },
        ],
      },
      {
        id: "sources",
        label: "Source Refs",
        meta: `${sourceRefs.length} refs`,
        x: 220,
        y: 76,
        icon: Network,
        status: sourceRefs.length > 0 ? "annotated" : "idle",
        tone: sourceRefs.length > 0 ? "target" : "neutral",
        description: "本次 Evolution 绑定的来源引用与 capability tags，会驱动 traceability 与冲突检测。",
        details: [
          { label: "Source Refs", value: joinOrDash(sourceRefs) },
          { label: "Capability Tags", value: joinOrDash(capabilityTags) },
          { label: "Operation Type", value: formatOperationType(previewResult?.operationType ?? latestHistoryEntry?.operationType) },
        ],
      },
      {
        id: "preview",
        label: "Preview Overlay",
        meta: `${previewChangeCount} changes`,
        x: 238,
        y: 244,
        icon: Split,
        status: previewResult ? previewResult.riskLevel : "pending",
        tone: previewResult ? "target" : "neutral",
        description: "Analyze & Preview 生成的变更叠层，负责把 diff/risk 压缩成可执行提案。",
        details: [
          { label: "Change Count", value: `${previewChangeCount}` },
          { label: "Risk Level", value: previewResult?.riskLevel ?? "—" },
          { label: "Bytes Delta", value: `${bytesBefore} → ${bytesAfter}` },
        ],
      },
      {
        id: "snapshot",
        label: "Snapshot Record",
        meta: truncateId(snapshotId),
        x: 392,
        y: 84,
        icon: Database,
        status: snapshotId !== "—" ? "frozen" : "pending",
        tone: snapshotId !== "—" ? "warning" : "neutral",
        description: "执行前冻结的可回滚快照，用于把 preview 提案变成可恢复的操作。",
        details: [
          { label: "Snapshot Id", value: snapshotId },
          { label: "History Snapshot", value: latestHistoryEntry?.snapshotId ?? "—" },
          { label: "Rollback Ready", value: latestHistoryEntry ? "yes" : "pending" },
        ],
      },
      {
        id: "runtime",
        label: "Runtime Phase",
        meta: runtimeStatus?.phase ?? state,
        x: 402,
        y: 236,
        icon: Cpu,
        status: runtimeStatus?.runtimeState ?? state,
        tone: runtimeStatus ? "active" : "neutral",
        description: "真实执行阶段与运行态标记，负责把 preview 提案推进成实际写入结果。",
        details: [
          { label: "Runtime State", value: runtimeStatus?.runtimeState ?? "preview_only" },
          { label: "Phase", value: runtimeStatus?.phase ?? "—" },
          { label: "Progress", value: runtimeStatus ? `${runtimeStatus.progressPct}%` : "—" },
          { label: "Flags", value: formatRuntimeFlags(runtimeStatus) },
        ],
      },
      {
        id: "history",
        label: "History Record",
        meta: formatHistoryStatus(latestHistoryEntry?.status),
        x: 612,
        y: 84,
        icon: History,
        status: latestHistoryEntry ? "recorded" : "pending",
        tone:
          latestHistoryEntry?.status === "success"
            ? "success"
            : latestHistoryEntry
              ? "warning"
              : "neutral",
        description: "执行完成后写入的历史记录，是 graph 与 history sheet 的对接点。",
        details: [
          { label: "History Status", value: formatHistoryStatus(latestHistoryEntry?.status) },
          { label: "Operation Kind", value: latestHistoryEntry?.operationKind ?? "—" },
          { label: "Summary", value: latestHistorySummary },
        ],
      },
      {
        id: "rollback",
        label: "Rollback Target",
        meta: truncateId(latestHistoryEntry?.snapshotId ?? snapshotId),
        x: 624,
        y: 236,
        icon: Undo2,
        status:
          latestHistoryEntry?.operationKind === "rollback"
            ? "restored"
            : latestHistoryEntry
              ? "available"
              : "pending",
        tone: latestHistoryEntry ? "warning" : "neutral",
        description: "最新可恢复的目标快照，说明当前执行链最终会落到哪个 rollback object。",
        details: [
          { label: "Rollback Snapshot", value: latestHistoryEntry?.snapshotId ?? snapshotId },
          { label: "Rollback State", value: latestHistoryEntry?.operationKind === "rollback" ? "restored" : latestHistoryEntry ? "available" : "pending" },
          { label: "History Summary", value: latestHistorySummary },
        ],
      },
    ],
    [
      bytesAfter,
      bytesBefore,
      capabilityTags,
      currentNode?.name,
      latestHistoryEntry,
      latestHistorySummary,
      previewChangeCount,
      previewResult,
      runtimeStatus,
      snapshotId,
      sourceDocument,
      sourceRefs,
      state,
    ],
  );

  const edges = useMemo<GraphEdge[]>(
    () => [
      { id: "e1", from: "memory", to: "preview", type: "solid", label: "baseline → preview" },
      { id: "e2", from: "sources", to: "preview", type: "solid", label: "source refs" },
      { id: "e3", from: "preview", to: "snapshot", type: "solid", label: "freeze" },
      { id: "e4", from: "snapshot", to: "runtime", type: "solid", label: "execute" },
      { id: "e5", from: "runtime", to: "history", type: "dashed", animated: true, label: "record", emphasis: true },
      { id: "e6", from: "history", to: "rollback", type: "solid", label: "restore target" },
    ],
    [],
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[5];

  const drawPath = (
    fromNode: { x: number; y: number },
    toNode: { x: number; y: number },
  ) => {
    const dx = toNode.x - fromNode.x;
    const cx1 = fromNode.x + dx * 0.38;
    const cy1 = fromNode.y;
    const cx2 = toNode.x - dx * 0.38;
    const cy2 = toNode.y;
    return `M ${fromNode.x} ${fromNode.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${toNode.x} ${toNode.y}`;
  };

  const nodeClasses = (node: GraphNode) => {
    if (node.tone === "target") {
      return `${targetTone.bg} ${targetTone.border} ${targetTone.text} ${targetTone.glow}`;
    }
    if (node.tone === "active") {
      return "border-sky-300 bg-sky-50 text-sky-600 shadow-sm dark:border-sky-500/80 dark:bg-sky-950/20 dark:text-sky-400 dark:shadow-[0_0_15px_rgba(14,165,233,0.3)]";
    }
    if (node.tone === "success") {
      return "border-emerald-300 bg-emerald-50 text-emerald-600 shadow-sm dark:border-emerald-500/60 dark:bg-emerald-950/20 dark:text-emerald-300";
    }
    if (node.tone === "warning") {
      return "border-amber-300 bg-amber-50 text-amber-700 shadow-sm dark:border-amber-500/50 dark:bg-amber-950/20 dark:text-amber-300";
    }
    return "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-[#111116] dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200";
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-50 p-6 dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.94))]">
      <div className="mb-1 flex w-full max-w-[700px] shrink-0 items-end justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/75 dark:text-slate-400">
            <Network className="h-3.5 w-3.5 text-sky-500" />
            {t("evo.graph.meaning.beta")}
          </div>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <Network className="h-4 w-4 text-sky-500" />
            {t("evo.graph.title")}
          </h3>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {t("evo.graph.desc")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {previewChangeCount} preview changes
          </Badge>
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {sourceRefs.length} source refs
          </Badge>
        </div>
      </div>

      <div className="relative h-[320px] w-full max-w-[700px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/75 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_18px_40px_rgba(2,6,23,0.24)]">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${containerWidth} ${containerHeight}`}>
          <defs>
            <marker id="arrow-solid" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-400 dark:fill-slate-600" />
            </marker>
            <marker id="arrow-dashed" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={targetTone.fill} />
            </marker>
          </defs>

          {edges.map((edge) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const isHovered = hoveredNode === fromNode.id || hoveredNode === toNode.id;
            const strokeColor = edge.emphasis
              ? targetTone.fill
              : isHovered
                ? "#64748b"
                : "#cbd5e1";

            return (
              <g key={edge.id} className="transition-all duration-300">
                <path
                  d={drawPath(fromNode, toNode)}
                  fill="none"
                  stroke={strokeColor}
                  className={edge.animated ? "animate-[dash_2s_linear_infinite] stroke-[2px]" : "stroke-[1.5px]"}
                  strokeDasharray={edge.type === "dashed" ? "6,6" : "none"}
                  markerEnd={`url(#${edge.type === "dashed" ? "arrow-dashed" : "arrow-solid"})`}
                />
                <text
                  x={(fromNode.x + toNode.x) / 2}
                  y={(fromNode.y + toNode.y) / 2 - 8}
                  fill={edge.emphasis ? targetTone.fill : "#64748b"}
                  fontSize="10"
                  textAnchor="middle"
                  className="font-medium"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => (
          <div
            key={node.id}
            className="group absolute flex -translate-x-1/2 -translate-y-1/2 transform cursor-pointer flex-col items-center justify-center"
            style={{ left: `${(node.x / containerWidth) * 100}%`, top: `${(node.y / containerHeight) * 100}%` }}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={() => setSelectedNodeId(node.id)}
          >
            {node.id === "runtime" && state === "executing" ? (
              <div className="absolute inset-0 rounded-full bg-sky-500/15 blur-xl animate-pulse dark:bg-sky-500/20" />
            ) : null}
            <div
              className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-300 ${nodeClasses(node)} ${
                hoveredNode === node.id || selectedNodeId === node.id ? "scale-110 shadow-lg" : "scale-100"
              }`}
            >
              {node.id === "runtime" && state === "executing" ? (
                <div
                  className={`absolute -right-1 -top-1 h-3 w-3 rounded-full ${
                    template === "aggressive"
                      ? "bg-red-500"
                      : template === "knowledge_injection"
                        ? "bg-violet-500"
                        : "bg-sky-400"
                  } animate-ping`}
                />
              ) : null}
              <node.icon className={`h-5 w-5 ${node.id === "runtime" && state === "executing" ? "animate-spin" : ""}`} />
            </div>

            <div className={`mt-2 flex flex-col items-center transition-all duration-300 ${hoveredNode === node.id ? "translate-y-0 opacity-100" : "opacity-90"}`}>
              <span className={`mb-0.5 whitespace-nowrap text-[11px] font-semibold ${node.tone === "target" ? targetTone.text : node.tone === "active" ? "text-sky-700 dark:text-sky-300" : "text-slate-700 dark:text-slate-300"}`}>
                {node.label}
              </span>
              <span className="mb-1 max-w-[138px] truncate text-[10px] text-slate-500 dark:text-slate-500">
                {truncateText(node.meta, 26)}
              </span>
              <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500">
                {node.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid w-full max-w-[700px] gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/75 dark:shadow-[0_18px_40px_rgba(2,6,23,0.24)]">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {t("evo.graph.meaning.title")}
        </h4>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {"当前图谱已按 source refs -> preview -> snapshot -> runtime -> history -> rollback 映射本次 Evolution 的主要对象链，而不再只是静态示意。"}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Source Refs
            </div>
            <div className="font-mono text-sm text-slate-700 dark:text-slate-200">
              {sourceRefs.length}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Snapshot
            </div>
            <div className="font-mono text-sm text-slate-700 dark:text-slate-200">
              {truncateId(snapshotId)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              History Status
            </div>
            <div className="font-mono text-sm text-slate-700 dark:text-slate-200">
              {formatHistoryStatus(latestHistoryEntry?.status)}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                Explain Panel
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {selectedNode.label}
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {selectedNode.description}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onOpenDiff ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300"
                  onClick={onOpenDiff}
                >
                  Open Diff
                </Button>
              ) : null}
              {onOpenHistory ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300"
                  onClick={onOpenHistory}
                >
                  Open History
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              {formatOperationType(runtimeStatus?.operationType ?? previewResult?.operationType ?? latestHistoryEntry?.operationType ?? null)}
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              {previewChangeCount} preview changes
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              {capabilityTags.length} capability tags
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {selectedNode.details.map((detail) => (
              <div
                key={`${selectedNode.id}-${detail.label}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {detail.label}
                </div>
                <div className="font-medium break-all">{detail.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dash {
          to { stroke-dashoffset: -12; }
        }
      ` }} />
    </div>
  );
}
