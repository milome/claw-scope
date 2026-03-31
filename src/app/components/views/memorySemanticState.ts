import type { GatewayAgentFileEntry } from "../../contexts/OpenClawContext";
import type {
  SemanticCluster,
  SemanticConcept,
  SemanticEvidence,
  SemanticGraphEdge,
  SemanticGraphNode,
  SemanticMemoryEntry,
  SemanticMindMapModel,
} from "./memorySemanticTypes";

const MIN_TEXT_LENGTH = 24;
const MIN_KEYWORD_LENGTH = 4;
const MAX_KEYWORDS_PER_ENTRY = 10;
const MAX_CONCEPTS = 18;
const MAX_CLUSTERS = 8;
const MAX_EVIDENCE_PER_CONCEPT = 4;
const MAX_EVIDENCE_PER_CLUSTER = 6;
const COMMON_NOISE_SUFFIXES = ["view", "panel", "module", "title", "desc", "label", "status"];
const MIN_CONCEPT_ENTRY_COUNT = 2;
const MIN_CONCEPT_TOTAL_MATCHES = 3;
const SINGLE_ENTRY_MIN_KEYWORDS = 3;

const STOP_WORDS = new Set([
  "about",
  "after",
  "agent",
  "again",
  "also",
  "been",
  "before",
  "between",
  "could",
  "does",
  "from",
  "have",
  "into",
  "just",
  "more",
  "only",
  "over",
  "same",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "this",
  "through",
  "using",
  "view",
  "views",
  "when",
  "with",
  "would",
  "memory",
  "document",
  "documents",
  "timeline",
  "search",
  "resources",
  "knowledge",
  "semantic",
  "cluster",
  "concept",
  "payload",
  "source",
  "sources",
  "entries",
  "entry",
  "panel",
  "module",
  "title",
  "label",
  "summary",
  "current",
  "future",
  "phase",
  "should",
  "still",
  "into",
  "then",
  "there",
  "记忆",
  "问题",
  "当前",
  "需要",
  "进行",
  "实现",
  "功能",
  "用户",
  "模块",
  "内容",
  "一个",
  "可以",
  "以及",
  "因为",
  "所以",
  "内容",
  "相关",
  "支持",
  "显示",
  "结构",
  "分类",
  "文件",
  "路径",
]);

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeSemanticKeyword(token: string) {
  const normalized = token.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  const withoutSuffix = COMMON_NOISE_SUFFIXES.reduce((current, suffix) => {
    if (current.length > suffix.length + 2 && current.endsWith(suffix)) {
      return current.slice(0, -suffix.length);
    }
    return current;
  }, normalized);

  return withoutSuffix.replace(/^[-_]+|[-_]+$/g, "");
}

export function tokenizeText(text: string) {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .map((token) => normalizeSemanticKeyword(token))
    .filter((token) => token.length >= MIN_KEYWORD_LENGTH && !STOP_WORDS.has(token));
}

export function collectKeywords(text: string) {
  const counts = new Map<string, number>();
  tokenizeText(text).forEach((token) => {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_KEYWORDS_PER_ENTRY)
    .map(([token]) => token);
}

function collectFallbackPhrases(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const sentences = normalized
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 16);

  const phraseCounts = new Map<string, number>();
  sentences.forEach((sentence) => {
    const words = sentence
      .split(/[^\p{L}\p{N}_-]+/u)
      .map((word) => normalizeSemanticKeyword(word))
      .filter((word) => word.length >= MIN_KEYWORD_LENGTH && !STOP_WORDS.has(word));

    for (let index = 0; index < words.length - 1; index += 1) {
      const phrase = `${words[index]} ${words[index + 1]}`.trim();
      if (phrase.length < MIN_KEYWORD_LENGTH * 2 + 1) {
        continue;
      }
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
    }
  });

  return Array.from(phraseCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([phrase]) => phrase);
}

export function buildSnippet(text: string, keywords: string[]) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return "";
  }

  const lower = normalized.toLowerCase();
  const match = keywords.find((keyword) => lower.includes(keyword.toLowerCase()));
  if (!match) {
    return `${normalized.slice(0, 128)}${normalized.length > 128 ? "..." : ""}`;
  }

  const index = lower.indexOf(match.toLowerCase());
  const start = Math.max(0, index - 42);
  const end = Math.min(normalized.length, index + match.length + 68);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalized.length ? "..." : "";
  return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

export function phraseLabel(keyword: string) {
  if (!keyword) {
    return "Unknown concept";
  }
  return keyword
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function clusterLabel(keywords: string[]) {
  const head = keywords.slice(0, 2).map(phraseLabel);
  return head.join(" / ") || "Semantic Cluster";
}

export function groupConceptsByKeywordOverlap(concepts: SemanticConcept[]) {
  const groups: SemanticConcept[][] = [];

  concepts.forEach((concept) => {
    const existing = groups.find((group) => {
      const sample = group[0];
      return sample.keywords.some((keyword) => concept.keywords.includes(keyword));
    });

    if (existing) {
      existing.push(concept);
      return;
    }

    groups.push([concept]);
  });

  return groups;
}

export function buildSemanticMemoryEntries({
  documents,
  timelineEntries,
  agentId,
}: {
  documents: GatewayAgentFileEntry[];
  timelineEntries: GatewayAgentFileEntry[];
  agentId: string;
}): SemanticMemoryEntry[] {
  const documentEntries: SemanticMemoryEntry[] = documents
    .filter((document) => !document.missing && normalizeWhitespace(document.content ?? "").length >= MIN_TEXT_LENGTH)
    .map((document) => ({
      id: `document:${document.name}`,
      title: document.name,
      sourceKind: "document",
      agentId,
      timestamp: document.updatedAtMs ?? null,
      text: normalizeWhitespace(document.content ?? ""),
      path: document.path,
    }));

  const timelineDerived: SemanticMemoryEntry[] = timelineEntries
    .filter((entry) => !entry.missing && normalizeWhitespace(entry.content ?? "").length >= MIN_TEXT_LENGTH)
    .map((entry) => ({
      id: `timeline:${entry.name}`,
      title: entry.name,
      sourceKind: "timeline",
      agentId,
      timestamp: entry.updatedAtMs ?? null,
      text: normalizeWhitespace(entry.content ?? ""),
      path: entry.path,
    }));

  return [...documentEntries, ...timelineDerived].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
}

export function buildSemanticMindMapModel(entries: SemanticMemoryEntry[]): SemanticMindMapModel {
  const allowSingleEntryFallback = entries.length === 1;
  const conceptIndex = new Map<
    string,
    {
      keyword: string;
      entryIds: Set<string>;
      evidence: SemanticEvidence[];
      count: number;
    }
  >();

  entries.forEach((entry) => {
    const keywords = collectKeywords(entry.text);
    keywords.forEach((keyword) => {
      const current = conceptIndex.get(keyword) ?? {
        keyword,
        entryIds: new Set<string>(),
        evidence: [],
        count: 0,
      };
      current.entryIds.add(entry.id);
      current.count += 1;
      const snippet = buildSnippet(entry.text, [keyword]);
      if (!snippet) {
        conceptIndex.set(keyword, current);
        return;
      }
      current.evidence.push({
        entryId: entry.id,
        snippet,
        matchedTerms: [keyword],
        title: entry.title,
        sourceKind: entry.sourceKind,
        timestamp: entry.timestamp,
        path: entry.path,
      });
      conceptIndex.set(keyword, current);
    });
  });

  let concepts: SemanticConcept[] = Array.from(conceptIndex.values())
    .filter((item) =>
      allowSingleEntryFallback
        ? item.count >= 2
        : item.entryIds.size >= MIN_CONCEPT_ENTRY_COUNT || item.count >= MIN_CONCEPT_TOTAL_MATCHES,
    )
    .sort((a, b) => b.entryIds.size - a.entryIds.size || b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, MAX_CONCEPTS)
    .map((item, index) => ({
      id: `concept:${index}:${item.keyword}`,
      label: phraseLabel(item.keyword),
      score: item.count + item.entryIds.size,
      keywords: [item.keyword],
      entryIds: Array.from(item.entryIds),
      evidence: item.evidence.slice(0, MAX_EVIDENCE_PER_CONCEPT),
      explanation: allowSingleEntryFallback
        ? `Concept inferred from repeated keyword \"${phraseLabel(item.keyword)}\" inside a single available memory entry, because the corpus currently has only one usable entry.`
        : `Concept inferred because keyword \"${phraseLabel(item.keyword)}\" recurs across ${item.entryIds.size} entries with ${item.count} total matches.`,
    }));

  if (allowSingleEntryFallback && concepts.length === 0 && entries[0]) {
    const fallbackKeywords = collectKeywords(entries[0].text);
    const fallbackPhrases = collectFallbackPhrases(entries[0].text);
    const fallbackTerms = Array.from(new Set([...fallbackPhrases, ...fallbackKeywords])).slice(0, SINGLE_ENTRY_MIN_KEYWORDS);

    concepts = fallbackTerms.map((term, index) => ({
      id: `concept:fallback:${index}`,
      label: phraseLabel(term),
      score: Math.max(2, SINGLE_ENTRY_MIN_KEYWORDS - index),
      keywords: [term],
      entryIds: [entries[0].id],
      evidence: [
        {
          entryId: entries[0].id,
          snippet: buildSnippet(entries[0].text, [term]),
          matchedTerms: [term],
          title: entries[0].title,
          sourceKind: entries[0].sourceKind,
          timestamp: entries[0].timestamp,
          path: entries[0].path,
        },
      ],
      explanation: `Fallback concept bootstrapped from the only available memory entry using a high-signal phrase or keyword: \"${phraseLabel(term)}\".`,
    }));
  }

  const conceptGroups = groupConceptsByKeywordOverlap(concepts);

  let clusters: SemanticCluster[] = conceptGroups
    .sort((a, b) => b.length - a.length || a[0].label.localeCompare(b[0].label))
    .slice(0, MAX_CLUSTERS)
    .map((bucket, index) => {
      const entryIds = new Set<string>();
      const evidence: SemanticEvidence[] = [];
      bucket.forEach((concept) => {
        concept.entryIds.forEach((entryId) => entryIds.add(entryId));
        evidence.push(...concept.evidence);
      });

      const keywords = Array.from(new Set(bucket.flatMap((concept) => concept.keywords))).slice(0, 4);
      return {
        id: `cluster:${index}:${keywords.join("-") || "semantic"}`,
        label: clusterLabel(keywords),
        summary: allowSingleEntryFallback
          ? `Inferred from the only available memory entry around ${keywords.map(phraseLabel).join(", ")}.`
          : `Inferred from ${entryIds.size} memory entries around ${keywords.map(phraseLabel).join(", ")}.`,
        conceptIds: bucket.map((concept) => concept.id),
        entryIds: Array.from(entryIds),
        evidence: evidence.slice(0, MAX_EVIDENCE_PER_CLUSTER),
        explanation: allowSingleEntryFallback
          ? `Cluster formed as a minimal fallback by grouping repeated keywords from a single memory entry: ${keywords.map(phraseLabel).join(", ")}.`
          : `Cluster formed by grouping concepts with overlapping normalized keywords: ${keywords.map(phraseLabel).join(", ")}.`,
      };
    });

  if (allowSingleEntryFallback && clusters.length === 0 && concepts.length > 0) {
    const fallbackKeywords = Array.from(new Set(concepts.flatMap((concept) => concept.keywords))).slice(0, 4);
    const entryIds = Array.from(new Set(concepts.flatMap((concept) => concept.entryIds)));
    const evidence = concepts.flatMap((concept) => concept.evidence).slice(0, MAX_EVIDENCE_PER_CLUSTER);
    clusters = [
      {
        id: "cluster:fallback:single-entry",
        label: clusterLabel(fallbackKeywords),
        summary: `Bootstrapped from the only available memory entry around ${fallbackKeywords.map(phraseLabel).join(", ")}.`,
        conceptIds: concepts.map((concept) => concept.id),
        entryIds,
        evidence,
        explanation: `Minimal single-entry cluster created so one substantial MEMORY document can still produce a usable first mind map.`,
      },
    ];
  }

  const nodes: SemanticGraphNode[] = [
    ...clusters.map((cluster) => ({
      id: cluster.id,
      label: cluster.label,
      kind: "cluster" as const,
      score: cluster.entryIds.length,
      evidenceCount: cluster.evidence.length,
    })),
    ...concepts.map((concept) => ({
      id: concept.id,
      label: concept.label,
      kind: "concept" as const,
      score: concept.score,
      evidenceCount: concept.evidence.length,
    })),
  ];

  const edges: SemanticGraphEdge[] = [];

  clusters.forEach((cluster) => {
    cluster.conceptIds.forEach((conceptId) => {
      edges.push({
        id: `${cluster.id}->${conceptId}`,
        source: cluster.id,
        target: conceptId,
        kind: "contains",
        weight: 1,
      });
    });
  });

  for (let index = 0; index < concepts.length; index += 1) {
    const left = concepts[index];
    for (let compareIndex = index + 1; compareIndex < concepts.length; compareIndex += 1) {
      const right = concepts[compareIndex];
      const overlap = left.entryIds.filter((entryId) => right.entryIds.includes(entryId));
      if (overlap.length >= 2) {
        edges.push({
          id: `${left.id}<->${right.id}`,
          source: left.id,
          target: right.id,
          kind: "related_to",
          weight: overlap.length,
        });
      }
    }
  }

  return {
    entries,
    concepts,
    clusters,
    nodes,
    edges,
  };
}
