import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

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
  container: "flex flex-wrap gap-2",
  active:
    "border border-sky-200 bg-sky-50 text-sky-700 shadow-sm dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
  idle:
    "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600",
};

export function ArchiveLayerHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 px-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-700" />
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-300">
          <Icon className="h-3.5 w-3.5 text-sky-500 dark:text-sky-300" />
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
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 ${className}`.trim()}>
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
  return (
    <div className="absolute inset-y-0 right-0 z-20 w-full max-w-md border-l border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
        >
          Close
        </button>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

export function ArchiveDrawer({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-y-0 right-0 z-20 w-full max-w-md border-l border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
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
    <div className="flex-1 rounded-xl md:rounded-lg border-none md:border md:border-slate-200 md:shadow-sm overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.88))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,1),rgba(2,6,23,0.92))] dark:md:border-slate-800">
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
}: {
  header: ReactNode;
  body: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col px-6 py-5">
      {header}
      <ArchiveSectionCard>{body}</ArchiveSectionCard>
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
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  left: ReactNode;
  right: ReactNode;
  columns?: string;
}) {
  return (
    <ArchiveTabFrame icon={icon} title={title} description={description}>
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
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "secondary" | "primary";
}) {
  const className =
    variant === "primary"
      ? "rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
      : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300";

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

export function ArchiveSectionCard({ children }: { children: ReactNode }) {
  return (
    <div className={`relative overflow-hidden rounded-[26px] border border-slate-200/90 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-colors before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-0.5 before:rounded-full before:bg-sky-400/85 after:pointer-events-none after:absolute after:inset-y-5 after:left-0 after:w-1 after:rounded-r-full after:bg-sky-400/95 dark:border-slate-800 dark:bg-slate-950/80 dark:before:bg-sky-300/80 dark:after:bg-sky-300/85 ${ARCHIVE_SPACING.cardBody}`}>
      {children}
    </div>
  );
}

export function ArchiveTabFrame({
  icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className={ARCHIVE_SPACING.page}>
      <ArchiveLayerHeader icon={icon} title={title} description={description} />
      {children}
    </div>
  );
}

export function ArchiveTabBar({ children }: { children: ReactNode }) {
  return <div className={ARCHIVE_TABS.container}>{children}</div>;
}
