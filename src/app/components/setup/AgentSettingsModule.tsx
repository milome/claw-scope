import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  Folder,
  IdCard,
  Network,
  RefreshCw,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { useI18n } from "../../contexts/I18nContext";
import {
  gatewayAgentSettingsGet,
  type GatewayAgentSettingsResult,
  useOpenClaw,
} from "../../contexts/OpenClawContext";
import {
  canEditAgentSettings,
  resolveSelectedAgentId,
} from "./agentSettingsState";

function statusLabel(
  status: "active" | "standby" | "sleeping",
  t: (key: string) => string,
) {
  switch (status) {
    case "active":
      return t("agent.active");
    case "standby":
      return t("agent.standby");
    default:
      return t("agent.sleeping");
  }
}

function extractErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return null;
}

export function AgentSettingsModule() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { agents, nodes, grantedScopes } = useOpenClaw();
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [settings, setSettings] = useState<GatewayAgentSettingsResult | null>(
    null,
  );
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const agentIds = useMemo(() => agents.map((agent) => agent.id), [agents]);
  const canEdit = canEditAgentSettings(grantedScopes);

  useEffect(() => {
    setSelectedAgentId((current) => resolveSelectedAgentId(current, agentIds));
  }, [agentIds]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  const selectedNodeName = useMemo(() => {
    if (!selectedAgent) {
      return "—";
    }

    return (
      nodes.find((node) => node.id === selectedAgent.nodeId)?.name ??
      selectedAgent.nodeId
    );
  }, [nodes, selectedAgent]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedAgentId) {
      setSettings(null);
      setLoadError(null);
      setIsLoadingSettings(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingSettings(true);
    setLoadError(null);

    void gatewayAgentSettingsGet(selectedAgentId)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setSettings(result);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setSettings(null);
        setLoadError(extractErrorMessage(error));
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsLoadingSettings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken, selectedAgentId]);

  const workspaceValue =
    settings?.workspace?.trim() || t("config.agentSettings.unset");
  const modelValue = settings?.model?.trim() || t("config.agentSettings.unset");

  if (agents.length === 0) {
    return (
      <div className="w-full max-w-4xl font-sans text-slate-900 dark:text-slate-100 pb-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-bold tracking-tight mb-2">
            {t("config.agentSettings.title")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("config.agentSettings.empty")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl font-sans text-slate-900 dark:text-slate-100 pb-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight mb-1">
          {t("config.agentSettings.title")}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("config.agentSettings.desc")}
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0 border border-sky-100 dark:border-sky-900/60">
                <IdCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold mb-1.5">
                  {t("config.agentSettings.boundaryTitle")}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-6">
                  {t("config.agentSettings.boundaryDesc")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-sky-600 hover:bg-black dark:hover:bg-sky-500 text-white px-4 py-2.5 text-sm font-semibold transition-all shadow-md active:scale-95"
            >
              {t("config.agentSettings.openProfile")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 md:p-7 flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,240px)_1fr] gap-6 items-start">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  {t("config.agentSettings.select")}
                </span>
                <select
                  value={selectedAgentId}
                  onChange={(event) => setSelectedAgentId(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 text-sm text-slate-700 dark:text-slate-100 outline-none focus:border-sky-400 dark:focus:border-sky-500"
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500 mb-2">
                    {t("config.agentSettings.agentId")}
                  </div>
                  <div className="text-sm font-mono break-all text-slate-700 dark:text-slate-100">
                    {selectedAgent?.id ?? "—"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500 mb-2">
                    {t("config.agentSettings.node")}
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-100 flex items-center gap-2">
                    <Network className="w-4 h-4 text-cyan-500" />
                    {selectedNodeName}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500 mb-2">
                    {t("config.agentSettings.status")}
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-100 flex items-center gap-2">
                    {canEdit ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                    )}
                    {selectedAgent ? statusLabel(selectedAgent.status, t) : "—"}
                  </div>
                </div>
              </div>
            </div>

            {!canEdit ? (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                {t("config.agentSettings.readonly")}
              </div>
            ) : null}

            <div className="rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/30 px-4 py-3 text-sm text-sky-800 dark:text-sky-300">
              {t("config.agentSettings.pending")}
            </div>

            {loadError ? (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                {t("config.agentSettings.loadFailed")} {loadError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  {t("config.agentSettings.workspace")}
                </span>
                <div className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 px-3 py-3 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span
                    className={`min-w-0 break-all ${settings?.workspace ? "text-slate-700 dark:text-slate-100" : ""}`}
                  >
                    {isLoadingSettings
                      ? t("config.agentSettings.loading")
                      : workspaceValue}
                  </span>
                </div>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  {t("config.agentSettings.model")}
                </span>
                <div className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 px-3 py-3 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span
                    className={`min-w-0 break-all ${settings?.model ? "text-slate-700 dark:text-slate-100" : ""}`}
                  >
                    {isLoadingSettings
                      ? t("config.agentSettings.loading")
                      : modelValue}
                  </span>
                </div>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setReloadToken((current) => current + 1)}
                disabled={!selectedAgentId || isLoadingSettings}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  !selectedAgentId || isLoadingSettings
                    ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-100 hover:border-sky-300 dark:hover:border-sky-700 hover:text-sky-600 dark:hover:text-sky-300"
                }`}
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoadingSettings ? "animate-spin" : ""}`}
                />
                {t("config.agentSettings.reload")}
              </button>
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-300 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white/80 dark:text-slate-500 cursor-not-allowed"
              >
                {t("config.agentSettings.save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
