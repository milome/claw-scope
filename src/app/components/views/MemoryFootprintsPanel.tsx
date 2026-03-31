import { Calendar, Clock, Footprints, Network } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { GatewayAgentMemoryTimelineAccessResult, GatewayAgentMemoryTimelineResult } from "../../contexts/OpenClawContext";
import type { MemoryFootprintGroup } from "./memoryState";
import { ArchiveCapsule, ArchiveDetailPane, ArchiveDiagnosticsCard, ArchiveEditorPane, ArchiveInfoBlock, ArchiveNotice, ArchiveSectionCard, ArchiveSplitPanel } from "./memoryArchiveUi";
import { EvidenceFocusCard } from "./EvidenceFocusCard";

type MemoryFootprintsPanelProps = {
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

  const highlightedSegments = useMemo(() => {
    if (!timelineEntryContent || !selectedHighlightTerm) {
      return [{ text: timelineEntryContent, match: false }];
    }

    const lowerContent = timelineEntryContent.toLowerCase();
    const lowerTerm = selectedHighlightTerm.toLowerCase();
    const segments: { text: string; match: boolean }[] = [];
    let cursor = 0;

    while (cursor < timelineEntryContent.length) {
      const index = lowerContent.indexOf(lowerTerm, cursor);
      if (index === -1) {
        segments.push({ text: timelineEntryContent.slice(cursor), match: false });
        break;
      }
      if (index > cursor) {
        segments.push({ text: timelineEntryContent.slice(cursor, index), match: false });
      }
      segments.push({ text: timelineEntryContent.slice(index, index + selectedHighlightTerm.length), match: true });
      cursor = index + selectedHighlightTerm.length;
    }

    return segments;
  }, [selectedHighlightTerm, timelineEntryContent]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !highlightSelection) {
      return;
    }

    const lineHeight = 28;
    const linesBefore = timelineEntryContent.slice(0, highlightSelection.current.start).split("\n").length - 1;
    body.scrollTop = Math.max(0, linesBefore * lineHeight - body.clientHeight / 3);
  }, [highlightSelection, timelineEntryContent]);

  return (
    <motion.div
      key="view-day"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <ArchiveSplitPanel
        icon={Footprints}
        title={t("memory.tab.footprints")}
        description={t("memory.footprints.probeHint")}
        columns="md:grid-cols-[0.9fr_1.1fr]"
        left={(
          <>
            <ArchiveCapsule>
              <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
                <ArchiveInfoBlock title={t("memory.footprints.accessMode")}>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{resolveTimelineModeLabel(timelineAccess, timelineResult)}</div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{timelineAccess ? `${timelineAccess.mode} / ${timelineAccess.reason}` : t("memory.overview.sources.timelineUnknown")}</div>
                </ArchiveInfoBlock>
                <ArchiveInfoBlock title={t("memory.footprints.probePreset")}>
                  <div className="mt-2 grid gap-2">
                    <input
                      value={timelineProbeRange.startDate}
                      onChange={(event) => onProbeRangeChange({ ...timelineProbeRange, startDate: event.target.value })}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                      placeholder={t("memory.footprints.probePlaceholder")}
                    />
                    <input
                      value={timelineProbeRange.endDate}
                      onChange={(event) => onProbeRangeChange({ ...timelineProbeRange, endDate: event.target.value })}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950"
                      placeholder={t("memory.footprints.probePlaceholder")}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t("memory.footprints.probeHint")}</div>
                  <button
                    onClick={onProbeTimelineRange}
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {timelineProbeState === "probing"
                      ? t("memory.footprints.probe.probing")
                      : timelineProbeState === "done"
                        ? t("memory.footprints.probe.done")
                        : timelineProbeState === "error"
                          ? t("memory.footprints.probe.error")
                          : t("memory.footprints.probe.idle")}
                  </button>
                  <div className="mt-3 space-y-2 text-[11px]">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                      covered: {timelineProbeFeedback.coveredDates.length > 0 ? timelineProbeFeedback.coveredDates.join(", ") : "none"}
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                      <div>missing:</div>
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
                        <div className="mt-1">none</div>
                      )}
                    </div>
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300">
                      probing: {timelineProbeFeedback.probingDates.length > 0 ? timelineProbeFeedback.probingDates.join(", ") : "idle"}
                    </div>
                  </div>
                </ArchiveInfoBlock>
              </div>
              {timelineError ? <div className="mt-3"><ArchiveNotice tone="error">{timelineError}</ArchiveNotice></div> : null}
            </ArchiveCapsule>
            <ArchiveSectionCard>
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
                        <Calendar className="h-3.5 w-3.5 text-sky-500 md:h-4 md:w-4" />
                      </div>
                      <div className={`mb-4 rounded-2xl border p-4 transition md:mb-5 ${group.entries.some((entry) => entry.name === selectedTimelineEntryName) ? "border-sky-300 bg-sky-50 shadow-sm dark:border-sky-700 dark:bg-slate-800" : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/70"}`}>
                        <div className="flex flex-wrap items-center gap-3 pt-0.5 md:pt-1">
                          <h3 className="text-[15px] font-bold tracking-tight text-slate-800 dark:text-slate-200 md:text-[16px]" dir="ltr">{group.dateLabel}</h3>
                          <span className="rounded-full border border-slate-200/80 bg-slate-200/60 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 md:text-[11px]">{t("memory.footprints.entries", group.entries.length)}</span>
                          {group.probeDay ? <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-800/50 dark:bg-sky-900/30 dark:text-sky-300 md:text-[11px]">{t("memory.footprints.probeStatus", group.probeDay.status)}</span> : null}
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
                          <div className="text-xs leading-5 text-slate-600 dark:text-slate-300">{group.entries[0]?.content ? group.entries[0].content.slice(0, 180) : group.entries[0]?.path ?? t("memory.footprints.noDetail")}</div>
                          <div className={`rounded-xl border px-3 py-2 text-[11px] font-medium shadow-sm ${group.entries.some((entry) => entry.name === selectedTimelineEntryName) ? "border-sky-200 bg-white text-sky-700 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-300" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>{group.entries[0]?.updatedAtMs ? new Date(group.entries[0].updatedAtMs).toLocaleTimeString() : t("memory.footprints.noTime")}</div>
                        </div>
                      </div>
                      <div className="space-y-3 md:space-y-4">
                        {group.entries.map((item) => (
                          <div key={item.name} className="group relative outline-none" tabIndex={0} onClick={() => onSelectTimelineEntry(item.name)}>
                            <div className="absolute -left-[29.5px] top-[16px] h-2.5 w-2.5 rounded-full border-[2px] border-slate-300 bg-white transition-colors group-hover:border-sky-400 group-focus:border-sky-500 dark:border-slate-600 dark:bg-slate-800 rtl:left-auto rtl:-right-[29.5px] md:-left-[45px] md:top-[20px] md:h-3 md:w-3 md:border-[2.5px] rtl:md:-right-[45px]" />
                            <div className={`cursor-pointer rounded-xl border p-3.5 shadow-sm transition-all group-focus:ring-2 group-focus:ring-sky-500 md:rounded-lg md:p-4 md:hover:border-sky-300 dark:md:hover:border-sky-700 ${selectedTimelineEntryName === item.name ? "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-slate-800" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
                              <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-1.5 md:gap-2">
                                  <span className="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 md:text-[11px]" dir="ltr"><Clock className="h-2.5 w-2.5 md:h-3 md:w-3" /> {item.updatedAtMs ? new Date(item.updatedAtMs).toLocaleTimeString() : "-"}</span>
                                  <span className="flex items-center gap-1 rounded border border-cyan-100 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700 dark:border-cyan-800/50 dark:bg-cyan-900/20 dark:text-cyan-300"><Network className="h-2.5 w-2.5 md:h-3 md:w-3" /><span className="max-w-[120px] truncate md:max-w-none">{timelineAccess?.mode ?? timelineResult?.source ?? t("memory.footprints.timelineFallback")}</span></span>
                                  {getAgentBadge(selectedAgentId)}
                                </div>
                                <span className="rounded border border-sky-100 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:border-sky-800/50 dark:bg-sky-900/30 dark:text-sky-300 md:px-2 md:text-[11px]">{item.name}</span>
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
          </>
        )}
        right={(
          <ArchiveDetailPane>
            <ArchiveEditorPane
              header={(
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{t("memory.footprints.detailTitle")}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedTimelineDateLabel || selectedTimelineEntryName || t("memory.footprints.detailPrompt")}</div>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">read only</span>
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
                    <div ref={bodyRef} className="max-h-[360px] overflow-auto text-sm leading-7 text-slate-800 dark:text-slate-100">
                      {timelineEntryLoading
                        ? t("memory.footprints.loading")
                        : timelineEntryError
                          ? timelineEntryError
                          : timelineEntryContent
                            ? highlightedSegments.map((segment, index) =>
                                segment.match ? (
                                  <mark key={index} className="rounded bg-sky-200 px-0.5 text-slate-900 dark:bg-sky-500/40 dark:text-sky-50">
                                    {segment.text}
                                  </mark>
                                ) : (
                                  <span key={index}>{segment.text}</span>
                                ),
                              )
                            : t("memory.footprints.noBody")}
                    </div>
                  </ArchiveDiagnosticsCard>
                  {selectedSnippet ? (
                    <div className="mt-4">
                      <EvidenceFocusCard
                        title="Evidence focus"
                        snippet={selectedSnippet}
                        sourceTitle={selectedTimelineEntryName || null}
                        expanded={evidenceExpanded}
                        onToggle={onToggleEvidenceExpanded}
                        navigationLabel="Source anchor"
                        navigationMeta={selectedTimelineDateLabel || null}
                      >
                        {highlightSelection ? (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={onPreviousHighlight} className="rounded-full border border-sky-300 px-2 py-1 text-[11px] font-semibold">Prev</button>
                            <span className="text-[11px] font-semibold">{Math.max(1, Math.min(activeHighlightIndex + 1, highlightSelection.matches.length))}/{highlightSelection.matches.length}</span>
                            <button type="button" onClick={onNextHighlight} className="rounded-full border border-sky-300 px-2 py-1 text-[11px] font-semibold">Next</button>
                          </div>
                        ) : null}
                      </EvidenceFocusCard>
                    </div>
                  ) : null}
                </>
              )}
            />
          </ArchiveDetailPane>
        )}
      />
    </motion.div>
  );
}
