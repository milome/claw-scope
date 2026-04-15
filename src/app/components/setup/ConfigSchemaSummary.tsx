import { useI18n } from "../../contexts/I18nContext";
import type { GatewayConfigSchemaLookupResult } from "../../contexts/OpenClawContext";

interface ConfigSchemaSummaryProps {
  schema: GatewayConfigSchemaLookupResult | null;
  loading: boolean;
}

export function ConfigSchemaSummary({
  schema,
  loading,
}: ConfigSchemaSummaryProps) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
        {t("config.agentSettings.schemaLoading")}
      </div>
    );
  }

  if (!schema) {
    return null;
  }

  const summary = schema.hint?.help ?? schema.description ?? schema.title ?? null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 px-4 py-3 space-y-2">
      <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        <span>{t("config.agentSettings.schemaTitle")}</span>
        {schema.nodeType ? <span>{schema.nodeType}</span> : null}
      </div>
      {summary ? (
        <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">{summary}</p>
      ) : null}
      <div className="text-[11px] text-slate-500 dark:text-slate-400">
        {t("config.agentSettings.schemaPath")} {schema.path}
      </div>
      {schema.children.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          {schema.children.map((child) => (
            <span
              key={child.path}
              className="rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1"
            >
              {child.key}
              {child.required ? " *" : ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
