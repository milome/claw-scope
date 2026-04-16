import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { gatewayPairingStatusLookup, useOpenClaw, type AuthMode, type GatewayPairingStatusResult } from '../../contexts/OpenClawContext';
import { CheckCircle2, XCircle, RefreshCw, Server, Shield, Globe, TerminalSquare, LayoutGrid, Cpu, Check, AlertCircle, ChevronRight, Moon, Sun } from 'lucide-react';
import { useI18n, LANGUAGES } from '../../contexts/I18nContext';
import { useTheme } from 'next-themes';
import appLogo from '../../../assets/270226c058e3f12ad7bb9e96e3b029bc0e2c0461.png';

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:18789';

export function SetupWizard() {
  const {
    isConfigured,
    hasSkippedSetup,
    isSetupWizardOpen,
    gatewayUrl,
    authMode: savedAuthMode,
    authSecret: savedAuthSecret,
    connectedOrigin,
    lastError,
    setHasSkippedSetup,
    updateConfig,
    testConnection,
    closeSetupWizard,
  } = useOpenClaw();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0, active: false });
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState(DEFAULT_GATEWAY_URL);
  const [authMode, setAuthMode] = useState<AuthMode>('token');
  const [authSecret, setAuthSecret] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<'none' | 'success' | 'fail'>('none');
  const [isDetecting, setIsDetecting] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<GatewayPairingStatusResult | null>(null);
  const [pairingStatusLoading, setPairingStatusLoading] = useState(false);
  const [authModeTouched, setAuthModeTouched] = useState(false);
  const [pairingActionHint, setPairingActionHint] = useState<string | null>(null);
  const [pairingBootstrapToken, setPairingBootstrapToken] = useState('');
  const [pairingAttempted, setPairingAttempted] = useState(false);
  const [pairingCompletionPending, setPairingCompletionPending] = useState(false);
  const pairingBootstrapTokenInputRef = useRef<HTMLInputElement | null>(null);

  const shouldShowWizard = isSetupWizardOpen || (!isConfigured && !hasSkippedSetup);
  const isPairingRequired = lastError?.code === 'PAIRING_REQUIRED';
  const isTokenMismatch = lastError?.code === 'AUTH_TOKEN_MISMATCH';
  const pairedReady = pairingStatus?.pairedReady ?? false;
  const pairedDeviceAvailable = pairedReady;
  const awaitingPairApproval =
    pairingAttempted && isPairingRequired && !pairedDeviceAvailable;
  const authSecretRequired =
    (authMode === 'token' || authMode === 'password') &&
    authSecret.trim().length === 0;
  const authSecretRequiredMessage = authMode === 'password' ? t('setup.auth.requiredPassword') : t('setup.auth.requiredToken');

  useEffect(() => {
    setMounted(true);
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as globalThis.Node)) {
        setIsLangMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!shouldShowWizard) {
      return;
    }

    setStep(1);
    setUrl(gatewayUrl || DEFAULT_GATEWAY_URL);
    setAuthMode(savedAuthMode === 'paired_device' ? 'token' : savedAuthMode);
    setAuthSecret(savedAuthSecret);
    setIsTesting(false);
    setIsSaving(false);
    setTestResult('none');
    setIsDetecting(false);
    setAuthModeTouched(false);
    setPairingActionHint(null);
    setPairingBootstrapToken(savedAuthMode === 'token' ? savedAuthSecret : '');
    setPairingAttempted(false);
    setPairingCompletionPending(false);
  }, [shouldShowWizard, gatewayUrl, savedAuthMode, savedAuthSecret]);

  useEffect(() => {
    if (!shouldShowWizard || !url.trim()) {
      setPairingStatus(null);
      setPairingStatusLoading(false);
      return;
    }

    let cancelled = false;
    setPairingStatus(null);
    setPairingStatusLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const next = await gatewayPairingStatusLookup(url);
        if (cancelled) {
          return;
        }
        applyPairingStatus(next, !authModeTouched);
      } catch {
        if (!cancelled) {
          setPairingStatus(null);
        }
      } finally {
        if (!cancelled) {
          setPairingStatusLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authModeTouched, shouldShowWizard, url]);

  const handleThemeToggle = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setRipplePos({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      active: true,
    });
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    setTimeout(() => {
      setRipplePos((prev) => ({ ...prev, active: false }));
    }, 1000);
  };

  const handleSkip = () => {
    if (!isConfigured) {
      setHasSkippedSetup(true);
    }
    closeSetupWizard();
  };

  const handleAutoDetect = () => {
    setIsDetecting(true);
    setTimeout(() => {
      setUrl(DEFAULT_GATEWAY_URL);
      setAuthMode('paired_device');
      setAuthSecret('');
      setAuthModeTouched(false);
      setPairingAttempted(false);
      setPairingCompletionPending(false);
      setPairingActionHint(null);
      setIsDetecting(false);
    }, 800);
  };

  const applyPairingStatus = (
    next: GatewayPairingStatusResult | null,
    adoptPairedDevice = false,
  ) => {
    setPairingStatus(next);

    if (next?.pairedReady && adoptPairedDevice) {
      setAuthMode('paired_device');
      setAuthSecret('');
      setAuthModeTouched(false);
      return;
    }

    if (!next?.pairedReady && !authModeTouched && authMode === 'paired_device') {
      setAuthMode('token');
    }
  };

  const handleTestAndNext = async () => {
    const targetUrl = url.trim();
    const effectiveMode = authMode;
    const effectiveSecret = authSecret;

    setIsTesting(true);
    setTestResult('none');
    setPairingActionHint(null);
    setPairingAttempted(false);
    setPairingCompletionPending(false);

    const success = await testConnection(targetUrl, effectiveMode, effectiveSecret);

    if (success) {
      setPairingStatusLoading(true);
      try {
        const next = await gatewayPairingStatusLookup(targetUrl);
        applyPairingStatus(next, true);
      } catch {
        // Ignore refresh failures and keep the test result visible.
      } finally {
        setPairingStatusLoading(false);
      }
    }

    setIsTesting(false);
    setTestResult(success ? 'success' : 'fail');
    setStep(3);
  };

  const handleStartPairing = async () => {
    const targetUrl = url.trim();
    const bootstrapToken = pairingBootstrapToken.trim();

    setPairingActionHint(null);
    setPairingAttempted(true);
    setPairingCompletionPending(false);

    if (!targetUrl) {
      return;
    }

    if (!bootstrapToken) {
      window.requestAnimationFrame(() => pairingBootstrapTokenInputRef.current?.focus());
      return;
    }

    setIsTesting(true);
    setTestResult('none');

    const success = await testConnection(targetUrl, 'paired_device', bootstrapToken);

    if (success) {
      setPairingStatusLoading(true);
      try {
        const next = await gatewayPairingStatusLookup(targetUrl);
        applyPairingStatus(next, true);

        if (next.pairedReady) {
          setPairingAttempted(false);
          setPairingCompletionPending(true);
          setPairingActionHint(t('setup.pairing.deviceTokenReady'));
        }
      } catch {
        // Ignore refresh failures and keep the test result visible.
      } finally {
        setPairingStatusLoading(false);
      }
    }

    setIsTesting(false);
    setTestResult(success ? 'success' : 'fail');
    setStep(3);
  };

  const handleSaveAndFinish = async () => {
    setIsSaving(true);
    const success = await updateConfig(
      url,
      pairingCompletionPending ? 'paired_device' : authMode,
      pairingCompletionPending ? '' : authSecret,
    );
    setIsSaving(false);

    if (!success) {
      setTestResult('fail');
      setStep(3);
      return;
    }

    setPairingAttempted(false);
    setPairingCompletionPending(false);
  };

  if (!shouldShowWizard) {
    return <></>;
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-50 dark:bg-slate-950 font-sans">
      <AnimatePresence>
        {ripplePos.active && (
          <motion.div
            initial={{
              clipPath: `circle(0px at ${ripplePos.x}px ${ripplePos.y}px)`,
              backgroundColor: theme === 'dark' ? '#f8fafc' : '#020617',
            }}
            animate={{
              clipPath: `circle(2000px at ${ripplePos.x}px ${ripplePos.y}px)`,
              backgroundColor: theme === 'dark' ? '#f8fafc' : '#020617',
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            className="fixed inset-0 z-[1000] pointer-events-none"
          />
        )}
      </AnimatePresence>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-500/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 dark:bg-indigo-500/5 blur-[120px] rounded-full"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      </div>

      <div className="relative z-10 w-[95%] sm:w-full max-w-[1000px] h-[90vh] min-h-[500px] max-h-[700px] sm:h-[640px] bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 flex">
          <motion.div
            className="h-full bg-blue-600 dark:bg-blue-500"
            initial={{ width: '25%' }}
            animate={{ width: `${(step / 4) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>

        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-50 flex items-center gap-2">
          <div className="relative" ref={langMenuRef}>
            <div className="group relative">
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all focus:outline-none hover:text-blue-600 dark:hover:text-blue-400 z-50 relative"
              >
                <Globe className="w-5 h-5 pointer-events-none" />
              </button>
              <div className="hidden md:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                {t('tooltip.lang')}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-[3px] border-transparent border-b-slate-800"></div>
              </div>
            </div>

            <AnimatePresence>
              {isLangMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-[calc(100%+8px)] right-0 rtl:right-auto rtl:left-0 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-[100] py-1.5"
                >
                  <div className="max-h-[300px] overflow-y-auto relative z-[100]">
                    {LANGUAGES.map((language) => (
                      <button
                        key={language.code}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLang(language.code);
                          setIsLangMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 md:py-2 text-[14px] md:text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors relative z-[100]"
                      >
                        <span className="flex items-center gap-2 pointer-events-none">
                          <span className="text-slate-900 dark:text-white font-medium">{language.native}</span>
                        </span>
                        {lang === language.code && <Check className="w-4 h-4 text-blue-500 pointer-events-none" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {mounted && (
            <div className="group relative">
              <button
                onClick={handleThemeToggle}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all focus:outline-none overflow-hidden relative z-50"
              >
                <AnimatePresence mode="wait">
                  {theme === 'dark' ? (
                    <motion.div key="moon" initial={{ y: -20, opacity: 0, rotate: -90 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 20, opacity: 0, rotate: 90 }} transition={{ duration: 0.3 }} className="absolute pointer-events-none">
                      <Moon className="w-5 h-5 text-blue-400" />
                    </motion.div>
                  ) : (
                    <motion.div key="sun" initial={{ y: -20, opacity: 0, rotate: 90 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 20, opacity: 0, rotate: -90 }} transition={{ duration: 0.3 }} className="absolute pointer-events-none">
                      <Sun className="w-5 h-5 text-amber-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
              <div className="hidden md:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                {theme === 'dark' ? t('tooltip.theme.light') : t('tooltip.theme.dark')}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-[3px] border-transparent border-b-slate-800"></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 relative overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 overflow-y-auto"
              >
                <div className="w-20 h-20 sm:w-28 sm:h-28 mb-4 sm:mb-6 relative group flex items-center justify-center mix-blend-multiply dark:mix-blend-normal shrink-0">
                  <img src={appLogo} alt={t("app.logoAlt")} className="w-[120%] h-[120%] object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-500 [clip-path:circle(45%_at_50%_50%)]" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-2 sm:mb-3 text-center">{t('setup.welcome.title')}</h1>
                <p className="text-base sm:text-lg font-medium bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-1 text-center">{t('setup.welcome.subtitle')}</p>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-8 sm:mb-12 text-center">{t('setup.welcome.desc')}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl shrink-0">
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4"><LayoutGrid className="w-6 h-6" /></div>
                    <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('setup.feat1.title')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{t('setup.feat1.desc')}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mb-4"><Server className="w-6 h-6" /></div>
                    <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('setup.feat2.title')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{t('setup.feat2.desc')}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4"><Cpu className="w-6 h-6" /></div>
                    <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('setup.feat3.title')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{t('setup.feat3.desc')}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col p-6 sm:p-10 md:p-14 overflow-y-auto"
              >
                <div className="max-w-2xl mx-auto w-full flex-1">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2 sm:mb-3">{t('setup.connect.title')}</h2>
                  <p className="text-[14px] sm:text-[15px] text-slate-500 dark:text-slate-400 mb-6 sm:mb-8">{t('setup.connect.desc')}</p>

                  <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 sm:p-5 mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">{t('setup.local.title')}</h4>
                      <p className="text-xs text-blue-600 dark:text-blue-400">{t('setup.local.desc')}</p>
                    </div>
                    <button
                      onClick={handleAutoDetect}
                      disabled={isDetecting}
                      className="px-4 py-2 w-full sm:w-auto justify-center bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-sm font-medium rounded-lg flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-4 h-4 ${isDetecting ? 'animate-spin' : ''}`} />
                      {isDetecting ? t('btn.detecting') : t('setup.btn.detect')}
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                        {t('setup.gateway.label')} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative group">
                        <Globe className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${!url ? 'text-red-400' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => {
                            setUrl(e.target.value);
                            setAuthModeTouched(false);
                            setPairingAttempted(false);
                            setPairingCompletionPending(false);
                            setPairingActionHint(null);
                          }}
                          placeholder={DEFAULT_GATEWAY_URL}
                          className={`w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border rounded-xl text-sm outline-none transition-all dark:text-slate-100 ${
                            !url
                              ? 'border-red-300 dark:border-red-500/50 focus:ring-2 focus:ring-red-500/50 focus:border-red-500'
                              : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 dark:hover:border-slate-600'
                          }`}
                        />
                      </div>
                      {!url ? (
                        <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {t('setup.gateway.urlRequired')}</p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-2">{t('setup.gateway.hint')}</p>
                      )}
                    </div>

                    {url && (pairingStatusLoading || pairingStatus) ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                          {t('setup.pairing.statusTitle')}
                        </div>
                        {pairingStatusLoading ? (
                          <div className="text-sm text-slate-500 dark:text-slate-400">{t('setup.pairing.detecting')}</div>
                        ) : pairingStatus?.pairedReady ? (
                          <>
                            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{t('setup.pairing.readyTitle')}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{t('setup.pairing.readyDesc')}</div>
                            <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t('setup.pairing.deviceTokenValid')}</div>
                          </>
                        ) : awaitingPairApproval ? (
                          <>
                            <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">{t('setup.pairing.awaitingApprovalTitle')}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{t('setup.pairing.awaitingApprovalDesc')}</div>
                            <code className="mt-2 block rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100 font-mono overflow-x-auto">
                              openclaw devices approve --latest
                            </code>
                          </>
                        ) : pairingStatus ? (
                          <>
                            <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">{t('setup.pairing.bootstrapTitle')}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{t('setup.pairing.bootstrapDesc')}</div>
                            <div className="space-y-3 pt-1">
                              <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                {t('setup.auth.pairedDeviceBootstrapLabel')}
                              </label>
                              <div className="relative">
                                <Shield className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  ref={pairingBootstrapTokenInputRef}
                                  type="password"
                                  value={pairingBootstrapToken}
                                  onChange={(e) => setPairingBootstrapToken(e.target.value)}
                                  placeholder={t('setup.ph.token')}
                                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-slate-100"
                                />
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{t('setup.auth.pairedDeviceBootstrapHint')}</p>
                              <button
                                onClick={handleStartPairing}
                                disabled={!url || isTesting}
                                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                              >
                                {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                {t('setup.pairing.startBootstrap')}
                              </button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                        {t('setup.auth.label')}
                      </label>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        {[
                          { id: 'paired_device', label: t('setup.auth.pairedDevice'), icon: Shield },
                          { id: 'token', label: t('setup.auth.token'), icon: TerminalSquare },
                          { id: 'password', label: t('setup.auth.pwd'), icon: Server },
                        ].map((modeOption) => {
                          const Icon = modeOption.icon;
                          const isActive = authMode === modeOption.id;
                          const isDisabled = modeOption.id === 'paired_device' && !pairedDeviceAvailable;
                          return (
                            <button
                              key={modeOption.id}
                              onClick={() => {
                                if (isDisabled) {
                                  return;
                                }
                                setPairingAttempted(false);
                                setPairingCompletionPending(false);
                                setPairingActionHint(null);
                                setAuthMode(modeOption.id as AuthMode);
                                setAuthModeTouched(true);
                              }}
                              disabled={isDisabled}
                              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                                isDisabled
                                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500'
                                  : isActive
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                              }`}
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
                                placeholder={authMode === 'password' ? t('setup.ph.pwd') : t('setup.ph.token')}
                                className={`w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border rounded-xl text-sm outline-none transition-all dark:text-slate-100 ${
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
                            <p className="text-xs text-slate-500 mt-2">{t('setup.hint.token1')} <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px] font-mono">openclaw config get gateway.auth.token</code> {t('setup.hint.token2')}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {authMode === 'paired_device' && pairedDeviceAvailable ? (
                        <p className="text-xs text-slate-500 mt-2">{t('setup.auth.pairedDeviceHint')}</p>
                      ) : !pairedDeviceAvailable ? (
                        <p className="text-xs text-slate-500 mt-2">{t('setup.pairing.pairedDeviceDisabled')}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col items-center justify-center p-12 text-center"
              >
                {testResult === 'success' ? (
                  <>
                    <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 flex items-center justify-center mb-8 relative">
                      <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping"></div>
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">{t('setup.success.title')}</h2>
                    <p className="text-lg text-slate-600 dark:text-slate-300 mb-2">{t('setup.success.desc1')}</p>
                    <p className="text-sm text-slate-500 mb-4">{t('setup.success.desc2')}</p>
                    {connectedOrigin && (
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                        {connectedOrigin}
                      </div>
                    )}
                    {pairingActionHint ? (
                      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300">
                        {pairingActionHint}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center mb-8 relative">
                      <XCircle className="w-12 h-12" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">{t('setup.fail.title')}</h2>
                    <p className="text-lg text-slate-600 dark:text-slate-300 mb-6">{t('setup.fail.desc')}</p>

                    <div className="space-y-4 max-w-md w-full">
                      {lastError && (
                        <div className="text-left rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-4">
                          <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 font-medium">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{lastError.message}</span>
                          </div>
                          {lastError.hint && <p className="mt-2 text-xs text-red-600 dark:text-red-300/80">{lastError.hint}</p>}
                        </div>
                      )}

                      {isPairingRequired ? (
                        <div className="text-left bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 w-full space-y-4">
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {t('setup.auth.deviceApprovalHint')}
                          </p>
                          <code className="block rounded-lg bg-slate-900 px-4 py-3 text-sm text-slate-100 font-mono overflow-x-auto">
                            openclaw devices approve --latest
                          </code>
                        </div>
                      ) : isTokenMismatch ? (
                        <div className="text-left bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 w-full space-y-4">
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {t('setup.auth.tokenMismatchHint')}
                          </p>
                          <code className="block rounded-lg bg-slate-900 px-4 py-3 text-sm text-slate-100 font-mono overflow-x-auto">
                            openclaw config get gateway.auth.token
                          </code>
                        </div>
                      ) : (
                        <div className="text-left bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 w-full">
                          <ul className="space-y-3">
                            <li className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"><AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> {t('setup.fail.reason1')}</li>
                            <li className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"><AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> {t('setup.fail.reason2')}</li>
                            <li className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"><AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> {t('setup.fail.reason3')}</li>
                            <li className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"><AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> {t('setup.fail.reason4')}</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="w-28 h-28 mb-8 relative flex items-center justify-center mix-blend-multiply dark:mix-blend-normal">
                  <motion.div className="w-full h-full flex items-center justify-center" initial={{ scale: 0.8, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
                    <img src={appLogo} alt={t("app.logoAlt")} className="w-[120%] h-[120%] object-contain drop-shadow-2xl [clip-path:circle(45%_at_50%_50%)]" />
                  </motion.div>
                </div>
                <h2 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">{t('setup.finish.title')}</h2>
                <p className="text-lg text-slate-500 dark:text-slate-400 mb-12 max-w-lg">{t('setup.finish.desc')}</p>
                {connectedOrigin && <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{connectedOrigin}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-20 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sm:px-8 shrink-0">
          {step === 1 && (
            <>
              <button onClick={handleSkip} className="px-3 sm:px-5 py-2 sm:py-2.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-lg">{t('btn.skip')}</button>
              <button onClick={() => setStep(2)} className="px-5 sm:px-6 py-2 sm:py-2.5 bg-[#165DFF] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 dark:focus:ring-offset-slate-900">{t('btn.start')} <ChevronRight className="w-4 h-4" /></button>
            </>
          )}

          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} className="px-3 sm:px-5 py-2 sm:py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/50">{t('btn.prev')}</button>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={handleTestAndNext}
                  disabled={!url || authSecretRequired || isTesting}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-sm font-semibold rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-2 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                >
                  {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                  <span className="hidden sm:inline">{t('btn.test')}</span>
                  <span className="sm:hidden">{t('btn.test')}</span>
                </button>
                <button disabled className="px-4 sm:px-6 py-2 sm:py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-sm font-semibold rounded-lg cursor-not-allowed flex items-center gap-1 sm:gap-2"><span className="hidden sm:inline">{t('btn.next')}</span><span className="sm:hidden">{t('btn.next')}</span> <ChevronRight className="w-4 h-4" /></button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <button onClick={() => setStep(2)} className="px-3 sm:px-5 py-2 sm:py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/50">
                {testResult === 'fail' ? t('btn.back') : t('btn.prev')}
              </button>
              {testResult === 'success' && (
                <button
                  onClick={pairingActionHint ? handleSaveAndFinish : () => setStep(4)}
                  disabled={pairingActionHint ? isSaving : false}
                  className="px-5 sm:px-6 py-2 sm:py-2.5 bg-[#165DFF] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  {pairingActionHint ? (
                    <>
                      {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {t('config.save')}
                    </>
                  ) : (
                    <>
                      {t('btn.enter')} <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </>
          )}

          {step === 4 && (
            <div className="w-full flex justify-center">
              <button
                onClick={handleSaveAndFinish}
                disabled={isSaving}
                className="px-8 sm:px-10 py-2.5 sm:py-3 bg-[#165DFF] hover:bg-blue-700 text-white text-[15px] font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {t('btn.experience')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
