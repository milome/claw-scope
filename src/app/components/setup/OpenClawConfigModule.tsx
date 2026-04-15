import { useEffect, useState } from 'react';
import { useOpenClaw, type AuthMode, type GatewayAdvancedConnectionConfig } from '../../contexts/OpenClawContext';
import { CheckCircle2, Server, Shield, Globe, TerminalSquare, RefreshCw, XCircle, AlertCircle, RotateCcw, Trash2, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '../../contexts/I18nContext';
import {
  buildAvailableOpenClawConfigSections,
  resolveSelectedOpenClawConfigSection,
  type OpenClawConfigSectionId,
} from './openClawConfigSectionState';

export function OpenClawConfigModule() {
  const { t } = useI18n();
  const {
    isConnected,
    isConfigured,
    gatewayUrl,
    authMode: savedAuthMode,
    authSecret: savedAuthSecret,
    advancedConnectionConfig,
    connectedOrigin,
    grantedScopes,
    lastError,
    updateConfig,
    saveAdvancedConnectionConfig,
    testConnection,
    reopenSetupWizard,
    discoveredGateways,
    savedEndpoints,
    nodes,
    scanLanGateways,
    setActiveSession,
    useDiscoveredGateway,
    removeSavedEndpoint,
  } = useOpenClaw();

  const [url, setUrl] = useState(gatewayUrl);
  const [authMode, setAuthMode] = useState<AuthMode>(savedAuthMode);
  const [authSecret, setAuthSecret] = useState(savedAuthSecret);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'none' | 'success' | 'fail'>('none');
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [applyingCandidateId, setApplyingCandidateId] = useState<string | null>(null);
  const [removingEndpointId, setRemovingEndpointId] = useState<string | null>(null);
  const [advancedTimeoutMs, setAdvancedTimeoutMs] = useState(String(advancedConnectionConfig.timeoutMs));
  const [advancedHeartbeatMs, setAdvancedHeartbeatMs] = useState(String(advancedConnectionConfig.heartbeatMs));
  const [advancedProxyUrl, setAdvancedProxyUrl] = useState(advancedConnectionConfig.proxyUrl ?? '');
  const [saveFeedback, setSaveFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const authSecretRequired = authMode !== 'paired_device' && authSecret.trim().length === 0;
  const authSecretRequiredMessage = authMode === 'token' ? t('setup.auth.requiredToken') : t('setup.auth.requiredPassword');

  useEffect(() => {
    setUrl(gatewayUrl);
    setAuthMode(savedAuthMode);
    setAuthSecret(savedAuthSecret);
  }, [gatewayUrl, savedAuthMode, savedAuthSecret]);

  useEffect(() => {
    setAdvancedTimeoutMs(String(advancedConnectionConfig.timeoutMs));
    setAdvancedHeartbeatMs(String(advancedConnectionConfig.heartbeatMs));
    setAdvancedProxyUrl(advancedConnectionConfig.proxyUrl ?? '');
  }, [advancedConnectionConfig]);

  const handleTestConnection = async () => {
    if (!url) {
      return;
    }

    setIsTesting(true);
    setTestResult('none');
    const success = await testConnection(url, authMode, authSecret);
    setIsTesting(false);
    setTestResult(success ? 'success' : 'fail');

    if (success) {
      setTimeout(() => setTestResult('none'), 3000);
    }
  };

  const handleSave = async () => {
    if (!url) {
      return;
    }

    setIsSaving(true);
    setSaveFeedback(null);

    const nextAdvancedConfig: GatewayAdvancedConnectionConfig = {
      timeoutMs: Number(advancedTimeoutMs) || advancedConnectionConfig.timeoutMs,
      heartbeatMs: Number(advancedHeartbeatMs) || advancedConnectionConfig.heartbeatMs,
      proxyUrl: advancedProxyUrl.trim() || null,
    };

    try {
      await saveAdvancedConnectionConfig(nextAdvancedConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('config.advanced.saveFail');
      setIsSaving(false);
      setSaveFeedback({ kind: 'error', message });
      return;
    }

    const success = hasBaseChanges
      ? await updateConfig(url, authMode, authSecret)
      : true;
    setIsSaving(false);
    setTestResult(success ? 'none' : 'fail');
    setSaveFeedback(
      success
        ? { kind: 'success', message: t('config.advanced.saveOk') }
        : { kind: 'error', message: t('config.advanced.savePartial') },
    );
  };

  const handleScanLan = async () => {
    setIsDiscovering(true);
    try {
      await scanLanGateways();
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleUseGateway = async (candidate: (typeof discoveredGateways)[number]) => {
    setApplyingCandidateId(candidate.id);
    try {
      const success = await useDiscoveredGateway(candidate, authMode, authSecret);
      setTestResult(success ? 'success' : 'fail');
    } finally {
      setApplyingCandidateId(null);
    }
  };

  const handleRemoveEndpoint = async (endpointId: string, label: string) => {
    if (!globalThis.confirm?.(t('config.discovery.removeConfirm', label))) {
      return;
    }
    setRemovingEndpointId(endpointId);
    try {
      await removeSavedEndpoint(endpointId);
    } finally {
      setRemovingEndpointId(null);
    }
  };

  const formatTimestamp = (value?: number | null) => {
    if (!value) {
      return t('config.discovery.never');
    }
    return new Date(value).toLocaleString();
  };

  const candidateConfidenceLabel = (confidence: (typeof discoveredGateways)[number]['confidence']) => {
    if (confidence === 'high') {
      return t('config.discovery.confidenceHigh');
    }
    if (confidence === 'medium') {
      return t('config.discovery.confidenceMedium');
    }
    return t('config.discovery.confidenceLow');
  };

  const candidateConfidenceClass = (confidence: (typeof discoveredGateways)[number]['confidence']) => {
    if (confidence === 'high') {
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    }
    if (confidence === 'medium') {
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    }
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  };

  const hasBaseChanges = url !== gatewayUrl || authMode !== savedAuthMode || authSecret !== savedAuthSecret;
  const hasAdvancedChanges =
    Number(advancedTimeoutMs || 0) !== advancedConnectionConfig.timeoutMs ||
    Number(advancedHeartbeatMs || 0) !== advancedConnectionConfig.heartbeatMs ||
    advancedProxyUrl.trim() !== (advancedConnectionConfig.proxyUrl ?? '');
  const hasChanges = hasBaseChanges || hasAdvancedChanges;
  const connectedLabel = connectedOrigin ?? gatewayUrl;
  const statusDescription = isConnected
    ? `${t('config.status.connected')} ${connectedLabel}`
    : !isConfigured
      ? t('config.status.unconfigured')
      : lastError?.message ?? t('config.test.fail');
  const connectedNodes = nodes.filter((node) => node.sessionId);
  const availableSections = buildAvailableOpenClawConfigSections({
    hasConnectedNodes: connectedNodes.length > 0,
  });
  const [activeSection, setActiveSection] =
    useState<OpenClawConfigSectionId>('status');

  const sectionMeta: Record<
    OpenClawConfigSectionId,
    { label: string; icon: typeof Globe }
  > = {
    status: { label: t('config.legend.status'), icon: CheckCircle2 },
    sessions: { label: t('config.legend.sessions'), icon: Wifi },
    connection: { label: t('config.legend.connection'), icon: Shield },
    discovery: { label: t('config.legend.discovery'), icon: Globe },
    advanced: { label: t('config.legend.advanced'), icon: TerminalSquare },
  };

  useEffect(() => {
    const nextSection = resolveSelectedOpenClawConfigSection(
      activeSection,
      availableSections,
    );

    if (nextSection !== activeSection) {
      setActiveSection(nextSection);
    }
  }, [activeSection, availableSections]);


  return (
    <div className="w-full max-w-4xl font-sans text-slate-900 dark:text-slate-100">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-1">{t('config.instance.title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('config.instance.desc')}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {t('config.legend.title')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableSections.map((sectionId) => {
              const meta = sectionMeta[sectionId];
              const Icon = meta.icon;
              const isActive = activeSection === sectionId;

              return (
                <button
                  key={sectionId}
                  type="button"
                  onClick={() => setActiveSection(sectionId)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeSection === 'status' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold mb-1">{t('config.status.title')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{statusDescription}</p>
            {isConnected && grantedScopes.length > 0 ? (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {t('config.status.scopes')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {grantedScopes.map((scope) => (
                    <span
                      key={scope}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                {t('config.status.ok')}
              </div>
            ) : !isConfigured ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium">
                <AlertCircle className="w-4 h-4" />
                {t('common.unconfigured')}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-lg text-sm font-medium">
                <XCircle className="w-4 h-4" />
                {t('config.status.fail')}
              </div>
              )}
          </div>
        </div>
        ) : null}

        {activeSection === 'sessions' && connectedNodes.length > 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-[15px] font-semibold mb-1">{t('config.sessions.title')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('config.sessions.desc')}</p>
              </div>
              <div className="space-y-3">
                {connectedNodes.map((node) => (
                  <div key={node.sessionId} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{node.name}</span>
                        {node.isActive ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                            {t('config.sessions.active')}
                          </span>
                        ) : null}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${node.status === 'online' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {node.status === 'online' ? t('config.sessions.online') : t('config.sessions.offline')}
                        </span>
                      </div>
                      <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                        {node.origin ?? node.id}
                      </div>
                    </div>
                    <button
                      onClick={() => node.sessionId && void setActiveSession(node.sessionId)}
                      disabled={!node.sessionId || node.isActive}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-600 disabled:opacity-60 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
                    >
                      {t('config.sessions.makeActive')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeSection === 'connection' || activeSection === 'discovery' || activeSection === 'advanced' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden focus-within:border-blue-300 dark:focus-within:border-blue-700 transition-colors">
          <div className="p-5 sm:p-6 space-y-6">
            {activeSection === 'connection' ? (
            <>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                {t('setup.gateway.label')} <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <Globe className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${!url ? 'text-red-400' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://127.0.0.1:18789"
                  className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border rounded-xl text-sm outline-none transition-all dark:text-slate-100 ${
                    !url
                      ? 'border-red-300 dark:border-red-500/50 focus:ring-2 focus:ring-red-500/50 focus:border-red-500'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                />
              </div>
              {!url && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {t('config.connection.urlRequired')}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                {t('setup.auth.label')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {[
                  { id: 'paired_device', label: t('setup.auth.pairedDevice'), icon: Shield },
                  { id: 'token', label: t('setup.auth.token'), icon: TerminalSquare },
                  { id: 'password', label: t('setup.auth.pwd'), icon: Server },
                ].map((modeOption) => {
                  const Icon = modeOption.icon;
                  const isActive = authMode === modeOption.id;
                  return (
                    <button
                      key={modeOption.id}
                      onClick={() => setAuthMode(modeOption.id as AuthMode)}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      <Icon className="w-4 h-4" /> {modeOption.label}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {authMode !== 'paired_device' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="relative mt-2">
                      <Shield className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={authSecret}
                        onChange={(e) => setAuthSecret(e.target.value)}
                        placeholder={authMode === 'token' ? t('setup.ph.token') : t('setup.ph.pwd')}
                        className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border rounded-xl text-sm outline-none transition-all dark:text-slate-100 ${
                          authSecretRequired
                            ? 'border-red-300 dark:border-red-500/50 focus:ring-2 focus:ring-red-500/50 focus:border-red-500'
                            : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                      />
                    </div>
                    {authSecretRequired && (
                      <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {authSecretRequiredMessage}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              {authMode === 'paired_device' && (
                <p className="text-xs text-slate-500 mt-2">{t('setup.auth.pairedDeviceHint')}</p>
              )}
            </div>
            </>
            ) : null}

            {activeSection === 'discovery' ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-5 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('config.discovery.title')}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('config.discovery.desc')}</p>
                </div>
                <button
                  onClick={handleScanLan}
                  disabled={isDiscovering}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isDiscovering ? 'animate-spin' : ''}`} />
                  {isDiscovering ? t('config.discovery.scanning') : t('config.discovery.scan')}
                </button>
              </div>

              {authSecretRequired ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  {t('config.discovery.authHint')}
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {t('config.discovery.savedTitle')}
                </div>
                {savedEndpoints.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {t('config.discovery.savedEmpty')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedEndpoints.map((endpoint) => (
                      <div key={endpoint.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{endpoint.label}</span>
                              {endpoint.wasUserSelected ? (
                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                                  {t('config.discovery.preferred')}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                              {endpoint.httpUrl ?? endpoint.wsUrl}
                            </div>
                            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                              {t('config.discovery.lastSuccess')}: {formatTimestamp(endpoint.lastSuccessAtMs)}
                            </div>
                          </div>
                          <button
                            onClick={() => void handleRemoveEndpoint(endpoint.id, endpoint.label)}
                            disabled={removingEndpointId === endpoint.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-60 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-700 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('config.discovery.remove')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {t('config.discovery.candidatesTitle')}
                </div>
                {discoveredGateways.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {t('config.discovery.candidatesEmpty')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {discoveredGateways.map((candidate) => (
                      <div key={candidate.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                              <Wifi className="w-4 h-4 text-sky-500" />
                              <span>{candidate.label}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${candidateConfidenceClass(candidate.confidence)}`}>
                                {candidateConfidenceLabel(candidate.confidence)}
                              </span>
                              {candidate.protocolVerified ? (
                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                                  {t('config.discovery.protocolVerified')}
                                </span>
                              ) : null}
                              {candidate.matchedSeedHost ? (
                                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                                  {t('config.discovery.seedHost')}
                                </span>
                              ) : candidate.matchedSeedSubnet ? (
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                  {t('config.discovery.seedSubnet')}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                              {candidate.httpUrl ?? candidate.wsUrl}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {t('config.discovery.lastSeen')}: {formatTimestamp(candidate.lastSeenAtMs)}
                              <span>{t('config.discovery.score')}: {candidate.confidenceScore}</span>
                              {candidate.protocolSignal ? (
                                <span>{t('config.discovery.signal')}: {candidate.protocolSignal}</span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            onClick={() => void handleUseGateway(candidate)}
                            disabled={authSecretRequired || applyingCandidateId === candidate.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#165DFF] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {applyingCandidateId === candidate.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                            {t('config.discovery.use')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            ) : null}

            {activeSection === 'advanced' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
                {t('config.advanced.localClientNote')}
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('config.timeout')}</label>
                    <input type="number" value={advancedTimeoutMs} onChange={(e) => setAdvancedTimeoutMs(e.target.value)} placeholder="30000" min={1000} max={120000} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('config.heartbeat')}</label>
                    <input type="number" value={advancedHeartbeatMs} onChange={(e) => setAdvancedHeartbeatMs(e.target.value)} placeholder="5000" min={1000} max={60000} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('config.proxy')}</label>
                    <input type="text" value={advancedProxyUrl} onChange={(e) => setAdvancedProxyUrl(e.target.value)} placeholder="http://127.0.0.1:7890" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm" />
                    <p className="mt-2 text-[11px] leading-5 text-amber-600 dark:text-amber-300">
                      {t('config.advanced.proxyDeferred')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            ) : null}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-4 flex flex-col gap-4">
            {lastError && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-4 py-3">
                <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 font-medium">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{lastError.message}</span>
                </div>
                {lastError.hint && <p className="mt-2 text-xs text-red-600 dark:text-red-300/80">{lastError.hint}</p>}
              </div>
            )}

            {saveFeedback ? (
              <div className={`rounded-xl border px-4 py-3 text-sm ${
                saveFeedback.kind === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300'
              }`}>
                {saveFeedback.message}
              </div>
            ) : null}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {testResult === 'fail' && <span className="text-sm text-red-500 font-medium flex items-center gap-1.5"><XCircle className="w-4 h-4" /> {t('config.test.fail')}</span>}
                {testResult === 'success' && <span className="text-sm text-emerald-500 font-medium flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {t('config.test.ok')}</span>}
              </div>
              <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                <button
                  onClick={reopenSetupWizard}
                  className="flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-slate-400/50 active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('config.setup.rerun')}
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={!url || authSecretRequired || isTesting}
                  className="flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-slate-400/50 active:scale-95"
                >
                  {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                  {t('btn.test')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || !url || authSecretRequired || isSaving}
                  className="flex-1 sm:flex-none px-6 py-2 bg-[#165DFF] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : t('config.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}




