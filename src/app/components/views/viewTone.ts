export type ViewTone = "sky" | "violet" | "emerald" | "amber" | "rose";

export type ResourceTone = "sky" | "violet" | "emerald" | "amber";

export function resolveViewToneClasses(tone: ViewTone) {
  switch (tone) {
    case "violet":
      return {
        softBadge: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/70 dark:bg-violet-950/30 dark:text-violet-300",
        iconText: "text-violet-500 dark:text-violet-400",
        title: "text-slate-900 dark:text-slate-100",
        meta: "text-slate-400 dark:text-slate-500",
        cardAccent: "before:bg-violet-400/85 after:bg-violet-400/95 dark:before:bg-violet-300/80 dark:after:bg-violet-300/85",
        cardHover: "hover:border-violet-200 dark:hover:border-violet-800",
        metricBadge: "bg-violet-50 text-violet-500 shadow-sm dark:bg-violet-900/30 dark:text-violet-400",
        navActive: "bg-violet-50 dark:bg-violet-950/30 border-violet-500 text-violet-700 dark:text-violet-300",
        navIconActive: "text-violet-600 dark:text-violet-400",
        navMobileActive: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30",
        actionSecondary: "hover:border-violet-200 hover:text-violet-700 dark:hover:border-violet-700 dark:hover:text-violet-300",
      };
    case "emerald":
      return {
        softBadge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300",
        iconText: "text-emerald-500 dark:text-emerald-400",
        title: "text-slate-900 dark:text-slate-100",
        meta: "text-slate-500 dark:text-slate-400",
        cardAccent: "before:bg-emerald-400/85 after:bg-emerald-400/95 dark:before:bg-emerald-300/80 dark:after:bg-emerald-300/85",
        cardHover: "hover:border-emerald-200 dark:hover:border-emerald-800",
        metricBadge: "bg-emerald-50 text-emerald-500 shadow-sm dark:bg-emerald-900/30 dark:text-emerald-400",
        navActive: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-300",
        navIconActive: "text-emerald-600 dark:text-emerald-400",
        navMobileActive: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
        actionSecondary: "hover:border-emerald-200 hover:text-emerald-700 dark:hover:border-emerald-700 dark:hover:text-emerald-300",
      };
    case "amber":
      return {
        softBadge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300",
        iconText: "text-amber-500 dark:text-amber-400",
        title: "text-slate-900 dark:text-slate-100",
        meta: "text-slate-500 dark:text-slate-400",
        cardAccent: "before:bg-amber-400/85 after:bg-amber-400/95 dark:before:bg-amber-300/80 dark:after:bg-amber-300/85",
        cardHover: "hover:border-amber-200 dark:hover:border-amber-800",
        metricBadge: "bg-amber-50 text-amber-500 shadow-sm dark:bg-amber-900/30 dark:text-amber-400",
        navActive: "bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-700 dark:text-amber-300",
        navIconActive: "text-amber-600 dark:text-amber-400",
        navMobileActive: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
        actionSecondary: "hover:border-amber-200 hover:text-amber-700 dark:hover:border-amber-700 dark:hover:text-amber-300",
      };
    case "rose":
      return {
        softBadge: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300",
        iconText: "text-rose-500 dark:text-rose-400",
        title: "text-slate-900 dark:text-slate-100",
        meta: "text-slate-500 dark:text-slate-400",
        cardAccent: "before:bg-rose-400/85 after:bg-rose-400/95 dark:before:bg-rose-300/80 dark:after:bg-rose-300/85",
        cardHover: "hover:border-rose-200 dark:hover:border-rose-800",
        metricBadge: "bg-rose-50 text-rose-500 shadow-sm dark:bg-rose-900/30 dark:text-rose-400",
        navActive: "bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-700 dark:text-rose-300",
        navIconActive: "text-rose-600 dark:text-rose-400",
        navMobileActive: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30",
        actionSecondary: "hover:border-rose-200 hover:text-rose-700 dark:hover:border-rose-700 dark:hover:text-rose-300",
      };
    case "sky":
    default:
      return {
        softBadge: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300",
        iconText: "text-sky-500 dark:text-sky-400",
        title: "text-slate-900 dark:text-slate-100",
        meta: "text-slate-500 dark:text-slate-400",
        cardAccent: "before:bg-sky-400/85 after:bg-sky-400/95 dark:before:bg-sky-300/80 dark:after:bg-sky-300/85",
        cardHover: "hover:border-sky-200 dark:hover:border-sky-800",
        metricBadge: "bg-sky-50 text-sky-500 shadow-sm dark:bg-sky-900/30 dark:text-sky-400",
        navActive: "bg-sky-50 dark:bg-sky-900/30 border-sky-500 text-sky-700 dark:text-sky-400",
        navIconActive: "text-sky-600 dark:text-sky-400",
        navMobileActive: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30",
        actionSecondary: "hover:border-sky-200 hover:text-sky-700 dark:hover:border-sky-700 dark:hover:text-sky-300",
      };
  }
}

export function resourceToneForGroup(groupId: string): ResourceTone {
  if (groupId.includes("documents")) {
    return "violet";
  }
  if (groupId.includes("timeline")) {
    return "emerald";
  }
  if (groupId.includes("external")) {
    return "amber";
  }
  return "sky";
}

export function resolveResourceToneClasses(tone: ResourceTone) {
  switch (tone) {
    case "violet":
      return {
        icon: "text-violet-500 dark:text-violet-400",
        iconWrap: "border-violet-200 bg-violet-50 dark:border-violet-800/60 dark:bg-violet-950/25",
        selected: "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-slate-800",
        dot: "bg-violet-500",
        hover: "hover:border-violet-200 dark:hover:border-violet-700",
        action: "hover:border-violet-300 hover:text-violet-700 dark:hover:border-violet-700 dark:hover:text-violet-300",
      };
    case "emerald":
      return {
        icon: "text-emerald-500 dark:text-emerald-400",
        iconWrap: "border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/25",
        selected: "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-slate-800",
        dot: "bg-emerald-500",
        hover: "hover:border-emerald-200 dark:hover:border-emerald-700",
        action: "hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-700 dark:hover:text-emerald-300",
      };
    case "amber":
      return {
        icon: "text-amber-500 dark:text-amber-400",
        iconWrap: "border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/25",
        selected: "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-slate-800",
        dot: "bg-amber-500",
        hover: "hover:border-amber-200 dark:hover:border-amber-700",
        action: "hover:border-amber-300 hover:text-amber-700 dark:hover:border-amber-700 dark:hover:text-amber-300",
      };
    default:
      return {
        icon: "text-sky-500 dark:text-sky-400",
        iconWrap: "border-sky-200 bg-sky-50 dark:border-sky-800/60 dark:bg-sky-950/25",
        selected: "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-slate-800",
        dot: "bg-sky-500",
        hover: "hover:border-sky-200 dark:hover:border-sky-700",
        action: "hover:border-sky-300 hover:text-sky-700 dark:hover:border-sky-700 dark:hover:text-sky-300",
      };
  }
}

export function resolveInputTone(tone: ViewTone) {
  switch (tone) {
    case "violet":
      return "focus:border-violet-300 dark:focus:border-violet-500";
    case "emerald":
      return "focus:border-emerald-300 dark:focus:border-emerald-500";
    case "amber":
      return "focus:border-amber-300 dark:focus:border-amber-500";
    case "rose":
      return "focus:border-rose-300 dark:focus:border-rose-500";
    default:
      return "focus:border-sky-300 dark:focus:border-sky-500";
  }
}

export function resolveSolidToneButton(tone: ViewTone) {
  switch (tone) {
    case "violet":
      return "bg-violet-600 hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400";
    case "emerald":
      return "bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400";
    case "amber":
      return "bg-amber-500 text-slate-950 hover:bg-amber-400 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400";
    case "rose":
      return "bg-rose-600 hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400";
    default:
      return "bg-sky-600 hover:bg-sky-500 dark:bg-sky-600 dark:hover:bg-sky-500";
  }
}

export function resolveOutlineToneButton(tone: ViewTone) {
  switch (tone) {
    case "violet":
      return "hover:border-violet-300 hover:text-violet-700 dark:hover:border-violet-700 dark:hover:text-violet-300";
    case "emerald":
      return "hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-700 dark:hover:text-emerald-300";
    case "amber":
      return "hover:border-amber-300 hover:text-amber-700 dark:hover:border-amber-700 dark:hover:text-amber-300";
    case "rose":
      return "hover:border-rose-300 hover:text-rose-700 dark:hover:border-rose-700 dark:hover:text-rose-300";
    default:
      return "hover:border-sky-300 hover:text-sky-700 dark:hover:border-sky-700 dark:hover:text-sky-300";
  }
}

export function resolveSelectedToneSurface(tone: ViewTone) {
  switch (tone) {
    case "violet":
      return "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-slate-800";
    case "emerald":
      return "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-slate-800";
    case "amber":
      return "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-slate-800";
    case "rose":
      return "border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-slate-800";
    default:
      return "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-slate-800";
  }
}
