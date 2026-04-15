import { useI18n } from "../../contexts/I18nContext";
import type {
  GatewayAgentSettingsFieldMetadata,
  GatewayAgentSettingsWriteAction,
} from "../../contexts/OpenClawContext";

function metadataTone(
  source: GatewayAgentSettingsFieldMetadata["source"],
) {
  switch (source) {
    case "gateway_global":
      return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300";
    case "default_agent_routing":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";
    case "universal_defaults":
      return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300";
    case "selected_agent_override":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300";
    case "mixed":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/30 dark:text-fuchsia-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300";
  }
}

function sourceLabel(
  source: GatewayAgentSettingsFieldMetadata["source"],
  t: (key: string) => string,
) {
  switch (source) {
    case "gateway_global":
      return t("config.agentSettings.meta.source.gatewayGlobal");
    case "default_agent_routing":
      return t("config.agentSettings.meta.source.defaultAgentRouting");
    case "universal_defaults":
      return t("config.agentSettings.meta.source.universalDefaults");
    case "selected_agent_override":
      return t("config.agentSettings.meta.source.selectedAgentOverride");
    case "effective_runtime":
      return t("config.agentSettings.meta.source.effectiveRuntime");
    case "mixed":
      return t("config.agentSettings.meta.source.mixed");
    default:
      return t("config.agentSettings.meta.source.unset");
  }
}

function writeActionLabel(
  action: GatewayAgentSettingsWriteAction,
  t: (key: string) => string,
) {
  const kind =
    action.kind === "agents_update"
      ? t("config.agentSettings.meta.action.agentsUpdate")
      : t("config.agentSettings.meta.action.configPatch");

  return action.path ? `${kind}: ${action.path}` : kind;
}

export function AgentSettingsFieldMetadataSummary({
  metadata,
}: {
  metadata?: GatewayAgentSettingsFieldMetadata | null;
}) {
  const { t } = useI18n();

  if (!metadata) {
    return null;
  }

  return (
    <div className="grid gap-2 pt-1 sm:grid-cols-2">
      <div
        className={`rounded-xl border px-3 py-2.5 ${metadataTone(metadata.source)}`}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">
          {t("config.agentSettings.meta.sourceLabel")}
        </div>
        <div className="mt-1 text-xs font-semibold break-words">
          {sourceLabel(metadata.source, t)}
        </div>
        {metadata.path ? (
          <div className="mt-1 break-all font-mono text-[11px] opacity-80">
            {metadata.path}
          </div>
        ) : null}
      </div>
      {metadata.writeActions.map((action) => (
        <div
          key={`${action.kind}:${action.path ?? "none"}`}
          className={`rounded-xl border px-3 py-2.5 ${metadataTone(metadata.source)}`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">
            {t("config.agentSettings.meta.writeLabel")}
          </div>
          <div className="mt-1 break-all text-[11px] font-mono leading-5">
            {writeActionLabel(action, t)}
          </div>
        </div>
      ))}
    </div>
  );
}
