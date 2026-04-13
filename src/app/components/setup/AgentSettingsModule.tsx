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
  gatewayConfigSchemaLookup,
  gatewayAgentSettingsGet,
  type GatewayConfigSchemaLookupResult,
  type GatewayAgentSettingsResult,
  type GatewayAgentSettingsUpdateInput,
  useOpenClaw,
} from "../../contexts/OpenClawContext";
import { ConfigSchemaSummary } from "./ConfigSchemaSummary";
import {
  canEditAgentSettings,
  resolveSelectedAgentId,
} from "./agentSettingsState";

const ADVANCED_SCHEMA_PATHS = {
  bindings: "bindings",
  groupChat: "agents.defaults.groupChat",
  sandbox: "agents.defaults.sandbox",
  tools: "agents.defaults.tools",
  memorySearch: "agents.defaults.memorySearch",
} as const;

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

interface MemorySearchDraft {
  enabled: boolean;
  provider: string;
  model: string;
  extraPathsText: string;
  sourcesText: string;
  storePath: string;
  sessionMemoryEnabled: boolean;
  hybridEnabled: boolean;
  mmrEnabled: boolean;
  mmr: string;
  temporalDecay: string;
}

const EMPTY_MEMORY_SEARCH_DRAFT: MemorySearchDraft = {
  enabled: true,
  provider: "",
  model: "",
  extraPathsText: "",
  sourcesText: "",
  storePath: "",
  sessionMemoryEnabled: false,
  hybridEnabled: false,
  mmrEnabled: false,
  mmr: "",
  temporalDecay: "",
};

function normalizeDraftText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function buildTextDelta(draft: string, current?: string | null) {
  const normalizedDraft = normalizeDraftText(draft);
  const normalizedCurrent = normalizeDraftText(current);
  const changed = normalizedDraft !== normalizedCurrent;

  return {
    changed,
    value: changed ? (normalizedDraft || null) : undefined,
    clear: changed && normalizedDraft.length === 0,
  };
}

export function AgentSettingsModule() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { agents, nodes, grantedScopes, saveAgentSettings } = useOpenClaw();
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [settings, setSettings] = useState<GatewayAgentSettingsResult | null>(
    null,
  );
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [schemaErrors, setSchemaErrors] = useState<
    Partial<Record<(typeof ADVANCED_SCHEMA_PATHS)[keyof typeof ADVANCED_SCHEMA_PATHS], string>>
  >({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [schemas, setSchemas] = useState<
    Partial<Record<(typeof ADVANCED_SCHEMA_PATHS)[keyof typeof ADVANCED_SCHEMA_PATHS], GatewayConfigSchemaLookupResult>>
  >({});
  const [reloadToken, setReloadToken] = useState(0);
  const [workspaceDraft, setWorkspaceDraft] = useState("");
  const [modelDraft, setModelDraft] = useState("");
  const [agentDirDraft, setAgentDirDraft] = useState("");
  const [isDefaultDraft, setIsDefaultDraft] = useState(false);
  const [bindingsDraft, setBindingsDraft] = useState("");
  const [groupChatDraft, setGroupChatDraft] = useState("");
  const [sandboxDraft, setSandboxDraft] = useState("");
  const [toolsDraft, setToolsDraft] = useState("");
  const [memorySearchDraft, setMemorySearchDraft] = useState<MemorySearchDraft>(
    EMPTY_MEMORY_SEARCH_DRAFT,
  );

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

  useEffect(() => {
    let cancelled = false;

    if (!selectedAgentId) {
      setSchemas({});
      setSchemaErrors({});
      setIsLoadingSchemas(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingSchemas(true);
    setSchemaErrors({});

    void Promise.allSettled(
      Object.values(ADVANCED_SCHEMA_PATHS).map((path) => gatewayConfigSchemaLookup(path)),
    )
      .then((results) => {
        if (cancelled) {
          return;
        }

        const next: Partial<
          Record<
            (typeof ADVANCED_SCHEMA_PATHS)[keyof typeof ADVANCED_SCHEMA_PATHS],
            GatewayConfigSchemaLookupResult
          >
        > = {};
        const nextErrors: Partial<
          Record<
            (typeof ADVANCED_SCHEMA_PATHS)[keyof typeof ADVANCED_SCHEMA_PATHS],
            string
          >
        > = {};

        Object.values(ADVANCED_SCHEMA_PATHS).forEach((path, index) => {
          const result = results[index];
          if (result?.status === "fulfilled") {
            next[path] = result.value;
            return;
          }
          if (result?.status === "rejected") {
            nextErrors[path] =
              extractErrorMessage(result.reason) ??
              t("config.agentSettings.schemaUnavailable");
          }
        });

        setSchemas(next);
        setSchemaErrors(nextErrors);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setIsLoadingSchemas(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken, selectedAgentId, t]);

  const schemaErrorEntries = Object.entries(schemaErrors);

  const workspaceValue =
    settings?.workspace?.trim() || t("config.agentSettings.unset");
  const modelValue = settings?.model?.trim() || t("config.agentSettings.unset");
  const agentDirValue =
    settings?.agentDir?.trim() || t("config.agentSettings.unset");
  const memorySearchSettings = settings?.memorySearch ?? null;
  const bindingsValue =
    settings?.bindingsJson?.trim() || t("config.agentSettings.unset");
  const groupChatValue =
    settings?.groupChatJson?.trim() || t("config.agentSettings.unset");
  const sandboxValue =
    settings?.sandboxJson?.trim() || t("config.agentSettings.unset");
  const toolsValue = settings?.toolsJson?.trim() || t("config.agentSettings.unset");

  const workspacePatch = buildTextDelta(workspaceDraft, settings?.workspace);
  const modelPatch = buildTextDelta(modelDraft, settings?.model);
  const agentDirPatch = buildTextDelta(agentDirDraft, settings?.agentDir);
  const bindingsPatch = buildTextDelta(bindingsDraft, settings?.bindingsJson);
  const groupChatPatch = buildTextDelta(groupChatDraft, settings?.groupChatJson);
  const sandboxPatch = buildTextDelta(sandboxDraft, settings?.sandboxJson);
  const toolsPatch = buildTextDelta(toolsDraft, settings?.toolsJson);
  const memorySearchProviderPatch = buildTextDelta(
    memorySearchDraft.provider,
    memorySearchSettings?.provider,
  );
  const memorySearchModelPatch = buildTextDelta(
    memorySearchDraft.model,
    memorySearchSettings?.model,
  );
  const memorySearchExtraPathsPatch = buildTextDelta(
    memorySearchDraft.extraPathsText,
    memorySearchSettings?.extraPathsText,
  );
  const memorySearchSourcesPatch = buildTextDelta(
    memorySearchDraft.sourcesText,
    memorySearchSettings?.sourcesText,
  );
  const memorySearchStorePathPatch = buildTextDelta(
    memorySearchDraft.storePath,
    memorySearchSettings?.storePath,
  );
  const memorySearchMmrPatch = buildTextDelta(
    memorySearchDraft.mmr,
    memorySearchSettings?.mmr,
  );
  const memorySearchTemporalDecayPatch = buildTextDelta(
    memorySearchDraft.temporalDecay,
    memorySearchSettings?.temporalDecay,
  );
  const isDefaultChanged = isDefaultDraft !== (settings?.isDefault ?? false);
  const memorySearchEnabledChanged =
    memorySearchDraft.enabled !== (memorySearchSettings?.enabled ?? true);
  const memorySearchSessionMemoryChanged =
    memorySearchDraft.sessionMemoryEnabled !==
    (memorySearchSettings?.sessionMemoryEnabled ?? false);
  const memorySearchHybridChanged =
    memorySearchDraft.hybridEnabled !==
    (memorySearchSettings?.hybridEnabled ?? false);
  const memorySearchMmrEnabledChanged =
    memorySearchDraft.mmrEnabled !==
    (memorySearchSettings?.mmrEnabled ?? false);
  const memorySearchHasChanges =
    memorySearchEnabledChanged ||
    memorySearchProviderPatch.changed ||
    memorySearchModelPatch.changed ||
    memorySearchExtraPathsPatch.changed ||
    memorySearchSourcesPatch.changed ||
    memorySearchStorePathPatch.changed ||
    memorySearchSessionMemoryChanged ||
    memorySearchHybridChanged ||
    memorySearchMmrEnabledChanged ||
    memorySearchMmrPatch.changed ||
    memorySearchTemporalDecayPatch.changed;
  const hasChanges =
    workspacePatch.changed ||
    modelPatch.changed ||
    agentDirPatch.changed ||
    isDefaultChanged ||
    bindingsPatch.changed ||
    groupChatPatch.changed ||
    sandboxPatch.changed ||
    toolsPatch.changed ||
    memorySearchHasChanges;

  useEffect(() => {
    setWorkspaceDraft(settings?.workspace ?? "");
    setModelDraft(settings?.model ?? "");
    setAgentDirDraft(settings?.agentDir ?? "");
    setIsDefaultDraft(settings?.isDefault ?? false);
    setBindingsDraft(settings?.bindingsJson ?? "");
    setGroupChatDraft(settings?.groupChatJson ?? "");
    setSandboxDraft(settings?.sandboxJson ?? "");
    setToolsDraft(settings?.toolsJson ?? "");
    setMemorySearchDraft({
      enabled: settings?.memorySearch.enabled ?? true,
      provider: settings?.memorySearch.provider ?? "",
      model: settings?.memorySearch.model ?? "",
      extraPathsText: settings?.memorySearch.extraPathsText ?? "",
      sourcesText: settings?.memorySearch.sourcesText ?? "",
      storePath: settings?.memorySearch.storePath ?? "",
      sessionMemoryEnabled:
        settings?.memorySearch.sessionMemoryEnabled ?? false,
      hybridEnabled: settings?.memorySearch.hybridEnabled ?? false,
      mmrEnabled: settings?.memorySearch.mmrEnabled ?? false,
      mmr: settings?.memorySearch.mmr ?? "",
      temporalDecay: settings?.memorySearch.temporalDecay ?? "",
    });
    setSaveError(null);
    setSaveSuccess(null);
  }, [
    settings?.agentDir,
    settings?.bindingsJson,
    settings?.groupChatJson,
    settings?.isDefault,
    settings?.memorySearch.enabled,
    settings?.memorySearch.extraPathsText,
    settings?.memorySearch.hybridEnabled,
    settings?.memorySearch.mmrEnabled,
    settings?.memorySearch.mmr,
    settings?.memorySearch.model,
    settings?.memorySearch.provider,
    settings?.memorySearch.sessionMemoryEnabled,
    settings?.memorySearch.sourcesText,
    settings?.memorySearch.storePath,
    settings?.memorySearch.temporalDecay,
    settings?.model,
    settings?.sandboxJson,
    settings?.toolsJson,
    settings?.workspace,
    selectedAgentId,
  ]);

  const handleSave = async () => {
    if (!selectedAgentId || !canEdit) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const next = await saveAgentSettings({
        agentId: selectedAgentId,
        workspace: workspacePatch.value,
        model: modelPatch.value,
        clearWorkspace: workspacePatch.clear,
        clearModel: modelPatch.clear,
        isDefault: isDefaultChanged ? isDefaultDraft : undefined,
        agentDir: agentDirPatch.value,
        clearAgentDir: agentDirPatch.clear,
        bindingsJson: bindingsPatch.value,
        clearBindings: bindingsPatch.clear,
        groupChatJson: groupChatPatch.value,
        clearGroupChat: groupChatPatch.clear,
        sandboxJson: sandboxPatch.value,
        clearSandbox: sandboxPatch.clear,
        toolsJson: toolsPatch.value,
        clearTools: toolsPatch.clear,
        memorySearch: memorySearchHasChanges
          ? {
              enabled: memorySearchEnabledChanged
                ? memorySearchDraft.enabled
                : undefined,
              provider: memorySearchProviderPatch.value,
              clearProvider: memorySearchProviderPatch.clear,
              model: memorySearchModelPatch.value,
              clearModel: memorySearchModelPatch.clear,
              extraPathsText: memorySearchExtraPathsPatch.value,
              clearExtraPaths: memorySearchExtraPathsPatch.clear,
              sourcesText: memorySearchSourcesPatch.value,
              clearSources: memorySearchSourcesPatch.clear,
              storePath: memorySearchStorePathPatch.value,
              clearStorePath: memorySearchStorePathPatch.clear,
              sessionMemoryEnabled: memorySearchSessionMemoryChanged
                ? memorySearchDraft.sessionMemoryEnabled
                : undefined,
              hybridEnabled: memorySearchHybridChanged
                ? memorySearchDraft.hybridEnabled
                : undefined,
              mmrEnabled: memorySearchMmrEnabledChanged
                ? memorySearchDraft.mmrEnabled
                : undefined,
              mmr: memorySearchMmrPatch.value,
              clearMmr: memorySearchMmrPatch.clear,
              temporalDecay: memorySearchTemporalDecayPatch.value,
              clearTemporalDecay: memorySearchTemporalDecayPatch.clear,
            }
          : null,
      } satisfies GatewayAgentSettingsUpdateInput);
      setSettings(next);
      setSaveSuccess(t("config.agentSettings.saveOk"));
    } catch (error) {
      setSaveError(extractErrorMessage(error) ?? t("config.agentSettings.saveFail"));
    } finally {
      setIsSaving(false);
    }
  };

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
              {t("config.agentSettings.partial")}
            </div>

            {loadError ? (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                {t("config.agentSettings.loadFailed")} {loadError}
              </div>
            ) : null}

            {saveError ? (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                {saveError}
              </div>
            ) : null}

            {saveSuccess ? (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                {saveSuccess}
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  {t("config.agentSettings.workspace")}
                </span>
                <div className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 px-3 py-3 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  {canEdit ? (
                    <input
                      type="text"
                      value={workspaceDraft}
                      onChange={(event) => setWorkspaceDraft(event.target.value)}
                      placeholder={t("config.agentSettings.workspacePlaceholder")}
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  ) : (
                    <span
                      className={`min-w-0 break-all ${settings?.workspace ? "text-slate-700 dark:text-slate-100" : ""}`}
                    >
                      {isLoadingSettings
                        ? t("config.agentSettings.loading")
                        : workspaceValue}
                    </span>
                  )}
                </div>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  {t("config.agentSettings.model")}
                </span>
                <div className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 px-3 py-3 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  {canEdit ? (
                    <input
                      type="text"
                      value={modelDraft}
                      onChange={(event) => setModelDraft(event.target.value)}
                      placeholder={t("config.agentSettings.modelPlaceholder")}
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  ) : (
                    <span
                      className={`min-w-0 break-all ${settings?.model ? "text-slate-700 dark:text-slate-100" : ""}`}
                    >
                      {isLoadingSettings
                        ? t("config.agentSettings.loading")
                        : modelValue}
                    </span>
                  )}
                </div>
              </label>

              <label className="flex flex-col gap-2 lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  {t("config.agentSettings.agentDir")}
                </span>
                <div className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 px-3 py-3 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  {canEdit ? (
                    <input
                      type="text"
                      value={agentDirDraft}
                      onChange={(event) => setAgentDirDraft(event.target.value)}
                      placeholder={t("config.agentSettings.agentDirPlaceholder")}
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  ) : (
                    <span
                      className={`min-w-0 break-all ${settings?.agentDir ? "text-slate-700 dark:text-slate-100" : ""}`}
                    >
                      {isLoadingSettings
                        ? t("config.agentSettings.loading")
                        : agentDirValue}
                    </span>
                  )}
                </div>
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-4 py-3">
              <input
                type="checkbox"
                checked={isDefaultDraft}
                disabled={!canEdit}
                onChange={(event) => setIsDefaultDraft(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
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

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/30 p-5 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t("config.agentSettings.advancedPatchTitle")}
                </h4>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {t("config.agentSettings.advancedPatchDesc")}
                </p>
              </div>

              {schemaErrorEntries.length > 0 ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-2 text-xs text-amber-800 dark:text-amber-300">
                  <div>{t("config.agentSettings.schemaUnavailable")}</div>
                  <div className="flex flex-col gap-1">
                    {schemaErrorEntries.map(([path, message]) => (
                      <div key={path}>
                        <span className="font-mono">{path}</span>: {message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4">
                <label className="flex flex-col gap-2">
                  <ConfigSchemaSummary
                    schema={schemas[ADVANCED_SCHEMA_PATHS.bindings] ?? null}
                    loading={isLoadingSchemas}
                  />
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.bindings")}
                  </span>
                  {canEdit ? (
                    <textarea
                      value={bindingsDraft}
                      onChange={(event) => setBindingsDraft(event.target.value)}
                      placeholder={t("config.agentSettings.bindingsPlaceholder")}
                      rows={7}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 py-3 font-mono text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500"
                    />
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 py-3">
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-100">
                        {isLoadingSettings ? t("config.agentSettings.loading") : bindingsValue}
                      </pre>
                    </div>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.bindingsHint")}
                  </span>
                </label>

                <label className="flex flex-col gap-2">
                  <ConfigSchemaSummary
                    schema={schemas[ADVANCED_SCHEMA_PATHS.groupChat] ?? null}
                    loading={isLoadingSchemas}
                  />
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.groupChat")}
                  </span>
                  {canEdit ? (
                    <textarea
                      value={groupChatDraft}
                      onChange={(event) => setGroupChatDraft(event.target.value)}
                      placeholder={t("config.agentSettings.groupChatPlaceholder")}
                      rows={7}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 py-3 font-mono text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500"
                    />
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 py-3">
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-100">
                        {isLoadingSettings ? t("config.agentSettings.loading") : groupChatValue}
                      </pre>
                    </div>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.groupChatHint")}
                  </span>
                </label>

                <label className="flex flex-col gap-2">
                  <ConfigSchemaSummary
                    schema={schemas[ADVANCED_SCHEMA_PATHS.sandbox] ?? null}
                    loading={isLoadingSchemas}
                  />
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.sandbox")}
                  </span>
                  {canEdit ? (
                    <textarea
                      value={sandboxDraft}
                      onChange={(event) => setSandboxDraft(event.target.value)}
                      placeholder={t("config.agentSettings.sandboxPlaceholder")}
                      rows={7}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 py-3 font-mono text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500"
                    />
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 py-3">
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-100">
                        {isLoadingSettings ? t("config.agentSettings.loading") : sandboxValue}
                      </pre>
                    </div>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.sandboxHint")}
                  </span>
                </label>

                <label className="flex flex-col gap-2">
                  <ConfigSchemaSummary
                    schema={schemas[ADVANCED_SCHEMA_PATHS.tools] ?? null}
                    loading={isLoadingSchemas}
                  />
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.tools")}
                  </span>
                  {canEdit ? (
                    <textarea
                      value={toolsDraft}
                      onChange={(event) => setToolsDraft(event.target.value)}
                      placeholder={t("config.agentSettings.toolsPlaceholder")}
                      rows={7}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 py-3 font-mono text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500"
                    />
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 py-3">
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-100">
                        {isLoadingSettings ? t("config.agentSettings.loading") : toolsValue}
                      </pre>
                    </div>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.toolsHint")}
                  </span>
                </label>

              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/30 p-5 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t("config.agentSettings.memorySearchTitle")}
                </h4>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {t("config.agentSettings.memorySearchDesc")}
                </p>
              </div>

              <ConfigSchemaSummary
                schema={schemas[ADVANCED_SCHEMA_PATHS.memorySearch] ?? null}
                loading={isLoadingSchemas}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 px-4 py-3 lg:col-span-2">
                  <input
                    type="checkbox"
                    checked={memorySearchDraft.enabled}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-100">
                      {t("config.agentSettings.memorySearchEnabled")}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {t("config.agentSettings.memorySearchEnabledHint")}
                    </div>
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.memorySearchProvider")}
                  </span>
                  <input
                    type="text"
                    value={memorySearchDraft.provider}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        provider: event.target.value,
                      }))
                    }
                    placeholder={t(
                      "config.agentSettings.memorySearchProviderPlaceholder",
                    )}
                    className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.memorySearchModel")}
                  </span>
                  <input
                    type="text"
                    value={memorySearchDraft.model}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        model: event.target.value,
                      }))
                    }
                    placeholder={t(
                      "config.agentSettings.memorySearchModelPlaceholder",
                    )}
                    className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>

                <label className="flex flex-col gap-2 lg:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.memorySearchStorePath")}
                  </span>
                  <input
                    type="text"
                    value={memorySearchDraft.storePath}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        storePath: event.target.value,
                      }))
                    }
                    placeholder={t(
                      "config.agentSettings.memorySearchStorePathPlaceholder",
                    )}
                    className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={memorySearchDraft.sessionMemoryEnabled}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        sessionMemoryEnabled: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-100">
                      {t("config.agentSettings.memorySearchSessionMemory")}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {t("config.agentSettings.memorySearchSessionMemoryHint")}
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={memorySearchDraft.hybridEnabled}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        hybridEnabled: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-100">
                      {t("config.agentSettings.memorySearchHybridEnabled")}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {t("config.agentSettings.memorySearchHybridEnabledHint")}
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={memorySearchDraft.mmrEnabled}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        mmrEnabled: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-100">
                      {t("config.agentSettings.memorySearchMmrEnabled")}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {t("config.agentSettings.memorySearchMmrEnabledHint")}
                    </div>
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.memorySearchMmr")}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={memorySearchDraft.mmr}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        mmr: event.target.value,
                      }))
                    }
                    placeholder={t(
                      "config.agentSettings.memorySearchMmrPlaceholder",
                    )}
                    className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.memorySearchTemporalDecay")}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={memorySearchDraft.temporalDecay}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        temporalDecay: event.target.value,
                      }))
                    }
                    placeholder={t(
                      "config.agentSettings.memorySearchTemporalDecayPlaceholder",
                    )}
                    className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.memorySearchExtraPaths")}
                  </span>
                  <textarea
                    value={memorySearchDraft.extraPathsText}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        extraPathsText: event.target.value,
                      }))
                    }
                    placeholder={t(
                      "config.agentSettings.memorySearchExtraPathsPlaceholder",
                    )}
                    rows={5}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.memorySearchListHint")}
                  </span>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.memorySearchSources")}
                  </span>
                  <textarea
                    value={memorySearchDraft.sourcesText}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        sourcesText: event.target.value,
                      }))
                    }
                    placeholder={t(
                      "config.agentSettings.memorySearchSourcesPlaceholder",
                    )}
                    rows={5}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.memorySearchListHint")}
                  </span>
                </label>
              </div>
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
                onClick={() => void handleSave()}
                disabled={!canEdit || !selectedAgentId || isLoadingSettings || isSaving || !hasChanges}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  !canEdit || !selectedAgentId || isLoadingSettings || isSaving || !hasChanges
                    ? "bg-slate-300 dark:bg-slate-800 text-white/80 dark:text-slate-500 cursor-not-allowed"
                    : "bg-[#165DFF] text-white hover:bg-blue-700"
                }`}
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                {t("config.agentSettings.save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
