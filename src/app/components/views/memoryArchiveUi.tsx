import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useOptionalI18n } from "../../contexts/I18nContext";

export type ArchiveTone = "sky" | "violet" | "emerald" | "amber" | "rose";

type ArchiveToneClasses = {
  headerChip: string;
  headerIcon: string;
  sectionAccent: string;
  actionPrimary: string;
  actionSecondary: string;
  tabActive: string;
  tabIconActive: string;
  tabIconIdle: string;
  tabLabelActive: string;
  tabDescriptionActive: string;
  tabIdleHover: string;
  diagnostics: string;
};

export function resolveArchiveToneClasses(tone: ArchiveTone = "sky"): ArchiveToneClasses {
  switch (tone) {
    case "violet":
      return {
        headerChip:
          "border-violet-200 bg-violet-50/90 text-violet-700 dark:border-violet-800/70 dark:bg-violet-950/40 dark:text-violet-300",
        headerIcon: "text-violet-500 dark:text-violet-300",
        sectionAccent:
          "before:bg-violet-400/85 after:bg-violet-400/95 dark:before:bg-violet-300/80 dark:after:bg-violet-300/85",
        actionPrimary:
          "bg-violet-600 hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400",
        actionSecondary:
          "hover:border-violet-300 hover:text-violet-700 dark:hover:border-violet-700 dark:hover:text-violet-300",
        tabActive:
          "border border-violet-200 bg-[linear-gradient(180deg,rgba(245,243,255,1),rgba(237,233,254,0.92))] text-violet-700 shadow-sm shadow-violet-100/80 dark:border-violet-700 dark:bg-[linear-gradient(180deg,rgba(76,29,149,0.42),rgba(46,16,101,0.28))] dark:text-violet-300 dark:shadow-none",
        tabIconActive:
          "border-violet-200 bg-white text-violet-600 dark:border-violet-700 dark:bg-slate-950/60 dark:text-violet-300",
        tabIconIdle:
          "border-violet-100 bg-violet-50/80 text-violet-500 group-hover:border-violet-200 group-hover:text-violet-600 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300 dark:group-hover:border-violet-700 dark:group-hover:text-violet-200",
        tabLabelActive: "text-violet-900 dark:text-violet-100",
        tabDescriptionActive: "text-violet-700/90 dark:text-violet-200/80",
        tabIdleHover:
          "hover:border-violet-200/80 hover:bg-violet-50/70 hover:text-violet-900 dark:hover:border-violet-800 dark:hover:bg-violet-950/20 dark:hover:text-violet-100",
        diagnostics:
          "border-violet-200 bg-violet-50/80 dark:border-violet-900/60 dark:bg-violet-950/25",
      };
    case "emerald":
      return {
        headerChip:
          "border-emerald-200 bg-emerald-50/90 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-300",
        headerIcon: "text-emerald-500 dark:text-emerald-300",
        sectionAccent:
          "before:bg-emerald-400/85 after:bg-emerald-400/95 dark:before:bg-emerald-300/80 dark:after:bg-emerald-300/85",
        actionPrimary:
          "bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400",
        actionSecondary:
          "hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-700 dark:hover:text-emerald-300",
        tabActive:
          "border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,1),rgba(209,250,229,0.9))] text-emerald-700 shadow-sm shadow-emerald-100/80 dark:border-emerald-700 dark:bg-[linear-gradient(180deg,rgba(6,78,59,0.45),rgba(2,44,34,0.28))] dark:text-emerald-300 dark:shadow-none",
        tabIconActive:
          "border-emerald-200 bg-white text-emerald-600 dark:border-emerald-700 dark:bg-slate-950/60 dark:text-emerald-300",
        tabIconIdle:
          "border-emerald-100 bg-emerald-50/80 text-emerald-500 group-hover:border-emerald-200 group-hover:text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300 dark:group-hover:border-emerald-700 dark:group-hover:text-emerald-200",
        tabLabelActive: "text-emerald-900 dark:text-emerald-100",
        tabDescriptionActive: "text-emerald-700/90 dark:text-emerald-200/80",
        tabIdleHover:
          "hover:border-emerald-200/80 hover:bg-emerald-50/70 hover:text-emerald-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-100",
        diagnostics:
          "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/25",
      };
    case "amber":
      return {
        headerChip:
          "border-amber-200 bg-amber-50/90 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-300",
        headerIcon: "text-amber-500 dark:text-amber-300",
        sectionAccent:
          "before:bg-amber-400/85 after:bg-amber-400/95 dark:before:bg-amber-300/80 dark:after:bg-amber-300/85",
        actionPrimary:
          "bg-amber-500 hover:bg-amber-400 text-slate-950 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950",
        actionSecondary:
          "hover:border-amber-300 hover:text-amber-700 dark:hover:border-amber-700 dark:hover:text-amber-300",
        tabActive:
          "border border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,1),rgba(254,243,199,0.92))] text-amber-700 shadow-sm shadow-amber-100/80 dark:border-amber-700 dark:bg-[linear-gradient(180deg,rgba(120,53,15,0.42),rgba(69,26,3,0.28))] dark:text-amber-300 dark:shadow-none",
        tabIconActive:
          "border-amber-200 bg-white text-amber-600 dark:border-amber-700 dark:bg-slate-950/60 dark:text-amber-300",
        tabIconIdle:
          "border-amber-100 bg-amber-50/85 text-amber-500 group-hover:border-amber-200 group-hover:text-amber-600 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300 dark:group-hover:border-amber-700 dark:group-hover:text-amber-200",
        tabLabelActive: "text-amber-900 dark:text-amber-100",
        tabDescriptionActive: "text-amber-700/90 dark:text-amber-200/80",
        tabIdleHover:
          "hover:border-amber-200/80 hover:bg-amber-50/70 hover:text-amber-900 dark:hover:border-amber-800 dark:hover:bg-amber-950/20 dark:hover:text-amber-100",
        diagnostics:
          "border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/25",
      };
    case "rose":
      return {
        headerChip:
          "border-rose-200 bg-rose-50/90 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/35 dark:text-rose-300",
        headerIcon: "text-rose-500 dark:text-rose-300",
        sectionAccent:
          "before:bg-rose-400/85 after:bg-rose-400/95 dark:before:bg-rose-300/80 dark:after:bg-rose-300/85",
        actionPrimary:
          "bg-rose-600 hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400",
        actionSecondary:
          "hover:border-rose-300 hover:text-rose-700 dark:hover:border-rose-700 dark:hover:text-rose-300",
        tabActive:
          "border border-rose-200 bg-[linear-gradient(180deg,rgba(255,241,242,1),rgba(255,228,230,0.92))] text-rose-700 shadow-sm shadow-rose-100/80 dark:border-rose-700 dark:bg-[linear-gradient(180deg,rgba(136,19,55,0.4),rgba(76,5,25,0.26))] dark:text-rose-300 dark:shadow-none",
        tabIconActive:
          "border-rose-200 bg-white text-rose-600 dark:border-rose-700 dark:bg-slate-950/60 dark:text-rose-300",
        tabIconIdle:
          "border-rose-100 bg-rose-50/85 text-rose-500 group-hover:border-rose-200 group-hover:text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300 dark:group-hover:border-rose-700 dark:group-hover:text-rose-200",
        tabLabelActive: "text-rose-900 dark:text-rose-100",
        tabDescriptionActive: "text-rose-700/90 dark:text-rose-200/80",
        tabIdleHover:
          "hover:border-rose-200/80 hover:bg-rose-50/70 hover:text-rose-900 dark:hover:border-rose-800 dark:hover:bg-rose-950/20 dark:hover:text-rose-100",
        diagnostics:
          "border-rose-200 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/25",
      };
    case "sky":
    default:
      return {
        headerChip:
          "border-sky-200 bg-sky-50/90 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/35 dark:text-sky-300",
        headerIcon: "text-sky-500 dark:text-sky-300",
        sectionAccent:
          "before:bg-sky-400/85 after:bg-sky-400/95 dark:before:bg-sky-300/80 dark:after:bg-sky-300/85",
        actionPrimary:
          "bg-sky-600 hover:bg-sky-500 dark:bg-sky-600 dark:hover:bg-sky-500",
        actionSecondary:
          "hover:border-sky-300 hover:text-sky-700 dark:hover:border-sky-700 dark:hover:text-sky-300",
        tabActive:
          "border border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,1),rgba(224,242,254,0.92))] text-sky-700 shadow-sm shadow-sky-100/80 dark:border-sky-700 dark:bg-[linear-gradient(180deg,rgba(8,47,73,0.9),rgba(12,74,110,0.52))] dark:text-sky-300 dark:shadow-none",
        tabIconActive:
          "border-sky-200 bg-white text-sky-600 dark:border-sky-700 dark:bg-slate-950/60 dark:text-sky-300",
        tabIconIdle:
          "border-sky-100 bg-sky-50/85 text-sky-500 group-hover:border-sky-200 group-hover:text-sky-600 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300 dark:group-hover:border-sky-700 dark:group-hover:text-sky-200",
        tabLabelActive: "text-sky-900 dark:text-sky-100",
        tabDescriptionActive: "text-sky-700/90 dark:text-sky-200/80",
        tabIdleHover:
          "hover:border-sky-200/80 hover:bg-sky-50/70 hover:text-sky-900 dark:hover:border-sky-800 dark:hover:bg-sky-950/20 dark:hover:text-sky-100",
        diagnostics:
          "border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/25",
      };
  }
}

export const ARCHIVE_SPACING = {
  page: "p-4 md:p-6",
  sectionGap: "gap-4",
  cardBody: "p-4 md:p-5",
  detailPaneMinHeight: "min-h-[720px]",
};

export const ARCHIVE_SURFACE = {
  tabPane: "bg-transparent md:bg-slate-50/50 md:dark:bg-slate-900/50",
};

export const ARCHIVE_TABS = {
  container: "flex flex-wrap gap-1 rounded-[20px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.78))]",
  idleBase:
    "border border-transparent bg-transparent text-slate-600 dark:text-slate-300",
};

export function ArchiveLayerHeader({
  icon: Icon,
  title,
  description,
  tone = "sky",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: ArchiveTone;
}) {
  const toneClasses = resolveArchiveToneClasses(tone);

  return (
    <div className="mb-5 px-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-700" />
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-sm ${toneClasses.headerChip}`}>
          <Icon className={`h-3.5 w-3.5 ${toneClasses.headerIcon}`} />
          {title}
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-700" />
      </div>
      <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

export function ArchiveCapsule({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.82),rgba(255,255,255,0.92))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.3),rgba(2,6,23,0.24))]">
      {children}
    </div>
  );
}

export function ArchiveInfoBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</div>
      <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{children}</div>
    </div>
  );
}

export function ArchivePane({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`overflow-auto ${className}`.trim()}>{children}</div>;
}

export function ArchiveDiagnosticsCard({
  title,
  children,
  className = "",
  tone,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  tone?: ArchiveTone;
}) {
  const toneClasses = tone ? resolveArchiveToneClasses(tone) : null;

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 ${toneClasses?.diagnostics ?? ""} ${className}`.trim()}>
      <div className="font-medium">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function ArchiveDiagnosticsLayout({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useOptionalI18n();
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-hidden border-l border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-5 shadow-[0_24px_64px_rgba(2,6,23,0.55)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 rounded-[24px] border border-slate-800/90 bg-slate-950/70 px-4 py-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200 shadow-sm transition-colors hover:border-sky-600 hover:text-sky-300"
        >
          {t("common.close")}
        </button>
      </div>
      <div className="mt-4 h-[calc(100dvh-120px)] space-y-3 overflow-y-auto pr-2 pb-8">{children}</div>
    </div>
  );
}

export function ArchiveNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "warn";
  children: ReactNode;
}) {
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300"
        : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300";

  return <div className={`rounded-xl border p-3 text-sm ${toneClass}`}>{children}</div>;
}

export function ArchiveResultCard({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-4 text-slate-700 shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-slate-700/80 dark:from-slate-900 dark:to-slate-900 dark:text-slate-300 dark:hover:border-sky-700">
      {children}
    </article>
  );
}

export function ArchivePageHeader({
  title,
  description,
  leadingIcon,
  actions,
}: {
  title: string;
  description: string;
  leadingIcon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 md:mb-5 shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <div className="mb-1 flex items-center gap-2">
          {leadingIcon}
          <h1 className="text-[20px] md:text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        </div>
        <p className="text-[13px] md:text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {actions}
    </div>
  );
}

export function ArchiveDrawer({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px]">
      {children}
    </div>
  );
}

export function archiveDiagnosticsTone(hasIssue: boolean | null) {
  if (hasIssue == null) {
    return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
  if (hasIssue) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300";
}

export function ArchiveTabSurface({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 rounded-[28px] border border-slate-200/90 shadow-[0_18px_44px_rgba(15,23,42,0.08)] overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.88))] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,1),rgba(2,6,23,0.92))] dark:shadow-none">
      {children}
    </div>
  );
}

export function ArchiveTabSwitch({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return active ? <ArchiveTabSurface>{children}</ArchiveTabSurface> : null;
}

export function ArchiveMotionTab({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return active ? <>{children}</> : null;
}

export function ArchiveInfoGrid({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`grid ${ARCHIVE_SPACING.sectionGap} ${className}`.trim()}>{children}</div>;
}

export function ArchiveStatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {meta ? <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{meta}</div> : null}
    </div>
  );
}

export function ArchiveListCard({
  active = false,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition shadow-sm ${
        active
          ? "border-sky-300 bg-sky-50/90 shadow-[0_16px_32px_rgba(14,165,233,0.12)] dark:border-sky-700 dark:bg-slate-800"
          : "border-slate-200/80 bg-white hover:border-sky-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/70"
      }`}
    >
      {active ? <div className="absolute inset-y-3 left-0 w-1 rounded-full bg-gradient-to-b from-sky-400 via-cyan-400 to-violet-400 dark:from-sky-300 dark:via-cyan-300 dark:to-violet-300" /> : null}
      {children}
    </button>
  );
}

export function ArchiveDetailHeader({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle: string;
  meta: ReactNode;
}) {
  return (
    <div className="mb-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</div>
          <div className="mt-0.5 break-all text-[12px] leading-5 text-slate-500 dark:text-slate-400">{subtitle}</div>
        </div>
        {meta}
      </div>
    </div>
  );
}

export function ArchiveListPane({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ArchivePane className={`overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${ARCHIVE_SPACING.detailPaneMinHeight} ${className}`.trim()}>
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{title}</div>
      </div>
      {children}
    </ArchivePane>
  );
}

export function ArchiveDetailPane({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex h-[calc(100vh-280px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${ARCHIVE_SPACING.detailPaneMinHeight} ${className}`.trim()}>
      {children}
    </div>
  );
}

export function ArchiveEditorPane({
  header,
  body,
  footer,
  tone = "sky",
}: {
  header: ReactNode;
  body: ReactNode;
  footer?: ReactNode;
  tone?: ArchiveTone;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col px-6 py-5">
      {header}
      <ArchiveSectionCard tone={tone}>{body}</ArchiveSectionCard>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}

export function ArchiveSplitPanel({
  icon,
  title,
  description,
  left,
  right,
  columns = "lg:grid-cols-[300px_1fr]",
  tone = "sky",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  left: ReactNode;
  right: ReactNode;
  columns?: string;
  tone?: ArchiveTone;
}) {
  return (
    <ArchiveTabFrame icon={icon} title={title} description={description} tone={tone}>
      <ArchiveInfoGrid className={columns}>
        {left}
        {right}
      </ArchiveInfoGrid>
    </ArchiveTabFrame>
  );
}

export function ArchiveFormHeader({
  label,
  children,
}: {
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{label}</div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function ArchiveActionButton({
  children,
  onClick,
  disabled = false,
  variant = "secondary",
  tone = "sky",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "secondary" | "primary";
  tone?: ArchiveTone;
}) {
  const toneClasses = resolveArchiveToneClasses(tone);
  const className =
    variant === "primary"
      ? `rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses.actionPrimary}`
      : `rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${toneClasses.actionSecondary}`;

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

export function ArchiveSectionCard({
  children,
  tone = "sky",
}: {
  children: ReactNode;
  tone?: ArchiveTone;
}) {
  const toneClasses = resolveArchiveToneClasses(tone);

  return (
    <div className={`relative overflow-hidden rounded-[26px] border border-slate-200/90 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-colors dark:border-slate-800 dark:bg-slate-950/80 ${toneClasses.sectionAccent} before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-0.5 before:rounded-full after:pointer-events-none after:absolute after:inset-y-5 after:left-0 after:w-1 after:rounded-r-full ${ARCHIVE_SPACING.cardBody}`}>
      {children}
    </div>
  );
}

export function ArchiveTabFrame({
  icon,
  title,
  description,
  children,
  tone = "sky",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
  tone?: ArchiveTone;
}) {
  return (
    <div className={ARCHIVE_SPACING.page}>
      <ArchiveLayerHeader icon={icon} title={title} description={description} tone={tone} />
      {children}
    </div>
  );
}

export function ArchiveTabBar({ children }: { children: ReactNode }) {
  return <div className={ARCHIVE_TABS.container}>{children}</div>;
}

export function ArchiveSegmentedTabButton({
  active,
  icon: Icon,
  label,
  description,
  onClick,
  tone = "sky",
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  description: string;
  onClick: () => void;
  tone?: ArchiveTone;
}) {
  const toneClasses = resolveArchiveToneClasses(tone);

  return (
    <button
      type="button"
      onClick={onClick}
      data-tone={tone}
      className={`group min-w-[128px] flex-1 rounded-[15px] px-3 py-2 text-left transition ${active ? toneClasses.tabActive : `${ARCHIVE_TABS.idleBase} ${toneClasses.tabIdleHover}`}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border transition ${active ? toneClasses.tabIconActive : toneClasses.tabIconIdle}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className={`text-sm font-semibold tracking-tight ${active ? toneClasses.tabLabelActive : "text-slate-800 dark:text-slate-100"}`}>
            {label}
          </div>
          <div className={`mt-1 text-xs leading-5 ${active ? toneClasses.tabDescriptionActive : "text-slate-500 dark:text-slate-400"}`}>
            {description}
          </div>
        </div>
      </div>
    </button>
  );
}
