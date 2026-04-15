import { NavLink, Outlet, useLocation } from "react-router";
import { Database, Settings, BrainCircuit, Minus, Square, X, IdCard, Sun, Moon, Globe, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useI18n, LANGUAGES } from "../contexts/I18nContext";
import { SetupWizard } from "./setup/SetupWizard";
import { ReminderModal } from "./setup/ReminderModal";
import appLogo from "../../assets/270226c058e3f12ad7bb9e96e3b029bc0e2c0461.png";
import { resolveViewToneClasses } from "./views/viewTone";

function hasTauriWindowContext() {
  if (typeof window === "undefined") {
    return false;
  }

  const tauriInternals = (window as Window & {
    __TAURI_INTERNALS__?: {
      metadata?: {
        currentWindow?: unknown;
      };
    };
  }).__TAURI_INTERNALS__;

  return Boolean(tauriInternals?.metadata?.currentWindow);
}

export function Shell() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [hasTauriWindow, setHasTauriWindow] = useState(false);
  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0, active: false });
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setHasTauriWindow(hasTauriWindowContext());

    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as globalThis.Node)) {
        setIsLangMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleMinimize = () => {
    if (!hasTauriWindowContext()) {
      return;
    }

    void getCurrentWindow().minimize();
  };

  const handleToggleMaximize = () => {
    if (!hasTauriWindowContext()) {
      return;
    }

    void getCurrentWindow().toggleMaximize();
  };

  const handleClose = () => {
    if (!hasTauriWindowContext()) {
      return;
    }

    void getCurrentWindow().close();
  };

  return (
    <div className="flex flex-col h-screen md:h-screen h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden selection:bg-sky-200 dark:selection:bg-sky-900 transition-colors duration-300 relative">
      <SetupWizard />
      <ReminderModal />

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
            className="fixed inset-0 z-[100] pointer-events-none"
          />
        )}
      </AnimatePresence>

      <div
        data-tauri-drag-region
        className="h-[44px] md:h-[40px] shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-3 md:px-2 text-[14px] md:text-[13px] select-none shadow-sm z-20 transition-colors duration-300"
      >
        <div className="w-7 h-7 md:w-6 md:h-6 mr-2.5 shrink-0 flex items-center justify-center rtl:ml-2.5 rtl:mr-0 pointer-events-none drop-shadow-sm mix-blend-multiply dark:mix-blend-normal">
          <img src={appLogo} alt={t("app.logoAlt")} className="w-[120%] h-[120%] object-contain [clip-path:circle(45%_at_50%_50%)]" />
        </div>

        <div data-tauri-drag-region className="flex-1 text-slate-700 dark:text-slate-200 font-bold md:font-medium tracking-wide">
          ClawScope<span data-tauri-drag-region className="hidden md:inline">{t("app.subtitle")}</span>
        </div>

        <div className="flex items-center gap-2 md:gap-1.5 md:mx-4 relative z-50">
          <div className="relative" ref={langMenuRef}>
            <div className="group relative">
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all focus:outline-none hover:text-sky-600 dark:hover:text-sky-400 z-50 relative"
              >
                <Globe className="w-5 h-5 md:w-4 md:h-4 pointer-events-none" />
              </button>
              <div className="hidden md:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                {t("tooltip.lang")}
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
                        {lang === language.code && <Check className="w-4 h-4 text-sky-500 pointer-events-none" />}
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
                className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all focus:outline-none overflow-hidden relative z-50"
              >
                <AnimatePresence mode="wait">
                  {theme === 'dark' ? (
                    <motion.div key="moon" initial={{ y: -20, opacity: 0, rotate: -90 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 20, opacity: 0, rotate: 90 }} transition={{ duration: 0.3 }} className="absolute pointer-events-none">
                      <Moon className="w-5 h-5 md:w-4 md:h-4 text-sky-400" />
                    </motion.div>
                  ) : (
                    <motion.div key="sun" initial={{ y: -20, opacity: 0, rotate: 90 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 20, opacity: 0, rotate: -90 }} transition={{ duration: 0.3 }} className="absolute pointer-events-none">
                      <Sun className="w-5 h-5 md:w-4 md:h-4 text-amber-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
              <div className="hidden md:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                {theme === 'dark' ? t("tooltip.theme.light") : t("tooltip.theme.dark")}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-[3px] border-transparent border-b-slate-800"></div>
              </div>
            </div>
          )}

          <div className="hidden md:block w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
        </div>

        {hasTauriWindow && (
          <div className="hidden md:flex shrink-0 -mr-2 rtl:mr-0 rtl:-ml-2 z-50 relative">
            <button id="titlebar-minimize" onClick={handleMinimize} className="w-[46px] h-[40px] flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 active:bg-slate-300 dark:active:bg-slate-700 transition-colors focus:outline-none"><Minus className="w-4 h-4 pointer-events-none" strokeWidth={1.5} /></button>
            <button id="titlebar-maximize" onClick={handleToggleMaximize} className="w-[46px] h-[40px] flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 active:bg-slate-300 dark:active:bg-slate-700 transition-colors focus:outline-none"><Square className="w-3 h-3 pointer-events-none" strokeWidth={1.5} /></button>
            <button id="titlebar-close" onClick={handleClose} className="w-[46px] h-[40px] flex items-center justify-center text-slate-500 hover:bg-red-500 hover:text-white active:bg-red-600 transition-colors focus:outline-none"><X className="w-4 h-4 pointer-events-none" strokeWidth={1.5} /></button>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden z-10 relative">
        <aside className="hidden md:flex w-[220px] bg-white dark:bg-slate-900 border-r rtl:border-r-0 rtl:border-l border-slate-200 dark:border-slate-800 py-4 shrink-0 flex-col gap-1 shadow-[1px_0_4px_rgba(0,0,0,0.02)] rtl:shadow-[-1px_0_4px_rgba(0,0,0,0.02)] z-0 transition-colors duration-300">
          <div className="px-4 mb-2">
            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1">{t("nav.title")}</div>
          </div>
          <NavLink to="/" end className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 text-sm transition-all border-l-4 rtl:border-l-0 rtl:border-r-4 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset active:scale-[0.98] ${isActive ? `${resolveViewToneClasses('sky').navActive} font-semibold shadow-sm` : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}`}>
            {({ isActive }) => (
              <><IdCard className={`w-[18px] h-[18px] ${isActive ? resolveViewToneClasses('sky').navIconActive : 'text-slate-400 dark:text-slate-500'}`} strokeWidth={isActive ? 2.5 : 2} /> {t("nav.profile")}</>
            )}
          </NavLink>
          <NavLink to="/memory" className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 text-sm transition-all border-l-4 rtl:border-l-0 rtl:border-r-4 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset active:scale-[0.98] ${isActive ? `${resolveViewToneClasses('violet').navActive} font-semibold shadow-sm` : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}`}>
            {({ isActive }) => (
              <><Database className={`w-[18px] h-[18px] ${isActive ? resolveViewToneClasses('violet').navIconActive : 'text-slate-400 dark:text-slate-500'}`} strokeWidth={isActive ? 2.5 : 2} /> {t("nav.memory")}</>
            )}
          </NavLink>
          <NavLink to="/config" className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 text-sm transition-all border-l-4 rtl:border-l-0 rtl:border-r-4 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset active:scale-[0.98] ${isActive ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 text-slate-700 dark:text-slate-200 font-semibold shadow-sm' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}`}>
            {({ isActive }) => (
              <><Settings className={`w-[18px] h-[18px] ${isActive ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`} strokeWidth={isActive ? 2.5 : 2} /> {t("nav.config")}</>
            )}
          </NavLink>
          <NavLink to="/evolution" className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 text-sm transition-all border-l-4 rtl:border-l-0 rtl:border-r-4 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset active:scale-[0.98] ${isActive ? `${resolveViewToneClasses('emerald').navActive} font-semibold shadow-sm` : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}`}>
            {({ isActive }) => (
              <><BrainCircuit className={`w-[18px] h-[18px] ${isActive ? resolveViewToneClasses('emerald').navIconActive : 'text-slate-400 dark:text-slate-500'}`} strokeWidth={isActive ? 2.5 : 2} /> {t("nav.evolution")}</>
            )}
          </NavLink>

          <div className="mt-auto px-4 pb-3 flex flex-col gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
              <div className="font-semibold text-slate-800 dark:text-slate-200">{t("app.footer.version", "0.1.0")}</div>
              <div className="mt-1">{t("app.footer.copyright", 2026)}</div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pb-20 md:pb-0 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-4 md:p-6 min-h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-50 px-2 py-2 flex justify-around items-center safe-area-bottom shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <NavLink to="/" end className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-95 ${isActive ? resolveViewToneClasses('sky').navMobileActive : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>
          {({ isActive }) => (
            <>
              <motion.div animate={{ scale: isActive ? 1.1 : 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                <IdCard className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <span className="text-[10px] font-medium">{t("nav.profile").split(' ')[0]}</span>
            </>
          )}
        </NavLink>
        <NavLink to="/memory" className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-95 ${isActive ? resolveViewToneClasses('violet').navMobileActive : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>
          {({ isActive }) => (
            <>
              <motion.div animate={{ scale: isActive ? 1.1 : 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                <Database className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <span className="text-[10px] font-medium">{t("nav.memory")}</span>
            </>
          )}
        </NavLink>
        <NavLink to="/config" className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-95 ${isActive ? 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>
          {({ isActive }) => (
            <>
              <motion.div animate={{ scale: isActive ? 1.1 : 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                <Settings className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <span className="text-[10px] font-medium">{t("nav.config")}</span>
            </>
          )}
        </NavLink>
        <NavLink to="/evolution" className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-95 ${isActive ? resolveViewToneClasses('emerald').navMobileActive : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>
          {({ isActive }) => (
            <>
              <motion.div animate={{ scale: isActive ? 1.1 : 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                <BrainCircuit className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <span className="text-[10px] font-medium">{t("nav.evolution")}</span>
            </>
          )}
        </NavLink>
      </nav>

      <style>{`
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .safe-area-bottom {
            padding-bottom: calc(0.5rem + env(safe-area-bottom));
          }
        }
      `}</style>
    </div>
  );
}
