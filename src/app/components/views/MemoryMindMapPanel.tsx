import { BrainCircuit, Cpu, Orbit, Sparkles, Workflow } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { SemanticCluster, SemanticConcept, SemanticMindMapModel } from "./memorySemanticTypes";
import { ArchiveDetailPane, ArchiveDiagnosticsCard, ArchiveEditorPane, ArchiveInfoBlock, ArchiveNotice, ArchiveSectionCard, ArchiveSplitPanel } from "./memoryArchiveUi";

type MemoryMindMapPanelProps = {
  model: SemanticMindMapModel;
  t: (key: string, ...args: (string | number)[]) => string;
  onOpenEvidence: (evidence: {
    entryId: string;
    title: string;
    sourceKind: "document" | "timeline";
    path?: string;
    snippet: string;
    matchedTerms: string[];
  }) => void;
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

export function MemoryMindMapPanel({ model, t, onOpenEvidence }: MemoryMindMapPanelProps) {
  const anchors = useMemo(() => buildClusterAnchors(model), [model]);
  const floatingConcepts = useMemo(() => buildFloatingConcepts(anchors), [anchors]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(anchors[0]?.cluster.id ?? model.concepts[0]?.id ?? "");

  const selectedCluster = model.clusters.find((cluster) => cluster.id === selectedNodeId) ?? null;
  const selectedConcept = model.concepts.find((concept) => concept.id === selectedNodeId) ?? null;
  const selectedNode = selectedCluster ?? selectedConcept;
  const selectedEvidence = selectedCluster?.evidence ?? selectedConcept?.evidence ?? [];

  const groupedAnchors = useMemo(() => {
    const bySourceKind = new Map<string, Map<string, typeof selectedEvidence[number]>>();
    selectedEvidence.forEach((evidence) => {
      const kindBucket = bySourceKind.get(evidence.sourceKind) ?? new Map<string, typeof evidence>();
      const key = `${evidence.title}::${evidence.path ?? ""}`;
      if (!kindBucket.has(key)) {
        kindBucket.set(key, evidence);
      }
      bySourceKind.set(evidence.sourceKind, kindBucket);
    });

    return Array.from(bySourceKind.entries()).map(([sourceKind, bucket]) => ({
      sourceKind,
      anchors: Array.from(bucket.values()),
    }));
  }, [selectedEvidence]);

  const sourceCorpus = useMemo(
    () => model.entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      sourceKind: entry.sourceKind,
      timestamp: entry.timestamp,
      path: entry.path,
    })),
    [model.entries],
  );

  return (
    <motion.div
      key="view-mind-map"
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.24 }}
    >
      <ArchiveSplitPanel
        icon={BrainCircuit}
        title={t("memory.tab.knowledge")}
        description="Semantic mind map derived from memory text, styled to match the Figma composition language."
        columns="lg:grid-cols-[1.32fr_0.95fr]"
        left={(
          <ArchiveSectionCard>
            <div className="mb-4 flex items-start justify-between gap-3 rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,rgba(240,249,255,0.95),rgba(236,253,245,0.88))] p-4 dark:border-sky-900/60 dark:bg-[linear-gradient(135deg,rgba(12,74,110,0.2),rgba(6,95,70,0.14))]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-800/80 dark:bg-slate-950/60 dark:text-sky-300">
                  <Orbit className="h-3.5 w-3.5" />
                  Figma semantic map
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Glowing core, four outer semantic cluster cards, layered links, and floating concept chips.</div>
                <div className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                  This keeps the figma visual language while continuing to consume semantic clusters/concepts from the pipeline instead of resource topology.
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {model.entries.length} entries
              </div>
            </div>

            <ArchiveDiagnosticsCard title="Semantic summary" className="mb-4 text-xs">
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">entries</div>
                  <div className="mt-1 text-slate-900 dark:text-slate-100">{model.entries.length}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">clusters</div>
                  <div className="mt-1 text-slate-900 dark:text-slate-100">{model.clusters.length}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">concepts</div>
                  <div className="mt-1 text-slate-900 dark:text-slate-100">{model.concepts.length}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">edges</div>
                  <div className="mt-1 text-slate-900 dark:text-slate-100">{model.edges.length}</div>
                </div>
              </div>
            </ArchiveDiagnosticsCard>

            {anchors.length === 0 ? (
              <ArchiveNotice>No semantic clusters could be inferred from the current memory corpus yet.</ArchiveNotice>
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
                    <span className="text-[11px] font-mono tracking-widest uppercase opacity-80">Semantic Mapping Active</span>
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
                      <span className="text-[10px] font-bold text-slate-300 tracking-widest">MAP</span>
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
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{anchor.concepts.length} concepts</div>
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
        )}
        right={(
          <ArchiveSectionCard>
            <div className="rounded-3xl border border-slate-700 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.32)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Selected semantic node</div>
                  <div className="mt-2 text-lg font-semibold tracking-tight text-slate-100">{selectedNode?.label ?? "No node selected"}</div>
                  {selectedCluster ? <div className="mt-1 text-xs text-slate-400">cluster</div> : null}
                  {selectedConcept ? <div className="mt-1 text-xs text-slate-400">concept</div> : null}
                </div>
                <div className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-slate-200">
                  {selectedEvidence.length} evidence
                </div>
              </div>
            </div>

            {selectedCluster ? (
              <ArchiveDiagnosticsCard title="Cluster summary" className="mt-4 text-sm leading-7 text-slate-800 dark:text-slate-100">
                <div className="space-y-3">
                  <div>{selectedCluster.summary}</div>
                  <div className="text-xs leading-6 text-slate-500 dark:text-slate-400">{selectedCluster.explanation}</div>
                </div>
              </ArchiveDiagnosticsCard>
            ) : null}

            {selectedConcept ? (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <ArchiveInfoBlock title="Score">
                    <div className="mt-1 text-slate-800 dark:text-slate-100">{selectedConcept.score}</div>
                  </ArchiveInfoBlock>
                  <ArchiveInfoBlock title="Keywords">
                    <div className="mt-1 text-slate-800 dark:text-slate-100">{selectedConcept.keywords.join(", ")}</div>
                  </ArchiveInfoBlock>
                </div>
                <ArchiveDiagnosticsCard title="Why this concept exists" className="mt-4 text-sm leading-7 text-slate-800 dark:text-slate-100">
                  {selectedConcept.explanation}
                </ArchiveDiagnosticsCard>
              </>
            ) : null}

            <ArchiveDiagnosticsCard title="Supporting evidence" className="mt-4 text-sm leading-7 text-slate-800 dark:text-slate-100">
              {selectedEvidence.length > 0 ? (
                <div className="space-y-3">
                  {selectedEvidence.map((evidence) => (
                    <button
                      key={`${evidence.entryId}-${evidence.snippet}`}
                      type="button"
                      onClick={() => onOpenEvidence(evidence)}
                      className="block w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-700 dark:hover:bg-slate-800"
                    >
                      <div className="rounded-md bg-sky-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">{evidence.title}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{evidence.sourceKind}{evidence.path ? ` · ${evidence.path}` : ""}</div>
                      <div className="mt-2 text-sm text-slate-800 dark:text-slate-100">{evidence.snippet}</div>
                      <div className="mt-3 text-xs font-semibold text-sky-700 dark:text-sky-300">
                        {evidence.sourceKind === "document" ? "Open in Documents" : "Open in Footprints"}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                "No evidence snippets available."
              )}
            </ArchiveDiagnosticsCard>

            <ArchiveDiagnosticsCard title="Source anchors" className="mt-4 text-xs">
              {groupedAnchors.length > 0 ? (
                <div className="space-y-3">
                  {groupedAnchors.map((group) => (
                    <div key={group.sourceKind}>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {group.sourceKind === "document" ? "Documents" : "Footprints"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.anchors.map((evidence) => (
                          <button
                            key={`anchor-${group.sourceKind}-${evidence.title}-${evidence.path ?? ""}`}
                            type="button"
                            onClick={() => onOpenEvidence(evidence)}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:border-sky-700 dark:hover:bg-sky-900/30"
                          >
                            {evidence.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                "No source anchors available."
              )}
            </ArchiveDiagnosticsCard>

            <ArchiveDiagnosticsCard title="Source Corpus" className="mt-4 text-xs">
              {sourceCorpus.length > 0 ? (
                <div className="space-y-2">
                  {sourceCorpus.map((source) => (
                    <div key={source.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{source.title}</div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">{source.sourceKind}{source.timestamp ? ` · ${new Date(source.timestamp).toLocaleString()}` : ""}</div>
                      {source.path ? <div className="mt-1 break-all text-slate-500 dark:text-slate-400">{source.path}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                "No source corpus entries available."
              )}
            </ArchiveDiagnosticsCard>
          </ArchiveSectionCard>
        )}
      />

      <ArchiveDetailPane>
        <ArchiveEditorPane
          header={
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{t("memory.knowledge.drawerFields")}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Figma visual language, semantic data model.</div>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Sparkles className="mr-1 inline h-3.5 w-3.5" /> figma-semantic
              </div>
            </div>
          }
          body={
            <>
              <ArchiveDiagnosticsCard title="Pipeline contract">
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  <div>Semantic entries: {model.entries.length}</div>
                  <div>Clusters: {model.clusters.length}</div>
                  <div>Concepts: {model.concepts.length}</div>
                  <div>Edges: {model.edges.length}</div>
                </div>
              </ArchiveDiagnosticsCard>
              <ArchiveDiagnosticsCard title="Implementation note">
                <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <div>This panel keeps the figma-style glowing core and four surrounding node language.</div>
                  <div>Cluster cards and floating chips are semantic outputs from the derivation pipeline.</div>
                  <div>Structural/resource topology remains separated in the `Resources` panel.</div>
                </div>
              </ArchiveDiagnosticsCard>
            </>
          }
        />
      </ArchiveDetailPane>
    </motion.div>
  );
}
