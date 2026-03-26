import { useEffect, useState } from 'react';
import { useOpenClaw, type AuthMode } from '../../contexts/OpenClawContext';
import { CheckCircle2, Server, Shield, Globe, TerminalSquare, RefreshCw, XCircle, ChevronDown, ChevronUp, AlertCircle, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '../../contexts/I18nContext';

export function OpenClawConfigModule() {
  const { t } = useI18n();
  const {
    isConnected,
    isConfigured,
    gatewayUrl,
    authMode: savedAuthMode,
    authSecret: savedAuthSecret,
    connectedOrigin,
    lastError,
    updateConfig,
    testConnection,
    reopenSetupWizard,
  } = useOpenClaw();

  const [url, setUrl] = useState(gatewayUrl);
  const [authMode, setAuthMode] = useState<AuthMode>(savedAuthMode);
  const [authSecret, setAuthSecret] = useState(savedAuthSecret);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'none' | 'success' | 'fail'>('none');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const authSecretRequired = authMode !== 'none' && authSecret.trim().length === 0;
  const authSecretRequiredMessage = authMode === 'token' ? t('setup.auth.requiredToken') : t('setup.auth.requiredPassword');

  useEffect(() => {
    setUrl(gatewayUrl);
    setAuthMode(savedAuthMode);
    setAuthSecret(savedAuthSecret);
  }, [gatewayUrl, savedAuthMode, savedAuthSecret]);

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
    const success = await updateConfig(url, authMode, authSecret);
    setIsSaving(false);
    setTestResult(success ? 'none' : 'fail');
  };

  const hasChanges = url !== gatewayUrl || authMode !== savedAuthMode || authSecret !== savedAuthSecret;
  const connectedLabel = connectedOrigin ?? gatewayUrl;
  const statusDescription = isConnected
    ? `${t('config.status.connected')} ${connectedLabel}`
    : !isConfigured
      ? t('config.status.unconfigured')
      : lastError?.message ?? t('config.test.fail');

  return (
    <div className="w-full max-w-4xl font-sans text-slate-900 dark:text-slate-100">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-1">{t('config.instance.title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('config.instance.desc')}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold mb-1">{t('config.status.title')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{statusDescription}</p>
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
                Unconfigured
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-lg text-sm font-medium">
                <XCircle className="w-4 h-4" />
                {t('config.status.fail')}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden focus-within:border-blue-300 dark:focus-within:border-blue-700 transition-colors">
          <div className="p-5 sm:p-6 space-y-6">
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
              {!url && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> URL is required to save or test connection.</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                {t('setup.auth.label')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {[
                  { id: 'none', label: t('setup.auth.none'), icon: Shield },
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
                {authMode !== 'none' && (
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
              {authMode === 'none' && (
                <p className="text-xs text-slate-500 mt-2">{t('setup.auth.pairedDeviceHint')}</p>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                {t('config.advanced')} {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('config.timeout')}</label>
                          <input type="number" placeholder="30000" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('config.heartbeat')}</label>
                          <input type="number" placeholder="5000" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('config.proxy')}</label>
                          <input type="text" placeholder="http://127.0.0.1:7890" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
      </div>
    </div>
  );
}




