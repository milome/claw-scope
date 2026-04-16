import { invoke } from '@tauri-apps/api/core';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  OPENCLAW_STORAGE_KEYS as STORAGE_KEYS,
  normalizeAuthSecret,
  readStoredAuthMode,
  readStoredAuthSecret,
  type AuthMode,
} from './openClawStorage';
import { shouldShowSkippedConnectionReminder } from './openClawConnectionState';
import {
  resolvePersistedAuthModeAfterConnect,
  shouldRetryWithPairedDeviceOnLocalGateway,
} from './openClawConnectionPolicy';

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
  sessionId?: string;
  origin?: string | null;
  grantedScopes?: string[];
  isActive?: boolean;
}

export interface GatewayErrorSummary {
  category: string;
  code?: string | null;
  message: string;
  retryable: boolean;
  hint?: string | null;
}

interface GatewayStatusSnapshot {
  sessionId?: string | null;
  phase: GatewayConnectionPhase;
  gatewayOrigin?: string | null;
  isActive: boolean;
  deviceId?: string | null;
  grantedRole?: string | null;
  grantedScopes: string[];
  lastError?: GatewayErrorSummary | null;
  isPaired: boolean;
  canRetryWithDeviceToken: boolean;
}

export type GatewayDiscoverySource = 'lan_scan' | 'manual_saved';
export type GatewayDiscoveryConfidence = 'high' | 'medium' | 'low';
export type GatewayDiscoveryProbeStage = 'tcp_open' | 'websocket_open' | 'protocol_verified';

export interface GatewayDiscoveredCandidate {
  id: string;
  label: string;
  source: GatewayDiscoverySource;
  wsUrl: string;
  httpUrl?: string | null;
  host: string;
  port: number;
  isPairedHint?: boolean | null;
  lastSeenAtMs: number;
  confidence: GatewayDiscoveryConfidence;
  confidenceScore: number;
  probeStage: GatewayDiscoveryProbeStage;
  protocolVerified: boolean;
  protocolSignal?: string | null;
  matchedSeedSubnet: boolean;
  matchedSeedHost: boolean;
}

export interface GatewaySavedEndpoint {
  id: string;
  label: string;
  wsUrl: string;
  httpUrl?: string | null;
  originKey: string;
  host: string;
  port: number;
  wasUserSelected: boolean;
  lastConnectedAtMs?: number | null;
  lastSuccessAtMs?: number | null;
}

export type GatewayPairingStatusKind = 'paired_ready' | 'bootstrap_required';

export interface GatewayPairedEndpoint {
  originKey: string;
  label: string;
  wsUrl: string;
  httpUrl?: string | null;
  role: string;
  scopes: string[];
  updatedAtMs: number;
  wasUserSelected: boolean;
  lastSuccessAtMs?: number | null;
  exactMatch: boolean;
}

export interface GatewayPairingStatusResult {
  originKey: string;
  label: string;
  wsUrl: string;
  httpUrl?: string | null;
  status: GatewayPairingStatusKind;
  pairedReady: boolean;
  bootstrapRequired: boolean;
  savedEndpoint?: GatewaySavedEndpoint | null;
  matchedEndpoint?: GatewayPairedEndpoint | null;
  knownPairedEndpoints: GatewayPairedEndpoint[];
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

export interface GatewayMemorySharedAgentSummary {
  id: string;
  name: string;
}

export interface GatewayAgentMemoryDiagnostics {
  memorySearchEnabled: boolean;
  backend: string;
  provider?: string | null;
  embeddingModel?: string | null;
  builtinStorePath: string;
  sources: string[];
  extraPaths: string[];
  sessionMemoryEnabled: boolean;
  qmdActive: boolean;
  qmdHome?: string | null;
  qmdPaths: string[];
  qmdSessionsEnabled: boolean;
}

export interface GatewayAgentMemoryResult {
  agentId: string;
  workspace: string;
  documents: GatewayAgentFileEntry[];
  sharedAgents: GatewayMemorySharedAgentSummary[];
  diagnostics?: GatewayAgentMemoryDiagnostics | null;
}

export type GatewayAgentMemorySearchSourceKind =
  | 'root_memory'
  | 'daily_memory'
  | 'workspace_markdown'
  | 'extra_path'
  | 'session_transcript'
  | 'unknown';

export type GatewayAgentMemorySearchOpenTarget =
  | 'documents'
  | 'footprints'
  | 'detail_sheet';

export interface GatewayAgentMemorySearchDiagnostics {
  available: boolean;
  provider?: string | null;
  sources: string[];
  sessionMemoryEnabled: boolean;
  storeDriver: string;
  storePath: string;
  backend: string;
  advice?: string | null;
}

export interface GatewayAgentMemoryStatusSource {
  source: string;
  indexedFiles?: number | null;
  totalFiles?: number | null;
  chunks?: number | null;
}

export interface GatewayAgentMemoryStatusResult {
  agentId: string;
  provider?: string | null;
  requestedProvider?: string | null;
  model?: string | null;
  embeddingsAvailable?: boolean | null;
  embeddingsError?: string | null;
  indexedFiles?: number | null;
  totalFiles?: number | null;
  chunks?: number | null;
  bySource: GatewayAgentMemoryStatusSource[];
}

export interface GatewayAgentMemoryRuntimeStatusSourceCount {
  source: string;
  files: number;
  chunks: number;
}

export interface GatewayAgentMemoryRuntimeStatusCore {
  backend: string;
  files: number;
  totalFiles?: number | null;
  chunks: number;
  dirty: boolean;
  workspaceDir?: string | null;
  dbPath?: string | null;
  provider: string;
  model?: string | null;
  requestedProvider: string;
  sources: string[];
  extraPaths: string[];
  sourceCounts: GatewayAgentMemoryRuntimeStatusSourceCount[];
}

export interface GatewayAgentMemoryRuntimeStatusResult {
  agentId: string;
  embeddingOk: boolean;
  embeddingError?: string | null;
  vectorOk: boolean;
  status: GatewayAgentMemoryRuntimeStatusCore;
  rawPayload: string;
}

export interface GatewayAgentMemoryIndexResult {
  agentId: string;
  forced: boolean;
  stdout: string;
}

export interface GatewayConfigSetResult {
  key: string;
  value: string;
  stdout: string;
}

export interface GatewayAdvancedConnectionConfig {
  timeoutMs: number;
  heartbeatMs: number;
  proxyUrl?: string | null;
}

export interface GatewayAgentMemorySearchEntry {
  id: string;
  path: string;
  snippet: string;
  score?: number | null;
  lineStart?: number | null;
  lineEnd?: number | null;
  sourceKind: GatewayAgentMemorySearchSourceKind;
  openTarget: GatewayAgentMemorySearchOpenTarget;
  canonicalDocumentName?: string | null;
  timelineEntryName?: string | null;
}

export interface GatewayAgentMemorySearchResult {
  agentId: string;
  query: string;
  executedAtMs: number;
  diagnostics: GatewayAgentMemorySearchDiagnostics;
  results: GatewayAgentMemorySearchEntry[];
}

export interface GatewayAgentMemoryTimelineDiagnostics {
  gatewayVisibleFilesCount: number;
  gatewayVisibleRootDocsCount: number;
  gatewayVisibleDailyCount: number;
  gatewayOnlyReturnedRootDocs: boolean;
  localScanDirectory?: string | null;
  localScanFilesCount: number;
  localScanSkippedCount: number;
}

export interface GatewayAgentMemoryTimelineProbeSummary {
  startDate: string;
  endDate: string;
  attemptedDays: number;
  hitDays: number;
  missDays: number;
  skippedDays: number;
  timeoutDays: number;
  errorDays: number;
  retryDays: number;
  retryRecoveredDays: number;
  days: GatewayAgentMemoryTimelineProbeDayResult[];
  status: GatewayAgentMemoryTimelineProbeStatus;
  cached: boolean;
  lastErrorCategory?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}

export type GatewayAgentMemoryTimelineProbeDayStatus =
  | 'hit'
  | 'miss'
  | 'timeout'
  | 'error';

export interface GatewayAgentMemoryTimelineProbeDayResult {
  date: string;
  name: string;
  status: GatewayAgentMemoryTimelineProbeDayStatus;
  retried: boolean;
  recoveredAfterRetry: boolean;
  errorCategory?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export type GatewayAgentMemoryTimelineProbeStatus =
  | 'complete'
  | 'empty'
  | 'partial'
  | 'timeout'
  | 'error';

export type GatewayAgentMemoryTimelineSource =
  | 'local_workspace'
  | 'remote_probe'
  | 'unavailable';

export type GatewayAgentMemoryTimelineAccessReason =
  | 'workspace_local_and_readable'
  | 'workspace_remote_or_not_readable'
  | 'workspace_missing'
  | 'gateway_not_connected';

export interface GatewayAgentMemoryTimelineAccessResult {
  agentId: string;
  workspace: string;
  mode: GatewayAgentMemoryTimelineSource;
  reason: GatewayAgentMemoryTimelineAccessReason;
}

export interface GatewayAgentMemoryTimelineResult {
  agentId: string;
  workspace: string;
  source: GatewayAgentMemoryTimelineSource;
  entries: GatewayAgentFileEntry[];
  diagnostics: GatewayAgentMemoryTimelineDiagnostics;
  probe?: GatewayAgentMemoryTimelineProbeSummary | null;
}

export interface GatewayAgentSettingsResult {
  agentId: string;
  workspace?: string | null;
  model?: string | null;
  modelOptions: string[];
  isDefault: boolean;
  agentDir?: string | null;
  bindingsJson?: string | null;
  groupChatJson?: string | null;
  sandboxJson?: string | null;
  toolsJson?: string | null;
  memorySearch: GatewayAgentMemorySearchSettingsResult;
  metadata: GatewayAgentSettingsMetadata;
}

export type GatewayAgentSettingsFieldSourceKind =
  | 'gateway_global'
  | 'default_agent_routing'
  | 'universal_defaults'
  | 'selected_agent_override'
  | 'effective_runtime'
  | 'mixed'
  | 'unset';

export type GatewayAgentSettingsWriteActionKind =
  | 'agents_update'
  | 'config_patch';

export interface GatewayAgentSettingsWriteAction {
  kind: GatewayAgentSettingsWriteActionKind;
  path?: string | null;
}

export interface GatewayAgentSettingsFieldMetadata {
  source: GatewayAgentSettingsFieldSourceKind;
  path?: string | null;
  writeActions: GatewayAgentSettingsWriteAction[];
}

export interface GatewayAgentSettingsMetadata {
  workspace: GatewayAgentSettingsFieldMetadata;
  model: GatewayAgentSettingsFieldMetadata;
  isDefault: GatewayAgentSettingsFieldMetadata;
  agentDir: GatewayAgentSettingsFieldMetadata;
  bindings: GatewayAgentSettingsFieldMetadata;
  groupChat: GatewayAgentSettingsFieldMetadata;
  sandbox: GatewayAgentSettingsFieldMetadata;
  tools: GatewayAgentSettingsFieldMetadata;
  memorySearch: GatewayAgentSettingsFieldMetadata;
}

export interface GatewayConfigSchemaUiHint {
  label?: string | null;
  help?: string | null;
  tags: string[];
  advanced?: boolean | null;
  sensitive?: boolean | null;
  placeholder?: string | null;
}

export interface GatewayConfigSchemaLookupChild {
  key: string;
  path: string;
  nodeType?: string | null;
  required: boolean;
  hasChildren: boolean;
  hint?: GatewayConfigSchemaUiHint | null;
  hintPath?: string | null;
}

export interface GatewayConfigSchemaLookupResult {
  path: string;
  title?: string | null;
  description?: string | null;
  nodeType?: string | null;
  enumValues: string[];
  hint?: GatewayConfigSchemaUiHint | null;
  hintPath?: string | null;
  children: GatewayConfigSchemaLookupChild[];
}

export interface GatewayAgentMemorySearchSettingsResult {
  enabled: boolean;
  provider?: string | null;
  model?: string | null;
  extraPathsText: string;
  sourcesText: string;
  storePath?: string | null;
  sessionMemoryEnabled: boolean;
  hybridEnabled: boolean;
  mmrEnabled: boolean;
  mmr?: string | null;
  temporalDecay?: string | null;
}

export interface GatewayAgentMemorySearchSettingsUpdateInput {
  enabled?: boolean | null;
  provider?: string | null;
  clearProvider: boolean;
  model?: string | null;
  clearModel: boolean;
  extraPathsText?: string | null;
  clearExtraPaths: boolean;
  sourcesText?: string | null;
  clearSources: boolean;
  storePath?: string | null;
  clearStorePath: boolean;
  sessionMemoryEnabled?: boolean | null;
  hybridEnabled?: boolean | null;
  mmrEnabled?: boolean | null;
  mmr?: string | null;
  clearMmr: boolean;
  temporalDecay?: string | null;
  clearTemporalDecay: boolean;
}

export interface GatewayAgentSettingsUpdateInput {
  sessionId?: string | null;
  agentId: string;
  workspace?: string | null;
  model?: string | null;
  clearWorkspace: boolean;
  clearModel: boolean;
  isDefault?: boolean | null;
  agentDir?: string | null;
  clearAgentDir: boolean;
  bindingsJson?: string | null;
  clearBindings: boolean;
  groupChatJson?: string | null;
  clearGroupChat: boolean;
  sandboxJson?: string | null;
  clearSandbox: boolean;
  toolsJson?: string | null;
  clearTools: boolean;
  memorySearch?: GatewayAgentMemorySearchSettingsUpdateInput | null;
}

export interface GatewayAgentsListResult {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: GatewayAgentSummary[];
}

export type EvolutionTemplateKind =
  | 'conservative'
  | 'aggressive'
  | 'knowledge_injection'
  | 'custom_template';
export type EvolutionOperationStatus = 'success' | 'failed' | 'cancelled' | 'rolled_back';
export type EvolutionOperationKind = 'execute' | 'rollback';
export type EvolutionOperationType =
  | 'optimize'
  | 'inject_knowledge'
  | 'custom_transform'
  | 'restore_snapshot';
export type EvolutionRuntimeState =
  | 'preview_ready'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface EvolutionKnowledgeInjectionInput {
  sourceRef: string;
  additionalSourceRefs?: string[];
  knowledgeBody: string;
  capabilityTags: string[];
}

export interface EvolutionCustomTemplateInput {
  sourceRef: string;
  additionalSourceRefs?: string[];
  scriptBody: string;
  capabilityTags: string[];
}
export type EvolutionRuntimePhase =
  | 'preview_ready'
  | 'validating_preview'
  | 'snapshotting'
  | 'applying_changes'
  | 'reindexing'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface EvolutionPreviewChange {
  id: string;
  group: string;
  type: string;
  title: string;
  desc: string;
  impact: string;
}

export interface EvolutionPreviewResult {
  operationId: string;
  agentId: string;
  nodeLabel: string;
  template: EvolutionTemplateKind;
  operationType: EvolutionOperationType;
  sourceDocument: string;
  riskLevel: string;
  requiresConfirmation: boolean;
  unsafeApply: boolean;
  unsafeReasons: string[];
  sourceRef?: string | null;
  sourceRefs: string[];
  capabilityTags: string[];
  changes: EvolutionPreviewChange[];
  bytesBefore: number;
  bytesAfter: number;
  snapshotId: string;
  createdAtMs: number;
}

export interface EvolutionHistoryEntry {
  operationId: string;
  operationKind: EvolutionOperationKind;
  operationType: EvolutionOperationType;
  status: EvolutionOperationStatus;
  agentId: string;
  nodeLabel: string;
  template: EvolutionTemplateKind;
  snapshotId: string;
  sourceDocument: string;
  sourceRef?: string | null;
  sourceRefs: string[];
  capabilityTags: string[];
  summary: string;
  summaryI18n?: EvolutionLocalizedMessage | null;
  bytesBefore: number;
  bytesAfter: number;
  durationMs?: number | null;
  createdAtMs: number;
}

export interface EvolutionExecuteResult {
  operationId: string;
  snapshotId: string;
  historyEntry: EvolutionHistoryEntry;
}

export interface EvolutionRollbackResult {
  operationId: string;
  restoredSnapshotId: string;
  historyEntry: EvolutionHistoryEntry;
}

export interface EvolutionOperationStatusSnapshot {
  operationId: string;
  agentId: string;
  nodeLabel: string;
  template: EvolutionTemplateKind;
  operationType: EvolutionOperationType;
  sourceDocument: string;
  snapshotId: string;
  riskLevel: string;
  sourceRef?: string | null;
  sourceRefs: string[];
  capabilityTags: string[];
  runtimeState: EvolutionRuntimeState;
  phase: EvolutionRuntimePhase;
  progressPct: number;
  message: string;
  messageI18n?: EvolutionLocalizedMessage | null;
  canCancel: boolean;
  previewStale: boolean;
  conflictDetected: boolean;
  overrideApplied: boolean;
  activeConflictOperationId?: string | null;
  updatedAtMs: number;
  createdAtMs: number;
  historyEntry?: EvolutionHistoryEntry | null;
}

export interface EvolutionAuditEntry {
  operationId: string;
  operationKind: EvolutionOperationKind;
  operationType: EvolutionOperationType;
  status: EvolutionOperationStatus;
  agentId: string;
  nodeLabel: string;
  template: EvolutionTemplateKind;
  snapshotId: string;
  sourceDocument: string;
  riskLevel: string;
  sourceRef?: string | null;
  sourceRefs: string[];
  preflightBlocked: boolean;
  blockedReasonCode?: string | null;
  overrideApplied: boolean;
  overrideReasonCode?: string | null;
  capabilityTags: string[];
  message: string;
  messageI18n?: EvolutionLocalizedMessage | null;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
}

export interface EvolutionLocalizedMessage {
  key: string;
  args: string[];
}

export interface EvolutionMetricBucket {
  key: string;
  count: number;
}

export interface EvolutionAuditSummary {
  agentId: string;
  totalOperations: number;
  successCount: number;
  failedCount: number;
  cancelledCount: number;
  rolledBackCount: number;
  highRiskCount: number;
  unsafeBlockedCount: number;
  preflightBlockedCount: number;
  overrideCount: number;
  last24hOperations: number;
  last24hFailures: number;
  last24hBlocked: number;
  last7dOperations: number;
  last7dFailures: number;
  last7dOverrides: number;
  averageDurationMs?: number | null;
  statusBreakdown: EvolutionMetricBucket[];
  templateBreakdown: EvolutionMetricBucket[];
  operationTypeBreakdown: EvolutionMetricBucket[];
  blockedReasonBreakdown: EvolutionMetricBucket[];
  recentDailyBreakdown: EvolutionMetricBucket[];
  recentEntries: EvolutionAuditEntry[];
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
  advancedConnectionConfig: GatewayAdvancedConnectionConfig;
  setHasSkippedSetup: (skipped: boolean) => void;
  updateConfig: (url: string, mode: AuthMode, secret: string) => Promise<boolean>;
  saveAdvancedConnectionConfig: (config: GatewayAdvancedConnectionConfig) => Promise<GatewayAdvancedConnectionConfig>;
  saveAgentSettings: (input: GatewayAgentSettingsUpdateInput) => Promise<GatewayAgentSettingsResult>;
  testConnection: (url: string, mode: AuthMode, secret: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  refreshAgents: () => Promise<void>;
  reopenSetupWizard: () => void;
  closeSetupWizard: () => void;
  showReminder: boolean;
  setShowReminder: (show: boolean) => void;
  nodes: Node[];
  agents: Agent[];
  discoveredGateways: GatewayDiscoveredCandidate[];
  savedEndpoints: GatewaySavedEndpoint[];
  scanLanGateways: (timeoutMs?: number) => Promise<GatewayDiscoveredCandidate[]>;
  useDiscoveredGateway: (candidate: GatewayDiscoveredCandidate, mode: AuthMode, secret: string) => Promise<boolean>;
  removeSavedEndpoint: (endpointId: string) => Promise<boolean>;
  refreshSavedEndpoints: () => Promise<GatewaySavedEndpoint[]>;
  setActiveSession: (sessionId: string) => Promise<void>;
}

const OpenClawContext = createContext<OpenClawContextType | undefined>(undefined);

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:18789';
const DEFAULT_GATEWAY_ADVANCED_CONFIG: GatewayAdvancedConnectionConfig = {
  timeoutMs: 30000,
  heartbeatMs: 5000,
  proxyUrl: null,
};
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

export async function gatewayAgentIdentityGet(agentId: string, sessionId?: string) {
  return invokeGateway<GatewayAgentIdentityResult>('gateway_agent_identity_get', {
    sessionId,
    agentId,
  });
}

export async function gatewayAgentsList() {
  return invokeGateway<GatewayAgentsListResult>('gateway_agents_list');
}

export async function gatewayAgentsListForSession(sessionId?: string) {
  return invokeGateway<GatewayAgentsListResult>('gateway_agents_list', {
    sessionId,
  });
}

export async function gatewaySessionsList() {
  return invokeGateway<GatewayStatusSnapshot[]>('gateway_sessions_list');
}

export async function gatewaySetActiveSession(sessionId: string) {
  return invokeGateway<GatewayStatusSnapshot>('gateway_set_active_session', {
    sessionId,
  });
}

export async function gatewayDiscover(seedUrl?: string, timeoutMs = 2400) {
  return invokeGateway<GatewayDiscoveredCandidate[]>('gateway_discover', {
    seedUrl,
    timeoutMs,
  });
}

export async function gatewaySavedEndpoints() {
  return invokeGateway<GatewaySavedEndpoint[]>('gateway_saved_endpoints');
}

export async function gatewayPairingStatusLookup(url: string) {
  return invokeGateway<GatewayPairingStatusResult>('gateway_pairing_status_lookup', {
    config: createConnectConfig(url, 'paired_device', ''),
  });
}

export async function gatewaySelectEndpoint(candidate: GatewayDiscoveredCandidate) {
  return invokeGateway<GatewaySavedEndpoint>('gateway_select_endpoint', {
    candidate,
  });
}

export async function gatewayRemoveSavedEndpoint(endpointId: string) {
  return invokeGateway<boolean>('gateway_remove_saved_endpoint', {
    endpointId,
  });
}

export async function gatewayAgentSoulGet(agentId: string, sessionId?: string) {
  return invokeGateway<GatewayAgentFileGetResult>('gateway_agent_soul_get', {
    sessionId,
    agentId,
  });
}

export async function gatewayAgentFileRead(
  agentId: string,
  name: string,
  sessionId?: string,
) {
  return invokeGateway<GatewayAgentFileGetResult>('gateway_agent_file_read', {
    sessionId,
    agentId,
    name,
  });
}

export async function gatewayAgentMemoryGet(agentId: string, sessionId?: string) {
  return invokeGateway<GatewayAgentMemoryResult>('gateway_agent_memory_get', {
    sessionId,
    agentId,
  });
}

export async function gatewayAgentMemorySearch(
  agentId: string,
  query: string,
  maxResults?: number,
  sourceFilter?: 'all' | 'memory' | 'sessions',
  sessionId?: string,
) {
  return invokeGateway<GatewayAgentMemorySearchResult>('gateway_agent_memory_search', {
    sessionId,
    agentId,
    query,
    maxResults,
    sourceFilter,
  });
}

export async function gatewayAgentMemoryStatus(agentId: string, sessionId?: string) {
  return invokeGateway<GatewayAgentMemoryStatusResult>('gateway_agent_memory_status', {
    sessionId,
    agentId,
  });
}

export async function gatewayAgentMemoryRuntimeStatus(agentId: string, sessionId?: string) {
  return invokeGateway<GatewayAgentMemoryRuntimeStatusResult>(
    'gateway_agent_memory_runtime_status',
    {
      sessionId,
      agentId,
    },
  );
}

export async function openExternalUrl(url: string) {
  return invokeGateway<void>('open_external_url', { url });
}

export async function gatewayAgentMemoryTimelineGet(agentId: string, sessionId?: string) {
  return invokeGateway<GatewayAgentMemoryTimelineResult>(
    'gateway_agent_memory_timeline_get',
    {
      sessionId,
      agentId,
    },
  );
}

export async function gatewayAgentMemoryTimelineAccessResolve(
  agentId: string,
  sessionId?: string,
) {
  return invokeGateway<GatewayAgentMemoryTimelineAccessResult>(
    'gateway_agent_memory_timeline_access_resolve',
    {
      sessionId,
      agentId,
    },
  );
}

export async function gatewayAgentMemoryTimelineLocalScan(
  agentId: string,
  sessionId?: string,
) {
  return invokeGateway<GatewayAgentMemoryTimelineResult>(
    'gateway_agent_memory_timeline_local_scan',
    {
      sessionId,
      agentId,
    },
  );
}

export async function gatewayAgentMemoryTimelineRemoteProbe(
  agentId: string,
  startDate: string,
  endDate: string,
  sessionId?: string,
) {
  return invokeGateway<GatewayAgentMemoryTimelineResult>(
    'gateway_agent_memory_timeline_remote_probe',
    {
      sessionId,
      agentId,
      startDate,
      endDate,
    },
  );
}

export async function gatewayAgentMemoryTimelineRemoteProbeDates(
  agentId: string,
  dates: string[],
  sessionId?: string,
) {
  return invokeGateway<GatewayAgentMemoryTimelineResult>(
    'gateway_agent_memory_timeline_remote_probe_dates',
    {
      sessionId,
      agentId,
      dates,
    },
  );
}

export async function gatewayAgentMemoryTimelineEntryGet(
  agentId: string,
  name: string,
  sessionId?: string,
) {
  return invokeGateway<GatewayAgentFileGetResult>(
    'gateway_agent_memory_timeline_entry_get',
    {
      sessionId,
      agentId,
      name,
    },
  );
}

export async function gatewayAgentMemoryTimelineEntryRead(
  agentId: string,
  name: string,
  sessionId?: string,
) {
  return invokeGateway<GatewayAgentFileGetResult>(
    'gateway_agent_memory_timeline_entry_read',
    {
      sessionId,
      agentId,
      name,
    },
  );
}

export async function gatewayAgentWorkspaceIdentityGet(
  agentId: string,
  sessionId?: string,
) {
  return invokeGateway<GatewayAgentFileGetResult>('gateway_agent_workspace_identity_get', {
    sessionId,
    agentId,
  });
}

export async function gatewayAgentSettingsGet(agentId: string, sessionId?: string) {
  return invokeGateway<GatewayAgentSettingsResult>('gateway_agent_settings_get', {
    sessionId,
    agentId,
  });
}

export async function gatewayAgentSettingsSet(input: GatewayAgentSettingsUpdateInput) {
  return invokeGateway<GatewayAgentSettingsResult>('gateway_agent_settings_set', {
    input,
  });
}

export async function gatewayConfigSchemaLookup(path: string) {
  return invokeGateway<GatewayConfigSchemaLookupResult>('gateway_config_schema_lookup', {
    path,
  });
}

export async function evolutionPreview(
  agentId: string,
  nodeLabel: string,
  template: EvolutionTemplateKind,
  knowledgeInput?: EvolutionKnowledgeInjectionInput,
  customInput?: EvolutionCustomTemplateInput,
) {
  return invokeGateway<EvolutionPreviewResult>('evolution_preview', {
    agentId,
    nodeLabel,
    template,
    knowledgeInput,
    customInput,
  });
}

export async function evolutionExecute(operationId: string) {
  return invokeGateway<EvolutionExecuteResult>('evolution_execute', {
    operationId,
  });
}

export async function evolutionExecuteStart(
  operationId: string,
  overrideRiskAck = false,
) {
  return invokeGateway<EvolutionOperationStatusSnapshot>('evolution_execute_start', {
    operationId,
    overrideRiskAck,
  });
}

export async function evolutionOperationStatus(operationId: string) {
  return invokeGateway<EvolutionOperationStatusSnapshot>('evolution_operation_status', {
    operationId,
  });
}

export async function evolutionCancel(operationId: string) {
  return invokeGateway<EvolutionOperationStatusSnapshot>('evolution_cancel', {
    operationId,
  });
}

export async function evolutionHistoryList(agentId: string) {
  return invokeGateway<EvolutionHistoryEntry[]>('evolution_history_list', {
    agentId,
  });
}

export async function evolutionAuditSummary(agentId: string) {
  return invokeGateway<EvolutionAuditSummary>('evolution_audit_summary', {
    agentId,
  });
}

export async function evolutionRollback(agentId: string, snapshotId: string) {
  return invokeGateway<EvolutionRollbackResult>('evolution_rollback', {
    agentId,
    snapshotId,
  });
}

// Identity-facing fields are file-backed to keep the UI aligned with IDENTITY.md.
export async function gatewayAgentWorkspaceIdentitySet(
  agentId: string,
  content: string,
  sessionId?: string,
) {
  return invokeGateway<void>('gateway_agent_workspace_identity_set', {
    sessionId,
    agentId,
    content,
  });
}

export async function gatewayAgentSoulSet(
  agentId: string,
  content: string,
  sessionId?: string,
) {
  return invokeGateway<void>('gateway_agent_soul_set', {
    sessionId,
    agentId,
    content,
  });
}

export async function gatewayAgentMemorySet(
  agentId: string,
  name: string,
  content: string,
  sessionId?: string,
) {
  return invokeGateway<void>('gateway_agent_memory_set', {
    sessionId,
    agentId,
    name,
    content,
  });
}

export async function gatewayAgentMemoryIndex(
  agentId: string,
  force = false,
  sessionId?: string,
) {
  return invokeGateway<GatewayAgentMemoryIndexResult>('gateway_agent_memory_index', {
    sessionId,
    agentId,
    force,
  });
}

export async function gatewayConfigSetLocal(key: string, value: string) {
  return invokeGateway<GatewayConfigSetResult>('gateway_config_set_local', {
    key,
    value,
  });
}

export async function gatewayAdvancedConnectionConfigGet() {
  return invokeGateway<GatewayAdvancedConnectionConfig>('gateway_advanced_connection_config_get');
}

export async function gatewayAdvancedConnectionConfigSet(config: GatewayAdvancedConnectionConfig) {
  return invokeGateway<GatewayAdvancedConnectionConfig>('gateway_advanced_connection_config_set', {
    config,
  });
}

export async function gatewayExportMarkdownDocument(suggestedFileName: string, content: string) {
  return invokeGateway<string | null>('export_markdown_document', {
    suggestedFileName,
    content,
  });
}

export async function gatewayExportMarkdownDocumentQuick(
  suggestedFileName: string,
  content: string,
) {
  return invokeGateway<string>('export_markdown_document_quick', {
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

function resolveSavedEndpointUrl(endpoint: GatewaySavedEndpoint | null | undefined) {
  if (!endpoint) {
    return null;
  }
  if (endpoint.httpUrl && endpoint.httpUrl.trim().length > 0) {
    return endpoint.httpUrl;
  }
  if (endpoint.wsUrl.startsWith('ws://')) {
    return endpoint.wsUrl.replace(/^ws:\/\//, 'http://');
  }
  if (endpoint.wsUrl.startsWith('wss://')) {
    return endpoint.wsUrl.replace(/^wss:\/\//, 'https://');
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

function buildNodeFromSnapshot(snapshot: GatewayStatusSnapshot): Node | null {
  const origin = resolveOrigin(snapshot.gatewayOrigin);
  const sessionId = snapshot.sessionId?.trim();
  if (!origin || !sessionId) {
    return null;
  }

  return {
    id: buildNodeId(origin),
    name: buildNodeName(origin),
    status: isConnectedPhase(snapshot.phase) ? 'online' : 'offline',
    sessionId,
    origin,
    grantedScopes: snapshot.grantedScopes ?? [],
    isActive: snapshot.isActive,
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
  const [advancedConnectionConfig, setAdvancedConnectionConfig] = useState<GatewayAdvancedConnectionConfig>(DEFAULT_GATEWAY_ADVANCED_CONFIG);
  const [showReminder, setShowReminder] = useState(false);
  const [hasHydratedGatewayState, setHasHydratedGatewayState] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [discoveredGateways, setDiscoveredGateways] = useState<GatewayDiscoveredCandidate[]>([]);
  const [savedEndpoints, setSavedEndpoints] = useState<GatewaySavedEndpoint[]>([]);

  const refreshSessionRegistry = async () => {
    if (!isTauriRuntimeAvailable()) {
      setNodes([]);
      setAgents([]);
      setIsConnected(false);
      setConnectedOrigin(null);
      setGrantedScopes([]);
      return;
    }

    const snapshots = await gatewaySessionsList();
    const nextNodes = snapshots
      .map(buildNodeFromSnapshot)
      .filter((node): node is Node => node !== null);
    const activeNode =
      nextNodes.find((node) => node.isActive) ??
      nextNodes.find((node) => node.status === 'online') ??
      null;

    setNodes(nextNodes);

    if (!activeNode?.sessionId) {
      setAgents([]);
      setIsConnected(false);
      setConnectedOrigin(null);
      setGrantedScopes([]);
      return;
    }

    const agentsList = await gatewayAgentsListForSession(activeNode.sessionId);
    setAgents(mapAgents(agentsList, activeNode.id));
    setIsConnected(activeNode.status === 'online');
    setConnectedOrigin(activeNode.origin ?? null);
    setGrantedScopes(activeNode.grantedScopes ?? []);
  };

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
    if (
      shouldShowSkippedConnectionReminder({
        hasSkippedSetup,
        isConfigured,
        isSetupWizardOpen,
        isConnected,
        hasHydratedGatewayState,
      })
    ) {
      const timer = setTimeout(() => setShowReminder(true), 1500);
      return () => clearTimeout(timer);
    }

    setShowReminder(false);
  }, [hasSkippedSetup, isConfigured, isSetupWizardOpen, isConnected, hasHydratedGatewayState]);

  useEffect(() => {
    let cancelled = false;
    setHasHydratedGatewayState(false);

    const hydrateGatewayState = async () => {
      if (isTauriRuntimeAvailable()) {
        try {
          const nextAdvancedConfig = await gatewayAdvancedConnectionConfigGet();
          if (!cancelled) {
            setAdvancedConnectionConfig(nextAdvancedConfig);
          }
        } catch {
          if (!cancelled) {
            setAdvancedConnectionConfig(DEFAULT_GATEWAY_ADVANCED_CONFIG);
          }
        }
      }

      let nextSavedEndpoints: GatewaySavedEndpoint[] = [];
      if (isTauriRuntimeAvailable()) {
        try {
          nextSavedEndpoints = await gatewaySavedEndpoints();
          if (!cancelled) {
            setSavedEndpoints(nextSavedEndpoints);
          }
        } catch {
          if (!cancelled) {
            setSavedEndpoints([]);
          }
        }
      }

      try {
        const snapshot = await invokeGateway<GatewayStatusSnapshot>('gateway_status');
        if (cancelled) {
          return;
        }

        const origin = resolveOrigin(snapshot.gatewayOrigin, gatewayUrl);
        if (!isConnectedPhase(snapshot.phase) || !origin) {
          const preferredSavedEndpoint = nextSavedEndpoints.find((endpoint) => endpoint.wasUserSelected) ?? null;
          const reconnectCandidates = [
            ...(preferredSavedEndpoint ? [preferredSavedEndpoint] : []),
            ...nextSavedEndpoints.filter((endpoint) => endpoint.id !== preferredSavedEndpoint?.id),
          ]
            .map((endpoint) => resolveSavedEndpointUrl(endpoint))
            .filter((value): value is string => Boolean(value?.trim()));

          if (
            reconnectCandidates.length === 0 &&
            (isConfigured || gatewayUrl !== DEFAULT_GATEWAY_URL) &&
            gatewayUrl.trim().length > 0
          ) {
            reconnectCandidates.push(gatewayUrl);
          }

          let anyRecovered = false;
          for (const reconnectUrl of reconnectCandidates) {
            const success = await connectAndLoadAgents(
              reconnectUrl,
              authMode,
              authSecret,
              false,
              anyRecovered,
              true,
            );
            if (cancelled) {
              return;
            }
            if (success) {
              anyRecovered = true;
            }
          }

          if (anyRecovered) {
            if (preferredSavedEndpoint?.originKey) {
              try {
                await gatewaySetActiveSession(preferredSavedEndpoint.originKey);
              } catch {
                // Fall back to whatever session remained active.
              }
            }
            await refreshSessionRegistry();
            const preferredUrl = resolveSavedEndpointUrl(preferredSavedEndpoint);
            if (preferredUrl && preferredUrl !== gatewayUrl) {
              setGatewayUrl(preferredUrl);
            }
            setIsConfigured(true);
            setHasSkippedSetupState(false);
            setShowReminder(false);
            try {
              const refreshedEndpoints = await gatewaySavedEndpoints();
              if (!cancelled) {
                setSavedEndpoints(refreshedEndpoints);
              }
            } catch {
              if (!cancelled) {
                setSavedEndpoints([]);
              }
            }
            return;
          }

          setIsConnected(false);
          setConnectedOrigin(origin);
          setGrantedScopes(snapshot.grantedScopes ?? []);
          setLastError(snapshot.lastError ?? null);
          setNodes([]);
          setAgents([]);
          return;
        }

        try {
          await refreshSessionRegistry();
          if (cancelled) {
            return;
          }

          setIsConfigured(true);
          setHasSkippedSetupState(false);
          setShowReminder(false);
          setLastError(null);
          if (nextSavedEndpoints.length === 0 && isTauriRuntimeAvailable()) {
            try {
              setSavedEndpoints(await gatewaySavedEndpoints());
            } catch {
              setSavedEndpoints([]);
            }
          }
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

    void hydrateGatewayState().finally(() => {
      if (!cancelled) {
        setHasHydratedGatewayState(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authMode, authSecret, gatewayUrl, isConfigured]);

  useEffect(() => {
    if (!isConnected || !isTauriRuntimeAvailable()) {
      return;
    }

    let disposed = false;
    const intervalId = window.setInterval(() => {
      void invokeGateway<GatewayStatusSnapshot>('gateway_status')
        .then((snapshot) => {
          if (disposed) {
            return;
          }
          if (!isConnectedPhase(snapshot.phase) || !resolveOrigin(snapshot.gatewayOrigin, connectedOrigin ?? gatewayUrl)) {
            applyDisconnectedState(snapshot.lastError ?? null, resolveOrigin(snapshot.gatewayOrigin, connectedOrigin ?? gatewayUrl), snapshot.grantedScopes ?? []);
            return;
          }
          void refreshSessionRegistry().catch(() => {
            // Keep last-known node registry on transient refresh failures.
          });
          setLastError(snapshot.lastError ?? null);
        })
        .catch(() => {
          // Keep the last known connected state on transient heartbeat failures.
        });
    }, advancedConnectionConfig.heartbeatMs);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [advancedConnectionConfig.heartbeatMs, connectedOrigin, gatewayUrl, isConnected]);

  const setHasSkippedSetup = (skipped: boolean) => {
    if (skipped && isConnected) {
      setIsConfigured(true);
      setHasSkippedSetupState(false);
      setShowReminder(false);
      setIsSetupWizardOpen(false);
      return;
    }

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

  const connectAndLoadAgents = async (
    url: string,
    mode: AuthMode,
    secret: string,
    persistConfig: boolean,
    preserveExistingStateOnFailure = false,
    allowLocalPairedFallback = false,
  ): Promise<boolean> => {
    setLastError(null);

    try {
      const snapshot = await invokeGateway<GatewayStatusSnapshot>('gateway_connect', {
        config: createConnectConfig(url, mode, secret),
      });
      const origin = resolveOrigin(snapshot.gatewayOrigin, url);

      if (!isConnectedPhase(snapshot.phase) || !origin) {
        if (
          allowLocalPairedFallback &&
          shouldRetryWithPairedDeviceOnLocalGateway(url, mode, snapshot.lastError)
        ) {
          const fallbackSuccess: boolean = await connectAndLoadAgents(
            url,
            'paired_device',
            '',
            persistConfig,
            preserveExistingStateOnFailure,
            false,
          );
          if (fallbackSuccess) {
            setAuthMode('paired_device');
            setAuthSecret('');
          }
          return fallbackSuccess;
        }

        if (!preserveExistingStateOnFailure) {
          applyDisconnectedState(snapshot.lastError ?? null, origin, snapshot.grantedScopes ?? []);
        }
        return false;
      }

      try {
        await refreshSessionRegistry();
        try {
          setSavedEndpoints(await gatewaySavedEndpoints());
        } catch {
          setSavedEndpoints([]);
        }

        if (persistConfig) {
          const persistedAuth = resolvePersistedAuthModeAfterConnect(
            url,
            mode,
            secret,
            snapshot,
          );
          setGatewayUrl(url);
          setAuthMode(persistedAuth.mode);
          setAuthSecret(persistedAuth.secret);
          setIsConfigured(true);
          setHasSkippedSetupState(false);
          setShowReminder(false);
          setIsSetupWizardOpen(false);
        }

        return true;
      } catch (error) {
        if (!preserveExistingStateOnFailure) {
          applyDisconnectedState(toGatewayErrorSummary(error), origin, snapshot.grantedScopes ?? []);
        }
        return false;
      }
    } catch (error) {
      const summary = toGatewayErrorSummary(error);

      if (
        allowLocalPairedFallback &&
        shouldRetryWithPairedDeviceOnLocalGateway(url, mode, summary)
      ) {
        const fallbackSuccess: boolean = await connectAndLoadAgents(
          url,
          'paired_device',
          '',
          persistConfig,
          preserveExistingStateOnFailure,
          false,
        );
        if (fallbackSuccess) {
          setAuthMode('paired_device');
          setAuthSecret('');
        }
        return fallbackSuccess;
      }

      if (!preserveExistingStateOnFailure) {
        applyDisconnectedState(summary);
      }
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

    try {
      await refreshSessionRegistry();
    } catch (error) {
      const summary = toGatewayErrorSummary(error);
      setLastError(summary);
      throw error;
    }
  };

  const refreshSavedEndpoints = async () => {
    const next = await gatewaySavedEndpoints();
    setSavedEndpoints(next);
    return next;
  };

  const saveAdvancedConnectionConfig = async (config: GatewayAdvancedConnectionConfig) => {
    const next = await gatewayAdvancedConnectionConfigSet(config);
    setAdvancedConnectionConfig(next);
    return next;
  };

  const saveAgentSettings = async (input: GatewayAgentSettingsUpdateInput) => {
    return gatewayAgentSettingsSet(input);
  };

  const scanLanGateways = async (timeoutMs = advancedConnectionConfig.timeoutMs) => {
    const next = await gatewayDiscover(connectedOrigin ?? gatewayUrl, timeoutMs);
    setDiscoveredGateways(next);
    return next;
  };

  const useDiscoveredGateway = async (
    candidate: GatewayDiscoveredCandidate,
    mode: AuthMode,
    secret: string,
  ) => {
    const selected = await gatewaySelectEndpoint(candidate);
    await refreshSavedEndpoints();
    const connectUrl =
      resolveSavedEndpointUrl(selected) ??
      candidate.httpUrl ??
      candidate.wsUrl.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
    setGatewayUrl(connectUrl);
    return connectAndLoadAgents(connectUrl, mode, secret, true, false, true);
  };

  const removeSavedEndpoint = async (endpointId: string) => {
    const removed = await gatewayRemoveSavedEndpoint(endpointId);
    await refreshSavedEndpoints();
    return removed;
  };

  const setActiveSession = async (sessionId: string) => {
    await gatewaySetActiveSession(sessionId);
    await refreshSessionRegistry();
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
        advancedConnectionConfig,
        setHasSkippedSetup,
        updateConfig,
        saveAdvancedConnectionConfig,
        saveAgentSettings,
        testConnection,
        disconnect,
        refreshAgents,
        reopenSetupWizard,
        closeSetupWizard,
        showReminder,
        setShowReminder,
        nodes,
        agents,
        discoveredGateways,
        savedEndpoints,
        scanLanGateways,
        useDiscoveredGateway,
        removeSavedEndpoint,
        refreshSavedEndpoints,
        setActiveSession,
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
