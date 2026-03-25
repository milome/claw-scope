import { useState } from "react";
import { Search, Filter, Table, Footprints, ChevronRight, Calendar, Clock, Network, Cpu, BrainCircuit, Zap, FileDigit, Database, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "../../contexts/I18nContext";
import { useOpenClaw } from "../../contexts/OpenClawContext";

function FancyMindMap() {
  const { t } = useI18n();
  const ADVANCED_MIND_MAP = {
    core: { x: '50%', y: '50%' },
    nodes: [
      { 
        id: 'node-1', label: 'OpenClaw-Local', icon: Network, color: 'text-cyan-400', glow: 'shadow-[0_0_20px_rgba(34,211,238,0.4)]', bg: 'bg-cyan-950', border: 'border-cyan-500/50', 
        x: '30%', y: '25%', 
        agents: [
          { id: 'agt-1', label: 'Coding Agent', x: '15%', y: '15%' },
          { id: 'agt-2', label: 'Review Agent', x: '20%', y: '35%' },
          { id: 'agt-3', label: 'Terminal Agent', x: '40%', y: '10%' },
        ]
      },
      { 
        id: 'node-2', label: 'OpenClaw-East', icon: Database, color: 'text-violet-400', glow: 'shadow-[0_0_20px_rgba(167,139,250,0.4)]', bg: 'bg-violet-950', border: 'border-violet-500/50',
        x: '70%', y: '25%', 
        agents: [
          { id: 'agt-4', label: 'Scraper Agent', x: '85%', y: '15%' },
          { id: 'agt-5', label: 'DB Admin', x: '80%', y: '35%' },
        ]
      },
      { 
        id: 'node-3', label: 'OpenClaw-West', icon: Cpu, color: 'text-rose-400', glow: 'shadow-[0_0_20px_rgba(251,113,133,0.4)]', bg: 'bg-rose-950', border: 'border-rose-500/50',
        x: '30%', y: '75%', 
        agents: [
          { id: 'agt-6', label: 'Design Agent', x: '15%', y: '85%' },
          { id: 'agt-7', label: 'UX Tester', x: '25%', y: '65%' },
        ]
      },
      { 
        id: 'node-4', label: 'OpenClaw-Edge', icon: Zap, color: 'text-amber-400', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.4)]', bg: 'bg-amber-950', border: 'border-amber-500/50',
        x: '70%', y: '75%', 
        agents: [
          { id: 'agt-8', label: 'Deploy Agent', x: '85%', y: '85%' },
          { id: 'agt-9', label: 'Monitor Agent', x: '60%', y: '90%' },
        ]
      }
    ]
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-auto bg-[#020617] hide-scrollbar" dir="ltr">
      <div className="relative w-[800px] h-[600px] md:w-full md:h-full min-w-full min-h-full">
        {/* Glowing Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 md:w-96 h-64 md:h-96 bg-cyan-600/20 rounded-full blur-[80px] md:blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-64 md:w-96 h-64 md:h-96 bg-violet-600/20 rounded-full blur-[80px] md:blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
        </div>

        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {ADVANCED_MIND_MAP.nodes.map((nodeCat) => (
            <g key={`beam-${nodeCat.id}`}>
              <motion.line
                x1="50%" y1="50%" x2={nodeCat.x} y2={nodeCat.y}
                stroke="url(#gradient-core)" strokeWidth="4" strokeOpacity="0.3"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeOut" }}
              />
              <motion.line
                x1="50%" y1="50%" x2={nodeCat.x} y2={nodeCat.y}
                stroke="#334155" strokeWidth="1.5" strokeDasharray="6 6"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
              />
              {nodeCat.agents.map((agentNode, j) => (
                <g key={`branch-${agentNode.id}`}>
                  <motion.line
                    x1={nodeCat.x} y1={nodeCat.y} x2={agentNode.x} y2={agentNode.y}
                    stroke="#334155" strokeWidth="1"
                    initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.8, delay: 0.8 + j * 0.2 }}
                  />
                  <circle cx={agentNode.x} cy={agentNode.y} r="2" fill="#475569" />
                </g>
              ))}
            </g>
          ))}
          <defs>
            <linearGradient id="gradient-core" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute w-0 h-0 z-20" style={{ left: '50%', top: '50%' }}>
          <motion.div
            className="relative flex items-center justify-center w-[100px] md:w-[120px] h-[100px] md:h-[120px] -ml-[50px] md:-ml-[60px] -mt-[50px] md:-mt-[60px]"
            initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", duration: 1.5, bounce: 0.4 }}
          >
            <motion.div className="absolute inset-0 rounded-full border border-sky-500/30 border-t-sky-400 border-b-violet-400 shadow-[0_0_30px_rgba(56,189,248,0.2)]" animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} />
            <motion.div className="absolute inset-2 rounded-full border border-violet-500/20 border-l-violet-400 border-r-cyan-400" animate={{ rotate: -360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} />
            <div className="bg-[#0f172a] border border-slate-700 w-16 md:w-20 h-16 md:h-20 rounded-full flex flex-col items-center justify-center shadow-inner relative overflow-hidden group cursor-pointer hover:border-sky-400 transition-colors z-10">
                <Cpu className="w-6 h-6 md:w-7 md:h-7 text-sky-400 mb-1" />
                <span className="text-[9px] md:text-[10px] font-bold text-slate-300 tracking-widest">SOUL</span>
            </div>
          </motion.div>
        </div>

        {ADVANCED_MIND_MAP.nodes.map((nodeCat, i) => {
          const Icon = nodeCat.icon;
          return (
            <div key={nodeCat.id} className="absolute w-0 h-0 z-20" style={{ left: nodeCat.x, top: nodeCat.y }}>
              <motion.div
                className={`relative flex items-center gap-2.5 md:gap-3 ${nodeCat.bg} ${nodeCat.border} border p-2.5 md:p-3 rounded-xl ${nodeCat.glow} w-[140px] md:w-[160px] -ml-[70px] md:-ml-[80px] -mt-[26px] cursor-pointer hover:scale-105 transition-transform backdrop-blur-md`}
                initial={{ opacity: 0, scale: 0.5, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", delay: 0.4 + i * 0.15 }}
              >
                <div className="bg-black/40 p-1.5 md:p-2 rounded-lg shrink-0 border border-white/10"><Icon className={`w-4 h-4 md:w-5 md:h-5 ${nodeCat.color}`} /></div>
                <div>
                  <div className={`text-[12px] md:text-[13px] font-bold text-slate-100 tracking-wide`}>{nodeCat.label}</div>
                  <div className="text-[9px] md:text-[10px] text-slate-400 font-mono mt-0.5">{t("memory.map.agents", nodeCat.agents.length)}</div>
                </div>
              </motion.div>
            </div>
          )
        })}

        {ADVANCED_MIND_MAP.nodes.map((nodeCat) => (
          nodeCat.agents.map((agentNode, j) => (
            <div key={agentNode.id} className="absolute w-0 h-0 z-10" style={{ left: agentNode.x, top: agentNode.y }}>
              <motion.div
                className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-700 px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg text-[10px] md:text-[11px] font-medium text-slate-300 shadow-[0_4px_10px_rgba(0,0,0,0.3)] whitespace-nowrap -ml-6 -mt-4 cursor-crosshair hover:bg-slate-800 hover:border-slate-500 hover:text-white transition-all group flex items-center gap-1.5"
                initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", bounce: 0.5, delay: 1 + j * 0.1 }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500 group-hover:bg-cyan-400 transition-colors" />
                {agentNode.label}
              </motion.div>
            </div>
          ))
        ))}
      </div>
    </div>
  )
}

export function MemoryView() {
  const [viewMode, setViewMode] = useState<'table' | 'day' | 'mindmap'>('table');
  const { t } = useI18n();
  const { agents } = useOpenClaw();
  const [activeAgent, setActiveAgent] = useState(agents.length > 0 ? agents[0].id : 'all');

  const MOCK_MEMORY = [
    { id: 1, time: '2026-03-24 10:00', type: t("mem.type.1"), agent: 'c-7f8a-99x', node: 'OpenClaw-Local', summary: t("mem.sum.1"), status: 'indexed' },
    { id: 2, time: '2026-03-24 09:30', type: t("mem.type.2"), agent: 'a-3m2b-88z', node: 'OpenClaw-Local', summary: t("mem.sum.2"), status: 'indexed' },
    { id: 3, time: '2026-03-23 18:15', type: t("mem.type.3"), agent: 's-9k1c-11y', node: 'OpenClaw-East', summary: t("mem.sum.3"), status: 'processing' },
    { id: 4, time: '2026-03-23 14:00', type: t("mem.type.4"), agent: 'c-7f8a-99x', node: 'OpenClaw-Local', summary: t("mem.sum.4"), status: 'indexed' },
    { id: 5, time: '2026-03-22 11:20', type: t("mem.type.1"), agent: 'a-3m2b-88z', node: 'OpenClaw-Local', summary: t("mem.sum.5"), status: 'indexed' },
    { id: 6, time: '2026-03-21 09:05', type: t("mem.type.5"), agent: 'a-4t1c-77k', node: 'OpenClaw-Local', summary: t("mem.sum.6"), status: 'indexed' },
    { id: 7, time: '2026-03-20 16:40', type: t("mem.type.6"), agent: 's-9k1c-11y', node: 'OpenClaw-East', summary: t("mem.sum.7"), status: 'error' },
  ];

  const filteredMemory = MOCK_MEMORY.filter(item => activeAgent === 'all' || item.agent === activeAgent);

  const groupedMemory = filteredMemory.reduce((acc, curr) => {
    const date = curr.time.split(' ')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(curr);
    return acc;
  }, {} as Record<string, typeof MOCK_MEMORY>);

  const getAgentBadge = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-transparent`}>
        <Cpu className="w-3 h-3" />
        {agent.name}
      </span>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto h-full flex flex-col text-slate-900 dark:text-slate-100 transition-colors">
      <div className="mb-4 md:mb-5 shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[20px] md:text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-1">{t("memory.title")}</h1>
          <p className="text-[13px] md:text-sm text-slate-500 dark:text-slate-400">{t("memory.desc")}</p>
        </div>
        
        {/* Agent Dropdown Selector */}
        <div className="relative inline-flex items-center">
          <select 
            value={activeAgent}
            onChange={(e) => setActiveAgent(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 pl-4 pr-10 rounded-lg shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer min-w-[200px]"
          >
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.id.split('-')[0]}-{a.id.split('-')[2]})</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" />
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-4 shrink-0">
        <div className="relative w-full md:w-auto group">
          <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-sky-500 transition-colors" />
          <input type="search" placeholder={t("memory.search")} className="pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 md:py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg md:rounded-md text-[13px] md:text-sm w-full md:w-[280px] focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-900 shadow-sm transition-all" />
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner overflow-x-auto hide-scrollbar">
           <button 
             onClick={() => setViewMode('table')}
             className={`px-3 py-1.5 md:py-1.5 text-[12px] md:text-[13px] rounded-md flex-1 md:flex-none flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm font-semibold text-slate-800 dark:text-slate-100' : 'font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
           >
             <Table className={`w-[14px] h-[14px] md:w-[15px] md:h-[15px] ${viewMode === 'table' ? 'text-sky-600 dark:text-sky-400' : ''}`}/> {t("memory.view.list")}
           </button>
           <button 
             onClick={() => setViewMode('day')}
             className={`px-3 py-1.5 md:py-1.5 text-[12px] md:text-[13px] rounded-md flex-1 md:flex-none flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${viewMode === 'day' ? 'bg-white dark:bg-slate-700 shadow-sm font-semibold text-slate-800 dark:text-slate-100' : 'font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
           >
             <Footprints className={`w-[14px] h-[14px] md:w-[15px] md:h-[15px] ${viewMode === 'day' ? 'text-sky-600 dark:text-sky-400' : ''}`}/> {t("memory.view.footprint")}
           </button>
           <button 
             onClick={() => setViewMode('mindmap')}
             className={`px-3 py-1.5 md:py-1.5 text-[12px] md:text-[13px] rounded-md flex-1 md:flex-none flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${viewMode === 'mindmap' ? 'bg-white dark:bg-slate-700 shadow-sm font-semibold text-slate-800 dark:text-slate-100' : 'font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
           >
             <Network className={`w-[14px] h-[14px] md:w-[15px] md:h-[15px] ${viewMode === 'mindmap' ? 'text-sky-600 dark:text-sky-400' : ''}`}/> {t("memory.view.map")}
           </button>
        </div>
        
        <div className="flex-1 hidden md:block"></div>
        
        <button className="px-3.5 py-2 md:py-1.5 bg-slate-900 dark:bg-sky-600 text-white rounded-lg md:rounded-md text-[13px] font-medium flex items-center justify-center gap-1.5 hover:bg-slate-800 dark:hover:bg-sky-500 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 active:scale-95 w-full md:w-auto">
          <Filter className="w-4 h-4"/> {t("memory.filter")}
        </button>
      </div>

      <div className={`rounded-xl md:rounded-lg overflow-hidden flex-1 flex flex-col relative transition-colors duration-500 min-h-[400px] ${viewMode === 'mindmap' ? 'bg-[#020617] border border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.2)]' : 'bg-transparent md:bg-white md:dark:bg-slate-900 border-none md:border md:border-slate-200 md:dark:border-slate-800 md:shadow-sm'}`}>
        <AnimatePresence mode="wait">
          
          {viewMode === 'table' && (
            <motion.div 
              key="view-table"
              className="absolute inset-0 flex flex-col"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}
            >
              {/* Desktop Table View */}
              <div className="hidden md:flex flex-col flex-1 overflow-auto bg-white dark:bg-slate-900 relative">
                {filteredMemory.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl m-4">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">No memories found</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Try adjusting your filters or search query.</p>
                  </div>
                ) : (
                  <table className="w-full text-[13px] text-left rtl:text-right whitespace-nowrap bg-white dark:bg-slate-900">
                    <thead className="bg-[#f8fafc] dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10 shadow-[0_1px_0_rgba(226,232,240,1)] dark:shadow-[0_1px_0_rgba(30,41,59,1)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold w-[160px]">{t("memory.table.time")}</th>
                        <th className="px-4 py-3 font-semibold w-[140px]">{t("memory.table.type")}</th>
                        <th className="px-4 py-3 font-semibold w-[160px]">{t("memory.table.node")}</th>
                        <th className="px-4 py-3 font-semibold w-[120px]">{t("memory.table.agent")}</th>
                        <th className="px-4 py-3 font-semibold min-w-[300px]">{t("memory.table.summary")}</th>
                        <th className="px-4 py-3 font-semibold w-[80px] text-center">{t("memory.table.status")}</th>
                        <th className="px-4 py-3 font-semibold w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredMemory.map((item) => (
                        <tr key={item.id} className="hover:bg-[#f0f9ff] dark:hover:bg-slate-800 cursor-pointer transition-colors group focus-within:bg-sky-50 dark:focus-within:bg-slate-800" tabIndex={0}>
                           <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs" dir="ltr">{item.time}</td>
                           <td className="px-4 py-3">
                             <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium">{item.type}</span>
                           </td>
                           <td className="px-4 py-3">
                             <span className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 px-2 py-1 rounded-md border border-cyan-100 dark:border-cyan-800/50">
                               <Network className="w-3 h-3" />
                               {item.node}
                             </span>
                           </td>
                           <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{getAgentBadge(item.agent)}</td>
                           <td className="px-4 py-3 text-slate-900 dark:text-slate-100 truncate max-w-[400px]" title={item.summary}>{item.summary}</td>
                           <td className="px-4 py-3 text-center">
                             {item.status === 'indexed' && <div className="w-2 h-2 rounded-full bg-[#16a34a] mx-auto" title={t("memory.status.indexed")}></div>}
                             {item.status === 'processing' && <div className="w-2 h-2 rounded-full bg-[#d97706] mx-auto animate-pulse" title={t("memory.status.processing")}></div>}
                             {item.status === 'error' && <div className="w-2 h-2 rounded-full bg-[#dc2626] mx-auto" title={t("memory.status.error")}></div>}
                           </td>
                           <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                             <button className="text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 p-1 rounded hover:bg-sky-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"><ChevronRight className="w-4 h-4 rtl:rotate-180" /></button>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden flex-1 overflow-auto hide-scrollbar -mx-4 px-4 pb-4 space-y-3">
                 {filteredMemory.length === 0 ? (
                   <div className="flex flex-col items-center justify-center p-8 mt-4 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                     <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                       <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                     </div>
                     <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">No memories found</h3>
                     <p className="text-xs text-slate-500 dark:text-slate-400">Try adjusting your filters.</p>
                   </div>
                 ) : (
                   filteredMemory.map((item) => (
                     <div key={item.id} tabIndex={0} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-sky-500 transition-transform relative overflow-hidden group cursor-pointer">
                       <div className="flex justify-between items-start mb-2.5">
                         <div className="flex flex-col gap-1.5">
                           <div className="flex items-center gap-2">
                             {getAgentBadge(item.agent)}
                           </div>
                           <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium flex items-center gap-1">
                             <Network className="w-3 h-3" /> {item.node}
                           </span>
                         </div>
                         <span className="text-[11px] text-slate-400 font-mono bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded" dir="ltr">{item.time.split(' ')[1]}</span>
                       </div>
                       <p className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed mb-4 line-clamp-3">{item.summary}</p>
                       <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                         <span className="text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 px-2 py-0.5 rounded flex items-center gap-1">
                           <FileDigit className="w-3 h-3"/> {item.type}
                         </span>
                         <div className="flex items-center gap-1.5 text-[11px] font-medium">
                           {item.status === 'indexed' && <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span className="text-emerald-600 dark:text-emerald-400">{t("memory.status.indexed")}</span></>}
                           {item.status === 'processing' && <><div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div><span className="text-amber-600 dark:text-amber-400">{t("memory.status.processing")}</span></>}
                           {item.status === 'error' && <><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div><span className="text-red-600 dark:text-red-400">{t("memory.status.error")}</span></>}
                         </div>
                       </div>
                     </div>
                   ))
                 )}
              </div>

              <div className="hidden md:flex bg-[#f8fafc] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 justify-between items-center shrink-0">
                 <span>{t("memory.page.info", filteredMemory.length)}</span>
                 <div className="flex gap-1.5">
                   <button disabled className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-sm">{t("memory.page.prev")}</button>
                   <button className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 active:scale-95 transition-all">{t("memory.page.next")}</button>
                 </div>
              </div>
            </motion.div>
          )}

           {viewMode === 'day' && (
            <motion.div 
              key="view-day"
              className="absolute inset-0 overflow-auto bg-transparent md:bg-slate-50/50 md:dark:bg-slate-900/50 md:p-6 hide-scrollbar"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}
            >
               <div className="max-w-3xl mx-auto -mx-4 md:mx-auto px-2 md:px-0">
                  {Object.keys(groupedMemory).length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 mt-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mx-4 shadow-sm">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Footprints className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">No footprint found</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">There are no memory footprints for the current selection.</p>
                    </div>
                  ) : (
                    <div className="relative border-l-[2px] rtl:border-l-0 rtl:border-r-[2px] border-slate-200 dark:border-slate-800 ml-4 rtl:ml-0 rtl:mr-4 md:ml-8 rtl:md:mr-8 space-y-8 md:space-y-10 pb-8 pt-2">
                      {Object.entries(groupedMemory).map(([date, items]) => (
                        <div key={date} className="relative pl-6 rtl:pl-0 rtl:pr-6 md:pl-10 rtl:md:pr-10">
                          <div className="absolute -left-[15px] rtl:left-auto rtl:-right-[15px] md:-left-[17px] rtl:md:-right-[17px] top-0 w-7 h-7 md:w-8 md:h-8 bg-white dark:bg-slate-800 border-[2px] border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center shadow-sm z-10">
                            <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-sky-500" />
                          </div>
                          <div className="mb-4 md:mb-5 flex items-center gap-3 pt-0.5 md:pt-1">
                            <h3 className="text-[15px] md:text-[16px] font-bold text-slate-800 dark:text-slate-200 tracking-tight" dir="ltr">{date}</h3>
                            <span className="text-[10px] md:text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200/80 dark:border-slate-700">
                              {t("memory.day.items", items.length)}
                            </span>
                          </div>
                          <div className="space-y-3 md:space-y-4">
                            {items.map((item) => (
                              <div key={item.id} className="relative group outline-none" tabIndex={0}>
                                <div className="absolute -left-[29.5px] rtl:left-auto rtl:-right-[29.5px] md:-left-[45px] rtl:md:-right-[45px] top-[16px] md:top-[20px] w-2.5 h-2.5 md:w-3 md:h-3 bg-white dark:bg-slate-800 border-[2px] md:border-[2.5px] border-slate-300 dark:border-slate-600 rounded-full z-10 group-hover:border-sky-400 group-focus:border-sky-500 transition-colors"></div>
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl md:rounded-lg p-3.5 md:p-4 shadow-sm md:hover:border-sky-300 dark:md:hover:border-sky-700 group-focus:ring-2 group-focus:ring-sky-500 transition-all cursor-pointer">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5 md:gap-2">
                                      <span className="text-[10px] md:text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1" dir="ltr">
                                        <Clock className="w-2.5 h-2.5 md:w-3 md:h-3"/> {item.time.split(' ')[1]}
                                      </span>
                                      <span className="text-[10px] font-medium text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/20 px-1.5 py-0.5 rounded border border-cyan-100 dark:border-cyan-800/50 flex items-center gap-1">
                                        <Network className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                        <span className="max-w-[70px] md:max-w-none truncate">{item.node}</span>
                                      </span>
                                      {getAgentBadge(item.agent)}
                                    </div>
                                    <span className="text-[10px] md:text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 px-1.5 md:px-2 py-0.5 rounded">
                                      {item.type}
                                    </span>
                                  </div>
                                  <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">{item.summary}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
               </div>
            </motion.div>
          )}

          {viewMode === 'mindmap' && (
             <motion.div 
               key="view-mindmap"
               className="absolute inset-0 rounded-xl md:rounded-none overflow-hidden"
               initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, filter: "blur(10px)" }} transition={{ duration: 0.4 }}
             >
                <div className="absolute top-0 inset-x-0 h-10 md:h-12 bg-gradient-to-b from-[#020617] to-transparent z-30 flex items-center px-4 md:px-6 pointer-events-none">
                   <div className="flex items-center gap-2 text-cyan-400">
                     <BrainCircuit className="w-3.5 h-3.5 md:w-4 md:h-4 animate-pulse" />
                     <span className="text-[10px] md:text-[11px] font-mono tracking-widest uppercase opacity-80" dir="ltr">Neural Mapping Active</span>
                   </div>
                </div>
                <FancyMindMap />
             </motion.div>
          )}
        </AnimatePresence>
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

