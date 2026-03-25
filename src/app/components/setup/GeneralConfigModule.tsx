import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import { useI18n, LANGUAGES } from '../../contexts/I18nContext';
import { useOpenClaw } from '../../contexts/OpenClawContext';
import { Globe, Moon, Sun, Monitor, Check, Wrench, Cpu, Terminal, Sparkles, Pencil, User, Hash, BrainCircuit, Settings2, ChevronDown, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function GeneralConfigModule() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { agents: REAL_AGENTS, nodes: REAL_NODES } = useOpenClaw();
  
  // Theme ripple effect state
  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0, active: false });

  const MOCK_AGENTS_BACKUP = [
    {
      id: "c-7f8a-99x",
      name: "ClawScope AI",
      node: "OpenClaw-Local",
      avatarColor: "from-sky-400 to-blue-600",
      avatarIcon: Cpu,
      status: t("agent.active"),
      version: "v1.0.4-local",
      identity: t("agent.1.identity"),
      tags: [t("agent.1.tag.1"), t("agent.1.tag.2"), t("agent.1.tag.3")],
      soulQuote: t("agent.1.soul"),
    },
    {
      id: "a-3m2b-88z",
      name: "CodeReviewer",
      node: "OpenClaw-Local",
      avatarColor: "from-emerald-400 to-teal-600",
      avatarIcon: Terminal,
      status: t("agent.standby"),
      version: "v2.1.0-remote",
      identity: t("agent.2.identity"),
      tags: [t("agent.2.tag.1"), t("agent.2.tag.2"), t("agent.2.tag.3")],
      soulQuote: t("agent.2.soul"),
    },
    {
      id: "u-9k1c-11y",
      name: "StoryCrafter",
      node: "OpenClaw-West",
      avatarColor: "from-fuchsia-400 to-purple-600",
      avatarIcon: Sparkles,
      status: t("agent.sleeping"),
      version: "v0.9.beta",
      identity: t("agent.3.identity"),
      tags: [t("agent.3.tag.1"), t("agent.3.tag.2"), t("agent.3.tag.3")],
      soulQuote: t("agent.3.soul"),
    }
  ];

  const displayAgents = REAL_AGENTS.length > 0 
    ? REAL_AGENTS.map(a => {
        const backup = MOCK_AGENTS_BACKUP.find(b => b.id === a.id);
        return {
          ...a,
          node: REAL_NODES?.find(n => n.id === a.nodeId)?.name || backup?.node || (a as any).nodeId || "Local",
          avatarIcon: backup?.avatarIcon || Cpu,
          version: backup?.version || "v1.0.0",
          identity: backup?.identity || "A default identity.",
          tags: backup?.tags || ["ai", "assistant"],
          soulQuote: backup?.soulQuote || "Ready to serve."
        };
      })
    : MOCK_AGENTS_BACKUP;

  const [selectedAgentId, setSelectedAgentId] = useState(displayAgents.length > 0 ? displayAgents[0].id : '');
  const selectedAgent = displayAgents.find(a => a.id === selectedAgentId) || displayAgents[0];

  const handleThemeToggle = (e: React.MouseEvent, selectedTheme: string) => {
    if (theme === selectedTheme) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    setRipplePos({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      active: true
    });
    
    setTheme(selectedTheme);
    
    setTimeout(() => {
      setRipplePos(prev => ({ ...prev, active: false }));
    }, 1000);
  };

  const Icon = selectedAgent?.avatarIcon || Cpu;

  return (
    <div className="w-full max-w-4xl font-sans text-slate-900 dark:text-slate-100 pb-8">
      <AnimatePresence>
        {ripplePos.active && (
          <motion.div
            initial={{ 
              clipPath: `circle(0px at ${ripplePos.x}px ${ripplePos.y}px)`,
              backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc' 
            }}
            animate={{ 
              clipPath: `circle(2000px at ${ripplePos.x}px ${ripplePos.y}px)`,
              backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc'
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] pointer-events-none"
          />
        )}
      </AnimatePresence>

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-1">{t("config.agent.title")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("config.agent.desc")}</p>
        </div>
        
        {/* Agent Dropdown Selector */}
        <div className="relative inline-flex items-center">
          <select 
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 pl-4 pr-10 rounded-lg shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer min-w-[220px]"
          >
            {displayAgents.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.node || "Local"})</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-6">
        
        {/* P0: Agent Persona Summary */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-5 dark:opacity-10 transition-opacity group-hover:opacity-10 dark:group-hover:opacity-20">
            <Icon className="w-48 h-48 -mt-12 -mr-12" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${selectedAgent?.avatarColor || 'from-slate-400 to-slate-600'} text-white flex items-center justify-center shadow-lg shadow-sky-500/20`}>
                <Icon className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {selectedAgent?.name || "Unknown Agent"}
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium border border-slate-200 dark:border-slate-700">
                    {selectedAgent?.version || "unknown"}
                  </span>
                </h3>
                <div className="flex items-center gap-3 mt-1.5">
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${selectedAgent?.status === t("agent.active") ? 'bg-emerald-400' : selectedAgent?.status === t("agent.standby") ? 'bg-amber-400' : 'bg-slate-400'}`}></span>
                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${selectedAgent?.status === t("agent.active") ? 'bg-emerald-500' : selectedAgent?.status === t("agent.standby") ? 'bg-amber-500' : 'bg-slate-500'}`}></span>
                    </span>
                    {selectedAgent?.status || "Unknown"}
                  </p>
                  <div className="w-px h-3 bg-slate-200 dark:bg-slate-700"></div>
                  <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400 flex items-center gap-1 bg-cyan-50 dark:bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-100 dark:border-cyan-900/50">
                    <Network className="w-3 h-3" />
                    {selectedAgent?.node || "Local"}
                  </p>
                </div>
              </div>
            </div>
            
            {/* P2: Explicit "Edit" */}
            <button className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-sm font-semibold rounded-lg shadow-md transition-all active:scale-95 shrink-0 self-start sm:self-center">
              <Pencil className="w-4 h-4" />
              {t("config.agent.edit")}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 border-t border-slate-100 dark:border-slate-800 pt-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-sky-500" /> {t("profile.identity")}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 min-h-[100px]">
                {selectedAgent?.identity || "No identity defined."}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2 mb-3">
                <BrainCircuit className="w-4 h-4 text-purple-500" /> {t("profile.soul")}
              </h4>
              <p className="text-sm italic text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 min-h-[100px]">
                {selectedAgent?.soulQuote || "No soul quote defined."}
              </p>
            </div>
          </div>

          <div className="mt-6 relative z-10">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2 mb-3">
              <Hash className="w-4 h-4 text-amber-500" /> Tags
            </h4>
            <div className="flex flex-wrap gap-2">
              {selectedAgent?.tags?.map((tag, idx) => (
                <span key={idx} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* P3: Global and other groupings */}
        <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 border-dashed">
          <div className="mb-6 flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
               <Settings2 className="w-4 h-4" />
             </div>
             <h3 className="text-lg font-bold tracking-tight">{t("config.agent.global")}</h3>
          </div>

          <div className="space-y-4">
            {/* Appearance Settings */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6">
                <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
                  <Sun className="w-4 h-4 text-slate-500" /> Appearance
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={(e) => handleThemeToggle(e, 'light')}
                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/10 text-sky-700' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                      <Sun className="w-6 h-6 text-amber-500" />
                    </div>
                    <span className="text-sm font-medium">Light</span>
                  </button>
                  
                  <button
                    onClick={(e) => handleThemeToggle(e, 'dark')}
                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-sky-500 bg-slate-800 text-sky-400' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-900 shadow-sm flex items-center justify-center border border-slate-700">
                      <Moon className="w-6 h-6 text-sky-400" />
                    </div>
                    <span className="text-sm font-medium">Dark</span>
                  </button>

                  <button
                    onClick={(e) => handleThemeToggle(e, 'system')}
                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${theme === 'system' ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/10 text-sky-700 dark:text-sky-400' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 shadow-sm flex items-center justify-center">
                      <Monitor className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                    </div>
                    <span className="text-sm font-medium">System</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Language Settings */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6">
                <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-500" /> Language
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLang(l.code)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${lang === l.code ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'}`}
                    >
                      {l.native}
                      {lang === l.code && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* WIP Settings */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold mb-1">{t("config.wip.title")}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t("config.wip.desc")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
