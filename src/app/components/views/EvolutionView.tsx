import { useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";
import {
  CheckCircle2, Play, AlertTriangle, Network,
  ChevronDown, Activity, History, Undo2, ShieldAlert, Database,
  Split, Search, Loader2, Cpu, X, Server, Check, Flame, FileCode2, Info
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { MemoryTopologyGraph } from "./MemoryTopologyGraph";
import { EvolutionHistorySheet } from "./EvolutionHistorySheet";
import { buildEvolutionAuditReportMarkdown } from "./evolutionAuditReport";
import { formatKnowledgePackExample, parseKnowledgeInjectionPack } from "./evolutionKnowledgePack";
import {
  buildEvolutionTargetNodeEntries,
  resolveEvolutionSessionIdToActivate,
  resolveSelectedEvolutionAgentId,
  resolveSelectedEvolutionNodeId,
} from "./evolutionTargetState";
import {
  renderEvolutionHistorySummary,
  renderEvolutionRuntimeMessage,
} from "./evolutionMessageI18n";

type EvoState = "idle" | "analyzing" | "diff-ready" | "executing" | "success" | "failed" | "cancelled";
type TemplateType = EvolutionTemplateKind | null;

function normalizeUiErrorMessage(
  error: unknown,
  fallbackMessage = "Evolution request failed",
) {
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
  return fallbackMessage;
}

function formatRelativeTime(
  createdAtMs: number,
  t: (key: string, ...args: (string | number)[]) => string,
) {
  const diffMs = Date.now() - createdAtMs;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return t("evo.time.just_now");
  if (diffMinutes < 60) return t("evo.time.min_ago", diffMinutes);
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return t("evo.time.hr_ago", diffHours);
  const diffDays = Math.floor(diffHours / 24);
  return t("evo.time.day_ago", diffDays);
}

function formatHistoryStatus(entry: EvolutionHistoryEntry, t: (key: string, ...args: (string | number)[]) => string) {
  switch (entry.status) {
    case "rolled_back":
      return t("evo.historySheet.status.rolled_back");
    case "failed":
      return t("evo.historySheet.status.failed");
    case "cancelled":
      return t("evo.historySheet.status.cancelled");
    default:
      return t("evo.historySheet.status.success");
  }
}

function formatTemplateLabel(template: EvolutionTemplateKind | null, t: (key: string, ...args: (string | number)[]) => string) {
  switch (template) {
    case "aggressive":
      return t("evo.template.aggressive.title");
    case "knowledge_injection":
      return t("evo.template.knowledge.title");
    case "custom_template":
      return t("evo.template.custom.title");
    case "conservative":
    default:
      return t("evo.template.conservative.title");
  }
}

function formatKnowledgeWarning(
  warning: string,
  t: (key: string, ...args: (string | number)[]) => string,
) {
  switch (warning) {
    case "empty_pack":
      return t("evo.knowledge.warning.empty_pack");
    case "missing_delimiter":
      return t("evo.knowledge.warning.missing_delimiter");
    case "missing_source_ref":
      return t("evo.knowledge.warning.missing_source_ref");
    case "missing_body":
      return t("evo.knowledge.warning.missing_body");
    default:
      return warning;
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
  const { lang, t } = useI18n();
  const { nodes, agents, isConnected, setActiveSession } = useOpenClaw();
  const RECENT_HISTORY_COLLAPSED_COUNT = 3;
  const buildCustomTemplateExample = () =>
    `{\n  "mode": "append_block",\n  "title": "${t("evo.custom.example.blockTitle")}",\n  "content": "${t("evo.custom.example.blockContent")}"\n}`;
  const evolutionNodeEntries = useMemo(
    () =>
      buildEvolutionTargetNodeEntries({
        isConnected,
        nodes,
        agents,
      }),
    [agents, isConnected, nodes],
  );

  const [selectedNodeId, setSelectedNodeId] = useState(
    resolveSelectedEvolutionNodeId("", evolutionNodeEntries),
  );
  const [activeAgentId, setActiveAgentId] = useState(
    resolveSelectedEvolutionAgentId("", resolveSelectedEvolutionNodeId("", evolutionNodeEntries), evolutionNodeEntries),
  );
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
  const [knowledgeEntryMode, setKnowledgeEntryMode] = useState<"quick_paste" | "manual">("quick_paste");
  const [knowledgePackText, setKnowledgePackText] = useState("");
  const [knowledgeMetaExpanded, setKnowledgeMetaExpanded] = useState(false);
  const [lastHydratedPackText, setLastHydratedPackText] = useState("");
  const [customSourceRef, setCustomSourceRef] = useState("custom://playbook");
  const [customAdditionalSourcesInput, setCustomAdditionalSourcesInput] = useState("");
  const [customTagsInput, setCustomTagsInput] = useState("custom, safe");
  const [lastCustomAppendSourceRef, setLastCustomAppendSourceRef] = useState<string | null>(null);
  const [customScriptBody, setCustomScriptBody] = useState(
    buildCustomTemplateExample(),
  );
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
  const [historySheetSelectionId, setHistorySheetSelectionId] = useState<string | null>(null);
  const [isRecentHistoryExpanded, setIsRecentHistoryExpanded] = useState(false);
  const [auditSummary, setAuditSummary] = useState<EvolutionAuditSummary | null>(null);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const terminalToastKeyRef = useRef<string | null>(null);

  const executionSteps = [
    { id: 0, label: t("evo.step.0.label"), desc: t("evo.step.0.desc") },
    { id: 1, label: t("evo.step.1.label"), desc: t("evo.step.1.desc") },
    { id: 2, label: t("evo.step.2.label"), desc: t("evo.step.2.desc") },
    { id: 3, label: t("evo.step.3.label"), desc: t("evo.step.3.desc") },
  ];

  const currentNode = evolutionNodeEntries.find((node) => node.id === selectedNodeId);
  const currentNodeAgents = currentNode?.agents ?? [];
  const currentAgent =
    currentNodeAgents.find((agent) => agent.id === activeAgentId) ??
    agents.find((agent) => agent.id === activeAgentId) ??
    null;
  const manualKnowledgeCapabilityTags = useMemo(
    () =>
      knowledgeTagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [knowledgeTagsInput],
  );
  const manualKnowledgeAdditionalSources = useMemo(
    () =>
      knowledgeAdditionalSourcesInput
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [knowledgeAdditionalSourcesInput],
  );
  const manualKnowledgeInput = useMemo(
    () =>
      ({
        sourceRef: knowledgeSourceRef.trim(),
        additionalSourceRefs: manualKnowledgeAdditionalSources,
        knowledgeBody: knowledgeBody.trim(),
        capabilityTags: manualKnowledgeCapabilityTags,
      } satisfies EvolutionKnowledgeInjectionInput),
    [
      knowledgeSourceRef,
      manualKnowledgeAdditionalSources,
      knowledgeBody,
      manualKnowledgeCapabilityTags,
    ],
  );
  const parsedKnowledgePack = useMemo(
    () => parseKnowledgeInjectionPack(knowledgePackText),
    [knowledgePackText],
  );
  const effectiveKnowledgeInput =
    template === "knowledge_injection"
      ? (knowledgeEntryMode === "quick_paste"
          ? ({
              sourceRef: parsedKnowledgePack.sourceRef,
              additionalSourceRefs: parsedKnowledgePack.additionalSourceRefs,
              knowledgeBody: parsedKnowledgePack.knowledgeBody,
              capabilityTags: parsedKnowledgePack.capabilityTags,
            } satisfies EvolutionKnowledgeInjectionInput)
          : manualKnowledgeInput)
      : undefined;
  const canPreviewKnowledgeInjection =
    knowledgeEntryMode === "quick_paste"
      ? !!parsedKnowledgePack.sourceRef && !!parsedKnowledgePack.knowledgeBody
      : !!manualKnowledgeInput.sourceRef && !!manualKnowledgeInput.knowledgeBody;
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
    const nextExampleText = formatKnowledgePackExample({
      sourceRef: uniqueSource,
      additionalSourceRefs: ["doc://team-playbook", "qmd://memory-search-notes"],
      capabilityTags: ["memory", "search", "retrieval"],
      knowledgeBody:
        "Use memory_search before local fallback. Index rebuild is required after new memory ingestion.",
    });
    setTemplate("knowledge_injection");
    setKnowledgeEntryMode("quick_paste");
    setKnowledgePackText(nextExampleText);
    setKnowledgeSourceRef(uniqueSource);
    setKnowledgeAdditionalSourcesInput("doc://team-playbook, qmd://memory-search-notes");
    setKnowledgeTagsInput("memory, search, retrieval");
    setKnowledgeBody("Use memory_search before local fallback. Index rebuild is required after new memory ingestion.");
    setKnowledgeMetaExpanded(true);
    setLastHydratedPackText("");
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
    setCustomScriptBody(buildCustomTemplateExample());
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
      toast.error(t("evo.export.none"));
      return;
    }

    const lines = buildEvolutionAuditReportMarkdown(auditSummary, {
      generatedAt: new Date(),
      reportMode: "manual",
      lang,
    });

    try {
      const result = await gatewayExportMarkdownDocument(
        `evolution-audit-${auditSummary.agentId}.md`,
        lines,
      );
      if (result) {
        toast.success(t("evo.export.manual.success", result));
      } else {
        toast.info(t("evo.export.cancelled"));
      }
    } catch (error) {
      toast.error(normalizeUiErrorMessage(error, t("evo.export.none")));
    }
  };

  const handleQuickExportAuditReport = async () => {
    if (!auditSummary) {
      toast.error(t("evo.export.none"));
      return;
    }

    const lines = buildEvolutionAuditReportMarkdown(auditSummary, {
      generatedAt: new Date(),
      reportMode: "quick",
      lang,
    });

    try {
      const result = await gatewayExportMarkdownDocumentQuick(
        `evolution-audit-${auditSummary.agentId}.md`,
        lines,
      );
      toast.success(t("evo.export.quick.success", result));
    } catch (error) {
      toast.error(normalizeUiErrorMessage(error, t("evo.export.none")));
    }
  };

  useEffect(() => {
    const nextNodeId = resolveSelectedEvolutionNodeId(selectedNodeId, evolutionNodeEntries);
    if (nextNodeId !== selectedNodeId) {
      setSelectedNodeId(nextNodeId);
    }
  }, [selectedNodeId, evolutionNodeEntries]);

  useEffect(() => {
    const nextAgentId = resolveSelectedEvolutionAgentId(
      activeAgentId,
      selectedNodeId,
      evolutionNodeEntries,
    );
    if (nextAgentId !== activeAgentId) {
      setActiveAgentId(nextAgentId);
    }
  }, [activeAgentId, selectedNodeId, evolutionNodeEntries]);

  useEffect(() => {
    setIsRecentHistoryExpanded(false);
  }, [activeAgentId]);

  useEffect(() => {
    if (knowledgeEntryMode !== "manual" || !knowledgePackText.trim()) {
      return;
    }
    if (lastHydratedPackText === knowledgePackText) {
      return;
    }
    setKnowledgeSourceRef(parsedKnowledgePack.sourceRef);
    setKnowledgeAdditionalSourcesInput(parsedKnowledgePack.additionalSourceRefs.join(", "));
    setKnowledgeTagsInput(parsedKnowledgePack.capabilityTags.join(", "));
    setKnowledgeBody(parsedKnowledgePack.knowledgeBody);
    setLastHydratedPackText(knowledgePackText);
  }, [
    knowledgeEntryMode,
    knowledgePackText,
    lastHydratedPackText,
    parsedKnowledgePack.sourceRef,
    parsedKnowledgePack.additionalSourceRefs,
    parsedKnowledgePack.capabilityTags,
    parsedKnowledgePack.knowledgeBody,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      if (!isConnected || agents.length === 0 || !activeAgentId) {
        setHistoryEntries([]);
        setLatestResult(null);
        setAuditSummary(null);
        return;
      }

      setIsHistoryLoading(true);
      try {
        const [nextHistory, nextAudit] = await Promise.all([
          evolutionHistoryList(activeAgentId),
          evolutionAuditSummary(activeAgentId).catch(() => null),
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
          toast.error(normalizeUiErrorMessage(error, t("evo.connection.required")));
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
  }, [activeAgentId, agents.length, isConnected]);

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
        const toastMessage = renderEvolutionRuntimeMessage(snapshot, t);
        if (snapshot.runtimeState === "succeeded") {
          toast.success(toastMessage);
        } else if (snapshot.runtimeState === "cancelled") {
          toast.info(toastMessage);
        } else {
          toast.error(toastMessage);
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
          const message = normalizeUiErrorMessage(error, t("evo.connection.required"));
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
  const visibleHistoryEntries = useMemo(
    () =>
      isRecentHistoryExpanded
        ? historyEntries
        : historyEntries.slice(0, RECENT_HISTORY_COLLAPSED_COUNT),
    [historyEntries, isRecentHistoryExpanded, RECENT_HISTORY_COLLAPSED_COUNT],
  );
  const hiddenHistoryCount = Math.max(
    historyEntries.length - RECENT_HISTORY_COLLAPSED_COUNT,
    0,
  );

  const resolvePreviewTarget = async () => {
    if (!isConnected || agents.length === 0 || !currentNode) {
      return null;
    }

    const prioritizedNodeAgentIds = currentNodeAgents
      .map((agent) => agent.id)
      .filter((agentId) => agentId !== activeAgentId);
    const candidateIds = [
      activeAgentId,
      ...prioritizedNodeAgentIds,
      ...agents.map((agent) => agent.id).filter(
        (agentId) => agentId !== activeAgentId && !prioritizedNodeAgentIds.includes(agentId),
      ),
    ].filter(Boolean);

    for (const candidateId of candidateIds) {
      try {
        const memory = await gatewayAgentMemoryGet(candidateId);
        const hasMemoryDocument = memory.documents.some(
          (document) => !document.missing && typeof document.content === "string" && document.content.length > 0,
        );
        if (!hasMemoryDocument) {
          continue;
        }

        const candidateAgent = agents.find((agent) => agent.id === candidateId);
        const candidateNode = evolutionNodeEntries.find(
          (node) => node.id === candidateAgent?.nodeId,
        );
        if (candidateAgent && candidateNode) {
          if (candidateNode.id !== selectedNodeId) {
            setSelectedNodeId(candidateNode.id);
          }
          if (candidateId !== activeAgentId) {
            setActiveAgentId(candidateId);
          }
          return {
            agentId: candidateId,
            nodeLabel: candidateNode.name,
          };
        }
      } catch {
        // Ignore agents that cannot expose a writable MEMORY document.
      }
    }

    if (!activeAgentId) {
      return null;
    }

    return {
      agentId: activeAgentId,
      nodeLabel: currentNode.name,
    };
  };

  const handlePreview = async () => {
    if (!selectedNodeId || !activeAgentId || !template) return;
    if (!isConnected || agents.length === 0 || !currentNode || !currentAgent) {
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
        target.agentId,
        target.nodeLabel,
        template,
        effectiveKnowledgeInput,
        customInput,
      );
      setPreviewResult(preview);
      setState("diff-ready");
    } catch (error) {
      const message = normalizeUiErrorMessage(error, t("evo.connection.required"));
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
      const message = normalizeUiErrorMessage(error, t("evo.connection.required"));
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
      const message = normalizeUiErrorMessage(error, t("evo.connection.required"));
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
      const message = normalizeUiErrorMessage(error, t("evo.connection.required"));
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
                  value={selectedNodeId}
                  onChange={(e) => {
                    const nextNodeId = e.target.value;
                    setSelectedNodeId(nextNodeId);
                    const nextSessionId = resolveEvolutionSessionIdToActivate(
                      nextNodeId,
                      evolutionNodeEntries,
                    );
                    if (nextSessionId) {
                      void setActiveSession(nextSessionId);
                    }
                  }}
                  disabled={state !== "idle" && state !== "diff-ready"}
                  className="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-10 text-sm text-slate-900 transition-colors focus:border-sky-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="" disabled>{t("evo.target.select")}</option>
                  {evolutionNodeEntries.map((n) => (
                    <option key={n.id} value={n.id}>{n.name} {n.status === "offline" ? t("evo.target.offline") : ""}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-600" />
              </div>
            </div>

            {isConnected ? (
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">{t("evo.target.agent")}</label>
                <div className="relative">
                  <div className="absolute left-3 top-2.5 pointer-events-none">
                    <Server className="w-4 h-4 text-sky-500" />
                  </div>
                  <select
                    value={activeAgentId}
                    onChange={(e) => setActiveAgentId(e.target.value)}
                    disabled={
                      (state !== "idle" && state !== "diff-ready") ||
                      currentNodeAgents.length === 0
                    }
                    className="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-10 text-sm text-slate-900 transition-colors focus:border-sky-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="" disabled>{t("evo.target.agentSelect")}</option>
                    {currentNodeAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-600" />
                </div>
              </div>
            ) : null}

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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="ml-auto inline-flex text-slate-400 hover:text-slate-600" onClick={(event) => event.stopPropagation()} aria-label={t("evo.tooltip.more")}>
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px]">
                        {t("evo.template.conservative.desc")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">{t("evo.template.conservative.descShort")}</p>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="ml-auto inline-flex text-slate-400 hover:text-slate-600" onClick={(event) => event.stopPropagation()} aria-label={t("evo.tooltip.more")}>
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px]">
                        {t("evo.template.aggressive.desc")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">{t("evo.template.aggressive.descShort")}</p>
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
                      {t("evo.template.badge.live")}
                    </Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex text-slate-400 hover:text-slate-600" onClick={(event) => event.stopPropagation()} aria-label={t("evo.tooltip.more")}>
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px]">
                        {t("evo.template.knowledge.desc")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">{t("evo.template.knowledge.descShort")}</p>
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
                      {t("evo.knowledge.example")}
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
                    <span className={`font-medium text-[13px] ${template === "custom_template" ? "text-amber-700 dark:text-amber-100" : "text-slate-500 dark:text-slate-400"}`}>{t("evo.template.custom.title")}</span>
                    <Badge className={`ml-auto text-[9px] uppercase tracking-wider ${
                      template === "custom_template"
                        ? "border-amber-200 bg-white text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                        : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
                    }`}>
                      {t("evo.template.badge.sandboxed")}
                    </Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex text-slate-400 hover:text-slate-600" onClick={(event) => event.stopPropagation()} aria-label={t("evo.tooltip.more")}>
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px]">
                        {t("evo.template.custom.desc")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">{t("evo.template.custom.descShort")}</p>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto min-h-8 max-w-full whitespace-normal px-3 py-1.5 text-center text-[11px] leading-snug border-amber-200 bg-white/90 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/30 sm:max-w-[48%]"
                      onClick={(event) => {
                        event.stopPropagation();
                        loadCustomTemplateExample();
                      }}
                    >
                      {t("evo.custom.example")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto min-h-8 max-w-full whitespace-normal px-3 py-1.5 text-center text-[11px] leading-snug border-amber-200 bg-white/90 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/30 sm:max-w-[48%]"
                      onClick={(event) => {
                        event.stopPropagation();
                        loadCustomTemplateRemoveExample();
                      }}
                    >
                      {t("evo.custom.removeExample")}
                    </Button>
                  </div>
                </div>
              </div>

              {template === "knowledge_injection" ? (
                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/80 p-3.5 shadow-sm dark:border-violet-900/40 dark:bg-violet-950/20">
                  <div className="mb-3 grid gap-3">
                    <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
                      <Database className="h-3.5 w-3.5" />
                      {t("evo.knowledge.contract.title")}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex text-violet-400 hover:text-violet-600" aria-label={t("evo.tooltip.more")}>
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px]">
                          {t("evo.knowledge.contract.tip")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Tabs
                      value={knowledgeEntryMode}
                      onValueChange={(value) => {
                        const nextMode = value as "quick_paste" | "manual";
                        setKnowledgeEntryMode(nextMode);
                      }}
                      className="gap-0"
                    >
                      <TabsList className="grid h-8 w-full grid-cols-2 border border-violet-200 bg-white/80 dark:border-violet-900/40 dark:bg-violet-950/30">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <TabsTrigger value="quick_paste" className="min-w-0 truncate px-2 text-[10px] sm:text-[11px]">
                              {t("evo.knowledge.mode.quick.short")}
                            </TabsTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px]">
                            <div className="font-medium">{t("evo.knowledge.mode.quick.full")}</div>
                            <div>{t("evo.knowledge.mode.quick.desc")}</div>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <TabsTrigger value="manual" className="min-w-0 truncate px-2 text-[10px] sm:text-[11px]">
                              {t("evo.knowledge.mode.manual.short")}
                            </TabsTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px]">
                            <div className="font-medium">{t("evo.knowledge.mode.manual.full")}</div>
                            <div>{t("evo.knowledge.mode.manual.desc")}</div>
                          </TooltipContent>
                        </Tooltip>
                      </TabsList>
                    </Tabs>
                  </div>
                  {knowledgeEntryMode === "quick_paste" ? (
                    <div className="grid gap-3">
                      <div>
                        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          <span>{t("evo.knowledge.field.pack")}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="inline-flex text-slate-400 hover:text-slate-600" aria-label={t("evo.tooltip.more")}>
                                <Info className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[240px]">
                              {t("evo.knowledge.help.pack")}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Textarea
                          value={knowledgePackText}
                          onChange={(event) => {
                            setKnowledgePackText(event.target.value);
                            setLastHydratedPackText("");
                          }}
                          placeholder={`Source Ref: playbook://memory-search-v1\nAdditional Sources: doc://team-playbook, qmd://memory-search-notes\nCapability Tags: memory, search, retrieval\n\n---\n${t("evo.knowledge.field.pack.placeholder")}`}
                          disabled={state === "analyzing" || state === "executing"}
                          className="min-h-[168px] border-slate-200 bg-white text-sm leading-6 dark:border-slate-800 dark:bg-slate-950/70"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-violet-200 bg-white text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
                          {parsedKnowledgePack.sourceRef ? t("evo.knowledge.summary.source.one") : t("evo.knowledge.summary.source.zero")}
                        </Badge>
                        <Badge variant="outline" className="border-violet-200 bg-white text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
                          {t("evo.knowledge.summary.tags", parsedKnowledgePack.capabilityTags.length)}
                        </Badge>
                        <Badge variant="outline" className="border-violet-200 bg-white text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
                          {t("evo.knowledge.summary.additional", parsedKnowledgePack.additionalSourceRefs.length)}
                        </Badge>
                        <Badge variant="outline" className="border-violet-200 bg-white text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
                          {t("evo.knowledge.summary.bodyChars", parsedKnowledgePack.knowledgeBody.length)}
                        </Badge>
                      </div>
                      {parsedKnowledgePack.warnings.length > 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                          <div className="mb-1 font-semibold uppercase tracking-[0.14em]">
                            {t("evo.knowledge.parse.title")}
                          </div>
                          <div className="space-y-1">
                            {parsedKnowledgePack.warnings.map((warning) => (
                              <div key={warning}>- {formatKnowledgeWarning(warning, t)}</div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <Collapsible open={knowledgeMetaExpanded} onOpenChange={setKnowledgeMetaExpanded}>
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="justify-between border-violet-200 bg-white/90 text-violet-700 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-950/30"
                          >
                            {t("evo.knowledge.meta.parsed")}
                            <ChevronDown className={`h-4 w-4 transition-transform ${knowledgeMetaExpanded ? "rotate-180" : ""}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                          <div className="grid gap-3">
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
                              <div className="mb-1 font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                {t("evo.knowledge.field.source")}
                              </div>
                              <div className="break-all">{parsedKnowledgePack.sourceRef || "—"}</div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
                              <div className="mb-1 font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                {t("evo.knowledge.field.tags")}
                              </div>
                              <div>{parsedKnowledgePack.capabilityTags.join(", ") || "—"}</div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
                              <div className="mb-1 font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                {t("evo.knowledge.field.additional")}
                              </div>
                              <div className="break-all">{parsedKnowledgePack.additionalSourceRefs.join(", ") || "—"}</div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <div>
                        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          <span>{t("evo.knowledge.field.body")}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="inline-flex text-slate-400 hover:text-slate-600" aria-label={t("evo.tooltip.more")}>
                                <Info className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[240px]">
                              {t("evo.knowledge.help.body")}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Textarea
                          value={knowledgeBody}
                          onChange={(event) => setKnowledgeBody(event.target.value)}
                          placeholder={t("evo.knowledge.field.body.placeholder")}
                          disabled={state === "analyzing" || state === "executing"}
                          className="min-h-[144px] border-slate-200 bg-white text-sm leading-6 dark:border-slate-800 dark:bg-slate-950/70"
                        />
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          <span>{t("evo.knowledge.field.source")}</span>
                        </div>
                        <Input
                          value={knowledgeSourceRef}
                          onChange={(event) => setKnowledgeSourceRef(event.target.value)}
                          placeholder={t("evo.knowledge.field.source.placeholder")}
                          disabled={state === "analyzing" || state === "executing"}
                          className="h-9 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/70"
                        />
                      </div>
                      <Collapsible open={knowledgeMetaExpanded} onOpenChange={setKnowledgeMetaExpanded}>
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="justify-between border-violet-200 bg-white/90 text-violet-700 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-950/30"
                          >
                            {t("evo.knowledge.meta.advanced")}
                            <ChevronDown className={`h-4 w-4 transition-transform ${knowledgeMetaExpanded ? "rotate-180" : ""}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                          <div className="grid gap-3">
                            <div>
                              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                <span>{t("evo.knowledge.field.tags")}</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button type="button" className="inline-flex text-slate-400 hover:text-slate-600" aria-label={t("evo.tooltip.more")}>
                                      <Info className="h-3 w-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px]">
                                    {t("evo.knowledge.help.tags")}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Input
                                value={knowledgeTagsInput}
                                onChange={(event) => setKnowledgeTagsInput(event.target.value)}
                                placeholder={t("evo.knowledge.field.tags.placeholder")}
                                disabled={state === "analyzing" || state === "executing"}
                                className="h-9 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/70"
                              />
                            </div>
                            <div>
                              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                <span>{t("evo.knowledge.field.additional")}</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button type="button" className="inline-flex text-slate-400 hover:text-slate-600" aria-label={t("evo.tooltip.more")}>
                                      <Info className="h-3 w-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px]">
                                    {t("evo.knowledge.help.additional")}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Input
                                value={knowledgeAdditionalSourcesInput}
                                onChange={(event) => setKnowledgeAdditionalSourcesInput(event.target.value)}
                                placeholder={t("evo.knowledge.field.additional.placeholder")}
                                disabled={state === "analyzing" || state === "executing"}
                                className="h-9 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/70"
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}
                </div>
              ) : null}

              {template === "custom_template" ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                    <FileCode2 className="h-3.5 w-3.5" />
                    {t("evo.custom.contract.title")}
                  </div>
                  <div className="grid gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {t("evo.knowledge.field.source")}
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
                        {t("evo.knowledge.field.tags")}
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
                        {t("evo.knowledge.field.additional")}
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
                        {t("evo.custom.field.script")}
                      </label>
                      <Textarea
                        value={customScriptBody}
                        onChange={(event) => setCustomScriptBody(event.target.value)}
                        disabled={state === "analyzing" || state === "executing"}
                        className="min-h-[160px] border-slate-200 bg-white font-mono text-[12px] leading-6 dark:border-slate-800 dark:bg-slate-950/70"
                      />
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        {t("evo.custom.help.script")}
                      </p>
                      {lastCustomAppendSourceRef ? (
                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                          {t("evo.custom.help.lastSource", lastCustomAppendSourceRef)}
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
                  !selectedNodeId ||
                  !activeAgentId ||
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
                      ? t("evo.knowledge.execute")
                      : template === "custom_template"
                        ? t("evo.custom.execute")
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
          <div className="animate-in fade-in duration-500 flex flex-1 flex-col items-center justify-start px-8 pt-12 text-slate-500 dark:text-slate-500">
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
                        {t("evo.summary.knowledge.compact", currentNode?.name || t("evo.nodeFallback"))}
                        <span className="ml-1 font-medium text-slate-800 dark:text-slate-200">{effectiveKnowledgeInput?.sourceRef || "—"}</span>
                      </>
                    ) : template === "custom_template" ? (
                      <>
                        {t("evo.summary.custom.compact")}
                        <span className="ml-1 font-medium text-slate-800 dark:text-slate-200">{customInput?.sourceRef || "—"}</span>
                      </>
                    ) : (
                      <>
                        {t("evo.summary.desc1")} <span className="font-medium text-slate-800 dark:text-slate-200">{currentNode?.name || t("evo.nodeFallback")}</span>.
                        {t("evo.summary.desc2.prefix")} {template === "aggressive" ? t("evo.summary.desc2.agg") : t("evo.summary.desc2.con")}.
                      </>
                    )}
                  </p>
                  {previewResult ? (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                      {previewResult.sourceDocument} · {previewResult.bytesBefore} {t("common.bytes")} → {previewResult.bytesAfter} {t("common.bytes")}
                      {previewResult.sourceRefs.length > 0
                        ? ` · ${t("evo.summary.sourceRefs", previewResult.sourceRefs.length)}`
                        : previewResult.sourceRef
                          ? ` · ${t("evo.summary.sourceOne", previewResult.sourceRef)}`
                          : ""}
                      {previewResult.capabilityTags.length > 0
                        ? ` · ${t("evo.summary.capabilityTags", previewResult.capabilityTags.length)}`
                        : ""}
                    </p>
                  ) : null}
                  {previewResult && (previewResult.sourceRefs.length > 0 || previewResult.capabilityTags.length > 0) ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                        <div className="mb-1 font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                          {t("evo.runtime.sourceRefs")}
                        </div>
                        <div className="break-all">
                          {previewResult.sourceRefs.length > 0
                            ? previewResult.sourceRefs.join(", ")
                            : previewResult.sourceRef ?? "—"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                        <div className="mb-1 font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                          {t("evo.knowledge.field.tags")}
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
                        {previewResult.unsafeApply ? t("evo.preview.blocked") : t("evo.preview.confirmation")}
                      </div>
                      <div className="space-y-1.5">
                        {previewResult.unsafeReasons.length > 0 ? previewResult.unsafeReasons.map((reason) => (
                          <div key={reason}>- {reason}</div>
                        )) : <div>{t("evo.preview.confirmation.desc")}</div>}
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
              <div>{renderEvolutionRuntimeMessage(runtimeStatus, t)}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {runtimeStatus.previewStale ? (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                    {t("evo.runtime.previewStale")}
                  </Badge>
                ) : null}
                {runtimeStatus.conflictDetected ? (
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                    {t("evo.runtime.conflict")}
                  </Badge>
                ) : null}
                {runtimeStatus.overrideApplied ? (
                  <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
                    {t("evo.runtime.overrideApplied")}
                  </Badge>
                ) : null}
              </div>
              {runtimeStatus.sourceRefs.length > 0 ? (
                <div className="mt-2 break-all text-[11px] text-slate-500 dark:text-slate-400">
                  {t("evo.runtime.sourceRefs")}: {runtimeStatus.sourceRefs.join(", ")}
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
            {visibleHistoryEntries.map((entry) => {
              const statusLabel = formatHistoryStatus(entry, t);
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
                <div className="mb-1 text-[11px] text-slate-500 dark:text-slate-500">{renderEvolutionHistorySummary(entry, t)}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-500">
                  <span>{formatRelativeTime(entry.createdAtMs, t)}</span>
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
            {!isHistoryLoading && historyEntries.length > RECENT_HISTORY_COLLAPSED_COUNT ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-1 h-auto w-full justify-between rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                onClick={() => setIsRecentHistoryExpanded((current) => !current)}
              >
                <span>
                  {isRecentHistoryExpanded
                    ? t("evo.hist.collapse")
                    : t("evo.hist.expand", hiddenHistoryCount)}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    isRecentHistoryExpanded ? "rotate-180" : ""
                  }`}
                />
              </Button>
            ) : null}
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
                  {formatTemplateLabel(previewResult?.template ?? template, t)}
                </Badge>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 text-sm dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{t("evo.dialog.risk")}</span>
                <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-red-600 dark:bg-red-500/10 dark:text-red-500">{t("evo.dialog.risk.val")}</span>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-2.5 text-sm dark:border-slate-800/60">
                <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">{t("evo.dialog.scope")}</span>
                <span className="text-right text-xs leading-relaxed text-slate-700 dark:text-slate-300">{t("evo.dialog.scope.val", currentNode?.name || t("evo.nodeFallback"))}</span>
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
