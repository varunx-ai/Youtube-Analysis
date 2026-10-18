/** Phase 1 local knowledge-index contracts. Source text is *supplied* evidence, not verified video content. */
export type KnowledgeTextKind = 'supplied_transcript' | 'research_notes';
export type KnowledgeStatus = 'reviewed' | 'unreviewed';

export type KnowledgeSource = {
  id: string;
  title: string;
  channel: string;
  url: string;
  sourceUrl?: string;
  topic: string;
  kind: string;
  captured?: string;
  decision?: string;
  analysed?: boolean;
  notes: string;
  transcript: string;
};

export type KnowledgeChunk = {
  id: string;
  sourceId: string;
  sourceFingerprint: string;
  position: number;
  textKind: KnowledgeTextKind;
  text: string;
  title: string;
  channel: string;
  topic: string;
  kind: string;
  sourceUrl: string;
  captured: string | null;
  status: KnowledgeStatus;
  startSeconds: number | null;
  endSeconds: number | null;
  estimatedTokens: number;
};

export type SourceIndexEntry = {
  id: string;
  fingerprint: string;
  chunkCount: number;
  indexedAt: string;
};

export type KnowledgeIndex = {
  schemaVersion: 1;
  workspaceRevision: number;
  generatedAt: string;
  sources: Record<string, SourceIndexEntry>;
  chunks: KnowledgeChunk[];
};

export type SearchHit = {
  chunk: KnowledgeChunk;
  score: number;
  matchedTerms: string[];
  excerpt: string;
};
