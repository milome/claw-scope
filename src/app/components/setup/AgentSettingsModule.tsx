import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  Folder,
  IdCard,
  ListTree,
  Network,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { useI18n } from "../../contexts/I18nContext";
import {
  gatewayConfigSchemaLookup,
  gatewayAgentsListForSession,
  gatewayAgentSettingsGet,
  type GatewayConfigSchemaLookupResult,
  type Agent,
  type GatewayAgentSettingsFieldMetadata,
  type GatewayAgentSettingsResult,
  type GatewayAgentSettingsUpdateInput,
  type Node,
  isTauriRuntimeAvailable,
  useOpenClaw,
} from "../../contexts/OpenClawContext";
import { ConfigSchemaSummary } from "./ConfigSchemaSummary";
import { AgentSettingsFieldMetadataSummary } from "./AgentSettingsFieldMetadataSummary";
import { AgentSettingsScopeLegend } from "./AgentSettingsScopeLegend";
import { AgentSettingsDefaultRoutingCard } from "./AgentSettingsDefaultRoutingCard";
import {
  canEditAgentSettings,
  deriveAgentSettingsScope,
  resolveSelectedAgentId,
  buildAvailableAgentSettingsScopes,
  resolveSelectedAgentSettingsScope,
  type AgentSettingsScopeId,
} from "./agentSettingsState";

const ADVANCED_SCHEMA_PATHS = {
  bindings: "bindings",
  groupChat: "agents.defaults.groupChat",
  sandbox: "agents.defaults.sandbox",
  tools: "agents.defaults.tools",
  memorySearch: "agents.defaults.memorySearch",
} as const;

const AGENT_SETTINGS_FIXTURE_FLAG = "agent-settings-fixture";

const FIXTURE_NODES: Node[] = [
  {
    id: "gateway:https://demo-west.example.internal:18789",
    name: "OpenClaw Demo West Cluster Node With Long Label",
    status: "online",
    sessionId: "fixture-session-west-long-node-id-18789",
    origin: "https://demo-west.example.internal:18789",
    grantedScopes: ["operator.admin", "config.write"],
    isActive: true,
  },
  {
    id: "gateway:https://demo-east.example.internal:28789",
    name: "OpenClaw Demo East Failover Node",
    status: "online",
    sessionId: "fixture-session-east-long-node-id-28789",
    origin: "https://demo-east.example.internal:28789",
    grantedScopes: ["operator.admin", "config.write"],
    isActive: false,
  },
];

const FIXTURE_SESSION_AGENTS: Agent[] = [
  {
    id: "foundation-reasoner-with-an-intentionally-long-agent-identifier-01",
    name: "Foundation Reasoner",
    nodeId: FIXTURE_NODES[0].id,
    status: "active",
    type: "editorial",
  },
  {
    id: "ops-memory-review-companion-with-a-very-long-id-02",
    name: "Ops Memory Review",
    nodeId: FIXTURE_NODES[0].id,
    status: "standby",
    type: "system",
  },
];

const FIXTURE_SETTINGS: GatewayAgentSettingsResult = {
  agentId: FIXTURE_SESSION_AGENTS[0].id,
  workspace:
    "D:/Users/milom/Documents/OpenClaw/workspaces/foundation-reasoner-with-an-intentionally-long-agent-identifier-01",
  model: "anthropic/claude-sonnet-4-6-thinking-with-long-runtime-label",
  modelOptions: [
    "anthropic/claude-sonnet-4-6",
    "anthropic/claude-sonnet-4",
  ],
  isDefault: true,
  agentDir:
    "D:/Users/milom/.openclaw/agents/foundation-reasoner-with-an-intentionally-long-agent-identifier-01",
  bindingsJson: JSON.stringify(
    [
      {
        agentId: FIXTURE_SESSION_AGENTS[0].id,
        match: {
          channel: "slack",
          workspace: "design-systems-and-runtime-governance",
          tags: ["critical", "long-context", "visual-regression"],
        },
      },
      {
        agentId: "ops-memory-review-companion-with-a-very-long-id-02",
        match: {
          channel: "telegram",
          workspace: "night-shift-observability",
          tags: ["handoff", "triage"],
        },
      },
    ],
    null,
    2,
  ),
  groupChatJson: JSON.stringify(
    {
      enabled: true,
      mode: "managed",
      coordinator: "foundation-reasoner",
      policy: {
        maxParticipants: 6,
        allowParallelReplies: true,
        escalationTag: "needs-human-review",
      },
    },
    null,
    2,
  ),
  sandboxJson: JSON.stringify(
    {
      mode: "workspace-write",
      network: "deny",
      fileSystem: {
        roots: [
          "D:/Users/milom/Documents/OpenClaw/workspaces/foundation-reasoner",
          "D:/Users/milom/Documents/OpenClaw/shared-reference-materials",
        ],
      },
    },
    null,
    2,
  ),
  toolsJson: JSON.stringify(
    {
      profile: "safe",
      allow: [
        "memory_search",
        "config.schema.lookup",
        "ui.capture.screenshot",
        "knowledge.timeline.read",
      ],
      deny: ["network.fetch.untrusted"],
    },
    null,
    2,
  ),
  memorySearch: {
    enabled: true,
    provider: "openai",
    model: "text-embedding-3-large",
    extraPathsText:
      "../team-docs/design-system/handbook\n../team-docs/runtime/operational-playbooks\n../team-docs/research/quarterly-architecture-review",
    sourcesText: "memory\nsessions\nhandoffs\nincident-postmortems",
    storePath:
      "D:/Users/milom/.openclaw/vector-store/foundation-reasoner-with-an-intentionally-long-agent-identifier-01.sqlite",
    sessionMemoryEnabled: true,
    hybridEnabled: true,
    mmrEnabled: true,
    mmr: "0.42",
    temporalDecay: "0.18",
  },
  metadata: {
    workspace: {
      source: "effective_runtime",
      path: "agents.files.get(IDENTITY.md).workspace",
      writeActions: [
        { kind: "agents_update", path: "workspace" },
        {
          kind: "config_patch",
          path: "agents.defaults.workspace",
        },
      ],
    },
    model: {
      source: "universal_defaults",
      path: "agents.defaults.model",
      writeActions: [
        { kind: "agents_update", path: "model" },
        { kind: "config_patch", path: "agents.defaults.model" },
      ],
    },
    isDefault: {
      source: "default_agent_routing",
      path: "agents.default_id",
      writeActions: [
        { kind: "config_patch", path: "agents.list[*].default" },
      ],
    },
    agentDir: {
      source: "selected_agent_override",
      path: `agents.list.${FIXTURE_SESSION_AGENTS[0].id}.agentDir`,
      writeActions: [
        {
          kind: "config_patch",
          path: `agents.list.${FIXTURE_SESSION_AGENTS[0].id}.agentDir`,
        },
      ],
    },
    bindings: {
      source: "gateway_global",
      path: "bindings",
      writeActions: [{ kind: "config_patch", path: "bindings" }],
    },
    groupChat: {
      source: "selected_agent_override",
      path: `agents.list.${FIXTURE_SESSION_AGENTS[0].id}.groupChat`,
      writeActions: [
        {
          kind: "config_patch",
          path: `agents.list.${FIXTURE_SESSION_AGENTS[0].id}.groupChat`,
        },
      ],
    },
    sandbox: {
      source: "universal_defaults",
      path: "agents.defaults.sandbox",
      writeActions: [{ kind: "config_patch", path: "agents.defaults.sandbox" }],
    },
    tools: {
      source: "selected_agent_override",
      path: `agents.list.${FIXTURE_SESSION_AGENTS[0].id}.tools`,
      writeActions: [
        {
          kind: "config_patch",
          path: `agents.list.${FIXTURE_SESSION_AGENTS[0].id}.tools`,
        },
      ],
    },
    memorySearch: {
      source: "mixed",
      path: `agents.defaults.memorySearch + agents.list.${FIXTURE_SESSION_AGENTS[0].id}.memorySearch`,
      writeActions: [
        { kind: "config_patch", path: "agents.defaults.memorySearch" },
        {
          kind: "config_patch",
          path: `agents.list.${FIXTURE_SESSION_AGENTS[0].id}.memorySearch`,
        },
      ],
    },
  },
};

function resolveScopeTone(
  source?: GatewayAgentSettingsFieldMetadata["source"] | null,
) {
  switch (source) {
    case "gateway_global":
      return {
        panel:
          "border-cyan-200 bg-cyan-50/80 dark:border-cyan-900/60 dark:bg-cyan-950/20",
        badge:
          "border-cyan-200 bg-cyan-100 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/50 dark:text-cyan-300",
        shell:
          "border-cyan-200/80 bg-white/80 dark:border-cyan-900/40 dark:bg-slate-950/50",
      };
    case "default_agent_routing":
      return {
        panel:
          "border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/20",
        badge:
          "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300",
        shell:
          "border-amber-200/80 bg-white/80 dark:border-amber-900/40 dark:bg-slate-950/50",
      };
    case "universal_defaults":
      return {
        panel:
          "border-violet-200 bg-violet-50/80 dark:border-violet-900/60 dark:bg-violet-950/20",
        badge:
          "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/50 dark:text-violet-300",
        shell:
          "border-violet-200/80 bg-white/80 dark:border-violet-900/40 dark:bg-slate-950/50",
      };
    case "selected_agent_override":
      return {
        panel:
          "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/20",
        badge:
          "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300",
        shell:
          "border-emerald-200/80 bg-white/80 dark:border-emerald-900/40 dark:bg-slate-950/50",
      };
    case "mixed":
      return {
        panel:
          "border-fuchsia-200 bg-fuchsia-50/80 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/20",
        badge:
          "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/50 dark:text-fuchsia-300",
        shell:
          "border-fuchsia-200/80 bg-white/80 dark:border-fuchsia-900/40 dark:bg-slate-950/50",
      };
    default:
      return {
        panel:
          "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/30",
        badge:
          "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
        shell:
          "border-slate-200/80 bg-white/80 dark:border-slate-700 dark:bg-slate-950/60",
      };
  }
}

function ContextStatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-400 dark:text-slate-500">{icon}</div>
        <div className="min-w-0 space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            {label}
          </div>
          <div className="break-all text-sm font-medium leading-6 text-slate-800 dark:text-slate-100">
            {value}
          </div>
          {detail ? (
            <div className="break-all text-xs leading-5 text-slate-500 dark:text-slate-400">
              {detail}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ScopeFieldCard({
  title,
  hint,
  metadata,
  schema,
  loading = false,
  children,
  className = "",
}: {
  title: string;
  hint: string;
  metadata?: GatewayAgentSettingsFieldMetadata | null;
  schema?: GatewayConfigSchemaLookupResult | null;
  loading?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const tone = resolveScopeTone(metadata?.source);

  return (
    <div className={`rounded-2xl border p-4 space-y-4 ${tone.panel} ${className}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone.badge}`}
          >
            {title}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {hint}
          </p>
        </div>
        {schema ? (
          <div className="xl:w-64 shrink-0">
            <ConfigSchemaSummary schema={schema} loading={loading} />
          </div>
        ) : null}
      </div>
      <div className={`rounded-2xl border p-3 ${tone.shell}`}>{children}</div>
      <AgentSettingsFieldMetadataSummary metadata={metadata} />
    </div>
  );
}

function ScopeSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h4>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function OverrideFieldRow({
  step,
  icon,
  title,
  hint,
  metadata,
  schema,
  loading = false,
  children,
}: {
  step: string;
  icon: ReactNode;
  title: string;
  hint: string;
  metadata?: GatewayAgentSettingsFieldMetadata | null;
  schema?: GatewayConfigSchemaLookupResult | null;
  loading?: boolean;
  children: ReactNode;
}) {
  const tone = metadata?.source === "universal_defaults" ? "violet" : "emerald";
  const toneClasses =
    tone === "violet"
      ? {
          step:
            "bg-violet-500 text-white shadow-violet-500/25 dark:bg-violet-400 dark:text-slate-950",
          icon:
            "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
          headingClassName: "text-violet-700 dark:text-violet-300",
          shell:
            "border-violet-200/60 bg-white/80 dark:border-violet-900/40 dark:bg-slate-950/45",
        }
      : {
          step:
            "bg-emerald-500 text-white shadow-emerald-500/25 dark:bg-emerald-400 dark:text-slate-950",
          icon:
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
          headingClassName: "text-emerald-700 dark:text-emerald-300",
          shell:
            "border-emerald-200/60 bg-white/80 dark:border-emerald-900/40 dark:bg-slate-950/45",
        };

  return (
    <div className="grid gap-4 py-4 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-bold shadow-lg ${toneClasses.step}`}
        >
          {step}
        </div>
        <div className="min-w-0">
          <div
            className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${toneClasses.icon}`}
          >
            {icon}
          </div>
          <div
            className={`mt-3 text-xs font-semibold uppercase tracking-[0.18em] ${toneClasses.headingClassName}`}
          >
            {title}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            {hint}
          </p>
          {schema ? (
            <div className="mt-3">
              <ConfigSchemaSummary
                schema={schema}
                loading={loading}
                variant="compact"
              />
            </div>
          ) : null}
          <AgentSettingsFieldMetadataSummary metadata={metadata} />
        </div>
      </div>
      <div className={`min-w-0 rounded-2xl border p-3 ${toneClasses.shell}`}>
        {children}
      </div>
    </div>
  );
}

const MEMORY_SEARCH_SECTION_TONES = {
  sky: {
    shell:
      "border-sky-100 bg-gradient-to-br from-sky-50/95 via-white/80 to-white/70 dark:border-sky-950/60 dark:from-sky-950/30 dark:via-slate-950/80 dark:to-slate-950/60",
    marker:
      "bg-sky-500 text-white shadow-sky-500/25 dark:bg-sky-400 dark:text-slate-950",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
  },
  cyan: {
    shell:
      "border-cyan-100 bg-gradient-to-br from-cyan-50/95 via-white/80 to-white/70 dark:border-cyan-950/60 dark:from-cyan-950/30 dark:via-slate-950/80 dark:to-slate-950/60",
    marker:
      "bg-cyan-500 text-white shadow-cyan-500/25 dark:bg-cyan-400 dark:text-slate-950",
    icon: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300",
  },
  emerald: {
    shell:
      "border-emerald-100 bg-gradient-to-br from-emerald-50/95 via-white/80 to-white/70 dark:border-emerald-950/60 dark:from-emerald-950/25 dark:via-slate-950/80 dark:to-slate-950/60",
    marker:
      "bg-emerald-500 text-white shadow-emerald-500/25 dark:bg-emerald-400 dark:text-slate-950",
    icon:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
  },
  amber: {
    shell:
      "border-amber-100 bg-gradient-to-br from-amber-50/95 via-white/80 to-white/70 dark:border-amber-950/60 dark:from-amber-950/25 dark:via-slate-950/80 dark:to-slate-950/60",
    marker:
      "bg-amber-500 text-white shadow-amber-500/25 dark:bg-amber-400 dark:text-slate-950",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
  },
  rose: {
    shell:
      "border-rose-100 bg-gradient-to-br from-rose-50/95 via-white/80 to-white/70 dark:border-rose-950/60 dark:from-rose-950/25 dark:via-slate-950/80 dark:to-slate-950/60",
    marker:
      "bg-rose-500 text-white shadow-rose-500/25 dark:bg-rose-400 dark:text-slate-950",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
  },
  violet: {
    shell:
      "border-violet-100 bg-gradient-to-br from-violet-50/95 via-white/80 to-white/70 dark:border-violet-950/60 dark:from-violet-950/30 dark:via-slate-950/80 dark:to-slate-950/60",
    marker:
      "bg-violet-500 text-white shadow-violet-500/25 dark:bg-violet-400 dark:text-slate-950",
    icon:
      "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
  },
} as const;

function MemorySearchSubsection({
  icon,
  step,
  title,
  description,
  children,
  tone = "violet",
  className = "",
}: {
  icon: ReactNode;
  step: string;
  title: string;
  description: string;
  children: ReactNode;
  tone?: keyof typeof MEMORY_SEARCH_SECTION_TONES;
  className?: string;
}) {
  const toneClasses = MEMORY_SEARCH_SECTION_TONES[tone];

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border p-4 shadow-sm shadow-slate-950/5 ${toneClasses.shell} ${className}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-white/60 blur-2xl dark:bg-white/5" />
      <div className="relative grid gap-4 xl:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl shadow-lg ${toneClasses.marker}`}
          >
            <span className="text-xs font-bold">{step}</span>
          </div>
          <div className="min-w-0">
            <div
              className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${toneClasses.icon}`}
            >
              {icon}
            </div>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
              {title}
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function resolveMemorySearchSectionTone(
  scope: AgentSettingsScopeId,
): keyof typeof MEMORY_SEARCH_SECTION_TONES {
  return scope === "universal_defaults" ? "violet" : "emerald";
}

function MemorySearchToggleTile({
  title,
  description,
  checked,
  disabled,
  onChange,
  tone = "sky",
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  tone?: keyof typeof MEMORY_SEARCH_SECTION_TONES;
}) {
  const checkTone =
    tone === "violet"
      ? "text-violet-600 focus:ring-violet-500"
      : tone === "emerald"
        ? "text-emerald-600 focus:ring-emerald-500"
        : "text-sky-600 focus:ring-sky-500";
  const accentColor =
    tone === "violet" ? "#7c3aed" : tone === "emerald" ? "#059669" : "#0284c7";

  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        style={{ accentColor }}
        className={`mt-1 h-4 w-4 shrink-0 rounded border-slate-300 ${checkTone}`}
      />
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-100">
          {title}
        </div>
        <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </div>
      </div>
    </label>
  );
}

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
  const fixtureMode =
    !isTauriRuntimeAvailable() &&
    new URLSearchParams(window.location.search).get("fixture") ===
      AGENT_SETTINGS_FIXTURE_FLAG;
  const { nodes, saveAgentSettings } = useOpenClaw();
  const effectiveNodes = fixtureMode ? FIXTURE_NODES : nodes;
  const [sessionAgents, setSessionAgents] = useState<Agent[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
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

  const selectableNodes = useMemo(
    () =>
      effectiveNodes.filter(
        (node) => node.sessionId && node.status === "online",
      ),
    [effectiveNodes],
  );
  const selectedNode = useMemo(
    () =>
      selectableNodes.find((node) => node.sessionId === selectedSessionId) ??
      selectableNodes.find((node) => node.isActive) ??
      selectableNodes[0] ??
      null,
    [selectableNodes, selectedSessionId],
  );
  const agentIds = useMemo(
    () => sessionAgents.map((agent) => agent.id),
    [sessionAgents],
  );
  const canEdit = canEditAgentSettings(selectedNode?.grantedScopes ?? []);
  const availableScopes = useMemo(
    () => buildAvailableAgentSettingsScopes(),
    [],
  );
  const [activeScope, setActiveScope] =
    useState<AgentSettingsScopeId>("gateway_global");

  useEffect(() => {
    const nextScope = resolveSelectedAgentSettingsScope(
      activeScope,
      availableScopes,
    );

    if (nextScope !== activeScope) {
      setActiveScope(nextScope);
    }
  }, [activeScope, availableScopes]);

  useEffect(() => {
    if (!selectableNodes.length) {
      setSelectedSessionId("");
      return;
    }

    if (
      selectedSessionId &&
      selectableNodes.some((node) => node.sessionId === selectedSessionId)
    ) {
      return;
    }

    setSelectedSessionId(selectableNodes.find((node) => node.isActive)?.sessionId ?? selectableNodes[0].sessionId ?? "");
  }, [selectableNodes, selectedSessionId]);

  useEffect(() => {
    let cancelled = false;

    if (fixtureMode) {
      setSessionAgents(FIXTURE_SESSION_AGENTS);
      return () => {
        cancelled = true;
      };
    }

    if (!selectedNode?.sessionId) {
      setSessionAgents([]);
      return () => {
        cancelled = true;
      };
    }

    void gatewayAgentsListForSession(selectedNode.sessionId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setSessionAgents(
          result.agents.map((agent) => ({
            id: agent.id,
            name: agent.identity?.name ?? agent.name ?? agent.id,
            nodeId: selectedNode.id,
            status: agent.id === result.defaultId ? "active" : "standby",
            type: agent.identity?.theme ?? result.scope,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSessionAgents([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fixtureMode, selectedNode]);

  useEffect(() => {
    setSelectedAgentId((current) => resolveSelectedAgentId(current, agentIds));
  }, [agentIds]);

  const selectedAgent = useMemo(
    () => sessionAgents.find((agent) => agent.id === selectedAgentId) ?? null,
    [sessionAgents, selectedAgentId],
  );

  const selectedNodeName = useMemo(() => {
    if (!selectedNode) {
      return "—";
    }
    return selectedNode.name;
  }, [selectedNode]);
  const selectedNodeDetail = selectedNode?.origin ?? selectedNode?.id ?? null;
  const selectedStatusDetail = selectedNode?.isActive
    ? selectedNodeName
    : selectedNodeDetail;
  const readyModelOptions = settings?.modelOptions ?? [];
  const unresolvedCurrentModel = useMemo(() => {
    const currentModel = settings?.model?.trim();
    if (!currentModel) {
      return null;
    }
    return readyModelOptions.includes(currentModel) ? null : currentModel;
  }, [readyModelOptions, settings?.model]);
  const isSelectedDefaultAgent =
    settings?.isDefault ?? (selectedAgent?.status === "active");
  const settingsMetadata = settings?.metadata ?? null;
  const conditionalScopeHint = isSelectedDefaultAgent
    ? t("config.agentSettings.conditionalDefaultsDefaultHint")
    : t("config.agentSettings.conditionalDefaultsOverrideHint");
  const saveTruthMessage = isSelectedDefaultAgent
    ? t("config.agentSettings.saveTruthDefault")
    : t("config.agentSettings.saveTruthOverride");
  const activeScopeTone = resolveScopeTone(activeScope);
  const overrideWorkbenchTone = resolveScopeTone("selected_agent_override");

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

    if (fixtureMode) {
      setSettings({
        ...FIXTURE_SETTINGS,
        agentId: selectedAgentId,
        isDefault: selectedAgentId === FIXTURE_SESSION_AGENTS[0].id,
      });
      setIsLoadingSettings(false);
      return () => {
        cancelled = true;
      };
    }

    void gatewayAgentSettingsGet(selectedAgentId, selectedNode?.sessionId)
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
  }, [fixtureMode, reloadToken, selectedAgentId, selectedNode?.sessionId]);

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

    if (fixtureMode) {
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
  const workspaceMetadata = settingsMetadata?.workspace;
  const modelMetadata = settingsMetadata?.model;
  const agentDirMetadata = settingsMetadata?.agentDir;
  const defaultAgentMetadata = settingsMetadata?.isDefault;
  const bindingsMetadata = settingsMetadata?.bindings;
  const groupChatMetadata = settingsMetadata?.groupChat;
  const sandboxMetadata = settingsMetadata?.sandbox;
  const toolsMetadata = settingsMetadata?.tools;
  const memorySearchMetadata = settingsMetadata?.memorySearch;
  const bindingsTone = resolveScopeTone(bindingsMetadata?.source);
  const groupChatTone = resolveScopeTone(groupChatMetadata?.source);
  const sandboxTone = resolveScopeTone(sandboxMetadata?.source);
  const toolsTone = resolveScopeTone(toolsMetadata?.source);
  const memorySearchTone = resolveScopeTone(memorySearchMetadata?.source);
  const workspaceScope = deriveAgentSettingsScope(workspaceMetadata);
  const modelScope = deriveAgentSettingsScope(modelMetadata);
  const agentDirScope = deriveAgentSettingsScope(agentDirMetadata);
  const defaultRoutingScope = deriveAgentSettingsScope(defaultAgentMetadata);
  const bindingsScope = deriveAgentSettingsScope(bindingsMetadata);
  const groupChatScope = deriveAgentSettingsScope(groupChatMetadata);
  const sandboxScope = deriveAgentSettingsScope(sandboxMetadata);
  const toolsScope = deriveAgentSettingsScope(toolsMetadata);
  const memorySearchScope = deriveAgentSettingsScope(memorySearchMetadata);
  const scopeCounts = useMemo(() => {
    const next = {
      gateway_global: 0,
      default_agent_routing: 0,
      universal_defaults: 0,
      selected_agent_override: 0,
      mixed: 0,
    } satisfies Record<AgentSettingsScopeId, number>;

    [
      workspaceScope,
      modelScope,
      agentDirScope,
      defaultRoutingScope,
      bindingsScope,
      groupChatScope,
      sandboxScope,
      toolsScope,
      memorySearchScope,
    ].forEach((scope) => {
      next[scope] += 1;
    });

    return next;
  }, [
    agentDirScope,
    bindingsScope,
    defaultRoutingScope,
    groupChatScope,
    memorySearchScope,
    modelScope,
    sandboxScope,
    toolsScope,
    workspaceScope,
  ]);
  const hasEffectiveFieldsInActiveScope = [
    workspaceScope,
    modelScope,
    agentDirScope,
  ].includes(activeScope);
  const hasAdvancedFieldsInActiveScope = [
    bindingsScope,
    groupChatScope,
    sandboxScope,
    toolsScope,
  ].includes(activeScope);
  const activeSchemaErrorEntries = schemaErrorEntries.filter(([path]) => {
    if (path === ADVANCED_SCHEMA_PATHS.bindings) {
      return bindingsScope === activeScope;
    }
    if (path === ADVANCED_SCHEMA_PATHS.groupChat) {
      return groupChatScope === activeScope;
    }
    if (path === ADVANCED_SCHEMA_PATHS.sandbox) {
      return sandboxScope === activeScope;
    }
    if (path === ADVANCED_SCHEMA_PATHS.tools) {
      return toolsScope === activeScope;
    }
    if (path === ADVANCED_SCHEMA_PATHS.memorySearch) {
      return memorySearchScope === activeScope;
    }
    return false;
  });

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
      if (fixtureMode) {
        setSettings((current) =>
          current
            ? {
                ...current,
                workspace: workspacePatch.value ?? current.workspace,
                model: modelPatch.value ?? current.model,
                agentDir: agentDirPatch.value ?? current.agentDir,
                bindingsJson: bindingsPatch.value ?? current.bindingsJson,
                groupChatJson: groupChatPatch.value ?? current.groupChatJson,
                sandboxJson: sandboxPatch.value ?? current.sandboxJson,
                toolsJson: toolsPatch.value ?? current.toolsJson,
                isDefault: isDefaultChanged ? isDefaultDraft : current.isDefault,
                memorySearch: memorySearchHasChanges
                  ? {
                      ...current.memorySearch,
                      enabled:
                        memorySearchEnabledChanged
                          ? memorySearchDraft.enabled
                          : current.memorySearch.enabled,
                      provider:
                        memorySearchProviderPatch.value ??
                        current.memorySearch.provider,
                      model:
                        memorySearchModelPatch.value ?? current.memorySearch.model,
                      extraPathsText:
                        memorySearchExtraPathsPatch.value ??
                        current.memorySearch.extraPathsText,
                      sourcesText:
                        memorySearchSourcesPatch.value ??
                        current.memorySearch.sourcesText,
                      storePath:
                        memorySearchStorePathPatch.value ??
                        current.memorySearch.storePath,
                      sessionMemoryEnabled:
                        memorySearchSessionMemoryChanged
                          ? memorySearchDraft.sessionMemoryEnabled
                          : current.memorySearch.sessionMemoryEnabled,
                      hybridEnabled:
                        memorySearchHybridChanged
                          ? memorySearchDraft.hybridEnabled
                          : current.memorySearch.hybridEnabled,
                      mmrEnabled:
                        memorySearchMmrEnabledChanged
                          ? memorySearchDraft.mmrEnabled
                          : current.memorySearch.mmrEnabled,
                      mmr: memorySearchMmrPatch.value ?? current.memorySearch.mmr,
                      temporalDecay:
                        memorySearchTemporalDecayPatch.value ??
                        current.memorySearch.temporalDecay,
                    }
                  : current.memorySearch,
              }
            : current,
        );
        setSaveSuccess(t("config.agentSettings.saveOk"));
        return;
      }

        const next = await saveAgentSettings({
        sessionId: selectedNode?.sessionId,
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

  if (selectableNodes.length === 0) {
    return (
      <div className="w-full max-w-7xl font-sans text-slate-900 dark:text-slate-100 pb-8">
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
    <div className="w-full max-w-7xl font-sans text-slate-900 dark:text-slate-100 pb-8">
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
          <div className="p-6 md:p-7 flex flex-col gap-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  {t("config.agentSettings.node")}
                </span>
                <select
                  value={selectedSessionId}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 text-sm text-slate-700 dark:text-slate-100 outline-none focus:border-sky-400 dark:focus:border-sky-500"
                >
                  {selectableNodes.map((node) => (
                    <option key={node.sessionId} value={node.sessionId}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  {t("config.agentSettings.select")}
                </span>
                <select
                  value={selectedAgentId}
                  onChange={(event) => setSelectedAgentId(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 text-sm text-slate-700 dark:text-slate-100 outline-none focus:border-sky-400 dark:focus:border-sky-500"
                >
                  {sessionAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <ContextStatCard
                icon={<IdCard className="w-4 h-4" />}
                label={t("config.agentSettings.agentId")}
                value={selectedAgent?.id ?? "—"}
                detail={selectedAgent?.name ?? null}
              />
              <ContextStatCard
                icon={<Network className="w-4 h-4" />}
                label={t("config.agentSettings.node")}
                value={selectedNodeName}
                detail={selectedNodeDetail}
              />
              <ContextStatCard
                icon={
                  canEdit ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                  )
                }
                label={t("config.agentSettings.status")}
                value={selectedAgent ? statusLabel(selectedAgent.status, t) : "—"}
                detail={selectedStatusDetail}
              />
            </div>

            {!canEdit ? (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                {t("config.agentSettings.readonly")}
              </div>
            ) : null}

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
            </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="grid grid-cols-1 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="border-b border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/30 xl:border-b-0 xl:border-r">
              <div className="xl:sticky xl:top-6">
                <AgentSettingsScopeLegend
                  activeScope={activeScope}
                  onSelectScope={setActiveScope}
                  layout="lane"
                  counts={scopeCounts}
                />
              </div>
            </div>
            <div className="min-w-0 p-6 md:p-7 space-y-6">
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
        {hasEffectiveFieldsInActiveScope &&
        activeScope !== "selected_agent_override" ? (
          <>
            <ScopeSection
              title={t("config.agentSettings.effectiveSectionTitle")}
              description={t("config.agentSettings.effectiveSectionDesc")}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {workspaceScope === activeScope ? (
                  <ScopeFieldCard
                    title={t("config.agentSettings.workspace")}
                    hint={t("config.agentSettings.workspaceHint")}
                    metadata={workspaceMetadata}
                  >
                    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-3 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
                      <Folder className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
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
                  </ScopeFieldCard>
                ) : null}

                {modelScope === activeScope ? (
                  <ScopeFieldCard
                    title={t("config.agentSettings.model")}
                    hint={t("config.agentSettings.modelHint")}
                    metadata={modelMetadata}
                  >
                    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-3 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
                      <Wrench className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
                      {canEdit ? (
                        <select
                          value={modelDraft}
                          onChange={(event) => setModelDraft(event.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none [color-scheme:light] focus:border-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark] dark:focus:border-sky-500"
                        >
                          <option value="">
                            {t("config.agentSettings.unset")}
                          </option>
                          {unresolvedCurrentModel ? (
                            <option value={unresolvedCurrentModel} disabled>
                              {t("config.agentSettings.modelCurrentUnavailable")} {unresolvedCurrentModel}
                            </option>
                          ) : null}
                          {readyModelOptions.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
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
                    {canEdit && readyModelOptions.length === 0 ? (
                      <div className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
                        {t("config.agentSettings.modelNoReadyOptions")}
                      </div>
                    ) : null}
                  </ScopeFieldCard>
                ) : null}

                {agentDirScope === activeScope ? (
                  <ScopeFieldCard
                    title={t("config.agentSettings.agentDir")}
                    hint={t("config.agentSettings.agentDirHint")}
                    metadata={agentDirMetadata}
                    className="lg:col-span-2"
                  >
                    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-3 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
                      <Folder className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
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
                  </ScopeFieldCard>
                ) : null}
              </div>
            </ScopeSection>
          </>
        ) : null}

        {defaultRoutingScope === activeScope ? (
          <AgentSettingsDefaultRoutingCard
            canEdit={canEdit}
            isDefaultDraft={isDefaultDraft}
            onChange={setIsDefaultDraft}
            metadata={defaultAgentMetadata}
          />
        ) : null}

        {activeScope === "selected_agent_override" ? (
          <div className={`rounded-3xl border p-5 space-y-5 ${overrideWorkbenchTone.panel}`}>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t("config.agentSettings.selectedOverrideWorkbenchTitle")}
              </h4>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {t("config.agentSettings.selectedOverrideWorkbenchDesc")}
              </p>
            </div>

            <div className={`rounded-xl border px-4 py-3 text-sm ${overrideWorkbenchTone.badge}`}>
              {conditionalScopeHint}
            </div>

            {activeSchemaErrorEntries.length > 0 ? (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-2 text-xs text-amber-800 dark:text-amber-300">
                <div>{t("config.agentSettings.schemaUnavailable")}</div>
                <div className="flex flex-col gap-1">
                  {activeSchemaErrorEntries.map(([path, message]) => (
                    <div key={path}>
                      <span className="font-mono">{path}</span>: {message}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="relative divide-y divide-emerald-200/70 dark:divide-emerald-900/45">
              <div className="pointer-events-none absolute bottom-8 left-[2.65rem] top-8 hidden w-px bg-gradient-to-b from-emerald-200 via-teal-200 to-sky-200 dark:from-emerald-900/70 dark:via-teal-900/70 dark:to-sky-900/70 xl:block" />
              {agentDirScope === activeScope ? (
                <OverrideFieldRow
                  step="01"
                  icon={<Folder className="w-4 h-4" />}
                  title={t("config.agentSettings.selectedOverrideIdentityTitle")}
                  hint={t("config.agentSettings.selectedOverrideIdentityDesc")}
                  metadata={agentDirMetadata}
                >
                  <div className="flex min-h-11 items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-3 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
                    <Folder className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
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
                </OverrideFieldRow>
              ) : null}

              {groupChatScope === activeScope ? (
                <OverrideFieldRow
                  step="02"
                  icon={<ListTree className="w-4 h-4" />}
                  title={t("config.agentSettings.selectedOverrideCollabTitle")}
                  hint={t("config.agentSettings.selectedOverrideCollabDesc")}
                  metadata={groupChatMetadata}
                  schema={schemas[ADVANCED_SCHEMA_PATHS.groupChat] ?? null}
                  loading={isLoadingSchemas}
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.groupChat")}
                  </span>
                  {canEdit ? (
                    <textarea
                      value={groupChatDraft}
                      onChange={(event) => setGroupChatDraft(event.target.value)}
                      placeholder={t("config.agentSettings.groupChatPlaceholder")}
                      rows={7}
                      className={`mt-3 w-full rounded-xl border px-3 py-3 font-mono text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 ${groupChatTone.shell}`}
                    />
                  ) : (
                    <div className={`mt-3 rounded-xl border px-3 py-3 ${groupChatTone.shell}`}>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-100">
                        {isLoadingSettings ? t("config.agentSettings.loading") : groupChatValue}
                      </pre>
                    </div>
                  )}
                  <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.groupChatHint")}
                  </span>
                </OverrideFieldRow>
              ) : null}

              {toolsScope === activeScope ? (
                <OverrideFieldRow
                  step="03"
                  icon={<Wrench className="w-4 h-4" />}
                  title={t("config.agentSettings.selectedOverrideToolsTitle")}
                  hint={t("config.agentSettings.selectedOverrideToolsDesc")}
                  metadata={toolsMetadata}
                  schema={schemas[ADVANCED_SCHEMA_PATHS.tools] ?? null}
                  loading={isLoadingSchemas}
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.tools")}
                  </span>
                  {canEdit ? (
                    <textarea
                      value={toolsDraft}
                      onChange={(event) => setToolsDraft(event.target.value)}
                      placeholder={t("config.agentSettings.toolsPlaceholder")}
                      rows={7}
                      className={`mt-3 w-full rounded-xl border px-3 py-3 font-mono text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 ${toolsTone.shell}`}
                    />
                  ) : (
                    <div className={`mt-3 rounded-xl border px-3 py-3 ${toolsTone.shell}`}>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-100">
                        {isLoadingSettings ? t("config.agentSettings.loading") : toolsValue}
                      </pre>
                    </div>
                  )}
                  <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.toolsHint")}
                  </span>
                </OverrideFieldRow>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeScope === "universal_defaults" ? (
          <div className={`rounded-3xl border p-5 space-y-5 ${activeScopeTone.panel}`}>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t("config.agentSettings.universalDefaultsWorkbenchTitle")}
              </h4>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {t("config.agentSettings.universalDefaultsWorkbenchDesc")}
              </p>
            </div>

            <div className={`rounded-xl border px-4 py-3 text-sm ${activeScopeTone.badge}`}>
              {conditionalScopeHint}
            </div>

            {activeSchemaErrorEntries.length > 0 ? (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-2 text-xs text-amber-800 dark:text-amber-300">
                <div>{t("config.agentSettings.schemaUnavailable")}</div>
                <div className="flex flex-col gap-1">
                  {activeSchemaErrorEntries.map(([path, message]) => (
                    <div key={path}>
                      <span className="font-mono">{path}</span>: {message}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="relative divide-y divide-violet-200/70 dark:divide-violet-900/45">
              <div className="pointer-events-none absolute bottom-8 left-[2.65rem] top-8 hidden w-px bg-gradient-to-b from-violet-200 via-purple-200 to-fuchsia-200 dark:from-violet-900/70 dark:via-purple-900/70 dark:to-fuchsia-900/70 xl:block" />
              {sandboxScope === activeScope ? (
                <OverrideFieldRow
                  step="01"
                  icon={<ShieldAlert className="w-4 h-4" />}
                  title={t("config.agentSettings.sandbox")}
                  hint={t("config.agentSettings.sandboxHint")}
                  metadata={sandboxMetadata}
                  schema={schemas[ADVANCED_SCHEMA_PATHS.sandbox] ?? null}
                  loading={isLoadingSchemas}
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    {t("config.agentSettings.sandbox")}
                  </span>
                  {canEdit ? (
                    <textarea
                      value={sandboxDraft}
                      onChange={(event) => setSandboxDraft(event.target.value)}
                      placeholder={t("config.agentSettings.sandboxPlaceholder")}
                      rows={7}
                      className={`mt-3 w-full rounded-xl border px-3 py-3 font-mono text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-violet-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-violet-500 ${activeScopeTone.shell}`}
                    />
                  ) : (
                    <div className={`mt-3 rounded-xl border px-3 py-3 ${activeScopeTone.shell}`}>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-100">
                        {isLoadingSettings ? t("config.agentSettings.loading") : sandboxValue}
                      </pre>
                    </div>
                  )}
                  <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.sandboxHint")}
                  </span>
                </OverrideFieldRow>
              ) : null}
            </div>
          </div>
        ) : null}

        {hasAdvancedFieldsInActiveScope &&
        activeScope !== "selected_agent_override" &&
        activeScope !== "universal_defaults" ? (
          <div className={`rounded-2xl border p-5 space-y-4 ${activeScopeTone.panel}`}>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t("config.agentSettings.advancedPatchTitle")}
              </h4>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {t("config.agentSettings.advancedPatchDesc")}
              </p>
            </div>

            {activeSchemaErrorEntries.length > 0 ? (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-2 text-xs text-amber-800 dark:text-amber-300">
                <div>{t("config.agentSettings.schemaUnavailable")}</div>
                <div className="flex flex-col gap-1">
                  {activeSchemaErrorEntries.map(([path, message]) => (
                    <div key={path}>
                      <span className="font-mono">{path}</span>: {message}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {bindingsScope === activeScope ? (
                <label
                  className={`flex flex-col gap-3 rounded-2xl border p-4 xl:col-span-2 ${bindingsTone.panel}`}
                >
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
                      className={`w-full rounded-xl border px-3 py-3 font-mono text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 ${bindingsTone.shell}`}
                    />
                  ) : (
                    <div className={`rounded-xl border px-3 py-3 ${bindingsTone.shell}`}>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-100">
                        {isLoadingSettings ? t("config.agentSettings.loading") : bindingsValue}
                      </pre>
                    </div>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.bindingsHint")}
                  </span>
                  <AgentSettingsFieldMetadataSummary metadata={bindingsMetadata} />
                </label>
              ) : null}

              {groupChatScope === activeScope ? (
                <label className={`flex flex-col gap-3 rounded-2xl border p-4 ${groupChatTone.panel}`}>
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
                      className={`w-full rounded-xl border px-3 py-3 font-mono text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 ${groupChatTone.shell}`}
                    />
                  ) : (
                    <div className={`rounded-xl border px-3 py-3 ${groupChatTone.shell}`}>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-100">
                        {isLoadingSettings ? t("config.agentSettings.loading") : groupChatValue}
                      </pre>
                    </div>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.groupChatHint")}
                  </span>
                  <AgentSettingsFieldMetadataSummary metadata={groupChatMetadata} />
                </label>
              ) : null}

              {sandboxScope === activeScope ? (
                <label className={`flex flex-col gap-3 rounded-2xl border p-4 ${sandboxTone.panel}`}>
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
                      className={`w-full rounded-xl border px-3 py-3 font-mono text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 ${sandboxTone.shell}`}
                    />
                  ) : (
                    <div className={`rounded-xl border px-3 py-3 ${sandboxTone.shell}`}>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-100">
                        {isLoadingSettings ? t("config.agentSettings.loading") : sandboxValue}
                      </pre>
                    </div>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.sandboxHint")}
                  </span>
                  <AgentSettingsFieldMetadataSummary metadata={sandboxMetadata} />
                </label>
              ) : null}

              {toolsScope === activeScope ? (
                <label className={`flex flex-col gap-3 rounded-2xl border p-4 ${toolsTone.panel}`}>
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
                      className={`w-full rounded-xl border px-3 py-3 font-mono text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 ${toolsTone.shell}`}
                    />
                  ) : (
                    <div className={`rounded-xl border px-3 py-3 ${toolsTone.shell}`}>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-100">
                        {isLoadingSettings ? t("config.agentSettings.loading") : toolsValue}
                      </pre>
                    </div>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.toolsHint")}
                  </span>
                  <AgentSettingsFieldMetadataSummary metadata={toolsMetadata} />
                </label>
              ) : null}
            </div>
          </div>
        ) : null}

        {memorySearchScope === activeScope ? (
          <div
            className={`rounded-3xl border p-5 space-y-5 ${memorySearchTone.panel}`}
          >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {t("config.agentSettings.memorySearchTitle")}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {t("config.agentSettings.memorySearchDesc")}
                  </p>
                </div>
                <div className="xl:w-64 shrink-0">
                  <ConfigSchemaSummary
                    schema={schemas[ADVANCED_SCHEMA_PATHS.memorySearch] ?? null}
                    loading={isLoadingSchemas}
                    title={t("config.agentSettings.memorySearchSchemaTitle")}
                    variant="compact"
                  />
                </div>
              </div>

              <AgentSettingsFieldMetadataSummary metadata={memorySearchMetadata} />

              {activeSchemaErrorEntries.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                  {activeSchemaErrorEntries.map(([path, message]) => (
                    <div key={path}>
                      <span className="font-mono">{path}</span>: {message}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="relative space-y-4">
                <div className="pointer-events-none absolute bottom-8 left-[2.65rem] top-8 hidden w-px bg-gradient-to-b from-violet-200 via-purple-200 to-fuchsia-200 dark:from-violet-900/70 dark:via-purple-900/70 dark:to-fuchsia-900/70 xl:block" />
                <MemorySearchSubsection
                  icon={<BrainCircuit className="w-4 h-4" />}
                  step="01"
                  tone={resolveMemorySearchSectionTone(activeScope)}
                  title={t("config.agentSettings.memorySearchControlTitle")}
                  description={t("config.agentSettings.memorySearchControlDesc")}
                >
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40">
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
                      className={`h-4 w-4 rounded border-slate-300 ${
                        resolveMemorySearchSectionTone(activeScope) === "violet"
                          ? "text-violet-600 focus:ring-violet-500"
                          : "text-emerald-600 focus:ring-emerald-500"
                      }`}
                      style={{
                        accentColor:
                          resolveMemorySearchSectionTone(activeScope) === "violet"
                            ? "#7c3aed"
                            : "#059669",
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-100">
                        {t("config.agentSettings.memorySearchEnabled")}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {t("config.agentSettings.memorySearchEnabledHint")}
                      </div>
                    </div>
                  </label>
                </MemorySearchSubsection>

                <MemorySearchSubsection
                  icon={<Database className="w-4 h-4" />}
                  step="02"
                  tone={resolveMemorySearchSectionTone(activeScope)}
                  title={t("config.agentSettings.memorySearchProviderBlockTitle")}
                  description={t("config.agentSettings.memorySearchProviderBlockDesc")}
                >
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.8fr_1fr_1.4fr]">
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

                    <label className="flex flex-col gap-2">
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
                  </div>
                </MemorySearchSubsection>

              <MemorySearchSubsection
                icon={<ListTree className="w-4 h-4" />}
                step="03"
                tone={resolveMemorySearchSectionTone(activeScope)}
                title={t("config.agentSettings.memorySearchBehaviorTitle")}
                description={t("config.agentSettings.memorySearchBehaviorDesc")}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MemorySearchToggleTile
                    title={t("config.agentSettings.memorySearchSessionMemory")}
                    description={t("config.agentSettings.memorySearchSessionMemoryHint")}
                    checked={memorySearchDraft.sessionMemoryEnabled}
                    disabled={!canEdit}
                    tone={resolveMemorySearchSectionTone(activeScope)}
                    onChange={(checked) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        sessionMemoryEnabled: checked,
                      }))
                    }
                  />
                  <MemorySearchToggleTile
                    title={t("config.agentSettings.memorySearchHybridEnabled")}
                    description={t("config.agentSettings.memorySearchHybridEnabledHint")}
                    checked={memorySearchDraft.hybridEnabled}
                    disabled={!canEdit}
                    tone={resolveMemorySearchSectionTone(activeScope)}
                    onChange={(checked) =>
                      setMemorySearchDraft((current) => ({
                        ...current,
                        hybridEnabled: checked,
                      }))
                    }
                  />
                  <div className="md:col-span-2">
                    <MemorySearchToggleTile
                      title={t("config.agentSettings.memorySearchMmrEnabled")}
                      description={t("config.agentSettings.memorySearchMmrEnabledHint")}
                      checked={memorySearchDraft.mmrEnabled}
                      disabled={!canEdit}
                      tone={resolveMemorySearchSectionTone(activeScope)}
                      onChange={(checked) =>
                        setMemorySearchDraft((current) => ({
                          ...current,
                          mmrEnabled: checked,
                        }))
                      }
                    />
                  </div>
                </div>
              </MemorySearchSubsection>

                <MemorySearchSubsection
                  icon={<SlidersHorizontal className="w-4 h-4" />}
                  step="04"
                  tone={resolveMemorySearchSectionTone(activeScope)}
                  title={t("config.agentSettings.memorySearchTuningTitle")}
                  description={t("config.agentSettings.memorySearchTuningDesc")}
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                  </div>
                </MemorySearchSubsection>

                <MemorySearchSubsection
                  icon={<Folder className="w-4 h-4" />}
                  step="05"
                  tone={resolveMemorySearchSectionTone(activeScope)}
                  title={t("config.agentSettings.memorySearchCorpusTitle")}
                  description={t("config.agentSettings.memorySearchCorpusDesc")}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                        rows={6}
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
                        rows={6}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t("config.agentSettings.memorySearchListHint")}
                      </span>
                    </label>
                  </div>
                </MemorySearchSubsection>
              </div>
            </div>
        ) : null}

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 sm:flex-1">
                {saveTruthMessage}
              </div>
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
    </div>
  );
}
