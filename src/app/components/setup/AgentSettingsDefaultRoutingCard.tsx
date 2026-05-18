import { useI18n } from "../../contexts/I18nContext";
import { AgentSettingsFieldMetadataSummary } from "./AgentSettingsFieldMetadataSummary";
import type { GatewayAgentSettingsFieldMetadata } from "../../contexts/OpenClawContext";

export function AgentSettingsDefaultRoutingCard({
  canEdit,
  isDefaultDraft,
  onChange,
  metadata,
}: {
  canEdit: boolean;
  isDefaultDraft: boolean;
  onChange: (checked: boolean) => void;
  metadata?: GatewayAgentSettingsFieldMetadata | null;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20 p-5 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {t("config.agentSettings.defaultAgentSectionTitle")}
        </h4>
        <p className="mt-1 text-sm leading-6 text-amber-800/90 dark:text-amber-300">
          {t("config.agentSettings.defaultAgentSectionDesc")}
        </p>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-white/70 dark:bg-slate-950/40 px-4 py-3">
        <input
          type="checkbox"
          checked={isDefaultDraft}
          disabled={!canEdit}
          onChange={(event) => onChange(event.target.checked)}
          style={{ accentColor: "#d97706" }}
          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
        />
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-100">
            {t("config.agentSettings.defaultAgent")}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t("config.agentSettings.defaultAgentHint")}
          </div>
        </div>
      </label>

      <AgentSettingsFieldMetadataSummary metadata={metadata} />
    </div>
  );
}
