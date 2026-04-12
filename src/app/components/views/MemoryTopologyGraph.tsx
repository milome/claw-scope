import { useState } from "react";
import { Activity, Cpu, Database, Network, Split } from "lucide-react";
import { useI18n } from "../../contexts/I18nContext";
import type {
  EvolutionHistoryEntry,
  EvolutionOperationType,
  EvolutionOperationStatusSnapshot,
  EvolutionPreviewResult,
} from "../../contexts/OpenClawContext";
import { Button } from "../ui/button";

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

function truncateId(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  if (value.length <= 18) {
    return value;
  }
  return `${value.slice(0, 10)}…${value.slice(-4)}`;
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
  const [selectedNodeId, setSelectedNodeId] = useState<string>("n5");

  const containerWidth = 700;
  const containerHeight = 300;

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

  const nodes = [
    {
      id: "n1",
      label: t("evo.graph.node.root"),
      meta: truncateId(previewResult?.snapshotId ?? latestHistoryEntry?.snapshotId),
      x: 60,
      y: 150,
      icon: Database,
      status: t("evo.graph.status.stable"),
    },
    {
      id: "n2",
      label: t("evo.graph.node.preserved"),
      meta: `${previewResult?.bytesBefore ?? latestHistoryEntry?.bytesBefore ?? 0} B`,
      x: 240,
      y: 70,
      icon: Split,
      status: t("evo.graph.status.reference"),
    },
    {
      id: "n3",
      label: t("evo.graph.node.pruned"),
      meta: previewResult?.riskLevel ?? "review",
      x: 240,
      y: 230,
      icon: Network,
      status:
        template === "aggressive"
          ? t("evo.graph.status.review")
          : t("evo.graph.status.reference"),
    },
    {
      id: "n4",
      label: currentNode?.name || t("evo.graph.node.current"),
      meta: previewResult?.sourceDocument ?? latestHistoryEntry?.sourceDocument ?? "MEMORY.md",
      x: 420,
      y: 150,
      icon: Cpu,
      status: t("evo.graph.status.active"),
    },
    {
      id: "n5",
      label:
        template === "aggressive"
          ? t("evo.graph.node.targetAggressive")
          : template === "knowledge_injection"
            ? "Knowledge Candidate"
          : template === "conservative"
            ? t("evo.graph.node.targetConservative")
            : t("evo.graph.node.target"),
      meta:
        runtimeStatus?.phase ??
        latestHistoryEntry?.status ??
        t("evo.graph.status.pending"),
      x: 640,
      y: 150,
      icon: Activity,
      status: t("evo.graph.status.pending"),
    },
  ];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[nodes.length - 1];

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

  const edges = [
    { id: "e1", from: "n1", to: "n2", type: "solid", label: t("evo.graph.edge.branch") },
    { id: "e2", from: "n1", to: "n3", type: "solid", label: t("evo.graph.edge.branch") },
    { id: "e3", from: "n2", to: "n4", type: "solid", label: t("evo.graph.edge.merge") },
    { id: "e4", from: "n3", to: "n4", type: "solid", label: "" },
    { id: "e5", from: "n4", to: "n5", type: "dashed", animated: true, label: t("evo.graph.edge.evolve") },
  ];

  const drawPath = (
    fromNode: { x: number; y: number },
    toNode: { x: number; y: number },
  ) => {
    const dx = toNode.x - fromNode.x;
    const cx1 = fromNode.x + dx * 0.4;
    const cy1 = fromNode.y;
    const cx2 = toNode.x - dx * 0.4;
    const cy2 = toNode.y;
    return `M ${fromNode.x} ${fromNode.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${toNode.x} ${toNode.y}`;
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
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-500 dark:bg-slate-700" />
            {t("evo.graph.status.stable")}
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            {t("evo.graph.status.active")}
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span
              className={`h-2 w-2 animate-pulse rounded-full ${
                template === "aggressive"
                  ? "bg-red-500"
                  : template === "knowledge_injection"
                    ? "bg-violet-500"
                    : "bg-sky-400"
              }`}
            />
            {t("evo.graph.status.pending")}
          </div>
        </div>
      </div>

      <div className="relative h-[300px] w-full max-w-[700px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/75 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_18px_40px_rgba(2,6,23,0.24)]">
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
            const isTargetEdge = edge.to === "n5";
            const strokeColor = isTargetEdge
              ? template === "aggressive"
                ? "#ef444480"
                : template === "knowledge_injection"
                  ? "#8b5cf680"
                : "#38bdf880"
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
                {edge.label ? (
                  <text
                    x={(fromNode.x + toNode.x) / 2}
                    y={(fromNode.y + toNode.y) / 2 - 8}
                    fill={isTargetEdge ? targetTone.fill : "#64748b"}
                    fontSize="10"
                    textAnchor="middle"
                    className="font-medium"
                  >
                    {edge.label}
                  </text>
                ) : null}
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
            {node.id === "n5" && state === "executing" ? (
              <div className="absolute inset-0 rounded-full bg-sky-500/15 blur-xl animate-pulse dark:bg-sky-500/20" />
            ) : null}
            <div
              className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-300
                ${node.id === "n5"
                  ? `${targetTone.bg} ${targetTone.border} ${targetTone.text} ${targetTone.glow}`
                  : node.id === "n4"
                    ? "border-sky-300 bg-sky-50 text-sky-600 shadow-sm dark:border-sky-500/80 dark:bg-sky-950/20 dark:text-sky-400 dark:shadow-[0_0_15px_rgba(14,165,233,0.3)]"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-[#111116] dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"}
                ${hoveredNode === node.id || selectedNodeId === node.id ? "scale-110 shadow-lg" : "scale-100"}`}
            >
              {node.id === "n5" ? (
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
              <node.icon className={`h-5 w-5 ${node.id === "n5" && state === "executing" ? "animate-spin" : ""}`} />
            </div>

            <div className={`mt-2 flex flex-col items-center transition-all duration-300 ${hoveredNode === node.id ? "translate-y-0 opacity-100" : "opacity-90"}`}>
              <span className={`mb-0.5 whitespace-nowrap text-[11px] font-semibold ${node.id === "n5" ? targetTone.text : node.id === "n4" ? "text-sky-700 dark:text-sky-300" : "text-slate-700 dark:text-slate-300"}`}>
                {node.label}
              </span>
              <span className="mb-1 max-w-[132px] truncate text-[10px] text-slate-500 dark:text-slate-500">
                {node.meta}
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
          {t("evo.graph.meaning.baseline")}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {t("evo.graph.meaning.current")}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {t("evo.graph.meaning.target")}
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          {t("evo.graph.meaning.ops")}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Preview Operation
            </div>
            <div className="font-mono text-sm text-slate-700 dark:text-slate-200">
              {truncateId(previewResult?.operationId)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Snapshot
            </div>
            <div className="font-mono text-sm text-slate-700 dark:text-slate-200">
              {truncateId(runtimeStatus?.snapshotId ?? previewResult?.snapshotId ?? latestHistoryEntry?.snapshotId)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Runtime Status
            </div>
            <div className="font-mono text-sm text-slate-700 dark:text-slate-200">
              {runtimeStatus?.phase ?? latestHistoryEntry?.status ?? "preview_only"}
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
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Operation Type</div>
              <div className="font-medium">
                {formatOperationType(runtimeStatus?.operationType ?? previewResult?.operationType ?? latestHistoryEntry?.operationType ?? null)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Source Ref</div>
              <div className="font-medium">
                {runtimeStatus?.sourceRef ?? previewResult?.sourceRef ?? latestHistoryEntry?.sourceRef ?? "—"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">History Summary</div>
              <div className="font-medium">
                {latestHistoryEntry?.summary ?? "No linked history yet"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Preview Change Count</div>
              <div className="font-medium">
                {previewResult?.changes.length ?? 0}
              </div>
            </div>
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
