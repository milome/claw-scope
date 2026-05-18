import { useI18n } from "../../contexts/I18nContext";
import type { GatewayConfigSchemaLookupResult } from "../../contexts/OpenClawContext";

interface ConfigSchemaSummaryProps {
  schema: GatewayConfigSchemaLookupResult | null;
  loading: boolean;
  title?: string;
  variant?: "default" | "compact";
}

export function ConfigSchemaSummary({
  schema,
  loading,
  title,
  variant = "default",
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
  const fieldCount = schema.children.length;
  const displayTitle = title ?? t("config.agentSettings.schemaTitle");

  if (variant === "compact") {
    return (
      <details className="group rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-xs shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-950/45">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {displayTitle}
              </span>
              {schema.nodeType ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  {schema.nodeType}
                </span>
              ) : null}
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                {t("config.agentSettings.schemaFieldCount", fieldCount)}
              </span>
            </div>
            {summary ? (
              <p className="mt-1 truncate text-slate-500 dark:text-slate-400">
                {summary}
              </p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-colors group-open:border-sky-200 group-open:bg-sky-50 group-open:text-sky-700 dark:border-slate-700 dark:text-slate-400 dark:group-open:border-sky-900/70 dark:group-open:bg-sky-950/30 dark:group-open:text-sky-300">
            {t("config.agentSettings.schemaDetails")}
          </span>
        </summary>

        <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <div className="break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            {schema.path}
          </div>
          {fieldCount > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {schema.children.map((child) => (
                <div
                  key={child.path}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/50"
                >
                  <span className="min-w-0 truncate font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {child.key}
                  </span>
                  {child.required ? (
                    <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-600 dark:bg-rose-950/35 dark:text-rose-300">
                      {t("config.agentSettings.schemaRequired")}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </details>
    );
  }

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
