import { useState } from "react";
import { CheckCircle2, Play, Beaker, FileCode2, Network, ChevronDown } from "lucide-react";
import { useI18n } from "../../contexts/I18nContext";
import { useOpenClaw } from "../../contexts/OpenClawContext";

export function EvolutionView() {
  const { t } = useI18n();
  const { nodes } = useOpenClaw();
  const [activeNode, setActiveNode] = useState(nodes.length > 0 ? nodes[0].id : '');

  const currentNode = nodes.find(n => n.id === activeNode);

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col animate-in fade-in duration-300">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-1">{t("evo.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("evo.desc")}</p>
        </div>
        
        {/* Node Dropdown Selector */}
        {nodes.length > 0 && (
          <div className="relative inline-flex items-center">
            <div className="absolute left-3 pointer-events-none flex items-center justify-center">
               <Network className="w-4 h-4 text-sky-500" />
            </div>
            <select 
              value={activeNode}
              onChange={(e) => setActiveNode(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-2 pl-9 pr-10 rounded-lg shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer min-w-[220px]"
            >
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.name} {n.status === 'offline' ? '(Offline)' : ''}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute right-3 pointer-events-none" />
          </div>
        )}
      </div>

      {currentNode && (
        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/50 rounded-lg p-4 mb-6 flex items-center gap-3 shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Targeting Node: <span className="font-semibold text-slate-900 dark:text-white">{currentNode.name}</span>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 shrink-0">
         <div className="bg-white dark:bg-slate-900 border-2 border-[#0ea5e9] rounded-lg p-5 shadow-sm relative overflow-hidden transition-all hover:shadow-md cursor-pointer">
            <div className="absolute top-0 right-0 bg-[#e0f2fe] dark:bg-sky-900/50 text-[#0369a1] dark:text-sky-300 text-[11px] px-2.5 py-1 rounded-bl-lg font-bold tracking-wider">{t("evo.rec")}</div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-[#f0f9ff] dark:bg-sky-900/30 rounded-md"><CheckCircle2 className="w-5 h-5 text-[#0ea5e9]" /></div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-[15px]">{t("evo.tpl1.title")}</h3>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-5 leading-relaxed h-[60px]">{t("evo.tpl1.desc")}</p>
            <button className="w-full py-2 bg-[#f0f9ff] dark:bg-sky-900/40 text-[#0369a1] dark:text-sky-400 border border-[#bae6fd] dark:border-sky-800/50 rounded-md text-[13px] font-semibold transition-colors hover:bg-[#e0f2fe] dark:hover:bg-sky-900/60">{t("evo.tpl1.btn")}</button>
         </div>
         
         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer opacity-80">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md"><Beaker className="w-5 h-5 text-[#d97706] dark:text-amber-500" /></div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-[15px]">{t("evo.tpl2.title")}</h3>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-5 leading-relaxed h-[60px]">{t("evo.tpl2.desc")}</p>
            <button className="w-full py-2 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md text-[13px] font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">{t("evo.tpl2.btn")}</button>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm relative overflow-hidden transition-all cursor-not-allowed opacity-50">
            <div className="absolute top-0 right-0 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] px-2.5 py-1 rounded-bl-lg font-bold tracking-wider">{t("evo.dev")}</div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-md"><FileCode2 className="w-5 h-5 text-slate-600 dark:text-slate-400" /></div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-[15px]">{t("evo.tpl3.title")}</h3>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-5 leading-relaxed h-[60px]">{t("evo.tpl3.desc")}</p>
            <button className="w-full py-2 bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 rounded-md text-[13px] font-medium" disabled>{t("evo.tpl3.btn")}</button>
         </div>
      </div>

      <div className="flex-1 min-h-[300px] flex flex-col bg-[#0f172a] rounded-lg border border-slate-800 overflow-hidden shadow-lg">
         <div className="bg-[#020617] px-4 py-3 border-b border-slate-800 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 text-slate-300 font-medium text-[13px]">
              <Play className="w-4 h-4 text-[#38bdf8]" /> {t("evo.preview.title")}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-slate-500 font-mono">{t("evo.preview.stat")}</span>
              <span className="text-[12px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700 font-mono">MEMORY.md</span>
            </div>
         </div>
         <div className="p-4 overflow-auto flex-1 font-mono text-[13px] leading-relaxed">
            <div className="text-slate-500 select-none">@@ -42,7 +42,7 @@</div>
            <div className="text-slate-300 px-2">  {t("evo.preview.date")}</div>
            <div className="text-slate-300 px-2">  {t("evo.preview.ctx")}</div>
            <div className="text-slate-300 px-2"> </div>
            <div className="bg-[#450a0a] text-[#f87171] px-2 border-l-2 border-[#ef4444]"><span className="select-none mr-2">-</span> {t("evo.preview.rm")}</div>
            <div className="bg-[#052e16] text-[#4ade80] px-2 border-l-2 border-[#22c55e]"><span className="select-none mr-2">+</span> {t("evo.preview.add")}</div>
            <div className="text-slate-300 px-2"> </div>
            <div className="text-slate-300 px-2">  {t("evo.preview.action")}</div>
            <div className="text-slate-300 px-2">  {t("evo.preview.task1")}</div>
            <div className="text-slate-300 px-2">  {t("evo.preview.task2")}</div>
         </div>
      </div>
      
      <div className="mt-5 flex justify-end shrink-0">
         <button className="px-5 py-2.5 text-[13px] font-medium bg-[#0ea5e9] text-white rounded-md hover:bg-sky-600 shadow-sm flex items-center gap-2 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-[#0ea5e9] group">
           <CheckCircle2 className="w-[18px] h-[18px] group-hover:scale-110 transition-transform"/> {t("evo.apply")}
         </button>
      </div>
    </div>
  );
}
