import {
  Fragment,
  startTransition,
  useMemo,
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  IdCard,
  Cpu,
  Sparkles,
  Fingerprint,
  Database,
  Hash,
  ArrowRight,
  Activity,
  Terminal,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Copy,
  Check,
  Download,
  FileText,
  Folder,
  Search,
  Settings,
  User,
  Blocks,
  Network,
  X,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useI18n } from "../../contexts/I18nContext";
import {
  gatewayExportMarkdownDocument,
  gatewayAgentIdentityGet,
  gatewayAgentSoulGet,
  gatewayAgentSoulSet,
  gatewayAgentWorkspaceIdentityGet,
  gatewayAgentWorkspaceIdentitySet,
  isTauriRuntimeAvailable,
  useOpenClaw,
  type GatewayAgentFileGetResult,
  type GatewayAgentIdentityResult,
} from "../../contexts/OpenClawContext";
import { applyIdentityMetaToDocument } from "./profileIdentityDocument";
import {
  groupAgentsByNode,
  resolveSelectedAgentIdForNode,
  resolveSelectedProfileNodeName,
} from "./profileNodeState";
import { resolveViewToneClasses } from "./viewTone";

type AgentStatusKey = "active" | "standby" | "sleeping";
type Translate = (key: string, ...args: (string | number)[]) => string;

type AgentDetailsState = {
  isLoaded: boolean;
  identity: GatewayAgentIdentityResult | null;
  soul: GatewayAgentFileGetResult | null;
  workspaceIdentity: GatewayAgentFileGetResult | null;
  error: string | null;
};

type AgentEditableMetaDraft = {
  name: string;
  avatar: string;
};

type DisplayAgent = {
  id: string;
  name: string;
  identityName: string | null;
  nodeId: string;
  node: string;
  avatarColor?: string;
  avatarIcon?: LucideIcon;
  avatarEmoji: string | null;
  avatarUrl: string | null;
  avatarValue: string | null;
  statusKey: AgentStatusKey;
  status: string;
  version: string;
  identity: string;
  tags: string[];
  soulQuote: string;
  stats: {
    memory: number;
    prefs: number;
    health: number;
  };
  detailsError: string | null;
};

type AgentDocumentListItem = {
  ordered: boolean;
  marker: string;
  depth: number;
  text: string;
};

type AgentDocumentBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "code"; language: string | null; text: string }
  | { type: "list"; items: AgentDocumentListItem[] }
  | { type: "divider" };

type AgentDocumentSection = {
  id: string;
  title: string;
  level: number;
  blocks: AgentDocumentBlock[];
  synthetic?: boolean;
};

type AgentDocumentSearchContext = {
  normalizedQuery: string;
  activeMatchIndex: number;
  nextMatchIndex: number;
  registerMatchRef: (matchIndex: number, element: HTMLElement | null) => void;
};

type AgentDocumentSourceMeta = {
  fileName: string | null;
  filePath: string | null;
  workspacePath: string | null;
  suggestedFileName: string;
  isFallback: boolean;
};

const PROFILE_DOC_STATE_STORAGE_PREFIX = "clawscope:profile-doc-state:";
const EXPAND_ALL_OVERSCAN_PX = 160;
const EXPAND_ALL_FALLBACK_VISIBLE_COUNT = 3;
const EXPAND_ALL_BATCH_SIZE = 3;

function statusLabel(status: AgentStatusKey, t: Translate) {
  switch (status) {
    case "active":
      return t("agent.active");
    case "standby":
      return t("agent.standby");
    default:
      return t("agent.sleeping");
  }
}

function stripMarkdown(value: string) {
  return value
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

function extractDocumentTags(markdown?: string | null) {
  if (!markdown) {
    return [] as string[];
  }

  const tags: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const normalized = line.trim();
    if (!normalized) {
      continue;
    }

    const fieldMatch = normalized.match(
      /^[-*]\s*([A-Za-z][A-Za-z0-9 _-]+)\s*:\s*(.+)$/,
    );
    if (!fieldMatch) {
      continue;
    }

    const key = fieldMatch[1].toLowerCase();
    const value = stripMarkdown(fieldMatch[2]);
    if (!value) {
      continue;
    }

    if (["emoji", "theme", "vibe", "creature", "role", "tone"].includes(key)) {
      tags.push(value);
    }
  }

  return Array.from(new Set(tags)).slice(0, 4);
}

function extractIdentityField(
  markdown: string | null | undefined,
  fieldName: string,
) {
  if (!markdown) {
    return null;
  }

  const pattern = new RegExp(`^(?:[-*+]\\s*)?${fieldName}\\s*:\\s*(.+)$`, "i");

  for (const line of markdown.split(/\r?\n/)) {
    const normalized = line.trim();
    if (!normalized) {
      continue;
    }

    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    const value = stripMarkdown(match[1]);
    if (value) {
      return value;
    }
  }

  return null;
}

function parseIdentityMarkdown(markdown?: string | null) {
  return {
    text: markdown?.trim() || null,
    tags: extractDocumentTags(markdown),
    name: extractIdentityField(markdown, "Name"),
    avatar: extractIdentityField(markdown, "Avatar"),
    emoji: extractIdentityField(markdown, "Emoji"),
  };
}

function resolveEditableAvatarValue(avatar?: string | null) {
  if (!avatar) {
    return null;
  }

  const normalized = avatar.trim();
  if (!normalized) {
    return null;
  }

  if (/^[A-Za-z0-9]$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function extractSoulText(markdown?: string | null) {
  return markdown?.trim() || null;
}

function resolveGatewayAvatarUrl(
  avatar?: string | null,
  connectedOrigin?: string | null,
) {
  if (!avatar) {
    return null;
  }

  const trimmed = avatar.trim();
  if (!trimmed) {
    return null;
  }

  if (/^(https?:\/\/|data:image\/)/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/") && connectedOrigin) {
    return `${connectedOrigin.replace(/\/$/, "")}${trimmed}`;
  }

  return null;
}

function countMeaningfulLines(markdown?: string | null) {
  if (!markdown) {
    return 0;
  }

  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function resolveHealth(status: AgentStatusKey) {
  switch (status) {
    case "active":
      return 98;
    case "standby":
      return 86;
    default:
      return 72;
  }
}

function resolveStatusDotClass(status: AgentStatusKey) {
  switch (status) {
    case "active":
      return "bg-emerald-500";
    case "standby":
      return "bg-amber-400";
    default:
      return "bg-slate-300 dark:bg-slate-600";
  }
}

function resolveStatusTextClass(status: AgentStatusKey) {
  switch (status) {
    case "active":
      return "text-emerald-600 dark:text-emerald-400";
    case "standby":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-slate-500 dark:text-slate-400";
  }
}

function formatAgentShortId(agentId: string) {
  const segments = agentId.split("-").filter(Boolean);
  if (segments.length >= 2) {
    return `${segments[0]}-${segments[segments.length - 1]}`;
  }

  if (agentId.length <= 16) {
    return agentId;
  }

  return `${agentId.slice(0, 8)}-${agentId.slice(-4)}`;
}

function formatLoadError(
  error: unknown,
  t?: (key: string, ...args: (string | number)[]) => string,
) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") {
      return record.message;
    }
    if (typeof record.hint === "string") {
      return record.hint;
    }
  }

  return t ? t("profile.error.loadAgentDetails") : "Failed to load agent details.";
}

async function loadAgentDetails(agentId: string): Promise<AgentDetailsState> {
  const [identityResult, soulResult, workspaceIdentityResult] =
    await Promise.allSettled([
      gatewayAgentIdentityGet(agentId),
      gatewayAgentSoulGet(agentId),
      gatewayAgentWorkspaceIdentityGet(agentId),
    ]);

  const firstError = [identityResult, soulResult, workspaceIdentityResult].find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  return {
    isLoaded: true,
    identity:
      identityResult.status === "fulfilled" ? identityResult.value : null,
    soul: soulResult.status === "fulfilled" ? soulResult.value : null,
    workspaceIdentity:
      workspaceIdentityResult.status === "fulfilled"
        ? workspaceIdentityResult.value
        : null,
    error: firstError ? formatLoadError(firstError.reason) : null,
  };
}

function resolveEditableDocumentContent(
  document: GatewayAgentFileGetResult | null | undefined,
) {
  if (!document || document.file.missing) {
    return "";
  }

  return document.file.content ?? "";
}

async function copyTextToClipboard(text: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

function downloadTextFile(fileName: string, text: string) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return;
  }

  const fileBlob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(fileBlob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}

function countMatchesInText(text: string, query: string) {
  if (!text || !query) {
    return 0;
  }

  const source = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  let searchFrom = 0;
  let count = 0;

  while (searchFrom < source.length) {
    const matchIndex = source.indexOf(needle, searchFrom);
    if (matchIndex === -1) {
      break;
    }

    count += 1;
    searchFrom = matchIndex + needle.length;
  }

  return count;
}

function countMatchesInBlock(block: AgentDocumentBlock, query: string) {
  switch (block.type) {
    case "heading":
    case "paragraph":
    case "quote":
    case "code":
      return countMatchesInText(block.text, query);
    case "list":
      return block.items.reduce(
        (total, item) => total + countMatchesInText(item.text, query),
        0,
      );
    case "divider":
    default:
      return 0;
  }
}

function countMatchesInSection(section: AgentDocumentSection, query: string) {
  const titleMatches = section.synthetic
    ? 0
    : countMatchesInText(section.title, query);
  return (
    titleMatches +
    section.blocks.reduce(
      (total, block) => total + countMatchesInBlock(block, query),
      0,
    )
  );
}

function renderTextWithHighlights(
  text: string,
  keyPrefix: string,
  searchContext: AgentDocumentSearchContext | null,
): ReactNode[] {
  if (!searchContext || !searchContext.normalizedQuery) {
    return [text];
  }

  const source = text;
  const normalizedSource = source.toLocaleLowerCase();
  const normalizedQuery = searchContext.normalizedQuery.toLocaleLowerCase();
  const nodes: ReactNode[] = [];
  let searchFrom = 0;
  let segmentIndex = 0;

  while (searchFrom < source.length) {
    const matchIndex = normalizedSource.indexOf(normalizedQuery, searchFrom);
    if (matchIndex === -1) {
      if (searchFrom < source.length) {
        nodes.push(source.slice(searchFrom));
      }
      break;
    }

    if (matchIndex > searchFrom) {
      nodes.push(source.slice(searchFrom, matchIndex));
    }

    const documentMatchIndex = searchContext.nextMatchIndex;
    searchContext.nextMatchIndex += 1;
    const matchedText = source.slice(
      matchIndex,
      matchIndex + normalizedQuery.length,
    );
    const isActive = documentMatchIndex === searchContext.activeMatchIndex;

    nodes.push(
      <mark
        key={`${keyPrefix}-match-${segmentIndex}`}
        ref={(element) => {
          searchContext.registerMatchRef(documentMatchIndex, element);
        }}
        data-doc-match-index={documentMatchIndex}
        className={`rounded px-0.5 py-[1px] ${
          isActive
            ? "bg-sky-500/90 text-white shadow-[0_0_0_1px_rgba(14,165,233,0.35)]"
            : "bg-amber-200/90 text-slate-900 dark:bg-amber-300/75 dark:text-slate-900"
        }`}
      >
        {matchedText}
      </mark>,
    );

    searchFrom = matchIndex + normalizedQuery.length;
    segmentIndex += 1;
  }

  return nodes.length > 0 ? nodes : [text];
}

function parseInlineMarkdown(
  text: string,
  keyPrefix: string,
  searchContext: AgentDocumentSearchContext | null = null,
): ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g);
  const nodes: ReactNode[] = [];

  parts.forEach((part, index) => {
    if (!part) {
      return;
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${index}`}
          className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-sky-700 dark:bg-slate-800 dark:text-sky-300"
        >
          {renderTextWithHighlights(
            part.slice(1, -1),
            `${keyPrefix}-code-${index}`,
            searchContext,
          )}
        </code>,
      );
      return;
    }

    const pattern =
      /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|~~([^~]+)~~)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(part)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(
          ...renderTextWithHighlights(
            part.slice(lastIndex, match.index),
            `${keyPrefix}-text-${index}-${lastIndex}`,
            searchContext,
          ),
        );
      }

      const [
        fullMatch,
        ,
        linkLabel,
        linkHref,
        boldA,
        boldB,
        italicA,
        italicB,
        strike,
      ] = match;
      const matchKey = `${keyPrefix}-inline-${index}-${match.index}`;

      if (linkLabel && linkHref) {
        nodes.push(
          <a
            key={matchKey}
            href={linkHref}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-sky-300 underline-offset-4 transition-colors hover:text-sky-600 dark:decoration-sky-700 dark:hover:text-sky-300"
          >
            {renderTextWithHighlights(
              linkLabel,
              `${matchKey}-label`,
              searchContext,
            )}
          </a>,
        );
      } else if (boldA || boldB) {
        nodes.push(
          <strong
            key={matchKey}
            className="font-semibold text-slate-900 dark:text-slate-100"
          >
            {renderTextWithHighlights(
              boldA || boldB,
              `${matchKey}-bold`,
              searchContext,
            )}
          </strong>,
        );
      } else if (italicA || italicB) {
        nodes.push(
          <em key={matchKey} className="italic">
            {renderTextWithHighlights(
              italicA || italicB,
              `${matchKey}-italic`,
              searchContext,
            )}
          </em>,
        );
      } else if (strike) {
        nodes.push(
          <span key={matchKey} className="line-through opacity-70">
            {renderTextWithHighlights(
              strike,
              `${matchKey}-strike`,
              searchContext,
            )}
          </span>,
        );
      } else {
        nodes.push(fullMatch);
      }

      lastIndex = match.index + fullMatch.length;
    }

    if (lastIndex < part.length) {
      nodes.push(
        ...renderTextWithHighlights(
          part.slice(lastIndex),
          `${keyPrefix}-tail-${index}-${lastIndex}`,
          searchContext,
        ),
      );
    }
  });

  return nodes;
}

function renderCodeTextWithHighlights(
  text: string,
  keyPrefix: string,
  searchContext: AgentDocumentSearchContext | null,
) {
  return text.split("\n").map((line, lineIndex) => (
    <Fragment key={`${keyPrefix}-line-${lineIndex}`}>
      {lineIndex > 0 ? <br /> : null}
      {renderTextWithHighlights(
        line,
        `${keyPrefix}-line-${lineIndex}`,
        searchContext,
      )}
    </Fragment>
  ));
}

function slugifyDocumentSectionId(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

function splitDocumentBlocks(markdown: string): AgentDocumentBlock[] {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: AgentDocumentBlock[] = [];
  let index = 0;

  const isBlockBoundary = (value: string) => {
    const trimmed = value.trim();
    return (
      !trimmed ||
      trimmed.startsWith("```") ||
      /^#{1,6}\s+/.test(trimmed) ||
      /^>\s?/.test(trimmed) ||
      /^[-*+]\s+/.test(trimmed) ||
      /^\d+\.\s+/.test(trimmed) ||
      /^---+$/.test(trimmed)
    );
  };

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim() || null;
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({
        type: "code",
        language,
        text: codeLines.join("\n").trimEnd(),
      });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const nextRaw = lines[index];
        const nextTrimmed = nextRaw.trim();
        if (!nextTrimmed) {
          quoteLines.push("");
          index += 1;
          continue;
        }
        if (!/^>\s?/.test(nextTrimmed)) {
          break;
        }
        quoteLines.push(nextTrimmed.replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({
        type: "quote",
        text: quoteLines
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim(),
      });
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const items: AgentDocumentListItem[] = [];
      while (index < lines.length) {
        const nextRaw = lines[index];
        const nextTrimmed = nextRaw.trim();
        if (!nextTrimmed) {
          index += 1;
          continue;
        }

        const unorderedMatch = nextRaw.match(/^(\s*)[-*+]\s+(.+)$/);
        const orderedMatch = nextRaw.match(/^(\s*)(\d+)\.\s+(.+)$/);
        if (!unorderedMatch && !orderedMatch) {
          break;
        }

        if (unorderedMatch) {
          items.push({
            ordered: false,
            marker: "•",
            depth: Math.floor(unorderedMatch[1].length / 2),
            text: unorderedMatch[2],
          });
        } else if (orderedMatch) {
          items.push({
            ordered: true,
            marker: `${orderedMatch[2]}.`,
            depth: Math.floor(orderedMatch[1].length / 2),
            text: orderedMatch[3],
          });
        }

        index += 1;
      }

      blocks.push({ type: "list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && !isBlockBoundary(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" ").trim(),
    });
  }

  return blocks;
}

function buildDocumentSections(
  blocks: AgentDocumentBlock[],
  t: (key: string, ...args: (string | number)[]) => string,
): AgentDocumentSection[] {
  const sections: AgentDocumentSection[] = [];
  let currentSection: AgentDocumentSection | null = null;
  const sectionIdCounts = new Map<string, number>();

  const nextSectionId = (title: string) => {
    const baseId = slugifyDocumentSectionId(title);
    const count = sectionIdCounts.get(baseId) ?? 0;
    sectionIdCounts.set(baseId, count + 1);
    return count === 0 ? baseId : `${baseId}-${count + 1}`;
  };

  const pushCurrent = () => {
    if (
      currentSection &&
      (currentSection.synthetic || currentSection.blocks.length > 0)
    ) {
      sections.push(currentSection);
    }
  };

  for (const block of blocks) {
    if (block.type === "heading" && block.level <= 2) {
      pushCurrent();
      currentSection = {
        id: nextSectionId(block.text),
        title: block.text,
        level: block.level,
        blocks: [],
      };
      continue;
    }

    if (!currentSection) {
      currentSection = {
        id: nextSectionId("overview"),
        title: t("profile.doc.overview"),
        level: 1,
        blocks: [],
        synthetic: true,
      };
    }

    currentSection.blocks.push(block);
  }

  pushCurrent();
  return sections;
}

function headingClassName(level: number, tone: "identity" | "soul") {
  if (level <= 1) {
    return tone === "soul"
      ? "mt-6 first:mt-0 text-2xl md:text-[1.85rem] font-semibold tracking-tight text-violet-950 dark:text-violet-100"
      : "mt-6 first:mt-0 text-2xl md:text-[1.85rem] font-semibold tracking-tight text-slate-900 dark:text-slate-100";
  }

  if (level === 2) {
    return tone === "soul"
      ? "mt-5 first:mt-0 text-xl md:text-[1.35rem] font-semibold text-violet-900 dark:text-violet-200"
      : "mt-5 first:mt-0 text-xl md:text-[1.35rem] font-semibold text-slate-900 dark:text-slate-100";
  }

  return tone === "soul"
    ? "mt-4 first:mt-0 text-sm md:text-[0.95rem] font-semibold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300"
    : "mt-4 first:mt-0 text-sm md:text-[0.95rem] font-semibold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300";
}

function CopyCodeButton({
  copied,
  onCopy,
}: {
  copied: boolean;
  onCopy: () => void;
}) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${
        copied
          ? "border-emerald-400 bg-emerald-500 text-white shadow-[0_0_0_1px_rgba(74,222,128,0.35)]"
          : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-sky-600 hover:text-white"
      }`}
      aria-label={copied ? t("profile.doc.copied") : t("profile.doc.copy")}
      title={copied ? t("profile.doc.copied") : t("profile.doc.copy")}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      <span>{copied ? t("profile.doc.copied") : t("profile.doc.copy")}</span>
    </button>
  );
}

function AgentDocumentBlocks({
  blocks,
  tone,
  sectionKey,
  searchContext,
}: {
  blocks: AgentDocumentBlock[];
  tone: "identity" | "soul";
  sectionKey: string;
  searchContext: AgentDocumentSearchContext | null;
}) {
  const { t } = useI18n();

  return (
    <div className="max-w-[78ch] space-y-4">
      {blocks.map((block, blockIndex) => {
        const key = `${sectionKey}-${block.type}-${blockIndex}`;

        if (block.type === "heading") {
          return (
            <div key={key} className={headingClassName(block.level, tone)}>
              {parseInlineMarkdown(block.text, key, searchContext)}
            </div>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p
              key={key}
              className="break-words text-[15px] leading-8 text-slate-700 dark:text-slate-300"
            >
              {parseInlineMarkdown(block.text, key, searchContext)}
            </p>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={key}
              className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white px-5 py-4 text-slate-700 shadow-sm dark:border-slate-700/80 dark:from-slate-900 dark:to-slate-900 dark:text-slate-300"
            >
              <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-violet-400 dark:from-sky-500 dark:to-violet-500" />
              <div className="mb-2 pl-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                {t("profile.doc.quote")}
              </div>
              {block.text.split("\n").map((line, lineIndex) => (
                <Fragment key={`${key}-quote-${lineIndex}`}>
                  {lineIndex > 0 ? <br /> : null}
                  {parseInlineMarkdown(
                    line,
                    `${key}-quote-${lineIndex}`,
                    searchContext,
                  )}
                </Fragment>
              ))}
            </blockquote>
          );
        }

        if (block.type === "code") {
          return (
            <CodeBlockPanel
              key={key}
              language={block.language}
              text={block.text}
              searchContext={searchContext}
            />
          );
        }

        if (block.type === "list") {
          return (
            <div key={key} className="space-y-3.5">
              {block.items.map((item, itemIndex) => (
                <div
                  key={`${key}-item-${itemIndex}`}
                  className="relative flex items-start gap-3 rounded-xl px-3.5 py-3"
                  style={{
                    marginInlineStart: `${item.depth * 24}px`,
                    background:
                      item.depth > 0
                        ? "rgba(148, 163, 184, 0.06)"
                        : "transparent",
                  }}
                >
                  <span className="mt-[2px] min-w-[1.75rem] font-mono text-xs font-semibold text-sky-600 dark:text-sky-300">
                    {item.marker}
                  </span>
                  <div className="min-w-0 flex-1 break-words leading-7 text-slate-700 dark:text-slate-300">
                    {parseInlineMarkdown(
                      item.text,
                      `${key}-item-${itemIndex}`,
                      searchContext,
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div
            key={key}
            className="relative my-7 flex items-center justify-center"
          >
            <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
            <div className="absolute h-2.5 w-2.5 rounded-full border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900" />
          </div>
        );
      })}
    </div>
  );
}

function CodeBlockPanel({
  language,
  text,
  searchContext,
}: {
  language: string | null;
  text: string;
  searchContext: AgentDocumentSearchContext | null;
}) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  const updateShadows = () => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const scrollable = element.scrollWidth > element.clientWidth + 8;
    setShowLeftShadow(scrollable && element.scrollLeft > 4);
    setShowRightShadow(
      scrollable &&
        element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
    );
  };

  useEffect(() => {
    const raf = window.requestAnimationFrame(updateShadows);
    const handleResize = () => updateShadows();
    window.addEventListener("resize", handleResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
    };
  }, [text]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopied(true);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {language || "code"}
        </div>
        <CopyCodeButton copied={copied} onCopy={() => void handleCopy()} />
      </div>
      <div className="relative">
        {copied ? (
          <div className="pointer-events-none absolute right-4 top-3 z-20 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-emerald-950/30">
            {t("profile.doc.copiedToClipboard")}
          </div>
        ) : null}
        {showLeftShadow ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white via-white/90 to-transparent dark:from-slate-950 dark:via-slate-950/85" />
        ) : null}
        {showRightShadow ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white via-white/90 to-transparent dark:from-slate-950 dark:via-slate-950/85" />
        ) : null}
        <pre
          ref={scrollRef}
          onScroll={updateShadows}
          className="overflow-x-auto px-4 py-4 text-[12px] leading-6 text-slate-800 dark:text-slate-100"
        >
          <code>
            {renderCodeTextWithHighlights(
              text,
              `code-${language || "plain"}`,
              searchContext,
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}

function SourceMetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5 md:grid-cols-[88px_minmax(0,1fr)] md:gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className="break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-[12px] leading-6 text-slate-700 dark:bg-slate-950/60 dark:text-slate-200">
        {value}
      </div>
    </div>
  );
}

function AgentDocument({
  content,
  tone,
  storageKey,
  source,
}: {
  content: string;
  tone: "identity" | "soul";
  storageKey: string;
  source: AgentDocumentSourceMeta | null;
}) {
  const { t } = useI18n();
  const blocks = splitDocumentBlocks(content);
  const sections = buildDocumentSections(blocks, t);
  const baseTextClass =
    tone === "soul"
      ? "text-slate-700 dark:text-slate-300"
      : "text-slate-800 dark:text-slate-200";
  const hasDirectorySections =
    sections.some((section) => !section.synthetic) && sections.length > 1;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [isSourcePanelOpen, setIsSourcePanelOpen] = useState(false);
  const [copiedAction, setCopiedAction] = useState<"raw" | "path" | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isProgressivelyExpanding, setIsProgressivelyExpanding] =
    useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const matchRefs = useRef<Record<number, HTMLElement | null>>({});
  const pendingExpandIdsRef = useRef<string[]>([]);
  const expandFrameRef = useRef<number | null>(null);
  const documentStateStorageKey = `${PROFILE_DOC_STATE_STORAGE_PREFIX}${storageKey}`;
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const sectionMatchCounts = Object.fromEntries(
    sections.map((section) => [
      section.id,
      normalizedSearchQuery
        ? countMatchesInSection(section, normalizedSearchQuery)
        : 0,
    ]),
  ) as Record<string, number>;
  const totalMatches = normalizedSearchQuery
    ? sections.reduce(
        (total, section) => total + (sectionMatchCounts[section.id] ?? 0),
        0,
      )
    : 0;
  const registerMatchRef = (
    matchIndex: number,
    element: HTMLElement | null,
  ) => {
    if (element) {
      matchRefs.current[matchIndex] = element;
      return;
    }

    delete matchRefs.current[matchIndex];
  };
  const searchContext: AgentDocumentSearchContext | null = normalizedSearchQuery
    ? {
        normalizedQuery: normalizedSearchQuery,
        activeMatchIndex,
        nextMatchIndex: 0,
        registerMatchRef,
      }
    : null;

  const createDefaultOpenSections = () =>
    Object.fromEntries(
      sections.map((section, index) => [
        section.id,
        index === 0 || section.level === 1,
      ]),
    );

  const cancelPendingExpansion = () => {
    pendingExpandIdsRef.current = [];
    if (expandFrameRef.current !== null) {
      window.cancelAnimationFrame(expandFrameRef.current);
      expandFrameRef.current = null;
    }
    setIsProgressivelyExpanding(false);
  };

  const scheduleNextExpandBatch = () => {
    if (pendingExpandIdsRef.current.length === 0) {
      expandFrameRef.current = null;
      setIsProgressivelyExpanding(false);
      return;
    }

    expandFrameRef.current = window.requestAnimationFrame(() => {
      const nextBatch = pendingExpandIdsRef.current.splice(
        0,
        EXPAND_ALL_BATCH_SIZE,
      );
      if (nextBatch.length > 0) {
        startTransition(() => {
          setOpenSections((previous) => ({
            ...previous,
            ...Object.fromEntries(
              nextBatch.map((sectionId) => [sectionId, true]),
            ),
          }));
        });
      }

      scheduleNextExpandBatch();
    });
  };

  const getVisibleSectionIds = () => {
    if (typeof window === "undefined") {
      return sections
        .slice(0, EXPAND_ALL_FALLBACK_VISIBLE_COUNT)
        .map((section) => section.id);
    }

    const visibleSectionIds = sections
      .filter((section) => {
        const element = sectionRefs.current[section.id];
        if (!element) {
          return false;
        }

        const bounds = element.getBoundingClientRect();
        return (
          bounds.bottom >= -EXPAND_ALL_OVERSCAN_PX &&
          bounds.top <= window.innerHeight + EXPAND_ALL_OVERSCAN_PX
        );
      })
      .map((section) => section.id);

    if (visibleSectionIds.length > 0) {
      return visibleSectionIds;
    }

    return sections
      .slice(0, EXPAND_ALL_FALLBACK_VISIBLE_COUNT)
      .map((section) => section.id);
  };

  useEffect(() => {
    cancelPendingExpansion();

    if (!hasDirectorySections) {
      setOpenSections({});
      return;
    }

    const defaults = createDefaultOpenSections();

    try {
      const raw = localStorage.getItem(documentStateStorageKey);
      if (!raw) {
        setOpenSections(defaults);
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const restoredOpenSections = Object.fromEntries(
        sections.map((section) => [
          section.id,
          typeof parsed[section.id] === "boolean"
            ? parsed[section.id]
            : defaults[section.id],
        ]),
      ) as Record<string, boolean>;
      setOpenSections(restoredOpenSections);
    } catch {
      setOpenSections(defaults);
    }
  }, [content, documentStateStorageKey, hasDirectorySections]);

  useEffect(() => {
    matchRefs.current = {};
    setSearchQuery("");
    setActiveMatchIndex(-1);
    setIsSourcePanelOpen(false);
    setCopiedAction(null);
    setIsExporting(false);
  }, [content, storageKey]);

  useEffect(() => {
    if (!copiedAction) {
      return;
    }

    const timer = window.setTimeout(() => setCopiedAction(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedAction]);

  useEffect(() => {
    if (!hasDirectorySections) {
      return;
    }

    if (Object.keys(openSections).length !== sections.length) {
      return;
    }

    if (isProgressivelyExpanding) {
      return;
    }

    localStorage.setItem(documentStateStorageKey, JSON.stringify(openSections));
  }, [
    documentStateStorageKey,
    hasDirectorySections,
    isProgressivelyExpanding,
    openSections,
    sections.length,
  ]);

  useEffect(() => {
    const validSectionIds = new Set(sections.map((section) => section.id));
    Object.keys(sectionRefs.current).forEach((sectionId) => {
      if (!validSectionIds.has(sectionId)) {
        delete sectionRefs.current[sectionId];
      }
    });
  }, [sections]);

  useEffect(() => () => cancelPendingExpansion(), []);

  useEffect(() => {
    matchRefs.current = {};

    if (!normalizedSearchQuery) {
      setActiveMatchIndex(-1);
      return;
    }

    cancelPendingExpansion();
    setActiveMatchIndex(0);
  }, [normalizedSearchQuery]);

  useEffect(() => {
    if (!normalizedSearchQuery) {
      return;
    }

    if (totalMatches === 0) {
      setActiveMatchIndex(-1);
      return;
    }

    setActiveMatchIndex((previous) => {
      if (previous < 0 || previous >= totalMatches) {
        return 0;
      }

      return previous;
    });
  }, [normalizedSearchQuery, totalMatches]);

  useEffect(() => {
    if (!normalizedSearchQuery || activeMatchIndex < 0 || totalMatches === 0) {
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      matchRefs.current[activeMatchIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });

    return () => window.cancelAnimationFrame(raf);
  }, [activeMatchIndex, normalizedSearchQuery, totalMatches]);

  const toggleSection = (sectionId: string) => {
    cancelPendingExpansion();
    setOpenSections((previous) => ({
      ...previous,
      [sectionId]: !previous[sectionId],
    }));
  };

  const expandAllSections = () => {
    cancelPendingExpansion();

    const visibleSectionIds = getVisibleSectionIds();
    const initiallyOpenSectionIds = sections
      .filter((section) => openSections[section.id])
      .map((section) => section.id);
    const immediateOpenSectionIds = new Set([
      ...visibleSectionIds,
      ...initiallyOpenSectionIds,
    ]);
    const remainingSectionIds = sections
      .map((section) => section.id)
      .filter((sectionId) => !immediateOpenSectionIds.has(sectionId));

    startTransition(() => {
      setOpenSections(
        Object.fromEntries(
          sections.map((section) => [
            section.id,
            immediateOpenSectionIds.has(section.id),
          ]),
        ),
      );
    });

    if (remainingSectionIds.length === 0) {
      return;
    }

    pendingExpandIdsRef.current = remainingSectionIds;
    setIsProgressivelyExpanding(true);
    scheduleNextExpandBatch();
  };

  const collapseAllSections = () => {
    cancelPendingExpansion();
    setOpenSections(
      Object.fromEntries(sections.map((section) => [section.id, false])),
    );
  };

  const jumpToPreviousMatch = () => {
    if (totalMatches === 0) {
      return;
    }

    setActiveMatchIndex((previous) => {
      if (previous <= 0) {
        return totalMatches - 1;
      }

      return previous - 1;
    });
  };

  const jumpToNextMatch = () => {
    if (totalMatches === 0) {
      return;
    }

    setActiveMatchIndex((previous) => {
      if (previous < 0 || previous >= totalMatches - 1) {
        return 0;
      }

      return previous + 1;
    });
  };

  const handleCopyRaw = async () => {
    const success = await copyTextToClipboard(content);
    if (success) {
      setCopiedAction("raw");
    }
  };

  const handleCopyPath = async () => {
    const pathValue = source?.filePath || source?.workspacePath;
    if (!pathValue) {
      return;
    }

    const success = await copyTextToClipboard(pathValue);
    if (success) {
      setCopiedAction("path");
    }
  };

  const handleExport = async () => {
    const suggestedFileName = source?.suggestedFileName || `${tone}.md`;
    setIsExporting(true);

    try {
      if (isTauriRuntimeAvailable()) {
        const exportedPath = await gatewayExportMarkdownDocument(
          suggestedFileName,
          content,
        );
        if (exportedPath) {
          toast.success(t("profile.doc.exported"), { duration: 2200 });
        }
        return;
      }

      downloadTextFile(suggestedFileName, content);
      toast.success(t("profile.doc.exported"), { duration: 2200 });
    } catch (error) {
      console.error("Failed to export markdown document", error);
      toast.error(t("profile.doc.exportFailed"), { duration: 2600 });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className={`space-y-4 text-[14px] md:text-[15px] leading-8 ${baseTextClass}`}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3.5 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/60">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("profile.doc.searchPlaceholder")}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:bg-white dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-sky-700"
              autoComplete="off"
              spellCheck={false}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label={t("profile.doc.clearSearch")}
                title={t("profile.doc.clearSearch")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {normalizedSearchQuery ? (
            <>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                {totalMatches > 0
                  ? `${activeMatchIndex + 1} / ${totalMatches}`
                  : t("profile.doc.noMatches")}
              </div>
              <button
                type="button"
                onClick={jumpToPreviousMatch}
                disabled={totalMatches === 0}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
                aria-label={t("profile.doc.previousMatch")}
                title={t("profile.doc.previousMatch")}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={jumpToNextMatch}
                disabled={totalMatches === 0}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
                aria-label={t("profile.doc.nextMatch")}
                title={t("profile.doc.nextMatch")}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setIsSourcePanelOpen((previous) => !previous)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
          >
            <FileText className="h-3.5 w-3.5" />
            {t("profile.doc.source")}
          </button>
          <button
            type="button"
            onClick={() => void handleCopyRaw()}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              copiedAction === "raw"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
            }`}
          >
            {copiedAction === "raw" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copiedAction === "raw"
              ? t("profile.doc.copied")
              : t("profile.doc.copyRaw")}
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
          >
            {isExporting ? (
              <Activity className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {isExporting ? t("profile.doc.exporting") : t("profile.doc.export")}
          </button>
          {hasDirectorySections ? (
            <>
              <button
                type="button"
                onClick={expandAllSections}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
              >
                {t("profile.doc.expandAll")}
              </button>
              <button
                type="button"
                onClick={collapseAllSections}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
              >
                {t("profile.doc.collapseAll")}
              </button>
            </>
          ) : null}
        </div>
        {isSourcePanelOpen ? (
          <div className="space-y-3.5 rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4.5 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/60">
            {source?.fileName || source?.filePath || source?.workspacePath ? (
              <>
                {source.fileName ? (
                  <SourceMetadataRow
                    label={t("profile.doc.fileName")}
                    value={source.fileName}
                  />
                ) : null}
                {source.filePath ? (
                  <SourceMetadataRow
                    label={t("profile.doc.sourcePath")}
                    value={source.filePath}
                  />
                ) : null}
                {source.workspacePath ? (
                  <SourceMetadataRow
                    label={t("profile.doc.workspace")}
                    value={source.workspacePath}
                  />
                ) : null}
                {source.isFallback ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
                    {t("profile.doc.sourceUnavailable")}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleCopyPath()}
                    disabled={!source.filePath && !source.workspacePath}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      copiedAction === "path"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
                    }`}
                  >
                    {copiedAction === "path" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Folder className="h-3.5 w-3.5" />
                    )}
                    {copiedAction === "path"
                      ? t("profile.doc.copied")
                      : t("profile.doc.copyPath")}
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
                {t("profile.doc.sourceUnavailable")}
              </div>
            )}
          </div>
        ) : null}
        {hasDirectorySections ? (
          <>
            {sections.map((section, index) => {
              const isSectionMatched =
                (sectionMatchCounts[section.id] ?? 0) > 0;
              const isOpen =
                (openSections[section.id] ?? false) ||
                (normalizedSearchQuery.length > 0 && isSectionMatched);
              const sectionTitle =
                index === 0 && section.synthetic
                  ? t("profile.doc.overview")
                  : section.title;
              const sectionContentStyle: CSSProperties = isOpen
                ? {
                    contentVisibility: "auto",
                    containIntrinsicSize: "0 360px",
                  }
                : {};
              return (
                <div
                  key={section.id}
                  ref={(element) => {
                    sectionRefs.current[section.id] = element;
                  }}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/55"
                  style={{
                    marginInlineStart: `${Math.max(section.level - 1, 0) * 10}px`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90 text-sky-500" : ""}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {section.synthetic
                          ? sectionTitle
                          : parseInlineMarkdown(
                              sectionTitle,
                              `${tone}-${section.id}-title`,
                              searchContext,
                            )}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                        {index === 0 && section.synthetic
                          ? t("profile.doc.overview")
                          : `level h${section.level}`}
                      </div>
                    </div>
                  </button>
                  {isOpen ? (
                    <div
                      className="border-t border-slate-200/80 px-5 py-5 dark:border-slate-700/70"
                      style={sectionContentStyle}
                    >
                      <AgentDocumentBlocks
                        blocks={section.blocks}
                        tone={tone}
                        sectionKey={`${tone}-${section.id}`}
                        searchContext={searchContext}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-5 py-5 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/55">
            <AgentDocumentBlocks
              blocks={blocks}
              tone={tone}
              sectionKey={`${tone}-root`}
              searchContext={searchContext}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AgentAvatar({
  agent,
  containerClassName,
  iconClassName,
  emojiClassName,
}: {
  agent: DisplayAgent;
  containerClassName: string;
  iconClassName: string;
  emojiClassName: string;
}) {
  const AgentIcon = agent.avatarIcon || Cpu;

  return (
    <div
      className={`overflow-hidden bg-gradient-to-br ${agent.avatarColor || "from-slate-400 to-slate-600"} flex items-center justify-center shrink-0 shadow-inner ${containerClassName}`}
    >
      {agent.avatarUrl ? (
        <img
          src={agent.avatarUrl}
          alt={agent.name}
          className="h-full w-full object-cover"
        />
      ) : agent.avatarEmoji ? (
        <span className={emojiClassName} aria-hidden="true">
          {agent.avatarEmoji}
        </span>
      ) : (
        <AgentIcon className={iconClassName} />
      )}
    </div>
  );
}

function ProfileDetailField({
  label,
  value,
  isEditing,
  onChange,
  placeholder,
  monospace = false,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  placeholder: string;
  monospace?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2.5">
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
        {label}
      </span>
      {isEditing ? (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-12 rounded-2xl border border-slate-200/90 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:shadow-[0_0_0_4px_rgba(186,230,253,0.55)] dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:shadow-[0_0_0_4px_rgba(14,165,233,0.18)] ${
            monospace ? "font-mono" : ""
          }`}
        />
      ) : (
        <div
          className={`min-h-12 overflow-hidden rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 text-sm leading-7 text-slate-700 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 ${
            monospace ? "font-mono" : ""
          }`}
        >
          {value ? (
            <span
              className={
                monospace
                  ? "block break-all whitespace-pre-wrap"
                  : "block break-words whitespace-pre-wrap"
              }
            >
              {value}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">-</span>
          )}
        </div>
      )}
    </label>
  );
}

function ProfileSectionHeader({
  icon: Icon,
  title,
  tone,
  meta,
  isDirty = false,
  dirtyLabel,
}: {
  icon: LucideIcon;
  title: string;
  tone: "sky" | "violet";
  meta?: string;
  isDirty?: boolean;
  dirtyLabel: string;
}) {
  const toneClasses = resolveViewToneClasses(tone);

  return (
    <div className="flex items-start gap-3">
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${toneClasses.softBadge}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={`text-[13px] font-bold uppercase tracking-[0.22em] ${toneClasses.title}`}
          >
            {title}
          </h3>
          {isDirty ? (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
              {dirtyLabel}
            </span>
          ) : null}
        </div>
        {meta ? (
          <p className={`mt-1 text-xs ${toneClasses.meta}`}>{meta}</p>
        ) : null}
      </div>
    </div>
  );
}

function ProfileSectionCard({
  tone,
  className = "",
  children,
}: {
  tone: "sky" | "violet";
  className?: string;
  children: ReactNode;
}) {
  const toneClasses = resolveViewToneClasses(tone);

  return (
    <div
      className={`relative overflow-hidden rounded-[26px] border border-slate-200/90 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-colors dark:border-slate-800 dark:bg-slate-950/80 before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-0.5 before:rounded-full after:pointer-events-none after:absolute after:inset-y-5 after:left-0 after:w-1 after:rounded-r-full rtl:after:left-auto rtl:after:right-0 rtl:after:rounded-l-full rtl:after:rounded-r-none md:p-5 ${toneClasses.cardAccent} ${className}`}
    >
      {children}
    </div>
  );
}

function ProfileActionButton({
  variant,
  tone = "sky",
  disabled = false,
  onClick,
  children,
}: {
  variant: "secondary" | "primary";
  tone?: "sky" | "violet";
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const toneClasses = resolveViewToneClasses(tone);
  const className =
    variant === "primary"
      ? "inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      : `rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${toneClasses.actionSecondary}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  );
}

function ProfileSectionActions({
  visible,
  isEditing,
  isSaving,
  reloadDisabled,
  editDisabled,
  tone = "sky",
  onReload,
  onEdit,
  onCancel,
  onSave,
  reloadLabel,
  editLabel,
  cancelLabel,
  saveLabel,
  savingLabel,
}: {
  visible: boolean;
  isEditing: boolean;
  isSaving: boolean;
  reloadDisabled: boolean;
  editDisabled: boolean;
  tone?: "sky" | "violet";
  onReload: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  reloadLabel: string;
  editLabel: string;
  cancelLabel: string;
  saveLabel: string;
  savingLabel: string;
}) {
  if (!visible) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 md:justify-end">
      <ProfileActionButton
        variant="secondary"
        tone={tone}
        onClick={onReload}
        disabled={reloadDisabled}
      >
        {reloadLabel}
      </ProfileActionButton>
      {isEditing ? (
        <>
          <ProfileActionButton
            variant="secondary"
            tone={tone}
            onClick={onCancel}
            disabled={isSaving}
          >
            {cancelLabel}
          </ProfileActionButton>
          <ProfileActionButton
            variant="primary"
            tone={tone}
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? <Activity className="h-3.5 w-3.5 animate-spin" /> : null}
            {isSaving ? savingLabel : saveLabel}
          </ProfileActionButton>
        </>
      ) : (
        <ProfileActionButton
          variant="primary"
          tone={tone}
          onClick={onEdit}
          disabled={editDisabled}
        >
          {editLabel}
        </ProfileActionButton>
      )}
    </div>
  );
}

function ProfileStatCard({
  tone,
  label,
  value,
  unit,
  labelIcon: LabelIcon,
  metricIcon: MetricIcon,
}: {
  tone: "sky" | "violet" | "emerald";
  label: string;
  value: string;
  unit?: string;
  labelIcon: LucideIcon;
  metricIcon: LucideIcon;
}) {
  const toneClasses = resolveViewToneClasses(tone);

  return (
    <div
      className={`relative min-w-[200px] snap-center flex-1 overflow-hidden rounded-[24px] border border-slate-200/90 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-colors before:pointer-events-none before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full md:min-w-0 md:p-5 dark:border-slate-800 dark:bg-slate-950/80 ${toneClasses.cardAccent} ${toneClasses.cardHover}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 md:text-sm">
            <LabelIcon className={`h-3.5 w-3.5 ${toneClasses.iconText}`} />
            {label}
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 md:text-3xl">
            {value}{" "}
            {unit ? (
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500 md:text-sm">
                {unit}
              </span>
            ) : null}
          </div>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full md:h-12 md:w-12 ${toneClasses.metricBadge}`}
        >
          <MetricIcon className="h-4 w-4 md:h-5 md:w-5" />
        </div>
      </div>
    </div>
  );
}

function ProfileDocumentEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200/90 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-950/50">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className="min-h-[320px] w-full resize-y rounded-[24px] bg-transparent px-4 py-4 font-mono text-[13px] leading-6 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
  );
}

export function ProfileView() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const {
    agents: realAgents,
    nodes: realNodes,
    isConnected,
    connectedOrigin,
    grantedScopes,
  } = useOpenClaw();

  const MOCK_AGENTS_BACKUP: DisplayAgent[] = [
    {
      id: "c-7f8a-99x",
      name: "ClawScope AI",
      identityName: "ClawScope AI",
      nodeId: "node-local",
      node: "OpenClaw-Local",
      avatarColor: "from-sky-400 to-blue-600",
      avatarIcon: Cpu,
      avatarEmoji: null,
      avatarUrl: null,
      avatarValue: null,
      statusKey: "active" as const,
      status: statusLabel("active", t),
      version: "v1.0.4-local",
      identity: t("agent.1.identity"),
      tags: [t("agent.1.tag.1"), t("agent.1.tag.2"), t("agent.1.tag.3")],
      soulQuote: t("agent.1.soul"),
      stats: { memory: 1024, prefs: 12, health: 85 },
      detailsError: null,
    },
    {
      id: "a-3m2b-88z",
      name: "CodeReviewer",
      identityName: "CodeReviewer",
      nodeId: "node-local",
      node: "OpenClaw-Local",
      avatarColor: "from-emerald-400 to-teal-600",
      avatarIcon: Terminal,
      avatarEmoji: null,
      avatarUrl: null,
      avatarValue: null,
      statusKey: "standby" as const,
      status: statusLabel("standby", t),
      version: "v2.1.0-remote",
      identity: t("agent.2.identity"),
      tags: [t("agent.2.tag.1"), t("agent.2.tag.2"), t("agent.2.tag.3")],
      soulQuote: t("agent.2.soul"),
      stats: { memory: 8450, prefs: 5, health: 92 },
      detailsError: null,
    },
    {
      id: "u-9k1c-11y",
      nodeId: "node-west",
      name: "StoryCrafter",
      identityName: "StoryCrafter",
      node: "OpenClaw-West",
      avatarColor: "from-fuchsia-400 to-purple-600",
      avatarIcon: Sparkles,
      avatarEmoji: null,
      avatarUrl: null,
      avatarValue: null,
      statusKey: "sleeping" as const,
      status: statusLabel("sleeping", t),
      version: "v0.9.beta",
      identity: t("agent.3.identity"),
      tags: [t("agent.3.tag.1"), t("agent.3.tag.2"), t("agent.3.tag.3")],
      soulQuote: t("agent.3.soul"),
      stats: { memory: 320, prefs: 24, health: 98 },
      detailsError: null,
    },
  ];

  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedAgentRevision, setSelectedAgentRevision] = useState(0);
  const [agentDetailsById, setAgentDetailsById] = useState<
    Record<string, AgentDetailsState>
  >({});
  const [identityMetaDraft, setIdentityMetaDraft] =
    useState<AgentEditableMetaDraft>({
      name: "",
      avatar: "",
    });
  const [identityDocDraft, setIdentityDocDraft] = useState("");
  const [soulDocDraft, setSoulDocDraft] = useState("");
  const [isEditingIdentityMeta, setIsEditingIdentityMeta] = useState(false);
  const [isEditingIdentityDoc, setIsEditingIdentityDoc] = useState(false);
  const [isEditingSoulDoc, setIsEditingSoulDoc] = useState(false);
  const [isSavingIdentityMeta, setIsSavingIdentityMeta] = useState(false);
  const [isSavingIdentityDoc, setIsSavingIdentityDoc] = useState(false);
  const [isSavingSoulDoc, setIsSavingSoulDoc] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasRealAgents = isConnected && realAgents.length > 0;

  useEffect(() => {
    const candidateAgents = hasRealAgents ? realAgents : MOCK_AGENTS_BACKUP;
    if (candidateAgents.length === 0) {
      if (selectedAgentId !== "") {
        setSelectedAgentId("");
      }
      return;
    }

    if (!candidateAgents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(candidateAgents[0].id);
    }
  }, [hasRealAgents, realAgents, selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId) {
      return;
    }

    setSelectedAgentRevision((previous) => previous + 1);
  }, [selectedAgentId]);

  useEffect(() => {
    if (!hasRealAgents || !selectedAgentId) {
      return;
    }

    if (agentDetailsById[selectedAgentId]?.isLoaded) {
      return;
    }

    let cancelled = false;

    const loadSelectedAgentDetails = async () => {
      const nextDetails = await loadAgentDetails(selectedAgentId);
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setAgentDetailsById((previous) => ({
          ...previous,
          [selectedAgentId]: nextDetails,
        }));
      });
    };

    void loadSelectedAgentDetails();

    return () => {
      cancelled = true;
    };
  }, [agentDetailsById, hasRealAgents, selectedAgentId]);

  const displayAgents: DisplayAgent[] = hasRealAgents
    ? realAgents.map((agent) => {
        const backup = MOCK_AGENTS_BACKUP.find((item) => item.id === agent.id);
        const details = agentDetailsById[agent.id];
        const identityMarkdown = details?.workspaceIdentity?.file.missing
          ? null
          : details?.workspaceIdentity?.file.content;
        const soulMarkdown = details?.soul?.file.missing
          ? null
          : details?.soul?.file.content;
        const parsedIdentity = parseIdentityMarkdown(identityMarkdown);
        const resolvedAgentName =
          parsedIdentity.name ||
          agent.name ||
          details?.identity?.name?.trim() ||
          backup?.name ||
          agent.id;
        const resolvedAvatarValue =
          parsedIdentity.avatar || details?.identity?.avatar?.trim() || null;
        const editableAvatarValue =
          parsedIdentity.avatar ||
          resolveEditableAvatarValue(details?.identity?.avatar) ||
          null;

        return {
          ...agent,
          name: resolvedAgentName,
          identityName: parsedIdentity.name || resolvedAgentName,
          node:
            realNodes.find((node) => node.id === agent.nodeId)?.name ||
            backup?.node ||
            agent.nodeId ||
            "Local",
          avatarColor:
            agent.avatarColor ||
            backup?.avatarColor ||
            "from-slate-400 to-slate-600",
          avatarIcon: backup?.avatarIcon || Cpu,
          avatarEmoji:
            parsedIdentity.emoji || details?.identity?.emoji?.trim() || null,
          avatarUrl: resolveGatewayAvatarUrl(
            resolvedAvatarValue,
            connectedOrigin,
          ),
          avatarValue: editableAvatarValue,
          statusKey: agent.status,
          status: statusLabel(agent.status, t),
          version: details?.identity?.agentId
            ? `agent:${details.identity.agentId}`
            : t("profile.agentVersionFallback"),
          identity:
            parsedIdentity.text ||
            resolvedAgentName ||
            backup?.identity ||
            t("profile.noIdentity"),
          tags: parsedIdentity.tags,
          soulQuote:
            extractSoulText(soulMarkdown) ||
            backup?.soulQuote ||
            t("profile.noSoulQuote"),
          stats: {
            memory:
              countMeaningfulLines(identityMarkdown) +
              countMeaningfulLines(soulMarkdown),
            prefs: parsedIdentity.tags.length,
            health: resolveHealth(agent.status),
          },
          detailsError: details?.error || null,
        };
      })
    : MOCK_AGENTS_BACKUP.map((agent) => ({
        ...agent,
        identityName: agent.name,
        avatarValue: null,
        status: statusLabel(agent.statusKey, t),
      }));

  const activeAgent =
    displayAgents.find((agent) => agent.id === selectedAgentId) ??
    displayAgents[0] ??
    null;
  const activeAgentError = activeAgent?.detailsError || null;
  const activeAgentDetails = activeAgent
    ? agentDetailsById[activeAgent.id]
    : null;
  const activeIdentitySource =
    activeAgentDetails?.workspaceIdentity &&
    !activeAgentDetails.workspaceIdentity.file.missing
      ? {
          fileName: activeAgentDetails.workspaceIdentity.file.name,
          filePath: activeAgentDetails.workspaceIdentity.file.path,
          workspacePath: activeAgentDetails.workspaceIdentity.workspace,
          suggestedFileName: `${activeAgent?.id || "agent"}-${activeAgentDetails.workspaceIdentity.file.name}`,
          isFallback: false,
        }
      : {
          fileName: "IDENTITY.md",
          filePath: null,
          workspacePath: null,
          suggestedFileName: `${activeAgent?.id || "agent"}-IDENTITY.md`,
          isFallback: true,
        };
  const activeSoulSource =
    activeAgentDetails?.soul && !activeAgentDetails.soul.file.missing
      ? {
          fileName: activeAgentDetails.soul.file.name,
          filePath: activeAgentDetails.soul.file.path,
          workspacePath: activeAgentDetails.soul.workspace,
          suggestedFileName: `${activeAgent?.id || "agent"}-${activeAgentDetails.soul.file.name}`,
          isFallback: false,
        }
      : {
          fileName: "SOUL.md",
          filePath: null,
          workspacePath: null,
          suggestedFileName: `${activeAgent?.id || "agent"}-SOUL.md`,
          isFallback: true,
        };
  const activeIdentityMetaName =
    activeAgent?.identityName || activeAgent?.name || "";
  const activeIdentityMetaAvatar = activeAgent?.avatarValue || "";
  const activeIdentityDocumentContent = resolveEditableDocumentContent(
    activeAgentDetails?.workspaceIdentity,
  );
  const activeSoulDocumentContent = resolveEditableDocumentContent(
    activeAgentDetails?.soul,
  );
  const hasAdminScope = grantedScopes.includes("operator.admin");
  const canEditActiveAgent =
    hasRealAgents &&
    hasAdminScope &&
    Boolean(activeAgent?.id) &&
    Boolean(activeAgentDetails?.isLoaded);
  const isIdentityMetaDirty =
    identityMetaDraft.name !== activeIdentityMetaName ||
    identityMetaDraft.avatar !== activeIdentityMetaAvatar;
  const isIdentityDocDirty = identityDocDraft !== activeIdentityDocumentContent;
  const isSoulDocDirty = soulDocDraft !== activeSoulDocumentContent;

  useEffect(() => {
    setIsEditingIdentityMeta(false);
    setIsEditingIdentityDoc(false);
    setIsEditingSoulDoc(false);
  }, [activeAgent?.id]);

  useEffect(() => {
    if (!isEditingIdentityMeta) {
      setIdentityMetaDraft({
        name: activeIdentityMetaName,
        avatar: activeIdentityMetaAvatar,
      });
    }
  }, [activeIdentityMetaAvatar, activeIdentityMetaName, isEditingIdentityMeta]);

  useEffect(() => {
    if (!isEditingIdentityDoc) {
      setIdentityDocDraft(activeIdentityDocumentContent);
    }
  }, [activeIdentityDocumentContent, isEditingIdentityDoc]);

  useEffect(() => {
    if (!isEditingSoulDoc) {
      setSoulDocDraft(activeSoulDocumentContent);
    }
  }, [activeSoulDocumentContent, isEditingSoulDoc]);

  const reloadSelectedAgentDetails = async (agentId: string) => {
    const nextDetails = await loadAgentDetails(agentId);

    startTransition(() => {
      setAgentDetailsById((previous) => ({
        ...previous,
        [agentId]: nextDetails,
      }));
    });

    return nextDetails;
  };

  const handleIdentityMetaReload = async () => {
    if (!activeAgent) {
      return;
    }

    setIsEditingIdentityMeta(false);
    try {
      await reloadSelectedAgentDetails(activeAgent.id);
    } catch (error) {
      toast.error(formatLoadError(error, t));
    }
  };

  const handleIdentityMetaSave = async () => {
    if (!activeAgent) {
      return;
    }

    const nextName = identityMetaDraft.name.trim();
    const nextAvatar = identityMetaDraft.avatar.trim();
    const currentName = activeIdentityMetaName.trim();
    const currentAvatar = activeIdentityMetaAvatar.trim();
    const hasNameChange = nextName !== currentName;
    const hasAvatarChange = nextAvatar !== currentAvatar;

    if (!hasNameChange && !hasAvatarChange) {
      setIsEditingIdentityMeta(false);
      return;
    }

    setIsSavingIdentityMeta(true);
    try {
      const nextIdentityDocument = applyIdentityMetaToDocument(
        activeIdentityDocumentContent,
        {
          name: nextName,
          avatar: nextAvatar,
        },
      );

      await gatewayAgentWorkspaceIdentitySet(
        activeAgent.id,
        nextIdentityDocument,
      );
      await reloadSelectedAgentDetails(activeAgent.id);
      setIsEditingIdentityMeta(false);
      toast.success(t("profile.saveSuccess", t("profile.identityFields")));
    } catch (error) {
      toast.error(
        `${t("profile.saveFailed", t("profile.identityFields"))}: ${formatLoadError(error, t)}`,
      );
    } finally {
      setIsSavingIdentityMeta(false);
    }
  };

  const handleIdentityDocumentReload = async () => {
    if (!activeAgent) {
      return;
    }

    setIsEditingIdentityDoc(false);
    try {
      await reloadSelectedAgentDetails(activeAgent.id);
    } catch (error) {
      toast.error(formatLoadError(error, t));
    }
  };

  const handleIdentityDocumentSave = async () => {
    if (!activeAgent || !isIdentityDocDirty) {
      setIsEditingIdentityDoc(false);
      return;
    }

    setIsSavingIdentityDoc(true);
    try {
      await gatewayAgentWorkspaceIdentitySet(activeAgent.id, identityDocDraft);
      await reloadSelectedAgentDetails(activeAgent.id);
      setIsEditingIdentityDoc(false);
      toast.success(t("profile.saveSuccess", t("profile.identity")));
    } catch (error) {
      toast.error(
        `${t("profile.saveFailed", t("profile.identity"))}: ${formatLoadError(error, t)}`,
      );
    } finally {
      setIsSavingIdentityDoc(false);
    }
  };

  const handleSoulDocumentReload = async () => {
    if (!activeAgent) {
      return;
    }

    setIsEditingSoulDoc(false);
    try {
      await reloadSelectedAgentDetails(activeAgent.id);
    } catch (error) {
      toast.error(formatLoadError(error, t));
    }
  };

  const handleSoulDocumentSave = async () => {
    if (!activeAgent || !isSoulDocDirty) {
      setIsEditingSoulDoc(false);
      return;
    }

    setIsSavingSoulDoc(true);
    try {
      await gatewayAgentSoulSet(activeAgent.id, soulDocDraft);
      await reloadSelectedAgentDetails(activeAgent.id);
      setIsEditingSoulDoc(false);
      toast.success(t("profile.saveSuccess", t("profile.soul")));
    } catch (error) {
      toast.error(
        `${t("profile.saveFailed", t("profile.soul"))}: ${formatLoadError(error, t)}`,
      );
    } finally {
      setIsSavingSoulDoc(false);
    }
  };

  const groupedAgents = useMemo(
    () => groupAgentsByNode(displayAgents),
    [displayAgents],
  );
  const nodeEntries = useMemo(() => Object.entries(groupedAgents), [groupedAgents]);
  const nodeNames = useMemo(
    () => nodeEntries.map(([nodeName]) => nodeName),
    [nodeEntries],
  );
  const nodeCount = nodeNames.length;
  const [selectedNodeName, setSelectedNodeName] = useState("");

  useEffect(() => {
    const nextNodeName = resolveSelectedProfileNodeName(
      selectedNodeName,
      nodeNames,
    );
    if (nextNodeName !== selectedNodeName) {
      setSelectedNodeName(nextNodeName);
    }
  }, [nodeNames, selectedNodeName]);

  useEffect(() => {
    if (activeAgent?.node && activeAgent.node !== selectedNodeName) {
      setSelectedNodeName(activeAgent.node);
    }
  }, [activeAgent?.node, selectedNodeName]);

  const handleNodeSelect = (nodeName: string) => {
    setSelectedNodeName(nodeName);
    const nextSelectedAgentId = resolveSelectedAgentIdForNode(
      selectedAgentId,
      groupedAgents[nodeName] ?? [],
    );

    if (nextSelectedAgentId !== selectedAgentId) {
      setSelectedAgentId(nextSelectedAgentId);
    }
  };

  const activeNodeAgents = selectedNodeName
    ? groupedAgents[selectedNodeName] ?? []
    : [];

  const renderNodeSelectorControl = () => (
    <div className="relative px-1">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500">
        <Network className="h-4 w-4" />
      </div>
      <select
        value={selectedNodeName}
        onChange={(event) => handleNodeSelect(event.target.value)}
        disabled={nodeCount <= 1}
        className="w-full cursor-pointer appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-sky-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:focus:border-sky-500 dark:focus:bg-slate-900 disabled:cursor-default disabled:opacity-70"
      >
        {nodeEntries.map(([nodeName, agents]) => (
          <option key={nodeName} value={nodeName}>
            {nodeName} ({agents.length})
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );

  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector(
        '[data-active="true"]',
      ) as HTMLElement | null;
      if (activeEl) {
        const container = scrollRef.current;
        const scrollLeft =
          activeEl.offsetLeft -
          container.offsetWidth / 2 +
          activeEl.offsetWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: "smooth" });
      }
    }
  }, [selectedAgentId]);

  if (!activeAgent) {
    return (
      <div className="max-w-[1200px] mx-auto h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
        {t("profile.agents")}
      </div>
    );
  }

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
          <span className="truncate">
            {t("profile.connectedSummary", nodeCount, displayAgents.length)}
          </span>
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
          </div>

          {/* Desktop List */}
          <div className="hidden md:flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-b-2xl shadow-sm overflow-hidden flex-1 rtl:text-right">
            <div className="border-b border-slate-200 dark:border-slate-800 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  <Network className="w-3.5 h-3.5" />
                  {t("profile.nodes")}
                </div>
                <span className="inline-flex rounded-full border border-slate-200/80 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                  {nodeCount}
                </span>
              </div>
              {renderNodeSelectorControl()}
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 hide-scrollbar">
              <div className="flex flex-col gap-1.5">
                {activeNodeAgents.map((agent) => {
                  const isSelected = selectedAgentId === agent.id;
                  return (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`relative w-full flex items-center gap-3 p-2.5 rounded-xl text-left rtl:text-right transition-all ${
                        isSelected
                          ? "border border-sky-200 bg-white text-sky-700 shadow-sm before:pointer-events-none before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-sky-500 dark:border-sky-800/50 dark:bg-sky-950/20 dark:text-sky-200 dark:before:bg-sky-300 rtl:before:left-auto rtl:before:right-0"
                          : "border border-transparent bg-slate-100/60 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:bg-slate-950/20 dark:text-slate-500 dark:hover:bg-slate-900/60 dark:hover:text-slate-300"
                      }`}
                    >
                      <AgentAvatar
                        agent={agent}
                        containerClassName={`w-10 h-10 rounded-lg transition-all ${
                          isSelected ? "scale-105" : "opacity-75 scale-[0.98]"
                        }`}
                        iconClassName="w-5 h-5 text-white"
                        emojiClassName="text-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-[13px] font-bold truncate ${
                            isSelected
                              ? "text-sky-900 dark:text-sky-300"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {agent.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${resolveStatusDotClass(agent.statusKey)}`}
                          />
                          <span
                            className={`text-[11px] font-mono truncate ${
                              isSelected
                                ? "text-sky-500 dark:text-sky-300"
                                : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            {formatAgentShortId(agent.id)}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <ChevronRight className="w-4 h-4 text-sky-500 shrink-0 rtl:rotate-180" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile Horizontal Scroll */}
          <div className="md:hidden flex items-center justify-between mb-1 px-1">
            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Blocks className="w-3.5 h-3.5 text-sky-500" />{" "}
              {t("profile.agents")}
            </span>
          </div>
          <div className="md:hidden">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                <Network className="w-3.5 h-3.5" />
                {t("profile.nodes")}
              </div>
              <span className="inline-flex rounded-full border border-slate-200/80 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                {nodeCount}
              </span>
            </div>
            {renderNodeSelectorControl()}
          </div>
          <div
            ref={scrollRef}
            className="md:hidden flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 pb-2 -mx-4 px-4 scroll-smooth items-center"
          >
            {activeNodeAgents.map((agent) => {
              const isSelected = selectedAgentId === agent.id;
              return (
                <button
                  key={agent.id}
                  data-active={isSelected}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`relative snap-center shrink-0 flex items-center gap-2 p-1.5 pr-4 rtl:pr-1.5 rtl:pl-4 rounded-full transition-all border ${
                    isSelected
                      ? "bg-white border-sky-200 text-sky-700 shadow-sm after:pointer-events-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-sky-500 after:opacity-100 after:scale-x-100 after:transition-transform after:duration-200 after:ease-out dark:bg-sky-950/30 dark:border-sky-700 dark:text-sky-200 dark:after:bg-sky-300"
                      : "bg-slate-100/70 border-slate-100 text-slate-500 after:pointer-events-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-sky-500/70 after:opacity-0 after:scale-x-60 after:transition-transform after:duration-200 after:ease-out hover:bg-slate-100 hover:text-slate-700 dark:bg-slate-950/20 dark:border-slate-800 dark:text-slate-500 dark:after:bg-sky-300/70 dark:hover:bg-slate-900/60 dark:hover:text-slate-300"
                  }`}
                >
                  <AgentAvatar
                    agent={agent}
                    containerClassName={`w-9 h-9 rounded-full transition-all ${
                      isSelected ? "scale-100" : "opacity-70 scale-95"
                    }`}
                    iconClassName="w-4 h-4 text-white"
                    emojiClassName="text-base"
                  />
                  <div className="flex flex-col items-start">
                    <div
                      className={`text-[12px] font-bold ${
                        isSelected
                          ? "text-sky-900 dark:text-sky-300"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {agent.name}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${resolveStatusDotClass(agent.statusKey)}`}
                      />
                      <span
                        className={`text-[10px] font-mono truncate ${
                          isSelected
                            ? "text-sky-500 dark:text-sky-300"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {formatAgentShortId(agent.id)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Right Detail Card */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto md:pr-2 rtl:md:pr-0 rtl:md:pl-2 hide-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeAgent.id}:${selectedAgentRevision}`}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-4 md:gap-6"
            >
              {/* Card Body */}
              <div className="relative flex shrink-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_52px_rgba(15,23,42,0.08)] transition-colors before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-0.5 before:rounded-full before:bg-gradient-to-r before:from-sky-400 before:via-cyan-400 before:to-violet-400 dark:border-slate-800 dark:bg-slate-900 dark:before:from-sky-300 dark:before:via-cyan-300 dark:before:to-violet-300 md:flex-row md:rounded-3xl">
                {/* Visual Identity Left */}
                <div className="relative flex w-full shrink-0 flex-col items-center overflow-hidden border-b border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,249,255,0.96),rgba(245,243,255,0.94))] p-6 text-center text-slate-900 md:sticky md:top-0 md:w-[320px] md:self-start md:items-start md:border-b-0 md:border-r md:border-slate-200 md:p-8 md:text-left dark:border-slate-800/80 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 dark:text-white rtl:md:items-end rtl:md:text-right after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-slate-200/80 dark:after:bg-white/10 md:after:bottom-auto md:after:inset-y-8 md:after:left-auto md:after:right-0 md:after:h-auto md:after:w-px md:after:bg-gradient-to-b md:after:from-sky-300/50 md:after:via-slate-200/80 md:after:to-violet-300/45 dark:md:after:from-sky-400/35 dark:md:after:via-white/12 dark:md:after:to-violet-400/20 rtl:md:after:left-0 rtl:md:after:right-auto">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:20px_20px] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)]" />

                  <div className="relative z-10 flex flex-col items-center gap-5 md:items-start rtl:md:items-end w-full">
                    <AgentAvatar
                      agent={activeAgent}
                      containerClassName="w-20 h-20 md:w-16 md:h-16 rounded-2xl md:rounded-2xl rounded-full shadow-[0_0_30px_rgba(255,255,255,0.15)] mb-4 md:mb-6"
                      iconClassName="w-10 h-10 md:w-8 md:h-8 text-white"
                      emojiClassName="text-4xl md:text-3xl"
                    />

                    <div className="w-full flex flex-col items-center md:items-start rtl:md:items-end">
                      <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 md:mb-1">
                        {activeAgent.name}
                      </h2>
                      <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-slate-600 md:mb-4 md:justify-start md:text-sm dark:text-slate-400">
                        <div className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-white/90 px-3 py-1.5 text-sky-700 shadow-sm md:rounded md:px-2 md:py-1 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                          <Network className="w-3.5 h-3.5" /> {activeAgent.node}
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-slate-700 shadow-sm md:rounded md:px-2 md:py-1 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200">
                          <Hash className="w-3.5 h-3.5 text-sky-500 dark:text-sky-300" />{" "}
                          {activeAgent.id}
                        </div>
                      </div>

                      <div className="flex w-full justify-around gap-0 rounded-2xl border border-slate-200 bg-white/88 p-4 backdrop-blur-sm md:flex-col md:justify-start md:gap-3 md:rounded-xl dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="flex flex-col items-center gap-1.5 text-xs font-medium text-slate-700 md:flex-row md:gap-2.5 dark:text-slate-300">
                          <Activity
                            className={`w-5 h-5 md:w-4 md:h-4 ${resolveStatusTextClass(activeAgent.statusKey)}`}
                          />
                          <span className="hidden md:inline">
                            {t("profile.status")}:{" "}
                          </span>
                          {activeAgent.status}
                        </div>
                        <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 md:block"></div>
                        <div className="flex flex-col items-center gap-1.5 text-xs font-medium text-slate-700 md:flex-row md:gap-2.5 dark:text-slate-300">
                          <Terminal className="w-5 h-5 md:w-4 md:h-4 text-sky-500 dark:text-sky-400" />
                          <span className="hidden md:inline">
                            {t("profile.core")}:{" "}
                          </span>
                          {activeAgent.version}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Right */}
                <div className="relative flex flex-1 flex-col justify-between bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.86))] p-6 md:p-10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,1),rgba(2,6,23,0.92))]">
                  <div>
                    {hasRealAgents && !hasAdminScope ? (
                      <div className="md:mx-7 mb-6 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-4 shadow-sm transition-colors dark:border-amber-900/50 dark:bg-amber-950/30">
                        <div className="flex items-start gap-3">
                          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                              {t("profile.readOnlyNotice")}
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300/90">
                              {t(
                                "profile.readOnlyScopes",
                                grantedScopes.join(", ") || "operator.read",
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {hasRealAgents ? (
                      <ProfileSectionCard tone="sky" className="md:mx-7 mb-6">
                        <ProfileSectionHeader
                          icon={IdCard}
                          title={t("profile.identityFields")}
                          tone="sky"
                          meta={activeAgent.id}
                          isDirty={isIdentityMetaDirty}
                          dirtyLabel={t("profile.unsaved")}
                        />
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <ProfileDetailField
                            label={t("profile.identityName")}
                            value={identityMetaDraft.name}
                            isEditing={isEditingIdentityMeta}
                            onChange={(value) =>
                              setIdentityMetaDraft((previous) => ({
                                ...previous,
                                name: value,
                              }))
                            }
                            placeholder={activeAgent.id}
                          />
                          <ProfileDetailField
                            label={t("profile.identityAvatar")}
                            value={identityMetaDraft.avatar}
                            isEditing={isEditingIdentityMeta}
                            onChange={(value) =>
                              setIdentityMetaDraft((previous) => ({
                                ...previous,
                                avatar: value,
                              }))
                            }
                            placeholder="https://example.com/avatar.png"
                            monospace
                          />
                        </div>
                        <div className="mt-4">
                          <ProfileSectionActions
                            tone="sky"
                            visible={hasRealAgents}
                            isEditing={isEditingIdentityMeta}
                            isSaving={isSavingIdentityMeta}
                            reloadDisabled={
                              !canEditActiveAgent || isSavingIdentityMeta
                            }
                            editDisabled={!canEditActiveAgent}
                            onReload={() => void handleIdentityMetaReload()}
                            onEdit={() => setIsEditingIdentityMeta(true)}
                            onCancel={() => {
                              setIdentityMetaDraft({
                                name: activeIdentityMetaName,
                                avatar: activeIdentityMetaAvatar,
                              });
                              setIsEditingIdentityMeta(false);
                            }}
                            onSave={() => void handleIdentityMetaSave()}
                            reloadLabel={t("profile.reload")}
                            editLabel={t("profile.edit")}
                            cancelLabel={t("profile.cancel")}
                            saveLabel={t("profile.save")}
                            savingLabel={t("profile.saving")}
                          />
                        </div>
                      </ProfileSectionCard>
                    ) : null}

                    <div className="md:mx-5 mb-4 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.82),rgba(255,255,255,0.92))] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.3),rgba(2,6,23,0.24))]">
                      <div className="mb-5 px-2">
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-700" />
                          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-sm ${resolveViewToneClasses('sky').softBadge}`}>
                            <FileText className={`h-3.5 w-3.5 ${resolveViewToneClasses('sky').iconText}`} />
                            {t("profile.documentLayer")}
                          </div>
                          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-700" />
                        </div>
                        <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                          {t("profile.documentLayerDesc")}
                        </p>
                      </div>

                      {/* Identity */}
                      <ProfileSectionCard tone="sky" className="mb-6">
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <ProfileSectionHeader
                            icon={Fingerprint}
                            title={t("profile.identity")}
                            tone="sky"
                            isDirty={isIdentityDocDirty}
                            dirtyLabel={t("profile.unsaved")}
                          />
                          <ProfileSectionActions
                            tone="sky"
                            visible={hasRealAgents}
                            isEditing={isEditingIdentityDoc}
                            isSaving={isSavingIdentityDoc}
                            reloadDisabled={
                              !canEditActiveAgent || isSavingIdentityDoc
                            }
                            editDisabled={!canEditActiveAgent}
                            onReload={() => void handleIdentityDocumentReload()}
                            onEdit={() => setIsEditingIdentityDoc(true)}
                            onCancel={() => {
                              setIdentityDocDraft(activeIdentityDocumentContent);
                              setIsEditingIdentityDoc(false);
                            }}
                            onSave={() => void handleIdentityDocumentSave()}
                            reloadLabel={t("profile.reload")}
                            editLabel={t("profile.edit")}
                            cancelLabel={t("profile.cancel")}
                            saveLabel={t("profile.save")}
                            savingLabel={t("profile.saving")}
                          />
                        </div>
                        <div className="transition-colors">
                          {isEditingIdentityDoc ? (
                            <ProfileDocumentEditor
                              value={identityDocDraft}
                              onChange={setIdentityDocDraft}
                            />
                          ) : (
                            <AgentDocument
                              key={`${activeAgent.id}:identity`}
                              content={activeAgent.identity || t("profile.noIdentity")}
                              tone="identity"
                              storageKey={`${activeAgent.id}:identity`}
                              source={activeIdentitySource}
                            />
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {activeAgent.tags?.map((tag) => (
                            <span
                              key={tag}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-xs rounded-lg border border-slate-200 dark:border-slate-700/50 font-medium transition-colors"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </ProfileSectionCard>

                      {/* Soul */}
                      <ProfileSectionCard tone="violet">
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <ProfileSectionHeader
                            icon={Sparkles}
                            title={t("profile.soul")}
                            tone="violet"
                            isDirty={isSoulDocDirty}
                            dirtyLabel={t("profile.unsaved")}
                          />
                          <ProfileSectionActions
                            tone="violet"
                            visible={hasRealAgents}
                            isEditing={isEditingSoulDoc}
                            isSaving={isSavingSoulDoc}
                            reloadDisabled={!canEditActiveAgent || isSavingSoulDoc}
                            editDisabled={!canEditActiveAgent}
                            onReload={() => void handleSoulDocumentReload()}
                            onEdit={() => setIsEditingSoulDoc(true)}
                            onCancel={() => {
                              setSoulDocDraft(activeSoulDocumentContent);
                              setIsEditingSoulDoc(false);
                            }}
                            onSave={() => void handleSoulDocumentSave()}
                            reloadLabel={t("profile.reload")}
                            editLabel={t("profile.edit")}
                            cancelLabel={t("profile.cancel")}
                            saveLabel={t("profile.save")}
                            savingLabel={t("profile.saving")}
                          />
                        </div>
                        <div className="transition-colors">
                          {isEditingSoulDoc ? (
                            <ProfileDocumentEditor
                              value={soulDocDraft}
                              onChange={setSoulDocDraft}
                            />
                          ) : (
                            <AgentDocument
                              key={`${activeAgent.id}:soul`}
                              content={
                                activeAgent.soulQuote ||
                                t("profile.noSoulQuote")
                              }
                              tone="soul"
                              storageKey={`${activeAgent.id}:soul`}
                              source={activeSoulSource}
                            />
                          )}
                        </div>
                      </ProfileSectionCard>
                    </div>

                    {activeAgentError ? (
                      <div className="md:mx-7 mt-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 transition-colors">
                        {activeAgentError}
                      </div>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mt-6 md:mt-8 md:px-7">
                    <button
                      onClick={() => navigate("/memory")}
                      className="flex-1 bg-slate-900 dark:bg-violet-600 hover:bg-black dark:hover:bg-violet-500 text-white py-3 md:py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md md:group"
                    >
                      <Database className="w-4 h-4 text-violet-400 dark:text-violet-200" />
                      {t("profile.btn.memory")}
                      <ArrowRight className="w-4 h-4 text-slate-500 dark:text-violet-200 md:group-hover:translate-x-1 rtl:md:group-hover:-translate-x-1 rtl:rotate-180 transition-transform" />
                    </button>
                    <button
                      onClick={() => navigate("/config")}
                      className="w-full sm:w-auto px-6 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-3 md:py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <Settings className="w-4 h-4" />
                      {t("profile.btn.config")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-4 shrink-0 overflow-x-auto snap-x hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                <ProfileStatCard
                  tone="sky"
                  label={t("profile.stat.memory")}
                  value={activeAgent.stats.memory.toLocaleString()}
                  unit={t("profile.unit.item")}
                  labelIcon={Database}
                  metricIcon={Activity}
                />
                <ProfileStatCard
                  tone="violet"
                  label={t("profile.stat.pref")}
                  value={String(activeAgent.stats.prefs)}
                  unit={t("profile.unit.piece")}
                  labelIcon={IdCard}
                  metricIcon={User}
                />
                <ProfileStatCard
                  tone="emerald"
                  label={t("profile.stat.health")}
                  value={`${activeAgent.stats.health}%`}
                  labelIcon={Terminal}
                  metricIcon={Sparkles}
                />
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
