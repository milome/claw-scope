import { useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";
import {
  CheckCircle2, Play, AlertTriangle, Network,
  ChevronDown, Activity, History, Undo2, ShieldAlert, Database,
  Split, Search, Loader2, Cpu, X, Server, Check, Flame, FileCode2
} from "lucide-react";
import { useI18n } from "../../contexts/I18nContext";
import {
  evolutionAuditSummary,
  evolutionCancel,
  evolutionExecuteStart,
  evolutionHistoryList,
  evolutionOperationStatus,
  evolutionPreview,
  evolutionRollback,
  gatewayExportMarkdownDocumentQuick,
  gatewayExportMarkdownDocument,
  gatewayAgentMemoryGet,
  isTauriRuntimeAvailable,
  useOpenClaw,
  type EvolutionAuditSummary,
  type EvolutionCustomTemplateInput,
  type EvolutionExecuteResult,
  type EvolutionHistoryEntry,
  type EvolutionKnowledgeInjectionInput,
  type EvolutionOperationStatusSnapshot,
  type EvolutionPreviewChange,
  type EvolutionPreviewResult,
  type EvolutionTemplateKind,
} from "../../contexts/OpenClawContext";

import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { MemoryTopologyGraph } from "./MemoryTopologyGraph";
import { EvolutionHistorySheet } from "./EvolutionHistorySheet";
import { buildEvolutionAuditReportMarkdown } from "./evolutionAuditReport";

type EvoState = "idle" | "analyzing" | "diff-ready" | "executing" | "success" | "failed" | "cancelled";
type TemplateType = EvolutionTemplateKind | null;

function normalizeUiErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error;
    }
    if (typeof record.code === "string" && record.code.trim()) {
      return record.code;
    }
  }
  return "Evolution request failed";
}

function formatRelativeTime(createdAtMs: number) {
  const diffMs = Date.now() - createdAtMs;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hrs ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
}

function formatHistoryStatus(entry: EvolutionHistoryEntry) {
  switch (entry.status) {
    case "rolled_back":
      return "Rolled Back";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Success";
  }
}

function formatTemplateLabel(template: EvolutionTemplateKind | null) {
  switch (template) {
    case "aggressive":
      return "激进型重构";
    case "knowledge_injection":
      return "知识注入";
    case "custom_template":
      return "自定义模板";
    case "conservative":
    default:
      return "保守型修剪";
  }
}

function mapRuntimeStateToViewState(
  snapshot: EvolutionOperationStatusSnapshot,
): EvoState {
  switch (snapshot.runtimeState) {
    case "succeeded":
      return "success";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "running":
      return "executing";
    case "preview_ready":
    default:
      return "diff-ready";
  }
}

function mapRuntimePhaseToStep(phase: EvolutionOperationStatusSnapshot["phase"]) {
  switch (phase) {
    case "validating_preview":
    case "snapshotting":
      return 0;
    case "applying_changes":
      return 1;
    case "reindexing":
      return 2;
    case "finalizing":
    case "completed":
    case "failed":
    case "cancelled":
      return 3;
    case "preview_ready":
    default:
      return -1;
  }
}

export function EvolutionView() {
  const { t } = useI18n();
  const { nodes, agents, isConnected } = useOpenClaw();
  const evolutionNodes = isConnected && agents.length > 0
    ? agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        status: agent.status === "sleeping" ? "offline" as const : "online" as const,
      }))
    : nodes.length > 0
      ? nodes
    : [
        { id: "node-local", name: "OpenClaw-Local", status: "online" as const },
        { id: "node-east", name: "OpenClaw-East", status: "online" as const },
        { id: "node-west", name: "OpenClaw-West", status: "offline" as const },
      ];

  const [activeNode, setActiveNode] = useState(evolutionNodes.length > 0 ? evolutionNodes[0].id : "");
  const [template, setTemplate] = useState<TemplateType>(null);
  const [state, setState] = useState<EvoState>("idle");
  const [execStep, setExecStep] = useState(-1);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("diff");
  const [previewResult, setPreviewResult] = useState<EvolutionPreviewResult | null>(null);
  const [historyEntries, setHistoryEntries] = useState<EvolutionHistoryEntry[]>([]);
  const [latestResult, setLatestResult] = useState<EvolutionExecuteResult["historyEntry"] | EvolutionHistoryEntry | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<EvolutionOperationStatusSnapshot | null>(null);
  const [activeOperationId, setActiveOperationId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [knowledgeSourceRef, setKnowledgeSourceRef] = useState("");
  const [knowledgeAdditionalSourcesInput, setKnowledgeAdditionalSourcesInput] = useState("");
  const [knowledgeTagsInput, setKnowledgeTagsInput] = useState("");
  const [knowledgeBody, setKnowledgeBody] = useState("");
  const [customSourceRef, setCustomSourceRef] = useState("custom://playbook");
  const [customAdditionalSourcesInput, setCustomAdditionalSourcesInput] = useState("");
  const [customTagsInput, setCustomTagsInput] = useState("custom, safe");
  const [lastCustomAppendSourceRef, setLastCustomAppendSourceRef] = useState<string | null>(null);
  const [customScriptBody, setCustomScriptBody] = useState(
    '{\n  "mode": "append_block",\n  "title": "Custom Knowledge Block",\n  "content": "Use this declarative sandbox to append managed memory context."\n}',
  );
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
  const [historySheetSelectionId, setHistorySheetSelectionId] = useState<string | null>(null);
  const [auditSummary, setAuditSummary] = useState<EvolutionAuditSummary | null>(null);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const terminalToastKeyRef = useRef<string | null>(null);

  const executionSteps = [
    { id: 0, label: t("evo.step.0.label"), desc: t("evo.step.0.desc") },
    { id: 1, label: t("evo.step.1.label"), desc: t("evo.step.1.desc") },
    { id: 2, label: t("evo.step.2.label"), desc: t("evo.step.2.desc") },
    { id: 3, label: t("evo.step.3.label"), desc: t("evo.step.3.desc") },
  ];

  const currentNode = evolutionNodes.find((n) => n.id === activeNode);
  const knowledgeCapabilityTags = useMemo(
    () =>
      knowledgeTagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [knowledgeTagsInput],
  );
  const knowledgeAdditionalSources = useMemo(
    () =>
      knowledgeAdditionalSourcesInput
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [knowledgeAdditionalSourcesInput],
  );
  const knowledgeInput =
    template === "knowledge_injection"
      ? ({
          sourceRef: knowledgeSourceRef.trim(),
          additionalSourceRefs: knowledgeAdditionalSources,
          knowledgeBody: knowledgeBody.trim(),
          capabilityTags: knowledgeCapabilityTags,
        } satisfies EvolutionKnowledgeInjectionInput)
      : undefined;
  const canPreviewKnowledgeInjection =
    !!knowledgeInput?.sourceRef && !!knowledgeInput.knowledgeBody;
  const customCapabilityTags = useMemo(
    () =>
      customTagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [customTagsInput],
  );
  const customAdditionalSources = useMemo(
    () =>
      customAdditionalSourcesInput
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [customAdditionalSourcesInput],
  );
  const customInput =
    template === "custom_template"
      ? ({
          sourceRef: customSourceRef.trim(),
          additionalSourceRefs: customAdditionalSources,
          scriptBody: customScriptBody.trim(),
          capabilityTags: customCapabilityTags,
        } satisfies EvolutionCustomTemplateInput)
      : undefined;
  const canPreviewCustomTemplate =
    !!customInput?.sourceRef && !!customInput.scriptBody;

  const loadKnowledgeExample = () => {
    const uniqueSource = `playbook://memory-search-v1/${Date.now()}`;
    setTemplate("knowledge_injection");
    setKnowledgeSourceRef(uniqueSource);
    setKnowledgeAdditionalSourcesInput("doc://team-playbook, qmd://memory-search-notes");
    setKnowledgeTagsInput("memory, search, retrieval");
    setKnowledgeBody(
      "Use memory_search before local fallback. Index rebuild is required after new memory ingestion.",
    );
    setPreviewResult(null);
    setActionError(null);
    setState("idle");
    setExecStep(-1);
  };

  const loadCustomTemplateExample = () => {
    const uniqueSource = `custom://playbook/${Date.now()}`;
    setLastCustomAppendSourceRef(uniqueSource);
    setTemplate("custom_template");
    setCustomSourceRef(uniqueSource);
    setCustomAdditionalSourcesInput("custom://shared-playbook");
    setCustomTagsInput("custom, safe");
    setCustomScriptBody(
      '{\n  "mode": "append_block",\n  "title": "Custom Knowledge Block",\n  "content": "Use this declarative sandbox to append managed memory context."\n}',
    );
    setPreviewResult(null);
    setActionError(null);
    setState("idle");
    setExecStep(-1);
  };

  const loadCustomTemplateRemoveExample = () => {
    const targetSource = lastCustomAppendSourceRef ?? "custom://playbook/pending-remove";
    setTemplate("custom_template");
    setCustomSourceRef(targetSource);
    setCustomAdditionalSourcesInput(`custom://remove-contract/${Date.now()}`);
    setCustomTagsInput("custom, cleanup, remove");
    setCustomScriptBody(
      `{\n  "mode": "remove_blocks_by_source_ref",\n  "source_ref": "${targetSource}"\n}`,
    );
    setPreviewResult(null);
    setActionError(null);
    setState("idle");
    setExecStep(-1);
  };

  const loadAudit = async (agentId: string) => {
    setIsAuditLoading(true);
    try {
      const summary = await evolutionAuditSummary(agentId);
      setAuditSummary(summary);
    } catch {
      setAuditSummary(null);
    } finally {
      setIsAuditLoading(false);
    }
  };

  const handleExportAuditReport = async () => {
    if (!auditSummary) {
      toast.error("当前没有可导出的 Evolution 审计数据。");
      return;
    }

    const lines = buildEvolutionAuditReportMarkdown(auditSummary, {
      generatedAt: new Date(),
      reportMode: "manual",
    });

    try {
      const result = await gatewayExportMarkdownDocument(
        `evolution-audit-${auditSummary.agentId}.md`,
        lines,
      );
      if (result) {
        toast.success(`审计报告已导出：${result}`);
      } else {
        toast.info("已取消导出。");
      }
    } catch (error) {
      toast.error(normalizeUiErrorMessage(error));
    }
  };

  const handleQuickExportAuditReport = async () => {
    if (!auditSummary) {
      toast.error("当前没有可导出的 Evolution 审计数据。");
      return;
    }

    const lines = buildEvolutionAuditReportMarkdown(auditSummary, {
      generatedAt: new Date(),
      reportMode: "quick",
    });

    try {
      const result = await gatewayExportMarkdownDocumentQuick(
        `evolution-audit-${auditSummary.agentId}.md`,
        lines,
      );
      toast.success(`审计报告已快速导出：${result}`);
    } catch (error) {
      toast.error(normalizeUiErrorMessage(error));
    }
  };

  useEffect(() => {
    if (!currentNode && evolutionNodes.length > 0) {
      setActiveNode(evolutionNodes[0].id);
    }
  }, [currentNode, evolutionNodes]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      if (!isConnected || agents.length === 0 || !activeNode) {
        setHistoryEntries([]);
        setLatestResult(null);
        setAuditSummary(null);
        return;
      }

      setIsHistoryLoading(true);
      try {
        const [nextHistory, nextAudit] = await Promise.all([
          evolutionHistoryList(activeNode),
          evolutionAuditSummary(activeNode).catch(() => null),
        ]);
        if (cancelled) {
          return;
        }
        setHistoryEntries(nextHistory);
        setLatestResult(nextHistory[0] ?? null);
        setHistorySheetSelectionId(nextHistory[0]?.operationId ?? null);
        setAuditSummary(nextAudit);
      } catch (error) {
        if (!cancelled) {
          toast.error(normalizeUiErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
          setIsAuditLoading(false);
        }
      }
    };

    setIsAuditLoading(true);
    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [activeNode, agents.length, isConnected]);

  const applyRuntimeSnapshot = (snapshot: EvolutionOperationStatusSnapshot) => {
    setRuntimeStatus(snapshot);
    setExecStep(mapRuntimePhaseToStep(snapshot.phase));
    setState(mapRuntimeStateToViewState(snapshot));

    if (snapshot.historyEntry) {
      setLatestResult(snapshot.historyEntry);
      setHistorySheetSelectionId(snapshot.historyEntry.operationId);
      setHistoryEntries((current) => [
        snapshot.historyEntry as EvolutionHistoryEntry,
        ...current.filter(
          (entry) => entry.operationId !== snapshot.historyEntry?.operationId,
        ),
      ]);
      void loadAudit(snapshot.agentId);
    }

    if (
      snapshot.runtimeState === "succeeded" ||
      snapshot.runtimeState === "failed" ||
      snapshot.runtimeState === "cancelled"
    ) {
      setActiveOperationId(null);
      if (terminalToastKeyRef.current !== snapshot.operationId) {
        terminalToastKeyRef.current = snapshot.operationId;
        if (snapshot.runtimeState === "succeeded") {
          toast.success(snapshot.message);
        } else if (snapshot.runtimeState === "cancelled") {
          toast.info(snapshot.message);
        } else {
          toast.error(snapshot.message);
        }
      }
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    if (!activeOperationId) {
      return;
    }

    let disposed = false;
    let unlisten: UnlistenFn | null = null;
    let intervalId: number | undefined;

    const fetchStatus = async () => {
      try {
        const nextStatus = await evolutionOperationStatus(activeOperationId);
        if (!disposed) {
          applyRuntimeSnapshot(nextStatus);
        }
      } catch (error) {
        if (!disposed) {
          const message = normalizeUiErrorMessage(error);
          setActionError(message);
          setState("failed");
        }
      }
    };

    void fetchStatus();

    if (isTauriRuntimeAvailable()) {
      void listen<EvolutionOperationStatusSnapshot>( "evolution://status", (event) => {
        if (disposed) {
          return;
        }
        const payload = event.payload;
        if (payload.operationId === activeOperationId) {
          applyRuntimeSnapshot(payload);
        }
      }).then((dispose) => {
        unlisten = dispose;
      });
    }

    intervalId = window.setInterval(() => {
      void fetchStatus();
    }, 700);

    return () => {
      disposed = true;
      if (typeof intervalId === "number") {
        window.clearInterval(intervalId);
      }
      if (unlisten) {
        unlisten();
      }
    };
  }, [activeOperationId]);

  const diffGroups = useMemo(() => {
    const changes = previewResult?.changes ?? [];
    return {
      highRisk: changes.filter((change) => change.group === "high-risk"),
      regular: changes.filter((change) => change.group !== "high-risk"),
    };
  }, [previewResult]);

  const resolvePreviewTarget = async () => {
    if (!isConnected || agents.length === 0) {
      return currentNode;
    }

    const candidateIds = [activeNode, ...agents.map((agent) => agent.id).filter((agentId) => agentId !== activeNode)];
    for (const candidateId of candidateIds) {
      try {
        const memory = await gatewayAgentMemoryGet(candidateId);
        const hasMemoryDocument = memory.documents.some(
          (document) => !document.missing && typeof document.content === "string" && document.content.length > 0,
        );
        if (!hasMemoryDocument) {
          continue;
        }

        const candidate = evolutionNodes.find((node) => node.id === candidateId);
        if (candidate) {
          if (candidateId !== activeNode) {
            setActiveNode(candidateId);
          }
          return candidate;
        }
      } catch {
        // Ignore agents that cannot expose a writable MEMORY document.
      }
    }

    return currentNode;
  };

  const handlePreview = async () => {
    if (!activeNode || !template) return;
    if (!isConnected || agents.length === 0 || !currentNode) {
      toast.error(t("evo.connection.required"));
      return;
    }

    setActiveTab("diff");
    setActionError(null);
    setPreviewResult(null);
    setRuntimeStatus(null);
    setActiveOperationId(null);
    setState("analyzing");
    setExecStep(-1);

    try {
      const target = await resolvePreviewTarget();
      if (!target) {
        throw new Error(t("evo.connection.required"));
      }

      const preview = await evolutionPreview(
        target.id,
        target.name,
        template,
        knowledgeInput,
        customInput,
      );
      setPreviewResult(preview);
      setState("diff-ready");
    } catch (error) {
      const message = normalizeUiErrorMessage(error);
      setActionError(message);
      setState("failed");
      toast.error(message);
    }
  };

  const handleExecuteClick = () => {
    if (!previewResult) {
      return;
    }
    if (previewResult.riskLevel === "high") {
      setIsConfirmOpen(true);
    } else {
      void startExecution();
    }
  };

  const startExecution = async () => {
    if (!previewResult) {
      return;
    }

    setIsConfirmOpen(false);
    setActionError(null);
    setState("executing");
    setExecStep(0);
    terminalToastKeyRef.current = null;

    try {
      const nextStatus = await evolutionExecuteStart(
        previewResult.operationId,
        previewResult.riskLevel === "high",
      );
      setActiveOperationId(nextStatus.operationId);
      applyRuntimeSnapshot(nextStatus);
    } catch (error) {
      const message = normalizeUiErrorMessage(error);
      setActionError(message);
      setState("failed");
      void loadAudit(previewResult.agentId);
      toast.error(message);
    }
  };

  const handleCancelExecution = async () => {
    if (!activeOperationId || !runtimeStatus?.canCancel) {
      return;
    }

    setIsCancelling(true);
    try {
      const nextStatus = await evolutionCancel(activeOperationId);
      applyRuntimeSnapshot(nextStatus);
    } catch (error) {
      const message = normalizeUiErrorMessage(error);
      setActionError(message);
      toast.error(message);
      setIsCancelling(false);
    }
  };

  const handleRollback = async (entry: EvolutionHistoryEntry) => {
    try {
      const result = await evolutionRollback(entry.agentId, entry.snapshotId);
      setLatestResult(result.historyEntry);
      setHistorySheetSelectionId(result.historyEntry.operationId);
      setHistoryEntries((current) => [result.historyEntry, ...current]);
      void loadAudit(entry.agentId);
      setState("success");
      toast.success(`${t("evo.rollback.success")}: ${result.restoredSnapshotId}`);
    } catch (error) {
      const message = normalizeUiErrorMessage(error);
      setActionError(message);
      setState("failed");
      toast.error(message);
    }
  };

  const DiffGroup = ({
    title,
    color,
    items,
    icon: Icon,
  }: {
    title: string;
    color: string;
    items: EvolutionPreviewChange[];
    icon: typeof AlertTriangle;
  }) => (
    <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h3 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${color === "red" ? "text-red-600 dark:text-red-400" : color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-sky-600 dark:text-sky-400"}`}>
        <Icon className="w-4 h-4" /> {title}
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="overflow-hidden rounded-md border border-slate-200 bg-white transition-all hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/80 dark:shadow-[0_14px_32px_rgba(2,6,23,0.2)] dark:hover:border-slate-700">
            <div className="flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/95">
              <div className="flex items-center gap-3">
                <span className={`w-1.5 h-1.5 rounded-full ${item.type === "delete" ? "bg-red-500" : item.type === "insert" ? "bg-emerald-500" : "bg-sky-500"}`} />
                <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{item.title}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-600" />
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-3 pb-3 pt-1 text-xs dark:border-slate-800/70 dark:bg-slate-950/75">
              <div className="grid grid-cols-[80px_1fr] gap-2 mb-2 mt-2">
                <span className="text-slate-500 dark:text-slate-500">{t("evo.diff.details")}</span>
                <span className="text-slate-700 dark:text-slate-300">{item.desc}</span>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <span className="text-slate-500 dark:text-slate-500">{t("evo.diff.impact")}</span>
                <span className={`${item.group === "high-risk" ? "font-medium text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"}`}>{item.impact}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-300 flex h-full w-full overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-200">
      <div className="z-10 flex w-[320px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:shadow-[2px_0_15px_rgba(0,0,0,0.35)]">
        <div className="p-5 flex flex-col h-full overflow-y-auto custom-scrollbar">
          <div className="mb-6">
            <h1 className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              <Server className="w-5 h-5 text-sky-500" /> {t("evo.title")}
            </h1>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t("evo.workbench.desc")}</p>
          </div>

          <div className="space-y-6 flex-1">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">{t("evo.target.node")}</label>
              <div className="relative">
                <div className="absolute left-3 top-2.5 pointer-events-none">
                  <Network className="w-4 h-4 text-sky-500" />
                </div>
                <select
                  value={activeNode}
                  onChange={(e) => setActiveNode(e.target.value)}
                  disabled={state !== "idle" && state !== "diff-ready"}
                  className="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-10 text-sm text-slate-900 transition-colors focus:border-sky-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="" disabled>{t("evo.target.select")}</option>
                  {evolutionNodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.name} {n.status === "offline" ? t("evo.target.offline") : ""}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-600" />
              </div>
            </div>

            <div>
              <label className="mb-2 flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">
                {t("evo.template")}
                <span className="cursor-default lowercase text-sky-500/70">
                  {template === "knowledge_injection"
                    ? "knowledge"
                    : template === "aggressive"
                      ? "aggressive"
                      : template === "conservative"
                        ? "conservative"
                        : "capability-ready"}
                </span>
              </label>

              <div className="grid grid-cols-1 gap-3">
                <div
                  className={`relative cursor-pointer rounded-lg border p-3.5 transition-all duration-200 ${template === "conservative" ? "border-sky-200 bg-sky-50 shadow-sm dark:border-sky-500/50 dark:bg-sky-950/20 dark:shadow-[0_0_15px_rgba(14,165,233,0.1)]" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-900"}`}
                  onClick={() => {
                    if (state === "idle" || state === "diff-ready" || state === "failed" || state === "success") {
                      setTemplate("conservative");
                      setPreviewResult(null);
                      setActionError(null);
                      setState("idle");
                      setExecStep(-1);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldAlert className={`w-4 h-4 ${template === "conservative" ? "text-sky-400" : "text-slate-500"}`} />
                    <span className={`text-sm font-medium ${template === "conservative" ? "text-sky-700 dark:text-sky-100" : "text-slate-700 dark:text-slate-300"}`}>{t("evo.template.conservative.title")}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">{t("evo.template.conservative.desc")}</p>
                </div>

                <div
                  className={`relative cursor-pointer rounded-lg border p-3.5 transition-all duration-200 ${template === "aggressive" ? "border-red-200 bg-red-50 shadow-sm dark:border-red-500/50 dark:bg-red-950/20 dark:shadow-[0_0_15px_rgba(239,68,68,0.1)]" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-900"}`}
                  onClick={() => {
                    if (state === "idle" || state === "diff-ready" || state === "failed" || state === "success") {
                      setTemplate("aggressive");
                      setPreviewResult(null);
                      setActionError(null);
                      setState("idle");
                      setExecStep(-1);
                    }
                  }}
                >
                  {template === "aggressive" ? (
                    <div className="absolute top-3 right-3 flex space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 mb-1.5">
                    <Flame className={`w-4 h-4 ${template === "aggressive" ? "text-red-400" : "text-slate-500"}`} />
                    <span className={`text-sm font-medium ${template === "aggressive" ? "text-red-700 dark:text-red-100" : "text-slate-700 dark:text-slate-300"}`}>{t("evo.template.aggressive.title")}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">{t("evo.template.aggressive.desc")}</p>
                </div>

                <div
                  className={`relative cursor-pointer rounded-lg border p-3.5 transition-all duration-200 ${
                    template === "knowledge_injection"
                      ? "border-violet-200 bg-violet-50 shadow-sm dark:border-violet-500/50 dark:bg-violet-950/20 dark:shadow-[0_0_15px_rgba(139,92,246,0.12)]"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                  }`}
                  onClick={() => {
                    if (state === "idle" || state === "diff-ready" || state === "failed" || state === "success") {
                      setTemplate("knowledge_injection");
                      setPreviewResult(null);
                      setActionError(null);
                      setState("idle");
                      setExecStep(-1);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Database className={`w-4 h-4 ${template === "knowledge_injection" ? "text-violet-500" : "text-slate-600"}`} />
                    <span className={`font-medium text-[13px] ${template === "knowledge_injection" ? "text-violet-700 dark:text-violet-100" : "text-slate-500 dark:text-slate-400"}`}>{t("evo.template.knowledge.title")}</span>
                    <Badge className={`ml-auto text-[9px] uppercase tracking-wider ${
                      template === "knowledge_injection"
                        ? "border-violet-200 bg-white text-violet-600 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300"
                        : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
                    }`}>
                      live
                    </Badge>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">{t("evo.template.knowledge.desc")}</p>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-violet-200 bg-white/90 text-violet-700 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-950/30"
                      onClick={(event) => {
                        event.stopPropagation();
                        loadKnowledgeExample();
                      }}
                    >
                      载入知识示例
                    </Button>
                  </div>
                </div>

                <div
                  className={`relative cursor-pointer rounded-lg border p-3.5 transition-all duration-200 ${
                    template === "custom_template"
                      ? "border-amber-200 bg-amber-50 shadow-sm dark:border-amber-500/50 dark:bg-amber-950/20 dark:shadow-[0_0_15px_rgba(245,158,11,0.12)]"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                  }`}
                  onClick={() => {
                    if (state === "idle" || state === "diff-ready" || state === "failed" || state === "success") {
                      setTemplate("custom_template");
                      setPreviewResult(null);
                      setActionError(null);
                      setState("idle");
                      setExecStep(-1);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileCode2 className={`w-4 h-4 ${template === "custom_template" ? "text-amber-500" : "text-slate-600"}`} />
                    <span className={`font-medium text-[13px] ${template === "custom_template" ? "text-amber-700 dark:text-amber-100" : "text-slate-500 dark:text-slate-400"}`}>自定义模板</span>
                    <Badge className={`ml-auto text-[9px] uppercase tracking-wider ${
                      template === "custom_template"
                        ? "border-amber-200 bg-white text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                        : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
                    }`}>
                      sandboxed
                    </Badge>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">
                    通过 declarative JSON 脚本安全地追加、替换或去重当前 MEMORY 文档内容。
                  </p>
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-amber-200 bg-white/90 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/30"
                      onClick={(event) => {
                        event.stopPropagation();
                        loadCustomTemplateExample();
                      }}
                    >
                      载入脚本示例
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-amber-200 bg-white/90 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/30"
                      onClick={(event) => {
                        event.stopPropagation();
                        loadCustomTemplateRemoveExample();
                      }}
                    >
                      载入移除示例
                    </Button>
                  </div>
                </div>
              </div>

              {template === "knowledge_injection" ? (
                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/80 p-3.5 shadow-sm dark:border-violet-900/40 dark:bg-violet-950/20">
                  <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
                    <Database className="h-3.5 w-3.5" />
                    Knowledge Injection Contract
                  </div>
                  <div className="grid gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Source Ref
                      </label>
                      <Input
                        value={knowledgeSourceRef}
                        onChange={(event) => setKnowledgeSourceRef(event.target.value)}
                        placeholder="例如：playbook://memory-search-v1"
                        disabled={state === "analyzing" || state === "executing"}
                        className="h-9 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/70"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Capability Tags
                      </label>
                      <Input
                        value={knowledgeTagsInput}
                        onChange={(event) => setKnowledgeTagsInput(event.target.value)}
                        placeholder="memory, search, retrieval"
                        disabled={state === "analyzing" || state === "executing"}
                        className="h-9 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/70"
                      />
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        用逗号分隔标签；这些标签会进入 history 与 audit。
                      </p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Additional Sources
                      </label>
                      <Input
                        value={knowledgeAdditionalSourcesInput}
                        onChange={(event) => setKnowledgeAdditionalSourcesInput(event.target.value)}
                        placeholder="doc://team-playbook, qmd://memory-search-notes"
                        disabled={state === "analyzing" || state === "executing"}
                        className="h-9 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/70"
                      />
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        可选；多个来源会一并写入 provenance。
                      </p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Knowledge Body
                      </label>
                      <Textarea
                        value={knowledgeBody}
                        onChange={(event) => setKnowledgeBody(event.target.value)}
                        placeholder="输入要注入 MEMORY.md 的结构化知识片段。"
                        disabled={state === "analyzing" || state === "executing"}
                        className="min-h-[128px] border-slate-200 bg-white text-sm leading-6 dark:border-slate-800 dark:bg-slate-950/70"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {template === "custom_template" ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                    <FileCode2 className="h-3.5 w-3.5" />
                    Custom Template Sandbox
                  </div>
                  <div className="grid gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Source Ref
                      </label>
                      <Input
                        value={customSourceRef}
                        onChange={(event) => setCustomSourceRef(event.target.value)}
                        placeholder="custom://playbook"
                        disabled={state === "analyzing" || state === "executing"}
                        className="h-9 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/70"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Capability Tags
                      </label>
                      <Input
                        value={customTagsInput}
                        onChange={(event) => setCustomTagsInput(event.target.value)}
                        placeholder="custom, safe"
                        disabled={state === "analyzing" || state === "executing"}
                        className="h-9 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/70"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Additional Sources
                      </label>
                      <Input
                        value={customAdditionalSourcesInput}
                        onChange={(event) => setCustomAdditionalSourcesInput(event.target.value)}
                        placeholder="custom://shared-playbook"
                        disabled={state === "analyzing" || state === "executing"}
                        className="h-9 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/70"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Script Body
                      </label>
                      <Textarea
                        value={customScriptBody}
                        onChange={(event) => setCustomScriptBody(event.target.value)}
                        disabled={state === "analyzing" || state === "executing"}
                        className="min-h-[160px] border-slate-200 bg-white font-mono text-[12px] leading-6 dark:border-slate-800 dark:bg-slate-950/70"
                      />
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        仅允许 declarative JSON：`append_block`、`replace_text`、`dedupe_lines`、`remove_blocks_by_source_ref`。最大 4 KB，无文件系统与网络权限。
                      </p>
                      {lastCustomAppendSourceRef ? (
                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                          最近一次脚本示例来源：{lastCustomAppendSourceRef}；`载入移除示例` 会复用它生成 remove proof。
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800/50">
            {state === "idle" ? (
              <Button
                className="w-full bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-lg shadow-sky-900/20"
                onClick={() => void handlePreview()}
                disabled={
                  !activeNode ||
                  !template ||
                  !isConnected ||
                  agents.length === 0 ||
                  (template === "knowledge_injection" && !canPreviewKnowledgeInjection) ||
                  (template === "custom_template" && !canPreviewCustomTemplate)
                }
              >
                <Search className="w-4 h-4 mr-2" /> {t("evo.btn.analyze")}
              </Button>
            ) : null}
            {state === "analyzing" ? (
              <Button className="w-full bg-slate-800 text-slate-400 cursor-wait" disabled>
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-sky-500" /> {t("evo.analyzing")}
              </Button>
            ) : null}
            {state === "diff-ready" ? (
              <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                <Button
                  className={`w-full text-white shadow-lg transition-all ${template === "aggressive" ? "bg-red-600 hover:bg-red-500 shadow-red-900/20" : "bg-sky-600 hover:bg-sky-500 shadow-sky-900/20"}`}
                  onClick={handleExecuteClick}
                  disabled={!previewResult || !!previewResult.unsafeApply}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {template === "aggressive"
                    ? t("evo.btn.execute.high")
                    : template === "knowledge_injection"
                      ? "注入知识包"
                      : template === "custom_template"
                        ? "执行自定义模板"
                      : t("evo.btn.execute.low")}
                </Button>
                <Button variant="outline" className="w-full border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200" onClick={() => { setState("idle"); setPreviewResult(null); setRuntimeStatus(null); setActiveOperationId(null); setActionError(null); setExecStep(-1); }}>
                  <X className="w-4 h-4 mr-2" /> {t("evo.btn.discard")}
                </Button>
              </div>
            ) : null}
            {state === "executing" ? (
              <div className="space-y-3">
                <Button className="w-full cursor-wait border border-sky-200 bg-sky-50 text-sky-700 shadow-sm dark:border-sky-900/50 dark:bg-[#08131f] dark:text-sky-400 dark:shadow-[0_0_15px_rgba(14,165,233,0.15)]" disabled>
                  <Activity className="w-4 h-4 mr-2 animate-pulse" /> {t("evo.executing")}
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-950/20"
                  onClick={() => void handleCancelExecution()}
                  disabled={!runtimeStatus?.canCancel || isCancelling}
                >
                  {isCancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                  {t("evo.btn.cancel")}
                </Button>
              </div>
            ) : null}
            {state === "success" ? (
              <Button className="w-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50" onClick={() => { setState("idle"); setTemplate(null); setPreviewResult(null); setRuntimeStatus(null); setActiveOperationId(null); setActionError(null); setExecStep(-1); }}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> {t("evo.done")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100/70 dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.94))]">
        {state === "idle" ? (
          <div className="animate-in fade-in duration-500 flex flex-1 flex-col items-center justify-center text-slate-500 dark:text-slate-500">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-800/50 dark:bg-slate-900/50">
              <Cpu className="w-8 h-8 text-slate-500 dark:text-slate-600" />
            </div>
            <p className="mb-2 text-lg font-medium text-slate-800 dark:text-slate-300">{t("evo.empty.title")}</p>
            <p className="max-w-sm text-center text-sm leading-relaxed text-slate-500 dark:text-slate-500">
              {isConnected && agents.length > 0 ? t("evo.empty.desc") : t("evo.connection.required")}
            </p>
          </div>
        ) : null}

        {state === "analyzing" ? (
          <div className="animate-in fade-in duration-300 flex flex-1 flex-col items-center justify-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-sky-500/20 blur-xl rounded-full" />
              <Loader2 className="w-12 h-12 animate-spin text-sky-500 relative z-10" />
            </div>
            <p className="mb-2 text-lg font-medium text-slate-800 dark:text-slate-200">{t("evo.analyzing.title")}</p>
            <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-slate-500 dark:text-slate-500">
              {t("evo.analyzing.desc")}
            </p>
            <div className="mt-8 h-1 w-64 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-900">
              <div className="h-full bg-sky-500 w-1/2 animate-[pulse_2s_ease-in-out_infinite]" />
            </div>
          </div>
        ) : null}

        {state === "diff-ready" || state === "executing" || state === "success" || state === "failed" ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800/80 dark:bg-slate-950/80 dark:backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Split className="w-5 h-5 text-sky-500" />
                <h2 className="text-[15px] font-medium text-slate-800 dark:text-slate-200">{t("evo.diff.title")}</h2>
                <Badge variant="outline" className="ml-3 border-red-200 bg-red-50 font-mono text-[10px] text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                  {previewResult ? diffGroups.highRisk.length : 0} {t("evo.diff.badge.high")}
                </Badge>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 font-mono text-[10px] text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                  {previewResult ? diffGroups.regular.length : 0} {t("evo.diff.badge.upd")}
                </Badge>
              </div>
              <div className="w-[220px]">
                <TabsList className="grid h-8 w-full grid-cols-2 border border-slate-200 bg-slate-100 dark:border-slate-800/80 dark:bg-slate-900/70">
                  <TabsTrigger value="diff" className="text-[11px] dark:text-slate-400 data-[state=active]:bg-white data-[state=active]:text-sky-600 dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-sky-300 dark:data-[state=active]:shadow-[inset_0_0_0_1px_rgba(51,65,85,0.9)]">{t("evo.tab.diff")}</TabsTrigger>
                  <TabsTrigger value="graph" className="text-[11px] dark:text-slate-400 data-[state=active]:bg-white data-[state=active]:text-sky-600 dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-sky-300 dark:data-[state=active]:shadow-[inset_0_0_0_1px_rgba(51,65,85,0.9)]">{t("evo.tab.graph")}</TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="diff" className="flex-1 flex flex-col mt-0 border-none outline-none h-full overflow-hidden data-[state=inactive]:hidden">
              <div className="mx-6 mt-6 flex shrink-0 gap-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/75 dark:shadow-[0_18px_40px_rgba(2,6,23,0.24)]">
                <div className="flex-1">
                  <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <Activity className="w-4 h-4 text-sky-500" /> {t("evo.summary.title")}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {template === "knowledge_injection" ? (
                      <>
                        本次进化会向 <span className="font-medium text-slate-800 dark:text-slate-200">{currentNode?.name || "the node"}</span> 追加一个受管知识块，
                        来源引用为 <span className="font-medium text-slate-800 dark:text-slate-200">{knowledgeInput?.sourceRef || "—"}</span>，
                        并登记 {knowledgeCapabilityTags.length} 个 capability tags。
                        {knowledgeAdditionalSources.length > 0 ? ` 另外还会记录 ${knowledgeAdditionalSources.length} 个附加来源。` : ""}
                      </>
                    ) : template === "custom_template" ? (
                      <>
                        本次进化会在 declarative sandbox 中解释一份自定义 JSON 模板，
                        来源引用为 <span className="font-medium text-slate-800 dark:text-slate-200">{customInput?.sourceRef || "—"}</span>，
                        并仅允许对当前 MEMORY 文档执行受限的追加、替换或去重操作。
                        {customAdditionalSources.length > 0 ? ` 该模板还会带上 ${customAdditionalSources.length} 个附加来源用于 provenance。` : ""}
                      </>
                    ) : (
                      <>
                        {t("evo.summary.desc1")} <span className="font-medium text-slate-800 dark:text-slate-200">{currentNode?.name || "the node"}</span>.
                        {t("evo.summary.desc2.prefix")} {template === "aggressive" ? t("evo.summary.desc2.agg") : t("evo.summary.desc2.con")}.
                      </>
                    )}
                  </p>
                  {previewResult ? (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                      {previewResult.sourceDocument} · {previewResult.bytesBefore} bytes → {previewResult.bytesAfter} bytes
                      {previewResult.sourceRefs.length > 0
                        ? ` · ${previewResult.sourceRefs.length} source refs`
                        : previewResult.sourceRef
                          ? ` · source ${previewResult.sourceRef}`
                          : ""}
                      {previewResult.capabilityTags.length > 0
                        ? ` · ${previewResult.capabilityTags.length} capability tags`
                        : ""}
                    </p>
                  ) : null}
                  {previewResult && (previewResult.sourceRefs.length > 0 || previewResult.capabilityTags.length > 0) ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                        <div className="mb-1 font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                          Source Refs
                        </div>
                        <div className="break-all">
                          {previewResult.sourceRefs.length > 0
                            ? previewResult.sourceRefs.join(", ")
                            : previewResult.sourceRef ?? "—"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                        <div className="mb-1 font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                          Capability Tags
                        </div>
                        <div>
                          {previewResult.capabilityTags.length > 0
                            ? previewResult.capabilityTags.join(", ")
                            : "—"}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6 pt-6 custom-scrollbar">
                <div className="space-y-6 max-w-4xl mx-auto">
                  {actionError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                      {actionError}
                    </div>
                  ) : null}
                  {previewResult?.unsafeApply || previewResult?.requiresConfirmation ? (
                    <div className={`rounded-lg border p-4 text-sm ${
                      previewResult.unsafeApply
                        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                        : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                    }`}>
                      <div className="mb-2 flex items-center gap-2 font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        {previewResult.unsafeApply ? "Unsafe Apply Blocked" : "Requires Confirmation"}
                      </div>
                      <div className="space-y-1.5">
                        {previewResult.unsafeReasons.length > 0 ? previewResult.unsafeReasons.map((reason) => (
                          <div key={reason}>- {reason}</div>
                        )) : <div>当前操作被提升为高风险，请在确认后执行。</div>}
                      </div>
                    </div>
                  ) : null}
                  {diffGroups.highRisk.length > 0 ? (
                    <DiffGroup title={t("evo.group.high")} color="red" icon={AlertTriangle} items={diffGroups.highRisk} />
                  ) : null}
                  {diffGroups.regular.length > 0 ? (
                    <DiffGroup title={t("evo.group.add")} color="emerald" icon={FileCode2} items={diffGroups.regular} />
                  ) : null}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="graph" className="mt-0 flex h-full flex-1 flex-col overflow-hidden border-none outline-none data-[state=inactive]:hidden">
              <MemoryTopologyGraph
                currentNode={currentNode}
                template={template}
                state={state}
                previewResult={previewResult}
                runtimeStatus={runtimeStatus}
                latestHistoryEntry={latestResult}
                onOpenDiff={() => setActiveTab("diff")}
                onOpenHistory={() => {
                  setHistorySheetSelectionId(latestResult?.operationId ?? historyEntries[0]?.operationId ?? null);
                  setIsHistorySheetOpen(true);
                }}
              />
            </TabsContent>
          </Tabs>
        ) : null}
      </div>

      <div className="z-10 flex w-[320px] shrink-0 flex-col border-l border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:shadow-[-2px_0_15px_rgba(0,0,0,0.35)]">
        <div className="border-b border-slate-200 p-5 pb-6 dark:border-slate-800/50">
          <h3 className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            <Activity className="w-4 h-4 text-sky-500" />
            {t("evo.state.title")}
          </h3>
          <div className="space-y-5 relative ml-1">
            <div className="absolute bottom-2 left-[11px] top-2 w-[1px] bg-slate-200 dark:bg-slate-800" />
            {executionSteps.map((step) => {
              const isPast = state === "success" || (state === "executing" && execStep > step.id);
              const isCurrent = state === "executing" && execStep === step.id;

              return (
                <div key={step.id} className="relative flex gap-4 z-10 group">
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border
                    ${isPast ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/50 dark:bg-emerald-950/50 dark:text-emerald-500" :
                    isCurrent ? "border-sky-300 bg-sky-50 text-sky-600 shadow-sm dark:border-sky-500/80 dark:bg-[#08131f] dark:text-sky-400 dark:shadow-[0_0_10px_rgba(14,165,233,0.3)]" :
                    "border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-600"}`}>
                    {isPast ? <Check className="w-3.5 h-3.5" /> :
                      isCurrent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                  </div>
                  <div className="pt-0.5">
                    <p className={`mb-1.5 text-[13px] font-medium leading-none ${isCurrent ? "text-sky-600 dark:text-sky-400" : isPast ? "text-slate-800 dark:text-slate-200" : "text-slate-500 dark:text-slate-500"}`}>{step.label}</p>
                    <p className="pr-2 text-[11px] leading-snug text-slate-500 dark:text-slate-500">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {runtimeStatus ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {executionSteps[mapRuntimePhaseToStep(runtimeStatus.phase)]?.label ?? runtimeStatus.phase}
                </span>
                <span className="font-mono text-sky-600 dark:text-sky-300">
                  {runtimeStatus.progressPct}%
                </span>
              </div>
              <div>{runtimeStatus.message}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {runtimeStatus.previewStale ? (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                    Preview Stale
                  </Badge>
                ) : null}
                {runtimeStatus.conflictDetected ? (
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                    Conflict Detected
                  </Badge>
                ) : null}
                {runtimeStatus.overrideApplied ? (
                  <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
                    Override Applied
                  </Badge>
                ) : null}
              </div>
              {runtimeStatus.sourceRefs.length > 0 ? (
                <div className="mt-2 break-all text-[11px] text-slate-500 dark:text-slate-400">
                  Source Refs: {runtimeStatus.sourceRefs.join(", ")}
                </div>
              ) : null}
            </div>
          ) : null}

          {latestResult ? (
            <div className={`mt-6 animate-in fade-in slide-in-from-top-2 rounded-lg border p-3.5 ${
              latestResult.status === "failed"
                ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
                : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
            }`}>
              <div className={`mb-1.5 flex items-center gap-2 text-sm font-medium ${
                latestResult.status === "failed" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
              }`}>
                <CheckCircle2 className="w-4 h-4" /> {latestResult.status === "rolled_back" ? t("evo.rollback.success") : t("evo.state.success")}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("evo.state.snap")} <span className="rounded bg-emerald-100 px-1 py-0.5 font-mono text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200/70">{latestResult.snapshotId}</span></p>
            </div>
          ) : null}
        </div>

        <div className="p-5 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <History className="w-4 h-4 text-slate-500" />
              {t("evo.hist.title")}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-sky-600 hover:bg-transparent hover:text-sky-500 dark:text-sky-500 dark:hover:text-sky-400"
              onClick={() => {
                setHistorySheetSelectionId(historyEntries[0]?.operationId ?? null);
                setIsHistorySheetOpen(true);
              }}
            >
              {t("evo.hist.view")}
            </Button>
          </div>
          <div className="space-y-2.5 overflow-y-auto custom-scrollbar flex-1 pr-1">
            {isHistoryLoading ? (
              <div className="text-xs text-slate-500 dark:text-slate-500">{t("evo.hist.loading")}</div>
            ) : null}
            {!isHistoryLoading && historyEntries.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-500">{t("evo.hist.empty")}</div>
            ) : null}
            {historyEntries.map((entry) => {
              const statusLabel = formatHistoryStatus(entry);
              const canRollback = entry.operationKind === "execute" && entry.status === "success";
              return (
              <div
                key={entry.operationId}
                className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                onClick={() => {
                  setHistorySheetSelectionId(entry.operationId);
                  setIsHistorySheetOpen(true);
                }}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{entry.nodeLabel}</span>
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                    entry.status === "failed" || entry.status === "cancelled"
                      ? "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                      : entry.status === "rolled_back"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                  }`}>{statusLabel}</span>
                </div>
                <div className="mb-1 text-[11px] text-slate-500 dark:text-slate-500">{entry.summary}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-500">
                  <span>{formatRelativeTime(entry.createdAtMs)}</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] opacity-70 dark:bg-slate-950">{entry.snapshotId}</span>
                    {canRollback ? (
                    <button
                      onClick={() => void handleRollback(entry)}
                      className="flex items-center gap-1 font-medium text-sky-600 opacity-0 transition-opacity hover:text-sky-500 group-hover:opacity-100 dark:text-sky-500 dark:hover:text-sky-400"
                    >
                      <Undo2 className="w-3 h-3" /> {t("evo.hist.rollback")}
                    </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      </div>

      <EvolutionHistorySheet
        open={isHistorySheetOpen}
        onOpenChange={setIsHistorySheetOpen}
        historyEntries={historyEntries}
        auditSummary={auditSummary}
        isAuditLoading={isAuditLoading}
        selectedOperationId={historySheetSelectionId}
        onSelectedOperationIdChange={setHistorySheetSelectionId}
        onExportReport={handleExportAuditReport}
        onQuickExportReport={handleQuickExportAuditReport}
        onRollback={handleRollback}
      />

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-[425px] border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-red-600 dark:text-red-500">
              <AlertTriangle className="w-5 h-5" />
              {t("evo.dialog.title")}
            </DialogTitle>
            <DialogDescription className="space-y-4 pt-4 text-slate-500 dark:text-slate-400">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 text-sm dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{t("evo.dialog.tpl")}</span>
                <Badge variant="outline" className="border-red-200 bg-red-50 font-medium text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                  {formatTemplateLabel(previewResult?.template ?? template)}
                </Badge>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 text-sm dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{t("evo.dialog.risk")}</span>
                <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-red-600 dark:bg-red-500/10 dark:text-red-500">{t("evo.dialog.risk.val")}</span>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-2.5 text-sm dark:border-slate-800/60">
                <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">{t("evo.dialog.scope")}</span>
                <span className="text-right text-xs leading-relaxed text-slate-700 dark:text-slate-300">{t("evo.dialog.scope.val", currentNode?.name || "the node")}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 text-sm dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{t("evo.dialog.vol")}</span>
                <span className="text-right font-mono text-xs text-slate-700 dark:text-slate-300">{t("evo.dialog.vol.val")}</span>
              </div>
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs leading-relaxed text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400/90">
                <Flame className="mr-2 inline -mt-0.5 h-4 w-4 text-red-500" />
                {t("evo.dialog.warn")} <span className="ml-1 rounded border border-red-200 bg-white px-1 py-0.5 font-mono text-red-700 dark:border-red-900/30 dark:bg-[#050505] dark:text-red-300">{previewResult?.snapshotId ?? "evo_snap_auto"}</span> {t("evo.dialog.warn2")}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between mt-6">
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)} className="text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
              {t("evo.dialog.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void startExecution()} className="gap-2 border border-red-500 bg-red-600 text-sm font-medium text-white shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:bg-red-500">
              <Cpu className="w-4 h-4" /> {t("evo.dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
