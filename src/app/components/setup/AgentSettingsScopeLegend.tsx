import { useI18n } from "../../contexts/I18nContext";

const SCOPE_LEGEND_STYLES = [
  "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300",
  "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300",
  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
] as const;

export function AgentSettingsScopeLegend() {
  const { t } = useI18n();
  const items = [
    {
      title: t("config.agentSettings.scopeGlobalTitle"),
      desc: t("config.agentSettings.scopeGlobalDesc"),
    },
    {
      title: t("config.agentSettings.scopeDefaultRoutingTitle"),
      desc: t("config.agentSettings.scopeDefaultRoutingDesc"),
    },
    {
      title: t("config.agentSettings.scopeConditionalDefaultsTitle"),
      desc: t("config.agentSettings.scopeConditionalDefaultsDesc"),
    },
    {
      title: t("config.agentSettings.scopeSelectedOverrideTitle"),
      desc: t("config.agentSettings.scopeSelectedOverrideDesc"),
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 md:p-7 space-y-4">
        <div>
          <h3 className="text-[15px] font-semibold mb-1.5">
            {t("config.agentSettings.scopeLegendTitle")}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-6">
            {t("config.agentSettings.scopeLegendDesc")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item, index) => (
            <div
              key={item.title}
              className={`rounded-2xl border px-4 py-4 ${SCOPE_LEGEND_STYLES[index]}`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.22em] mb-2">
                {item.title}
              </div>
              <div className="text-sm leading-6">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
