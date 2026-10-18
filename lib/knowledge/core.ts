import { createHash } from 'node:crypto';
import { chunkText } from './chunk.ts';
import type { KnowledgeChunk, KnowledgeIndex, KnowledgeSource, SearchHit } from './types.ts';

const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const safeString = (s: string | undefined) => s || '';

export function emptyIndex(revision = -1): KnowledgeIndex {
  return { schemaVersion: 1, generatedAt: new Date(0).toISOString(), workspaceRevision: revision, sources: {}, chunks: [] };
}

function fingerprint(s: KnowledgeSource): string {
  return digest(JSON.stringify([s.id, s.title, s.channel, s.topic, s.kind, s.url, s.sourceUrl,
    s.captured, s.decision, s.analysed, s.notes, s.transcript, 'chunk-v1']));
}

/** Pure incremental update; preserves unchanged chunks verbatim. */
export function indexSources(sources: KnowledgeSource[], current: KnowledgeIndex, workspaceRevision: number, now = new Date().toISOString()) {
  const next: KnowledgeIndex = { schemaVersion: 1, workspaceRevision, generatedAt: now, sources: {}, chunks: [] };
  const oldChunks = new Map<string, KnowledgeChunk[]>();
  for (const chunk of current.chunks) oldChunks.set(chunk.sourceId, [...(oldChunks.get(chunk.sourceId) || []), chunk]);
  let reused = 0, updated = 0, skipped = 0;
  for (const s of sources) {
    if (s.decision === 'exclude' || !(s.notes?.trim() || s.transcript?.trim())) { skipped++; continue; }
    const key = fingerprint(s);
    if (current.schemaVersion === 1 && current.sources[s.id]?.fingerprint === key) {
      next.sources[s.id] = current.sources[s.id];
      next.chunks.push(...(oldChunks.get(s.id) || []));
      reused++;
      continue;
    }
    const status = s.analysed ? 'reviewed' : 'unreviewed';
    const chunks: KnowledgeChunk[] = [];
    for (const [textKind, value] of [['research_notes', s.notes], ['supplied_transcript', s.transcript]] as const) {
      for (const c of chunkText(value || '', textKind)) {
        chunks.push({
          ...c,
          id: digest(`${s.id}\0${key}\0${textKind}\0${chunks.length}`).slice(0, 24),
          sourceId: s.id, sourceFingerprint: key, position: chunks.length,
          textKind, title: s.title, channel: s.channel, topic: s.topic, kind: s.kind,
          sourceUrl: safeString(s.sourceUrl) || s.url,
          captured: s.captured || null, status,
        });
      }
    }
    next.sources[s.id] = { id: s.id, fingerprint: key, chunkCount: chunks.length, indexedAt: now };
    next.chunks.push(...chunks);
    updated++;
  }
  return { index: next, stats: { updated, reused, skipped, removed: Object.keys(current.sources).filter(id => !(id in next.sources)).length, chunkCount: next.chunks.length } };
}

// Accurate lexical matching rather than pretending embeddings have been generated.
const STOP = new Set('a an the and or but to of in on for from how what where when who why is are was were be been with it this that those these do does can as at by about into our your my we i you they which their a'.split(' '));
export function tokenize(s: string): string[] {
  return (s.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(w => w.length > 1 && !STOP.has(w));
}

function excerptAround(text: string, terms: string[], size = 320): string {
  if (text.length <= size) return text;
  const low = text.toLocaleLowerCase();
  const pos = terms.map(t => low.indexOf(t)).filter(i => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, pos - 65), end = Math.min(text.length, start + size);
  return `${start ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

export type SearchOptions = { limit?: number; topic?: string; channel?: string; reviewedOnly?: boolean };
export function searchIndex(index: KnowledgeIndex, question: string, options: SearchOptions = {}): SearchHit[] {
  const terms = [...new Set(tokenize(question))].slice(0, 32);
  if (!terms.length) return [];
  const eligible = index.chunks.filter(c => (!options.topic || c.topic === options.topic)
    && (!options.channel || c.channel === options.channel)
    && (!options.reviewedOnly || c.status === 'reviewed'));
  if (!eligible.length) return [];
  const docs = eligible.map(c => ({ chunk: c, tokens: tokenize(`${c.title} ${c.topic} ${c.text}`) }));
  const avgLength = docs.reduce((a, d) => a + d.tokens.length, 0) / docs.length || 1;
  const df = new Map(terms.map(t => [t, docs.filter(d => d.tokens.includes(t)).length]));
  const hits = docs.map(d => {
    const frequency = new Map<string, number>();
    for (const t of d.tokens) frequency.set(t, (frequency.get(t) || 0) + 1);
    let score = 0;
    const matched: string[] = [];
    for (const term of terms) {
      const freq = frequency.get(term) || 0;
      if (!freq) continue;
      matched.push(term);
      const idf = Math.log(1 + (docs.length - (df.get(term) || 0) + 0.5) / ((df.get(term) || 0) + 0.5));
      score += idf * (freq * 2.2) / (freq + 1.2 * (0.25 + 0.75 * d.tokens.length / avgLength));
      if (tokenize(`${d.chunk.title} ${d.chunk.topic}`).includes(term)) score += 0.4;
    }
    return { chunk: d.chunk, score, matchedTerms: matched, excerpt: excerptAround(d.chunk.text, matched) };
  }).filter(h => h.score > 0).sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));
  // Avoid a single long podcast crowding out every other source in the first results.
  const perSource = new Map<string, number>();
  const chosen: SearchHit[] = [];
  for (const h of hits) {
    const count = perSource.get(h.chunk.sourceId) || 0;
    if (count >= 3) continue;
    perSource.set(h.chunk.sourceId, count + 1);
    chosen.push(h);
    if (chosen.length >= Math.min(30, Math.max(1, options.limit || 10))) break;
  }
  return chosen;
}
