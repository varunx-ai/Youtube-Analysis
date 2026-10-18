import type { KnowledgeTextKind } from './types.ts';

export type TextSegment = { text: string; startSeconds: number | null; endSeconds: number | null };

export function estimateTokens(text: string): number {
  // A conservative text-size estimate for budgeting only, NOT an API tokenizer.
  return Math.ceil(text.length / 3.5);
}

export function timestampSeconds(value: string): number | null {
  const parts = value.replace(',', '.').trim().split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every(p => /^\d+(?:\.\d+)?$/.test(p))) return null;
  const nums = parts.map(Number);
  if (!nums.every(Number.isFinite)) return null;
  const sec = nums.at(-1)!;
  const min = nums.at(-2)!;
  if (min > 59 || sec >= 60) return null;
  const hour = nums.length === 3 ? nums[0] : 0;
  return hour * 3600 + min * 60 + sec;
}

/** Supports [mm:ss], [hh:mm:ss], and subtitle/VTT time ranges. Unknown timestamps remain null. */
export function segmentText(text: string, kind: KnowledgeTextKind): TextSegment[] {
  const cleaned = text.replace(/\r\n?/g, '\n').trim();
  if (!cleaned) return [];
  const out: TextSegment[] = [];
  let start: number | null = null;
  let end: number | null = null;
  for (const raw of cleaned.split('\n')) {
    const line = raw.trim();
    if (!line || line === 'WEBVTT' || (/^\d+$/.test(line) && kind === 'supplied_transcript')) continue;
    if (kind === 'supplied_transcript') {
      const ranged = line.match(/^((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d+)?)\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d+)?)(?:\s+.*)?$/);
      if (ranged) {
        start = timestampSeconds(ranged[1]);
        end = timestampSeconds(ranged[2]);
        continue;
      }
      const stamped = line.match(/^\[?((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d+)?)\]?\s*[-–:]?\s+(.*)$/);
      if (stamped) {
        start = timestampSeconds(stamped[1]);
        end = null;
        if (stamped[2].trim()) out.push({ text: stamped[2].trim(), startSeconds: start, endSeconds: end });
        continue;
      }
    }
    out.push({ text: line, startSeconds: start, endSeconds: end });
    // Subtitle end times apply only to that cue's text, never following unstamped prose.
    if (end !== null) { start = null; end = null; }
  }
  return out;
}

/** Split overlong paragraphs without dropping any words or inventing timestamps. */
function breakLongSegment(segment: TextSegment, maxChars: number): TextSegment[] {
  const words = segment.text.split(/\s+/).filter(Boolean);
  const parts: TextSegment[] = [];
  let buffer = '';
  for (const word of words) {
    if (buffer && buffer.length + word.length + 1 > maxChars) {
      parts.push({ ...segment, text: buffer });
      buffer = '';
    }
    if (word.length > maxChars) {
      if (buffer) { parts.push({ ...segment, text: buffer }); buffer = ''; }
      for (let i = 0; i < word.length; i += maxChars) parts.push({ ...segment, text: word.slice(i, i + maxChars) });
      continue;
    }
    buffer = buffer ? `${buffer} ${word}` : word;
  }
  if (buffer) parts.push({ ...segment, text: buffer });
  return parts;
}

export type TextChunk = {
  text: string;
  startSeconds: number | null;
  endSeconds: number | null;
  estimatedTokens: number;
};

export function chunkText(text: string, kind: KnowledgeTextKind, targetTokens = 550): TextChunk[] {
  if (!Number.isInteger(targetTokens) || targetTokens < 100 || targetTokens > 4000)
    throw new Error('Chunk target must be 100–4000 estimated tokens.');
  const maxChars = Math.floor(targetTokens * 3.5);
  const pieces = segmentText(text, kind).flatMap(s => breakLongSegment(s, maxChars));
  const chunks: TextChunk[] = [];
  let buffer: TextSegment[] = [];
  let charCount = 0;
  const flush = () => {
    if (!buffer.length) return;
    const body = buffer.map(s => s.text).join('\n');
    // An ending time is given only if every contributing cue has a known end.
    const hasRange = buffer.every(s => s.endSeconds !== null);
    chunks.push({
      text: body,
      startSeconds: buffer.find(s => s.startSeconds !== null)?.startSeconds ?? null,
      endSeconds: hasRange ? buffer.at(-1)!.endSeconds : null,
      estimatedTokens: estimateTokens(body),
    });
    buffer = [];
    charCount = 0;
  };
  for (const piece of pieces) {
    if (buffer.length && charCount + piece.text.length + 1 > maxChars) flush();
    buffer.push(piece);
    charCount += piece.text.length + 1;
  }
  flush();
  return chunks;
}
