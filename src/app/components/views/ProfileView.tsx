import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { IdCard, Cpu, Sparkles, Fingerprint, Database, Hash, ArrowRight, Activity, Terminal, Plus, ChevronRight, User, Blocks, Network } from "lucide-react";
import { useNavigate } from "react-router";
import { useI18n } from "../../contexts/I18nContext";
import { useOpenClaw } from "../../contexts/OpenClawContext";

export function ProfileView() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { agents: MOCK_AGENTS, nodes: REAL_NODES } = useOpenClaw();

  const MOCK_AGENTS_BACKUP = [
    {
      id: "c-7f8a-99x",
      name: "ClawScope AI",
      nodeId: "node-local",
      node: "OpenClaw-Local",
      avatarColor: "from-sky-400 to-blue-600",
      avatarIcon: Cpu,
      status: t("agent.active"),
      version: "v1.0.4-local",
      identity: t("agent.1.identity"),
      tags: [t("agent.1.tag.1"), t("agent.1.tag.2"), t("agent.1.tag.3")],
      soulQuote: t("agent.1.soul"),
      stats: { memory: 1024, prefs: 12, health: 85 }
    },
    {
      id: "a-3m2b-88z",
      name: "CodeReviewer",
      nodeId: "node-local",
      node: "OpenClaw-Local",
      avatarColor: "from-emerald-400 to-teal-600",
      avatarIcon: Terminal,
      status: t("agent.standby"),
      version: "v2.1.0-remote",
      identity: t("agent.2.identity"),
      tags: [t("agent.2.tag.1"), t("agent.2.tag.2"), t("agent.2.tag.3")],
      soulQuote: t("agent.2.soul"),
      stats: { memory: 8450, prefs: 5, health: 92 }
    },
    {
      id: "u-9k1c-11y",
      nodeId: "node-west",
      name: "StoryCrafter",
      node: "OpenClaw-West",
      avatarColor: "from-fuchsia-400 to-purple-600",
      avatarIcon: Sparkles,
      status: t("agent.sleeping"),
      version: "v0.9.beta",
      identity: t("agent.3.identity"),
      tags: [t("agent.3.tag.1"), t("agent.3.tag.2"), t("agent.3.tag.3")],
      soulQuote: t("agent.3.soul"),
      stats: { memory: 320, prefs: 24, health: 98 }
    }
  ];

  const [selectedAgentId, setSelectedAgentId] = useState(MOCK_AGENTS.length > 0 ? MOCK_AGENTS[0].id : (MOCK_AGENTS_BACKUP[0].id));
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayAgents = MOCK_AGENTS.length > 0 
    ? MOCK_AGENTS.map(a => {
        // Find match in backup to preserve static mock data if ID matches, else fallback
        const backup = MOCK_AGENTS_BACKUP.find(b => b.id === a.id);
        return {
          ...a,
          node: REAL_NODES?.find(n => n.id === a.nodeId)?.name || backup?.node || (a as any).nodeId || "Local",
          avatarIcon: backup?.avatarIcon || Cpu,
          version: backup?.version || "v1.0.0",
          identity: backup?.identity || "A default agent identity.",
          tags: backup?.tags || ["ai", "assistant"],
          soulQuote: backup?.soulQuote || "Ready to assist.",
          stats: backup?.stats || { memory: 0, prefs: 0, health: 100 }
        };
      })
    : MOCK_AGENTS_BACKUP;

  const activeAgent = displayAgents.find(a => a.id === selectedAgentId) || displayAgents[0];
  const Icon = activeAgent?.avatarIcon || Cpu;

  // Group agents by Node
  const groupedAgents = displayAgents.reduce((acc, agent) => {
    if (!acc[agent.node]) acc[agent.node] = [];
    acc[agent.node].push(agent);
    return acc;
  }, {} as Record<string, (typeof displayAgents)[number][]>);

  const nodeCount = Object.keys(groupedAgents).length;

  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeEl) {
        const container = scrollRef.current;
        const scrollLeft = activeEl.offsetLeft - (container.offsetWidth / 2) + (activeEl.offsetWidth / 2);
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }, [selectedAgentId]);

  return (
    <div className="max-w-[1200px] mx-auto h-full flex flex-col animate-in fade-in duration-500 pb-4 md:pb-8 text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* Top Status */}
      <div className="flex items-center justify-between mb-4 md:mb-8 shrink-0">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full md:w-auto flex items-center justify-center md:justify-start gap-2.5 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl md:rounded-full text-[13px] md:text-sm font-medium shadow-sm transition-colors"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="truncate">{t("profile.connected", nodeCount)} • {displayAgents.length} Agents</span>
        </motion.div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 gap-4 md:gap-6 min-h-0">
        
        {/* Sidebar/Mobile Scroll */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full md:w-[280px] shrink-0 flex flex-col gap-2"
        >
           <div className="hidden md:flex px-5 py-4 border border-slate-200 dark:border-slate-800 rounded-t-2xl border-b-0 items-center justify-between bg-white dark:bg-slate-900 transition-colors">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm">
                <Blocks className="w-4 h-4 text-sky-500" />
                {t("profile.agents")}
              </div>
              <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
           </div>
           
           {/* Desktop List */}
           <div className="hidden md:flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-b-2xl shadow-sm overflow-y-auto overflow-x-hidden p-3 space-y-4 flex-1 rtl:text-right hide-scrollbar">
              {Object.entries(groupedAgents).map(([nodeName, agents]) => (
                <div key={nodeName} className="flex flex-col">
                  <div className="flex items-center gap-1.5 px-2 py-1 mb-2 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700/50">
                    <Network className="w-3.5 h-3.5 text-slate-400" />
                    <span>{nodeName}</span>
                    <span className="ml-auto bg-slate-200 dark:bg-slate-700 text-[10px] px-1.5 py-0.5 rounded-md text-slate-600 dark:text-slate-300">{agents.length}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {agents.map((agent) => {
                      const isSelected = selectedAgentId === agent.id;
                      const AgentIcon = agent.avatarIcon || Cpu;
                      return (
                        <button key={agent.id} onClick={() => setSelectedAgentId(agent.id)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left rtl:text-right transition-all ${isSelected ? 'bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800/50 shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'}`}>
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${agent.avatarColor || 'from-slate-400 to-slate-600'} flex items-center justify-center shrink-0 shadow-inner ${isSelected ? 'scale-105' : 'opacity-80'}`}>
                            <AgentIcon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-[13px] font-bold truncate ${isSelected ? 'text-sky-900 dark:text-sky-300' : 'text-slate-700 dark:text-slate-300'}`}>{agent.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${agent.status === t("agent.active") ? 'bg-emerald-500' : agent.status === t("agent.standby") ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{agent.id.split('-')[0]}-{agent.id.split('-')[2]}</span>
                            </div>
                          </div>
                          {isSelected && <ChevronRight className="w-4 h-4 text-sky-500 shrink-0 rtl:rotate-180" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
           </div>

           {/* Mobile Horizontal Scroll */}
           <div className="md:hidden flex items-center justify-between mb-1 px-1">
              <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Blocks className="w-3.5 h-3.5 text-sky-500" /> {t("profile.agents")}
              </span>
              <button className="text-slate-500 hover:text-sky-500"><Plus className="w-4 h-4" /></button>
           </div>
           <div 
             ref={scrollRef}
             className="md:hidden flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 pb-2 -mx-4 px-4 scroll-smooth items-center"
           >
              {Object.entries(groupedAgents).map(([nodeName, agents]) => (
                <div key={nodeName} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/30 p-1.5 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm shrink-0">
                  <div className="flex flex-col items-center justify-center px-1.5">
                    <Network className="w-3.5 h-3.5 text-slate-400 mb-0.5" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">
                      {nodeName.replace('OpenClaw-', '')}
                    </span>
                  </div>
                  {agents.map((agent) => {
                    const isSelected = selectedAgentId === agent.id;
                    const AgentIcon = agent.avatarIcon || Cpu;
                    return (
                      <button 
                        key={agent.id} 
                        data-active={isSelected}
                        onClick={() => setSelectedAgentId(agent.id)} 
                        className={`snap-center shrink-0 flex items-center gap-2 p-1.5 pr-4 rtl:pr-1.5 rtl:pl-4 rounded-full transition-all border ${isSelected ? 'bg-white dark:bg-slate-900 border-sky-200 dark:border-sky-700 shadow-sm' : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-900/50'}`}
                      >
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${agent.avatarColor || 'from-slate-400 to-slate-600'} flex items-center justify-center shadow-inner ${isSelected ? 'scale-100' : 'opacity-70 scale-95'}`}>
                          <AgentIcon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col items-start">
                          <div className={`text-[12px] font-bold ${isSelected ? 'text-sky-900 dark:text-sky-300' : 'text-slate-600 dark:text-slate-400'}`}>{agent.name}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${agent.status === t("agent.active") ? 'bg-emerald-500' : agent.status === t("agent.standby") ? 'bg-amber-400' : 'bg-slate-300'}`} />
                            <span className="text-[10px] text-slate-400 font-mono truncate">{agent.id.split('-')[0]}-{agent.id.split('-')[2]}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
           </div>
        </motion.div>

        {/* Right Detail Card */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto md:pr-2 rtl:md:pr-0 rtl:md:pl-2 hide-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeAgent.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-4 md:gap-6"
            >
              {/* Card Body */}
              <div className="w-full bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row relative shrink-0 transition-colors">
                
                {/* Visual Identity Left */}
                <div className="w-full md:w-[320px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 flex flex-col relative overflow-hidden text-white shrink-0 items-center md:items-start text-center rtl:md:text-right rtl:md:items-end md:text-left">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:20px_20px]" />
                  
                  <div className="relative z-10 flex-1 flex flex-col items-center md:items-start rtl:md:items-end w-full">
                    <div className={`w-20 h-20 md:w-16 md:h-16 bg-gradient-to-br ${activeAgent.avatarColor || 'from-slate-400 to-slate-600'} rounded-2xl md:rounded-2xl rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.15)] mb-4 md:mb-6`}>
                        <Icon className="w-10 h-10 md:w-8 md:h-8 text-white" />
                    </div>
                    
                    <div className="mt-auto w-full flex flex-col items-center md:items-start rtl:md:items-end">
                      <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 md:mb-1">{activeAgent.name}</h2>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-slate-300 md:text-slate-400 text-xs md:text-sm font-mono mb-6 md:mb-4">
                        <div className="bg-slate-800/80 md:bg-slate-800/50 px-3 py-1.5 md:px-2 md:py-1 rounded-full md:rounded border border-slate-700 flex items-center gap-1.5 text-cyan-400">
                          <Network className="w-3.5 h-3.5" /> {activeAgent.node}
                        </div>
                        <div className="bg-slate-800/80 md:bg-slate-800/50 px-3 py-1.5 md:px-2 md:py-1 rounded-full md:rounded border border-slate-700 flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-sky-400 md:text-slate-400" /> {activeAgent.id}
                        </div>
                      </div>
                      
                      <div className="w-full flex md:flex-col justify-around md:justify-start gap-0 md:gap-3 bg-slate-950/60 md:bg-slate-950/40 p-4 rounded-2xl md:rounded-xl border border-slate-800 backdrop-blur-sm">
                        <div className="flex flex-col md:flex-row items-center gap-1.5 md:gap-2.5 text-xs text-slate-300 font-medium">
                          <Activity className={`w-5 h-5 md:w-4 md:h-4 ${activeAgent.status === t("agent.active") ? 'text-emerald-400' : activeAgent.status === t("agent.standby") ? 'text-amber-400' : 'text-slate-400'}`} />
                          <span className="hidden md:inline">{t("profile.status")}: </span>{activeAgent.status}
                        </div>
                        <div className="hidden md:block w-px h-6 bg-slate-700"></div>
                        <div className="flex flex-col md:flex-row items-center gap-1.5 md:gap-2.5 text-xs text-slate-300 font-medium">
                          <Terminal className="w-5 h-5 md:w-4 md:h-4 text-sky-400" />
                          <span className="hidden md:inline">{t("profile.core")}: </span>{activeAgent.version}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Right */}
                <div className="flex-1 p-6 md:p-10 relative flex flex-col justify-between">
                  <div>
                    {/* Identity */}
                    <div className="mb-6 md:mb-7">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 mb-3">
                        <Fingerprint className="w-5 h-5 text-sky-500" />
                        <h3 className="font-bold text-sm tracking-widest uppercase">{t("profile.identity")}</h3>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 font-medium text-[14px] md:text-[15px] leading-relaxed md:px-7 transition-colors">
                        {activeAgent.identity || "No identity set."}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-4 md:px-7">
                        {activeAgent.tags?.map(tag => (
                          <span key={tag} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-xs rounded-lg border border-slate-200 dark:border-slate-700/50 font-medium transition-colors">{tag}</span>
                        ))}
                      </div>
                    </div>

                    <div className="w-full md:w-[calc(100%-56px)] md:mx-7 h-px bg-slate-100 dark:bg-slate-800 mb-6 md:mb-7 transition-colors"></div>

                    {/* Soul */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 mb-3">
                        <Sparkles className="w-5 h-5 text-violet-500" />
                        <h3 className="font-bold text-sm tracking-widest uppercase">{t("profile.soul")}</h3>
                      </div>
                      <div className="md:mx-7 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-4 md:p-5 relative hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                          <div className="absolute top-0 left-0 rtl:left-auto rtl:right-0 w-1 h-full bg-violet-400 rounded-l-xl rtl:rounded-l-none rtl:rounded-r-xl"></div>
                          <p className="text-slate-600 dark:text-slate-300 text-[13px] md:text-[14px] leading-relaxed italic font-serif transition-colors">
                            "{activeAgent.soulQuote || "No soul quote available."}"
                          </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mt-6 md:mt-8 md:px-7">
                    <button 
                      onClick={() => navigate('/memory')}
                      className="flex-1 bg-slate-900 dark:bg-sky-600 hover:bg-black dark:hover:bg-sky-500 text-white py-3 md:py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md md:group"
                    >
                      <Database className="w-4 h-4 text-sky-400 dark:text-sky-100" />
                      {t("profile.btn.memory")}
                      <ArrowRight className="w-4 h-4 text-slate-400 dark:text-sky-100 md:group-hover:translate-x-1 rtl:md:group-hover:-translate-x-1 rtl:rotate-180 transition-transform" />
                    </button>
                    <button 
                      onClick={() => navigate('/config')}
                      className="w-full sm:w-auto px-6 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-3 md:py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <User className="w-4 h-4" />
                      {t("profile.btn.config")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-4 shrink-0 overflow-x-auto snap-x hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                <div className="min-w-[200px] md:min-w-0 snap-center bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-sky-200 dark:hover:border-sky-800 transition-colors flex-1">
                  <div>
                    <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mb-1 flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400"/> {t("profile.stat.memory")}</div>
                    <div className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">{activeAgent.stats.memory.toLocaleString()} <span className="text-xs md:text-sm text-slate-400 dark:text-slate-500 font-normal">{t("profile.unit.item")}</span></div>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center"><Activity className="w-4 h-4 md:w-5 md:h-5 text-sky-500 dark:text-sky-400"/></div>
                </div>
                <div className="min-w-[200px] md:min-w-0 snap-center bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-violet-200 dark:hover:border-violet-800 transition-colors flex-1">
                  <div>
                    <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mb-1 flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400"/> {t("profile.stat.pref")}</div>
                    <div className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">{activeAgent.stats.prefs} <span className="text-xs md:text-sm text-slate-400 dark:text-slate-500 font-normal">{t("profile.unit.piece")}</span></div>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center"><User className="w-4 h-4 md:w-5 md:h-5 text-violet-500 dark:text-violet-400"/></div>
                </div>
                <div className="min-w-[200px] md:min-w-0 snap-center bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors flex-1">
                  <div>
                    <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mb-1 flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400"/> {t("profile.stat.health")}</div>
                    <div className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">{activeAgent.stats.health}%</div>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center"><Sparkles className="w-4 h-4 md:w-5 md:h-5 text-emerald-500 dark:text-emerald-400"/></div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}



