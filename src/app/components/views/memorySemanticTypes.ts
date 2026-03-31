export type SemanticMemorySourceKind = "document" | "timeline";

export type SemanticMemoryEntry = {
  id: string;
  title: string;
  sourceKind: SemanticMemorySourceKind;
  agentId: string;
  timestamp: number | null;
  text: string;
  path?: string;
};

export type SemanticEvidence = {
  entryId: string;
  snippet: string;
  matchedTerms: string[];
  title: string;
  sourceKind: SemanticMemorySourceKind;
  timestamp: number | null;
  path?: string;
};

export type SemanticConcept = {
  id: string;
  label: string;
  score: number;
  keywords: string[];
  entryIds: string[];
  evidence: SemanticEvidence[];
  explanation: string;
};

export type SemanticCluster = {
  id: string;
  label: string;
  summary: string;
  conceptIds: string[];
  entryIds: string[];
  evidence: SemanticEvidence[];
  explanation: string;
};

export type SemanticGraphNode = {
  id: string;
  label: string;
  kind: "cluster" | "concept";
  score: number;
  evidenceCount: number;
};

export type SemanticGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: "contains" | "related_to";
  weight: number;
};

export type SemanticMindMapModel = {
  entries: SemanticMemoryEntry[];
  concepts: SemanticConcept[];
  clusters: SemanticCluster[];
  nodes: SemanticGraphNode[];
  edges: SemanticGraphEdge[];
};
