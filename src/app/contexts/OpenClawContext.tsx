import { invoke } from '@tauri-apps/api/core';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  OPENCLAW_STORAGE_KEYS as STORAGE_KEYS,
  normalizeAuthSecret,
  readStoredAuthMode,
  readStoredAuthSecret,
  type AuthMode,
} from './openClawStorage';

export type { AuthMode } from './openClawStorage';
type GatewayConnectionPhase =
  | 'idle'
  | 'resolving_endpoint'
  | 'opening_socket'
  | 'waiting_for_challenge'
  | 'sending_connect'
  | 'waiting_for_approval'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export interface Agent {
  id: string;
  name: string;
  nodeId: string;
  status: 'active' | 'standby' | 'sleeping';
  avatarColor?: string;
  type?: string;
}

export interface Node {
  id: string;
  name: string;
  status: 'online' | 'offline';
}

export interface GatewayErrorSummary {
  category: string;
  code?: string | null;
  message: string;
  retryable: boolean;
  hint?: string | null;
}

interface GatewayStatusSnapshot {
  phase: GatewayConnectionPhase;
  gatewayOrigin?: string | null;
  deviceId?: string | null;
  grantedRole?: string | null;
  grantedScopes: string[];
  lastError?: GatewayErrorSummary | null;
  isPaired: boolean;
  canRetryWithDeviceToken: boolean;
}

interface GatewayAgentIdentitySummary {
  name?: string | null;
  theme?: string | null;
  emoji?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
}

interface GatewayAgentSummary {
  id: string;
  name?: string | null;
  identity?: GatewayAgentIdentitySummary | null;
}

export interface GatewayAgentIdentityResult {
  agentId: string;
  name?: string | null;
  avatar?: string | null;
  emoji?: string | null;
}

export interface GatewayAgentFileEntry {
  name: string;
  path: string;
  missing: boolean;
  size?: number | null;
  updatedAtMs?: number | null;
  content?: string | null;
}

export interface GatewayAgentFileGetResult {
  agentId: string;
  workspace: string;
  file: GatewayAgentFileEntry;
}

export interface GatewayAgentsListResult {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: GatewayAgentSummary[];
}

interface GatewayConnectConfig {
  gatewayUrl: string;
  authMode: AuthMode;
  authSecret: string | null;
  role: string;
  scopes: string[];
  profileLabel: string | null;
}

interface OpenClawContextType {
  isConnected: boolean;
  isConfigured: boolean;
  hasSkippedSetup: boolean;
  isSetupWizardOpen: boolean;
  gatewayUrl: string;
  authMode: AuthMode;
  authSecret: string;
  connectedOrigin: string | null;
  grantedScopes: string[];
  lastError: GatewayErrorSummary | null;
  setHasSkippedSetup: (skipped: boolean) => void;
  updateConfig: (url: string, mode: AuthMode, secret: string) => Promise<boolean>;
  testConnection: (url: string, mode: AuthMode, secret: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  refreshAgents: () => Promise<void>;
  reopenSetupWizard: () => void;
  closeSetupWizard: () => void;
  showReminder: boolean;
  setShowReminder: (show: boolean) => void;
  nodes: Node[];
  agents: Agent[];
}

const OpenClawContext = createContext<OpenClawContextType | undefined>(undefined);

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:18789';
const DEFAULT_CONNECT_ROLE = 'operator';
const DEFAULT_CONNECT_SCOPES = ['operator.admin'];
const AGENT_GRADIENTS = [
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-amber-400 to-orange-600',
  'from-fuchsia-400 to-purple-600',
  'from-violet-400 to-indigo-600',
  'from-rose-400 to-red-600',
] as const;

function createConnectConfig(url: string, mode: AuthMode, secret: string): GatewayConnectConfig {
  return {
    gatewayUrl: url,
    authMode: mode,
    authSecret: normalizeAuthSecret(mode, secret),
    role: DEFAULT_CONNECT_ROLE,
    scopes: [...DEFAULT_CONNECT_SCOPES],
    profileLabel: null,
  };
}

export function isTauriRuntimeAvailable() {
  if (typeof window === 'undefined') {
    return false;
  }

  const runtimeWindow = window as Window & { __TAURI_INTERNALS__?: unknown };
  return '__TAURI_INTERNALS__' in runtimeWindow;
}

function createRuntimeUnavailableError(): GatewayErrorSummary {
  return {
    category: 'runtime',
    code: 'TAURI_RUNTIME_UNAVAILABLE',
    message: '当前运行环境未注入 Tauri API，请通过桌面端启动 ClawScope。',
    retryable: false,
    hint: '请使用 `npm run tauri dev` 或正式桌面应用启动当前项目。',
  };
}

function isGatewayErrorSummary(value: unknown): value is GatewayErrorSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.category === 'string' && typeof record.message === 'string' && typeof record.retryable === 'boolean';
}

function stringifyUnknownError(error: unknown) {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown gateway error';
  }
}

function toGatewayErrorSummary(error: unknown): GatewayErrorSummary {
  if (isGatewayErrorSummary(error)) {
    return error;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      category: typeof record.category === 'string' ? record.category : 'unknown',
      code: typeof record.code === 'string' ? record.code : null,
      message:
        typeof record.message === 'string'
          ? record.message
          : typeof record.error === 'string'
            ? record.error
            : stringifyUnknownError(error),
      retryable: typeof record.retryable === 'boolean' ? record.retryable : false,
      hint: typeof record.hint === 'string' ? record.hint : null,
    };
  }

  return {
    category: 'unknown',
    code: null,
    message: stringifyUnknownError(error),
    retryable: false,
    hint: null,
  };
}

async function invokeGateway<T>(command: string, args?: Record<string, unknown>) {
  if (!isTauriRuntimeAvailable()) {
    throw createRuntimeUnavailableError();
  }

  return invoke<T>(command, args);
}

export async function gatewayAgentIdentityGet(agentId: string) {
  return invokeGateway<GatewayAgentIdentityResult>('gateway_agent_identity_get', {
    agentId,
  });
}

export async function gatewayAgentsList() {
  return invokeGateway<GatewayAgentsListResult>('gateway_agents_list');
}

export async function gatewayAgentSoulGet(agentId: string) {
  return invokeGateway<GatewayAgentFileGetResult>('gateway_agent_soul_get', {
    agentId,
  });
}

export async function gatewayAgentWorkspaceIdentityGet(agentId: string) {
  return invokeGateway<GatewayAgentFileGetResult>('gateway_agent_workspace_identity_get', {
    agentId,
  });
}

// Identity-facing fields are file-backed to keep the UI aligned with IDENTITY.md.
export async function gatewayAgentWorkspaceIdentitySet(agentId: string, content: string) {
  return invokeGateway<void>('gateway_agent_workspace_identity_set', {
    agentId,
    content,
  });
}

export async function gatewayAgentSoulSet(agentId: string, content: string) {
  return invokeGateway<void>('gateway_agent_soul_set', {
    agentId,
    content,
  });
}

export async function gatewayExportMarkdownDocument(suggestedFileName: string, content: string) {
  return invokeGateway<string | null>('export_markdown_document', {
    suggestedFileName,
    content,
  });
}

function isConnectedPhase(phase: GatewayConnectionPhase) {
  return phase === 'connected';
}

function resolveOrigin(origin: string | null | undefined, fallback?: string) {
  if (origin && origin.trim().length > 0) {
    return origin;
  }

  if (fallback && fallback.trim().length > 0) {
    return fallback;
  }

  return null;
}

function buildNodeId(origin: string) {
  return `gateway:${origin}`;
}

function buildNodeName(origin: string) {
  try {
    const url = new URL(origin);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      return 'OpenClaw Local';
    }

    return `OpenClaw ${url.host}`;
  } catch {
    return origin;
  }
}

function buildNode(origin: string): Node {
  return {
    id: buildNodeId(origin),
    name: buildNodeName(origin),
    status: 'online',
  };
}

function hashValue(value: string) {
  let hash = 0;

  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function pickAgentGradient(agentId: string) {
  return AGENT_GRADIENTS[hashValue(agentId) % AGENT_GRADIENTS.length];
}

function mapAgents(result: GatewayAgentsListResult, nodeId: string): Agent[] {
  return result.agents.map((agent) => ({
    id: agent.id,
    name: agent.identity?.name ?? agent.name ?? agent.id,
    nodeId,
    status: agent.id === result.defaultId ? 'active' : 'standby',
    avatarColor: pickAgentGradient(agent.id),
    type: agent.identity?.theme ?? result.scope,
  }));
}

export function OpenClawProvider({ children }: { children: ReactNode }) {
  const isDev = import.meta.env.DEV;
  const readFlag = (key: string) => localStorage.getItem(key) === 'true';

  const [isConfigured, setIsConfigured] = useState(() => (isDev ? false : readFlag(STORAGE_KEYS.configured)));
  const [hasSkippedSetup, setHasSkippedSetupState] = useState(() => (isDev ? false : readFlag(STORAGE_KEYS.skipped)));
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(() => {
    if (isDev) {
      return true;
    }

    const configured = readFlag(STORAGE_KEYS.configured);
    const skipped = readFlag(STORAGE_KEYS.skipped);
    return !configured && !skipped;
  });
  const [gatewayUrl, setGatewayUrl] = useState(() => localStorage.getItem(STORAGE_KEYS.url) || DEFAULT_GATEWAY_URL);
  const [authMode, setAuthMode] = useState<AuthMode>(() => readStoredAuthMode(localStorage));
  const [authSecret, setAuthSecret] = useState(() => readStoredAuthSecret(localStorage));
  const [isConnected, setIsConnected] = useState(false);
  const [connectedOrigin, setConnectedOrigin] = useState<string | null>(null);
  const [grantedScopes, setGrantedScopes] = useState<string[]>([]);
  const [lastError, setLastError] = useState<GatewayErrorSummary | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.url, gatewayUrl);
    localStorage.setItem(STORAGE_KEYS.authMode, authMode);
    localStorage.setItem(STORAGE_KEYS.authSecret, authSecret);
  }, [gatewayUrl, authMode, authSecret]);

  useEffect(() => {
    if (isDev) {
      localStorage.removeItem(STORAGE_KEYS.configured);
      localStorage.removeItem(STORAGE_KEYS.skipped);
      return;
    }

    localStorage.setItem(STORAGE_KEYS.configured, String(isConfigured));
    localStorage.setItem(STORAGE_KEYS.skipped, String(hasSkippedSetup));
  }, [isConfigured, hasSkippedSetup, isDev]);

  useEffect(() => {
    if (hasSkippedSetup && !isConfigured && !isSetupWizardOpen) {
      const timer = setTimeout(() => setShowReminder(true), 1500);
      return () => clearTimeout(timer);
    }

    setShowReminder(false);
  }, [hasSkippedSetup, isConfigured, isSetupWizardOpen]);

  useEffect(() => {
    let cancelled = false;

    const hydrateGatewayState = async () => {
      try {
        const snapshot = await invokeGateway<GatewayStatusSnapshot>('gateway_status');
        if (cancelled) {
          return;
        }

        const origin = resolveOrigin(snapshot.gatewayOrigin, gatewayUrl);
        if (!isConnectedPhase(snapshot.phase) || !origin) {
          setIsConnected(false);
          setConnectedOrigin(origin);
          setGrantedScopes(snapshot.grantedScopes ?? []);
          setLastError(snapshot.lastError ?? null);
          setNodes([]);
          setAgents([]);
          return;
        }

        try {
          const agentsList = await gatewayAgentsList();
          if (cancelled) {
            return;
          }

          const node = buildNode(origin);
          setIsConnected(true);
          setConnectedOrigin(origin);
          setGrantedScopes(snapshot.grantedScopes ?? []);
          setLastError(null);
          setNodes([node]);
          setAgents(mapAgents(agentsList, node.id));
        } catch (error) {
          if (cancelled) {
            return;
          }

          setIsConnected(false);
          setConnectedOrigin(origin);
          setGrantedScopes(snapshot.grantedScopes ?? []);
          setLastError(toGatewayErrorSummary(error));
          setNodes([]);
          setAgents([]);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setIsConnected(false);
        setConnectedOrigin(null);
        setGrantedScopes([]);
        setLastError(toGatewayErrorSummary(error));
        setNodes([]);
        setAgents([]);
      }
    };

    void hydrateGatewayState();

    return () => {
      cancelled = true;
    };
  }, [gatewayUrl]);

  const setHasSkippedSetup = (skipped: boolean) => {
    setHasSkippedSetupState(skipped);
    if (skipped) {
      setIsSetupWizardOpen(false);
    } else {
      setShowReminder(false);
    }
  };

  const reopenSetupWizard = () => {
    setHasSkippedSetupState(false);
    setShowReminder(false);
    setIsSetupWizardOpen(true);
  };

  const closeSetupWizard = () => {
    setIsSetupWizardOpen(false);
  };

  const applyConnectedState = (origin: string, agentsList: GatewayAgentsListResult) => {
    const node = buildNode(origin);
    setIsConnected(true);
    setConnectedOrigin(origin);
    setLastError(null);
    setNodes([node]);
    setAgents(mapAgents(agentsList, node.id));
  };

  const applyDisconnectedState = (
    error: GatewayErrorSummary | null,
    origin: string | null = null,
    nextGrantedScopes: string[] = [],
  ) => {
    setIsConnected(false);
    setConnectedOrigin(origin);
    setGrantedScopes(nextGrantedScopes);
    setLastError(error);
    setNodes([]);
    setAgents([]);
  };

  const connectAndLoadAgents = async (url: string, mode: AuthMode, secret: string, persistConfig: boolean) => {
    setLastError(null);

    try {
      const snapshot = await invokeGateway<GatewayStatusSnapshot>('gateway_connect', {
        config: createConnectConfig(url, mode, secret),
      });
      const origin = resolveOrigin(snapshot.gatewayOrigin, url);

      if (!isConnectedPhase(snapshot.phase) || !origin) {
        applyDisconnectedState(snapshot.lastError ?? null, origin, snapshot.grantedScopes ?? []);
        return false;
      }

      try {
        const agentsList = await gatewayAgentsList();
        setGrantedScopes(snapshot.grantedScopes ?? []);
        applyConnectedState(origin, agentsList);

        if (persistConfig) {
          setGatewayUrl(url);
          setAuthMode(mode);
          setAuthSecret(mode === 'paired_device' ? '' : secret);
          setIsConfigured(true);
          setHasSkippedSetupState(false);
          setShowReminder(false);
          setIsSetupWizardOpen(false);
        }

        return true;
      } catch (error) {
        applyDisconnectedState(toGatewayErrorSummary(error), origin, snapshot.grantedScopes ?? []);
        return false;
      }
    } catch (error) {
      applyDisconnectedState(toGatewayErrorSummary(error));
      return false;
    }
  };

  const updateConfig = async (url: string, mode: AuthMode, secret: string) => {
    return connectAndLoadAgents(url, mode, secret, true);
  };

  const testConnection = async (url: string, mode: AuthMode, secret: string) => {
    return connectAndLoadAgents(url, mode, secret, false);
  };

  const disconnect = async () => {
    setLastError(null);

    try {
      await invokeGateway<GatewayStatusSnapshot>('gateway_disconnect');
      applyDisconnectedState(null);
    } catch (error) {
      applyDisconnectedState(toGatewayErrorSummary(error));
    }
  };

  const refreshAgents = async () => {
    if (!isConnected) {
      return;
    }

    const origin = connectedOrigin ?? resolveOrigin(null, gatewayUrl);
    if (!origin) {
      return;
    }

    try {
      const agentsList = await gatewayAgentsList();
      applyConnectedState(origin, agentsList);
    } catch (error) {
      const summary = toGatewayErrorSummary(error);
      setLastError(summary);
      throw error;
    }
  };

  return (
    <OpenClawContext.Provider
      value={{
        isConnected,
        isConfigured,
        hasSkippedSetup,
        isSetupWizardOpen,
        gatewayUrl,
        authMode,
        authSecret,
        connectedOrigin,
        grantedScopes,
        lastError,
        setHasSkippedSetup,
        updateConfig,
        testConnection,
        disconnect,
        refreshAgents,
        reopenSetupWizard,
        closeSetupWizard,
        showReminder,
        setShowReminder,
        nodes,
        agents,
      }}
    >
      {children}
    </OpenClawContext.Provider>
  );
}

export function useOpenClaw() {
  const context = useContext(OpenClawContext);
  if (!context) throw new Error('useOpenClaw must be used within OpenClawProvider');
  return context;
}

