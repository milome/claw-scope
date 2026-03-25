import { useState } from 'react';
import { OpenClawConfigModule } from '../setup/OpenClawConfigModule';
import { GeneralConfigModule } from '../setup/GeneralConfigModule';
import { Settings, SlidersHorizontal, Zap } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';

export function ConfigView() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'general' | 'connection'>('general');

  return (
    <div className="max-w-[1200px] mx-auto h-full flex flex-col animate-in fade-in duration-500 pb-4 md:pb-8 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="mb-6 md:mb-8 shrink-0 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("nav.config")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("config.instance.desc")}</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-6 shrink-0 max-w-4xl">
        <button
          onClick={() => setActiveTab('general')}
          className={`pb-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'general' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {t("config.tab.general")}
          {activeTab === 'general' && (
            <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-sky-500 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('connection')}
          className={`pb-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'connection' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          <Zap className="w-4 h-4" />
          {t("config.tab.connection")}
          {activeTab === 'connection' && (
            <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-sky-500 rounded-t-full" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {activeTab === 'general' && (
          <GeneralConfigModule />
        )}
        
        {activeTab === 'connection' && (
          <OpenClawConfigModule />
        )}
      </div>
    </div>
  );
}

