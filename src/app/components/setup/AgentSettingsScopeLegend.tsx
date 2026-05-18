import { useI18n } from "../../contexts/I18nContext";
import type { AgentSettingsScopeId } from "./agentSettingsState";

const SCOPE_LEGEND_STYLES = [
  "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300",
  "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300",
  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
  "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/30 dark:text-fuchsia-300",
] as const;

export function AgentSettingsScopeLegend({
  activeScope,
  onSelectScope,
  layout = "grid",
  counts,
}: {
  activeScope?: AgentSettingsScopeId | null;
  onSelectScope?: (scope: AgentSettingsScopeId) => void;
  layout?: "grid" | "lane";
  counts?: Partial<Record<AgentSettingsScopeId, number>>;
}) {
  const { t } = useI18n();
  const isLane = layout === "lane";
  const items = [
    {
      id: "gateway_global" as const,
      title: t("config.agentSettings.scopeGlobalTitle"),
      desc: t("config.agentSettings.scopeGlobalDesc"),
    },
    {
      id: "default_agent_routing" as const,
      title: t("config.agentSettings.scopeDefaultRoutingTitle"),
      desc: t("config.agentSettings.scopeDefaultRoutingDesc"),
    },
    {
      id: "universal_defaults" as const,
      title: t("config.agentSettings.scopeConditionalDefaultsTitle"),
      desc: t("config.agentSettings.scopeConditionalDefaultsDesc"),
    },
    {
      id: "selected_agent_override" as const,
      title: t("config.agentSettings.scopeSelectedOverrideTitle"),
      desc: t("config.agentSettings.scopeSelectedOverrideDesc"),
    },
    {
      id: "mixed" as const,
      title: t("config.agentSettings.scopeMixedTitle"),
      desc: t("config.agentSettings.scopeMixedDesc"),
    },
  ];

  return (
    <div
      className={
        isLane
          ? "h-full"
          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
      }
    >
      <div className={isLane ? "space-y-4" : "p-6 md:p-7 space-y-4"}>
        <div>
          <h3 className="text-[15px] font-semibold mb-1.5">
            {t("config.agentSettings.scopeNavigatorTitle")}
          </h3>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {t("config.agentSettings.scopeNavigatorDesc")}
          </p>
        </div>
        <div
          className={
            isLane
              ? "flex flex-col gap-2.5"
              : "grid grid-cols-1 md:grid-cols-2 gap-3"
          }
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={onSelectScope ? () => onSelectScope(item.id) : undefined}
              aria-pressed={activeScope === item.id}
              className={`rounded-2xl border text-left transition-all ${SCOPE_LEGEND_STYLES[index]} ${
                isLane ? "px-4 py-3.5" : "px-4 py-4"
              } ${
                onSelectScope
                  ? activeScope === item.id
                    ? "ring-2 ring-offset-2 ring-slate-900/10 dark:ring-slate-100/20 shadow-sm opacity-100"
                    : isLane
                      ? "opacity-75 hover:opacity-100 hover:translate-x-1"
                      : "opacity-80 hover:opacity-100"
                  : ""
              }`}
            >
              <div
                className={`font-semibold uppercase tracking-[0.22em] ${
                  isLane ? "mb-1.5 text-[11px]" : "mb-2 text-xs"
                }`}
              >
                {item.title}
              </div>
              <div
                className={
                  isLane
                    ? "line-clamp-2 text-xs leading-5"
                    : "line-clamp-2 text-sm leading-6"
                }
              >
                {item.desc}
              </div>
              <div className="mt-2 text-[11px] font-semibold opacity-80">
                {t(
                  "config.agentSettings.scopeFieldCount",
                  counts?.[item.id] ?? 0,
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
