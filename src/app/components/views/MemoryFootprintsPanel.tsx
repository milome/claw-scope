import { Calendar, ChevronDown, Clock, Footprints, Network } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { GatewayAgentMemoryTimelineAccessResult, GatewayAgentMemoryTimelineResult } from "../../contexts/OpenClawContext";
import type { MemoryFootprintGroup } from "./memoryState";
import { ArchiveCapsule, ArchiveDetailPane, ArchiveDiagnosticsCard, ArchiveEditorPane, ArchiveInfoBlock, ArchiveLayerHeader, ArchiveNotice, ArchiveSectionCard, type ArchiveTone } from "./memoryArchiveUi";
import { EvidenceFocusCard } from "./EvidenceFocusCard";
import { RichContentRenderer } from "./RichContentRenderer";
import { probeStatusLabel, timelineModeLabel, timelineReasonLabel } from "./memoryDisplayLabels";
import { resolveInputTone, resolveSelectedToneSurface, resolveSolidToneButton, resolveViewToneClasses } from "./viewTone";

type MemoryFootprintsPanelProps = {
  tone?: ArchiveTone;
  timelineAccess: GatewayAgentMemoryTimelineAccessResult | null;
  timelineResult: GatewayAgentMemoryTimelineResult | null;
  timelineProbeRange: { startDate: string; endDate: string };
  timelineProbeState: "idle" | "probing" | "done" | "error";
  timelineProbeFeedback: {
    coveredDates: string[];
    missingDates: string[];
    probingDates: string[];
    failureReasons: Record<string, string>;
  };
  timelineError: string | null;
  filteredFootprintGroups: MemoryFootprintGroup[];
  selectedTimelineEntryName: string;
  selectedTimelineDateLabel: string;
  timelineSelectionHint: string | null;
  selectedSnippet: string | null;
  selectedHighlightTerm: string | null;
  activeHighlightIndex: number;
  evidenceExpanded: boolean;
  onToggleEvidenceExpanded: () => void;
  timelineEntryContent: string;
  timelineEntryLoading: boolean;
  timelineEntryError: string | null;
  selectedAgentId: string;
  resolveTimelineModeLabel: (
    access: GatewayAgentMemoryTimelineAccessResult | null,
    result: GatewayAgentMemoryTimelineResult | null,
  ) => string;
  getAgentBadge: (agentId: string) => ReactNode;
  t: (key: string, ...args: (string | number)[]) => string;
  onProbeRangeChange: (next: { startDate: string; endDate: string }) => void;
  onProbeTimelineRange: () => void;
  onRetryProbeDate: (date: string) => void;
  onPreviousHighlight: () => void;
  onNextHighlight: () => void;
  onSelectTimelineEntry: (name: string) => void;
};

export function MemoryFootprintsPanel({
  tone = "sky",
  timelineAccess,
  timelineResult,
  timelineProbeRange,
  timelineProbeState,
  timelineProbeFeedback,
  timelineError,
  filteredFootprintGroups,
  selectedTimelineEntryName,
  selectedTimelineDateLabel,
  timelineSelectionHint,
  selectedSnippet,
  selectedHighlightTerm,
  activeHighlightIndex,
  evidenceExpanded,
  onToggleEvidenceExpanded,
  timelineEntryContent,
  timelineEntryLoading,
  timelineEntryError,
  selectedAgentId,
  resolveTimelineModeLabel,
  getAgentBadge,
  t,
  onProbeRangeChange,
  onProbeTimelineRange,
  onRetryProbeDate,
  onPreviousHighlight,
  onNextHighlight,
  onSelectTimelineEntry,
}: MemoryFootprintsPanelProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [isProbeFeedbackExpanded, setIsProbeFeedbackExpanded] = useState(false);
  const tonePalette = resolveViewToneClasses(tone);
  const toneClasses = {
    icon: tonePalette.iconText,
    focus: resolveInputTone(tone),
    primary: resolveSolidToneButton(tone),
    selected: resolveSelectedToneSurface(tone),
    selectedBadge: `${tonePalette.softBadge} bg-white dark:bg-slate-900`,
    hoverDot: tone === "violet" ? "group-hover:border-violet-400 group-focus:border-violet-500" : tone === "emerald" ? "group-hover:border-emerald-400 group-focus:border-emerald-500" : tone === "amber" ? "group-hover:border-amber-400 group-focus:border-amber-500" : tone === "rose" ? "group-hover:border-rose-400 group-focus:border-rose-500" : "group-hover:border-sky-400 group-focus:border-sky-500",
    ring: tone === "violet" ? "group-focus:ring-violet-500" : tone === "emerald" ? "group-focus:ring-emerald-500" : tone === "amber" ? "group-focus:ring-amber-500" : tone === "rose" ? "group-focus:ring-rose-500" : "group-focus:ring-sky-500",
    chip: tonePalette.softBadge,
    outline: `${tonePalette.softBadge} bg-transparent`,
  };

  const highlightSelection = useMemo(() => {
    if (!timelineEntryContent || !selectedHighlightTerm) {
      return null;
    }

    const lowerContent = timelineEntryContent.toLowerCase();
    const lowerTerm = selectedHighlightTerm.toLowerCase();
    const matches: { start: number; end: number }[] = [];
    let cursor = 0;

    while (cursor < timelineEntryContent.length) {
      const start = lowerContent.indexOf(lowerTerm, cursor);
      if (start === -1) {
        break;
      }
      matches.push({ start, end: start + selectedHighlightTerm.length });
      cursor = start + selectedHighlightTerm.length;
    }

    if (matches.length === 0) {
      return null;
    }

    return {
      matches,
      current: matches[Math.max(0, Math.min(activeHighlightIndex, matches.length - 1))],
    };
  }, [activeHighlightIndex, selectedHighlightTerm, timelineEntryContent]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !highlightSelection) {
      return;
    }

    const lineHeight = 28;
    const linesBefore = timelineEntryContent.slice(0, highlightSelection.current.start).split("\n").length - 1;
    body.scrollTop = Math.max(0, linesBefore * lineHeight - body.clientHeight / 3);
  }, [highlightSelection, timelineEntryContent]);

  useEffect(() => {
    const hasProbeIssue =
      Boolean(timelineError) ||
      timelineProbeState === "error" ||
      timelineProbeFeedback.missingDates.length > 0 ||
      Object.keys(timelineProbeFeedback.failureReasons).length > 0;

    if (hasProbeIssue) {
      setIsProbeFeedbackExpanded(true);
    }
  }, [
    timelineError,
    timelineProbeFeedback.failureReasons,
    timelineProbeFeedback.missingDates.length,
    timelineProbeState,
  ]);

  const timelineDetailPane = (
    <ArchiveDetailPane className="h-auto lg:sticky lg:top-4 lg:h-[calc(100vh-220px)]">
      <ArchiveEditorPane
        header={(
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{t("memory.footprints.detailTitle")}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedTimelineDateLabel || selectedTimelineEntryName || t("memory.footprints.detailPrompt")}</div>
            </div>
            <span className={`rounded-full border bg-white px-3 py-1 text-xs font-semibold shadow-sm dark:bg-slate-900 ${toneClasses.selectedBadge}`}>{t("memory.footprints.readonly")}</span>
          </div>
        )}
        body={(
          <>
            {timelineSelectionHint ? <div className="mt-3"><ArchiveNotice>{timelineSelectionHint}</ArchiveNotice></div> : null}
            <ArchiveInfoBlock title={t("memory.footprints.selectedDate")}>
              <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{selectedTimelineEntryName ? selectedTimelineEntryName.replace(/^memory\//, "").replace(/\.md$/i, "") : t("memory.footprints.noDate")}</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <ArchiveInfoBlock title={t("memory.footprints.sourceMode")}>
                  <div className="mt-1 text-slate-800 dark:text-slate-100">{resolveTimelineModeLabel(timelineAccess, timelineResult)}</div>
                </ArchiveInfoBlock>
                <ArchiveInfoBlock title={t("memory.footprints.currentEntry")}>
                  <div className="mt-1 break-all text-slate-800 dark:text-slate-100">{selectedTimelineEntryName || t("memory.search.na")}</div>
                </ArchiveInfoBlock>
              </div>
            </ArchiveInfoBlock>
            <ArchiveDiagnosticsCard title={t("memory.footprints.body")} className="mt-4 text-sm leading-7 text-slate-800 dark:text-slate-100">
              <div ref={bodyRef} className="max-h-[360px] overflow-auto rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 text-sm leading-7 text-slate-800 shadow-inner dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 lg:max-h-[calc(100vh-560px)]">
                {timelineEntryLoading
                  ? t("memory.footprints.loading")
                  : timelineEntryError
                    ? timelineEntryError
                    : timelineEntryContent
                      ? (
                        <RichContentRenderer text={timelineEntryContent} highlightTerm={selectedHighlightTerm} />
                      )
                      : t("memory.footprints.noBody")}
              </div>
            </ArchiveDiagnosticsCard>
            {selectedSnippet ? (
              <div className="mt-4">
                <EvidenceFocusCard
                  title={t("memory.evidence.focus")}
                  snippet={selectedSnippet}
                  sourceTitle={selectedTimelineEntryName || null}
                  expanded={evidenceExpanded}
                  onToggle={onToggleEvidenceExpanded}
                  navigationLabel={t("memory.evidence.sourceAnchor")}
                  navigationMeta={selectedTimelineDateLabel || null}
                >
                  {highlightSelection ? (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={onPreviousHighlight} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${toneClasses.outline}`}>{t("memory.highlight.prev")}</button>
                      <span className="text-[11px] font-semibold">{Math.max(1, Math.min(activeHighlightIndex + 1, highlightSelection.matches.length))}/{highlightSelection.matches.length}</span>
                      <button type="button" onClick={onNextHighlight} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${toneClasses.outline}`}>{t("memory.highlight.next")}</button>
                    </div>
                  ) : null}
                </EvidenceFocusCard>
              </div>
            ) : null}
          </>
        )}
      />
    </ArchiveDetailPane>
  );

  return (
    <motion.div
      key="view-day"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <div className="p-4 md:p-6">
        <ArchiveLayerHeader
          icon={Footprints}
          title={t("memory.tab.footprints")}
          description={t("memory.footprints.probeHint")}
          tone={tone}
        />
        <div className="grid gap-4 lg:h-[calc(100vh-210px)] lg:min-h-[720px] lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:items-start">
          <div className="lg:order-2">{timelineDetailPane}</div>
          <div className="min-h-0 lg:order-1 lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
            <ArchiveCapsule>
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`rounded-full border px-2.5 py-1 font-semibold ${toneClasses.chip}`}>
                    {t("memory.footprints.accessMode")}: {resolveTimelineModeLabel(timelineAccess, timelineResult)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {timelineAccess ? `${timelineModeLabel(timelineAccess.mode, t)} / ${timelineReasonLabel(timelineAccess.reason, t)}` : t("memory.overview.sources.timelineUnknown")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsProbeFeedbackExpanded((current) => !current)}
                    className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold transition ${toneClasses.outline}`}
                  >
                    {t("memory.footprints.probePreset")}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isProbeFeedbackExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                  <input
                    value={timelineProbeRange.startDate}
                    onChange={(event) => onProbeRangeChange({ ...timelineProbeRange, startDate: event.target.value })}
                    className={`h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none dark:border-slate-700 dark:bg-slate-950 ${toneClasses.focus}`}
                    placeholder={t("memory.footprints.probePlaceholder")}
                  />
                  <input
                    value={timelineProbeRange.endDate}
                    onChange={(event) => onProbeRangeChange({ ...timelineProbeRange, endDate: event.target.value })}
                    className={`h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none dark:border-slate-700 dark:bg-slate-950 ${toneClasses.focus}`}
                    placeholder={t("memory.footprints.probePlaceholder")}
                  />
                  <button
                    onClick={onProbeTimelineRange}
                    className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium text-white ${toneClasses.primary}`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {timelineProbeState === "probing"
                      ? t("memory.footprints.probe.probing")
                      : timelineProbeState === "done"
                        ? t("memory.footprints.probe.done")
                        : timelineProbeState === "error"
                          ? t("memory.footprints.probe.error")
                          : t("memory.footprints.probe.idle")}
                  </button>
                </div>

                {isProbeFeedbackExpanded ? (
                  <div className="grid gap-2 text-[11px] xl:grid-cols-3">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                      {t("memory.footprints.probe.covered")}: {timelineProbeFeedback.coveredDates.length > 0 ? timelineProbeFeedback.coveredDates.join(", ") : t("memory.footprints.probe.none")}
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                      <div>{t("memory.footprints.probe.missing")}:</div>
                      {timelineProbeFeedback.missingDates.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {timelineProbeFeedback.missingDates.map((date) => (
                            <div key={date} className="flex items-center gap-2 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                              <button
                                type="button"
                                onClick={() => onRetryProbeDate(date)}
                                className="transition hover:text-amber-900 dark:hover:text-amber-100"
                              >
                                {date}
                              </button>
                              {timelineProbeFeedback.failureReasons[date] ? (
                                <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
                                  {timelineProbeFeedback.failureReasons[date]}
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1">{t("memory.footprints.probe.none")}</div>
                      )}
                    </div>
                    <div className={`rounded-lg border px-3 py-2 ${toneClasses.chip}`}>
                      {t("memory.footprints.probe.probingDays")}: {timelineProbeFeedback.probingDates.length > 0 ? timelineProbeFeedback.probingDates.join(", ") : t("memory.footprints.probe.idleState")}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{t("memory.footprints.probeHint")}</div>
                )}
              </div>
              {timelineError ? <div className="mt-3"><ArchiveNotice tone="error">{timelineError}</ArchiveNotice></div> : null}
            </ArchiveCapsule>
            <div className="min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            <ArchiveSectionCard tone={tone}>
              {filteredFootprintGroups.length === 0 ? (
                <div className="mx-4 mt-8 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <Footprints className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">{t("memory.footprints.emptyTitle")}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t("memory.footprints.emptyDesc")}</p>
                </div>
              ) : (
                <div className="ml-4 space-y-8 border-l-[2px] border-slate-200 pb-8 pt-2 dark:border-slate-800 rtl:ml-0 rtl:mr-4 rtl:border-l-0 rtl:border-r-[2px] md:ml-8 md:space-y-10 rtl:md:mr-8">
                  {filteredFootprintGroups.map((group) => (
                    <div key={group.id} className="relative pl-6 rtl:pl-0 rtl:pr-6 md:pl-10 rtl:md:pr-10">
                      <div className="absolute -left-[15px] top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border-[2px] border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 rtl:left-auto rtl:-right-[15px] md:-left-[17px] md:h-8 md:w-8 rtl:md:-right-[17px]">
                        <Calendar className={`h-3.5 w-3.5 md:h-4 md:w-4 ${toneClasses.icon}`} />
                      </div>
                      <div className={`mb-4 rounded-2xl border p-4 transition md:mb-5 ${group.entries.some((entry) => entry.name === selectedTimelineEntryName) ? `${toneClasses.selected} shadow-sm` : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/70"}`}>
                        <div className="flex flex-wrap items-center gap-3 pt-0.5 md:pt-1">
                          <h3 className="text-[15px] font-bold tracking-tight text-slate-800 dark:text-slate-200 md:text-[16px]" dir="ltr">{group.dateLabel}</h3>
                          <span className="rounded-full border border-slate-200/80 bg-slate-200/60 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 md:text-[11px]">{t("memory.footprints.entries", group.entries.length)}</span>
                          {group.probeDay ? <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold md:text-[11px] ${toneClasses.chip}`}>{probeStatusLabel(group.probeDay.status, t)}</span> : null}
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
                          <div className="text-xs leading-5 text-slate-600 dark:text-slate-300">{group.entries[0]?.content ? group.entries[0].content.slice(0, 180) : group.entries[0]?.path ?? t("memory.footprints.noDetail")}</div>
                          <div className={`rounded-xl border px-3 py-2 text-[11px] font-medium shadow-sm ${group.entries.some((entry) => entry.name === selectedTimelineEntryName) ? toneClasses.selectedBadge : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>{group.entries[0]?.updatedAtMs ? new Date(group.entries[0].updatedAtMs).toLocaleTimeString() : t("memory.footprints.noTime")}</div>
                        </div>
                      </div>
                      <div className="space-y-3 md:space-y-4">
                        {group.entries.map((item) => (
                          <div key={item.name} className="group relative outline-none" tabIndex={0} onClick={() => onSelectTimelineEntry(item.name)}>
                            <div className={`absolute -left-[29.5px] top-[16px] h-2.5 w-2.5 rounded-full border-[2px] border-slate-300 bg-white transition-colors dark:border-slate-600 dark:bg-slate-800 rtl:left-auto rtl:-right-[29.5px] md:-left-[45px] md:top-[20px] md:h-3 md:w-3 md:border-[2.5px] rtl:md:-right-[45px] ${toneClasses.hoverDot}`} />
                            <div className={`cursor-pointer rounded-xl border p-3.5 shadow-sm transition-all group-focus:ring-2 md:rounded-lg md:p-4 dark:md:hover:border-slate-700 ${toneClasses.ring} ${selectedTimelineEntryName === item.name ? toneClasses.selected : "border-slate-200 bg-white md:hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"}`}>
                              <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-1.5 md:gap-2">
                                  <span className="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 md:text-[11px]" dir="ltr"><Clock className="h-2.5 w-2.5 md:h-3 md:w-3" /> {item.updatedAtMs ? new Date(item.updatedAtMs).toLocaleTimeString() : "-"}</span>
                                  <span className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${toneClasses.chip}`}><Network className="h-2.5 w-2.5 md:h-3 md:w-3" /><span className="max-w-[120px] truncate md:max-w-none">{timelineAccess?.mode ?? timelineResult?.source ?? t("memory.footprints.timelineFallback")}</span></span>
                                  {getAgentBadge(selectedAgentId)}
                                </div>
                                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium md:px-2 md:text-[11px] ${toneClasses.chip}`}>{item.name}</span>
                              </div>
                              <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">{item.path}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ArchiveSectionCard>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
