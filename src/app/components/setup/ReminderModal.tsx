import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useOpenClaw } from '../../contexts/OpenClawContext';
import { Unplug, X, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import appLogo from "../../../assets/270226c058e3f12ad7bb9e96e3b029bc0e2c0461.png";

import { useI18n } from '../../contexts/I18nContext';

export function ReminderModal() {
  const { showReminder, setShowReminder } = useOpenClaw();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // We should not early return here, since it messes up hooks count if showReminder toggles.
  // Instead, return empty fragment if not shown.
  if (!showReminder) return <></>;

  const handleClose = () => {
    if (dontShowAgain) {
      // In a real app we'd save this to localStorage/context
      // For now we'll just close it
    }
    setShowReminder(false);
  };

  const handleGoToConfig = () => {
    setShowReminder(false);
    navigate('/config');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[900] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
          className="relative w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          {/* Close button */}
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8">
            <div className="relative w-20 h-20 mb-6 mx-auto flex items-center justify-center mix-blend-multiply dark:mix-blend-normal">
              <div className="w-full h-full grayscale-[80%] opacity-80 drop-shadow-md flex items-center justify-center">
                <img src={appLogo} alt={t("app.logoAlt")} className="w-[120%] h-[120%] object-contain [clip-path:circle(45%_at_50%_50%)]" />
              </div>
              <div className="absolute 0 -right-1 w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/80 border-2 border-white dark:border-slate-900 flex items-center justify-center text-amber-500 shadow-sm z-10">
                <Unplug className="w-3.5 h-3.5" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 text-center">{t("reminder.title")}</h2>
            <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed mb-8 text-center">
              {t("reminder.desc")}
            </p>

            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#165DFF] focus:ring-[#165DFF] dark:border-slate-600 dark:bg-slate-800"
                />
                {t("reminder.dont")}
              </label>

              <div className="flex items-center gap-3">
                <button 
                  onClick={handleClose}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {t("reminder.later")}
                </button>
                <button 
                  onClick={handleGoToConfig}
                  className="px-6 py-2.5 bg-[#165DFF] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  {t("reminder.goto")} <Link2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}



