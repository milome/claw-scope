import React, { useState } from "react";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router";
import { useI18n, LANGUAGES } from "../../contexts/I18nContext";
import {
  Globe,
  Moon,
  Sun,
  Monitor,
  Check,
  Wrench,
  Settings2,
  IdCard,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function GeneralConfigModule() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();

  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0, active: false });

  const handleThemeToggle = (e: React.MouseEvent, selectedTheme: string) => {
    if (theme === selectedTheme) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setRipplePos({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      active: true,
    });

    setTheme(selectedTheme);

    setTimeout(() => {
      setRipplePos((prev) => ({ ...prev, active: false }));
    }, 1000);
  };

  return (
    <div className="w-full max-w-4xl font-sans text-slate-900 dark:text-slate-100 pb-8">
      <AnimatePresence>
        {ripplePos.active && (
          <motion.div
            initial={{
              clipPath: `circle(0px at ${ripplePos.x}px ${ripplePos.y}px)`,
              backgroundColor: theme === "dark" ? "#020617" : "#f8fafc",
            }}
            animate={{
              clipPath: `circle(2000px at ${ripplePos.x}px ${ripplePos.y}px)`,
              backgroundColor: theme === "dark" ? "#020617" : "#f8fafc",
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] pointer-events-none"
          />
        )}
      </AnimatePresence>

      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight mb-1">
          {t("config.general.title")}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("config.general.desc")}
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
                  {t("config.general.profileEntry.title")}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-6">
                  {t("config.general.profileEntry.desc")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-sky-600 hover:bg-black dark:hover:bg-sky-500 text-white px-4 py-2.5 text-sm font-semibold transition-all shadow-md active:scale-95"
            >
              {t("config.general.profileEntry.btn")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 border-dashed">
          <div className="mb-6 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
              <Settings2 className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold tracking-tight">
              {t("config.agent.global")}
            </h3>
          </div>

          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6">
                <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
                  <Sun className="w-4 h-4 text-slate-500" /> {t("config.general.appearance")}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={(e) => handleThemeToggle(e, "light")}
                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      theme === "light"
                        ? "border-sky-500 bg-sky-50 dark:bg-sky-900/10 text-sky-700"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                      <Sun className="w-6 h-6 text-amber-500" />
                    </div>
                    <span className="text-sm font-medium">{t("config.general.theme.light")}</span>
                  </button>

                  <button
                    onClick={(e) => handleThemeToggle(e, "dark")}
                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      theme === "dark"
                        ? "border-sky-500 bg-slate-800 text-sky-400"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-900 shadow-sm flex items-center justify-center border border-slate-700">
                      <Moon className="w-6 h-6 text-sky-400" />
                    </div>
                    <span className="text-sm font-medium">{t("config.general.theme.dark")}</span>
                  </button>

                  <button
                    onClick={(e) => handleThemeToggle(e, "system")}
                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      theme === "system"
                        ? "border-sky-500 bg-sky-50 dark:bg-sky-900/10 text-sky-700 dark:text-sky-400"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 shadow-sm flex items-center justify-center">
                      <Monitor className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                    </div>
                    <span className="text-sm font-medium">{t("config.general.theme.system")}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6">
                <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-500" /> {t("config.general.language")}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLang(l.code)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                        lang === l.code
                          ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {l.native}
                      {lang === l.code && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold mb-1">
                    {t("config.wip.title")}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t("config.wip.desc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
