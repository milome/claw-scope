import { BrainCircuit, Cpu, Orbit, Workflow } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { SemanticCluster, SemanticConcept, SemanticMindMapModel } from "./memorySemanticTypes";
import { ArchiveDiagnosticsCard, ArchiveLayerHeader, ArchiveNotice, ArchiveSectionCard, type ArchiveTone } from "./memoryArchiveUi";
import { LabelValueList } from "./LabelValueList";

type MemoryMindMapPanelProps = {
  tone?: ArchiveTone;
  model: SemanticMindMapModel;
  t: (key: string, ...args: (string | number)[]) => string;
  showDebug: boolean;
  onToggleDebug: () => void;
};

type SemanticClusterAnchor = {
  cluster: SemanticCluster;
  concepts: SemanticConcept[];
  x: string;
  y: string;
  colorClass: string;
  glowClass: string;
  bgClass: string;
  borderClass: string;
  pulseColor: string;
};

type FloatingConceptNode = {
  concept: SemanticConcept;
  parentId: string;
  x: string;
  y: string;
};

const CLUSTER_PRESETS = [
  {
    x: "30%",
    y: "25%",
    colorClass: "text-cyan-400",
    glowClass: "shadow-[0_0_20px_rgba(34,211,238,0.4)]",
    bgClass: "bg-cyan-950/90",
    borderClass: "border-cyan-500/50",
    pulseColor: "#22d3ee",
  },
  {
    x: "70%",
    y: "25%",
    colorClass: "text-violet-400",
    glowClass: "shadow-[0_0_20px_rgba(167,139,250,0.4)]",
    bgClass: "bg-violet-950/90",
    borderClass: "border-violet-500/50",
    pulseColor: "#a78bfa",
  },
  {
    x: "30%",
    y: "75%",
    colorClass: "text-rose-400",
    glowClass: "shadow-[0_0_20px_rgba(251,113,133,0.38)]",
    bgClass: "bg-rose-950/90",
    borderClass: "border-rose-500/50",
    pulseColor: "#fb7185",
  },
  {
    x: "70%",
    y: "75%",
    colorClass: "text-amber-400",
    glowClass: "shadow-[0_0_20px_rgba(251,191,36,0.35)]",
    bgClass: "bg-amber-950/90",
    borderClass: "border-amber-500/50",
    pulseColor: "#fbbf24",
  },
];

function shortLabel(label: string, max = 22) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function shortText(text: string, max = 150) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function buildClusterAnchors(model: SemanticMindMapModel) {
  return model.clusters.slice(0, 4).map((cluster, index) => {
    const preset = CLUSTER_PRESETS[index % CLUSTER_PRESETS.length];
    return {
      cluster,
      concepts: model.concepts.filter((concept) => cluster.conceptIds.includes(concept.id)).slice(0, 4),
      ...preset,
    } satisfies SemanticClusterAnchor;
  });
}

function buildFloatingConcepts(anchors: SemanticClusterAnchor[]) {
  const offsets = [
    [{ x: "15%", y: "15%" }, { x: "22%", y: "36%" }, { x: "40%", y: "12%" }, { x: "46%", y: "32%" }],
    [{ x: "85%", y: "15%" }, { x: "80%", y: "35%" }, { x: "60%", y: "12%" }, { x: "56%", y: "32%" }],
    [{ x: "15%", y: "85%" }, { x: "25%", y: "65%" }, { x: "40%", y: "88%" }, { x: "46%", y: "68%" }],
    [{ x: "85%", y: "85%" }, { x: "60%", y: "90%" }, { x: "80%", y: "65%" }, { x: "56%", y: "68%" }],
  ];

  return anchors.flatMap((anchor, anchorIndex) =>
    anchor.concepts.map((concept, conceptIndex) => ({
      concept,
      parentId: anchor.cluster.id,
      x: offsets[anchorIndex]?.[conceptIndex]?.x ?? anchor.x,
      y: offsets[anchorIndex]?.[conceptIndex]?.y ?? anchor.y,
    } satisfies FloatingConceptNode)),
  );
}

export function MemoryMindMapPanel({ tone = "sky", model, t, showDebug, onToggleDebug }: MemoryMindMapPanelProps) {
  const anchors = useMemo(() => buildClusterAnchors(model), [model]);
  const floatingConcepts = useMemo(() => buildFloatingConcepts(anchors), [anchors]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(anchors[0]?.cluster.id ?? model.concepts[0]?.id ?? "");

  const selectedCluster = model.clusters.find((cluster) => cluster.id === selectedNodeId) ?? null;
  const selectedConcept = model.concepts.find((concept) => concept.id === selectedNodeId) ?? null;
  const selectedNode = selectedCluster ?? selectedConcept;
  const selectedEvidence = selectedCluster?.evidence ?? selectedConcept?.evidence ?? [];
  const selectedEvidenceCount = selectedEvidence.length;
  const selectedSummary = selectedCluster?.summary ?? selectedConcept?.explanation ?? "";
  const selectedKeywords = selectedConcept?.keywords.slice(0, 4) ?? [];

  return (
    <motion.div
      key="view-mind-map"
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.24 }}
      className="space-y-4"
    >
      <ArchiveLayerHeader
        icon={BrainCircuit}
        title={t("memory.tab.knowledge")}
        description={t("memory.knowledge.note")}
        tone={tone}
      />

      <div className="space-y-4">
        <ArchiveSectionCard tone={tone}>
            <div className="mb-3 flex items-start justify-between gap-3 rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,rgba(240,249,255,0.95),rgba(236,253,245,0.88))] p-4 dark:border-sky-900/60 dark:bg-[linear-gradient(135deg,rgba(12,74,110,0.2),rgba(6,95,70,0.14))]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-800/80 dark:bg-slate-950/60 dark:text-sky-300">
                  <Orbit className="h-3.5 w-3.5" />
                  {t("memory.mindmap.titleBadge")}
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{t("memory.mindmap.headerGlow")}</div>
                <div className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                  {t("memory.mindmap.headerDesc")}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {model.entries.length} {t("common.entries")}
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {t("memory.mindmap.debug.title")}
                  {showDebug ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] tracking-normal text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                      {t("memory.diag.ready")}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("memory.mindmap.debug.inspect")}</div>
              </div>
              <button
                type="button"
                onClick={onToggleDebug}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
              >
                {showDebug ? t("memory.mindmap.debug.hide") : t("memory.mindmap.debug.show")}
              </button>
            </div>

            <div className="mb-3 rounded-2xl border border-slate-200 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-950/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t("memory.mindmap.selectedNode")}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedNode?.label ?? t("memory.mindmap.noNode")}</div>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {selectedEvidenceCount} {t("memory.mindmap.evidenceStat")}
                </div>
              </div>
              {selectedSummary ? (
                <div className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-400">
                  {shortText(selectedSummary)}
                </div>
              ) : null}
              {selectedConcept ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300">
                    {t("memory.search.score", selectedConcept.score)}
                  </span>
                  {selectedKeywords.map((keyword) => (
                    <span key={keyword} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : null}
              {selectedEvidence[0] ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <div className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">{selectedEvidence[0].title}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{selectedEvidence[0].snippet}</div>
                </div>
              ) : null}
            </div>

            {showDebug ? (
              <ArchiveDiagnosticsCard title={t("memory.mindmap.debug.title")} className="mb-3 text-xs" tone={tone}>
                <LabelValueList
                  className="md:grid-cols-2"
                  items={[
                    { label: t("memory.mindmap.inputDocuments"), value: model.debug?.diagnostics.inputDocuments ?? 0 },
                    { label: t("memory.mindmap.inputTimelineEntries"), value: model.debug?.diagnostics.inputTimelineEntries ?? 0 },
                    { label: t("memory.mindmap.timelineWithContent"), value: model.debug?.diagnostics.timelineEntriesWithContent ?? 0 },
                    { label: t("memory.mindmap.timelineMissingContent"), value: model.debug?.diagnostics.timelineEntriesMissingContent ?? 0 },
                    { label: t("memory.mindmap.timelineTooShort"), value: model.debug?.diagnostics.timelineEntriesTooShort ?? 0 },
                    { label: t("memory.mindmap.timelineSource"), value: model.debug?.diagnostics.timelineSource ?? t("memory.documents.none") },
                    { label: t("memory.mindmap.timelineProbeDays"), value: model.debug?.diagnostics.timelineProbeDays ?? 0 },
                    { label: t("memory.mindmap.selectedTimelineEntry"), value: model.debug?.diagnostics.timelineSelectedEntry ?? t("memory.documents.none") },
                  ]}
                />
              </ArchiveDiagnosticsCard>
            ) : (
              <ArchiveDiagnosticsCard title={t("memory.mindmap.semanticSummary")} className="mb-3 text-xs" tone={tone}>
                <LabelValueList
                  className="md:grid-cols-4"
                  items={[
                    { label: t("memory.mindmap.entriesStat"), value: model.entries.length },
                    { label: t("memory.mindmap.clustersStat"), value: model.clusters.length },
                    { label: t("memory.mindmap.conceptsStat"), value: model.concepts.length },
                    { label: t("memory.mindmap.edgesStat"), value: model.edges.length },
                  ]}
                />
              </ArchiveDiagnosticsCard>
            )}

            {anchors.length === 0 ? (
              <ArchiveNotice>{t("memory.mindmap.noClusters")}</ArchiveNotice>
            ) : (
              <div className="relative h-[720px] overflow-hidden rounded-[28px] border border-slate-200 bg-[#020617] dark:border-slate-800" dir="ltr">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-1/4 left-1/4 w-80 h-80 md:w-96 md:h-96 bg-cyan-600/20 rounded-full blur-[100px] animate-pulse"></div>
                  <div className="absolute bottom-1/4 right-1/4 w-80 h-80 md:w-96 md:h-96 bg-violet-600/18 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1s" }}></div>
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
                </div>

                <div className="absolute top-0 inset-x-0 h-12 bg-gradient-to-b from-[#020617] to-transparent z-30 flex items-center px-6 pointer-events-none">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <BrainCircuit className="w-4 h-4 animate-pulse" />
                    <span className="text-[11px] font-mono tracking-widest uppercase opacity-80">{t("memory.mindmap.active")}</span>
                  </div>
                </div>

                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  {anchors.map((anchor) => {
                    const anchorSelected = selectedNodeId === anchor.cluster.id;
                    return (
                    <g key={`beam-${anchor.cluster.id}`}>
                      <motion.line
                        x1="50%"
                        y1="50%"
                        x2={anchor.x}
                        y2={anchor.y}
                        stroke="url(#semantic-core)"
                        strokeWidth={anchorSelected ? "5" : "4"}
                        strokeOpacity={anchorSelected ? "0.55" : "0.3"}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.3, ease: "easeOut" }}
                      />
                      <motion.line
                        x1="50%"
                        y1="50%"
                        x2={anchor.x}
                        y2={anchor.y}
                        stroke={anchorSelected ? anchor.pulseColor : "#334155"}
                        strokeWidth={anchorSelected ? "2.4" : "1.5"}
                        strokeDasharray="6 6"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
                      />
                      {anchor.concepts.map((concept, conceptIndex) => {
                        const conceptNode = floatingConcepts.find((node) => node.concept.id === concept.id);
                        if (!conceptNode) {
                          return null;
                        }
                        return (
                          <g key={`branch-${concept.id}`}>
                            <motion.line
                              x1={anchor.x}
                              y1={anchor.y}
                              x2={conceptNode.x}
                              y2={conceptNode.y}
                              stroke={selectedNodeId === concept.id || anchorSelected ? anchor.pulseColor : "#334155"}
                              strokeWidth={selectedNodeId === concept.id || anchorSelected ? "2.2" : "1"}
                              strokeOpacity={selectedNodeId === concept.id || anchorSelected ? "0.92" : "0.72"}
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              transition={{ duration: 0.8, delay: 0.8 + conceptIndex * 0.15 }}
                            />
                            <circle cx={conceptNode.x} cy={conceptNode.y} r={selectedNodeId === concept.id ? "3" : "2"} fill={anchor.pulseColor} />
                          </g>
                        );
                      })}
                    </g>
                  );})}
                  <defs>
                    <linearGradient id="semantic-core" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="absolute w-0 h-0 z-20" style={{ left: "50%", top: "50%" }}>
                  <motion.button
                    type="button"
                    onClick={() => setSelectedNodeId(anchors[0]?.cluster.id ?? "")}
                    className="relative flex items-center justify-center w-[120px] h-[120px] -ml-[60px] -mt-[60px]"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", duration: 1.3, bounce: 0.35 }}
                  >
                    <motion.div className="absolute inset-0 rounded-full border border-sky-500/30 border-t-sky-400 border-b-violet-400 shadow-[0_0_30px_rgba(56,189,248,0.2)]" animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} />
                    <motion.div className="absolute inset-2 rounded-full border border-violet-500/20 border-l-violet-400 border-r-cyan-400" animate={{ rotate: -360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} />
                    <motion.div className="absolute inset-[18px] rounded-full border border-cyan-400/15 border-t-cyan-300 border-b-transparent" animate={{ rotate: 360 }} transition={{ duration: 7, repeat: Infinity, ease: "linear" }} />
                    <motion.div className="absolute inset-[8px] rounded-full bg-cyan-400/5 blur-xl" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
                    <motion.div className="absolute inset-[26px] rounded-full bg-violet-400/10 blur-lg" animate={{ opacity: [0.25, 0.6, 0.25] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} />
                    <div className="bg-[#0f172a] border border-slate-700 w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-inner relative overflow-hidden group cursor-pointer hover:border-sky-400 transition-colors z-10">
                      <Cpu className="w-7 h-7 text-sky-400 mb-1" />
                      <span className="text-[10px] font-bold text-slate-300 tracking-widest">{t("memory.mindmap.map")}</span>
                    </div>
                  </motion.button>
                </div>

                {anchors.map((anchor, index) => (
                  <div key={anchor.cluster.id} className="absolute w-0 h-0 z-20" style={{ left: anchor.x, top: anchor.y }}>
                    <motion.button
                      type="button"
                      onClick={() => setSelectedNodeId(anchor.cluster.id)}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative flex items-center gap-3 ${anchor.bgClass} ${anchor.borderClass} border p-3 rounded-xl ${anchor.glowClass} w-[182px] -ml-[91px] -mt-[30px] cursor-pointer transition-transform backdrop-blur-md ${selectedNodeId === anchor.cluster.id ? "ring-2 ring-sky-400/70 shadow-[0_0_28px_rgba(56,189,248,0.18)]" : ""}`}
                      initial={{ opacity: 0, scale: 0.5, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: "spring", delay: 0.35 + index * 0.12 }}
                    >
                      <motion.div
                        className="absolute -inset-1 rounded-[14px] border border-white/5 opacity-0"
                        whileHover={{ opacity: 1, scale: 1.03 }}
                        transition={{ duration: 0.18 }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-xl bg-white/5 opacity-0"
                        animate={selectedNodeId === anchor.cluster.id ? { opacity: [0.04, 0.12, 0.04] } : { opacity: 0 }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <div className="bg-black/40 p-2 rounded-lg shrink-0 border border-white/10"><Workflow className={`w-5 h-5 ${anchor.colorClass}`} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold text-slate-100 tracking-wide truncate">{shortLabel(anchor.cluster.label, 20)}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{anchor.concepts.length} {t("memory.mindmap.concept")}</div>
                      </div>
                      <div className="absolute inset-0 rounded-xl border border-white/5 pointer-events-none" />
                    </motion.button>
                  </div>
                ))}

                {floatingConcepts.map((node, index) => (
                  <div key={node.concept.id} className="absolute w-0 h-0 z-10" style={{ left: node.x, top: node.y }}>
                    <motion.button
                      type="button"
                      onClick={() => setSelectedNodeId(node.concept.id)}
                      whileHover={{ scale: 1.04, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-[#0f172a]/90 backdrop-blur-md border border-slate-700 px-3 py-2 rounded-lg text-[11px] font-medium text-slate-300 shadow-[0_4px_10px_rgba(0,0,0,0.3)] whitespace-nowrap -ml-8 -mt-4 hover:bg-slate-800 hover:border-slate-500 hover:text-white transition-all flex items-center gap-1.5 ${selectedNodeId === node.concept.id ? "ring-2 ring-sky-400/70 border-sky-400" : ""}`}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", bounce: 0.45, delay: 0.9 + index * 0.12 }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      {shortLabel(node.concept.label, 18)}
                    </motion.button>
                  </div>
                ))}
              </div>
            )}
        </ArchiveSectionCard>
      </div>

    </motion.div>
  );
}
