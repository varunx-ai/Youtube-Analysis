import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadIndex, saveIndex } from '../lib/knowledge/storage.ts';
import { chunkText, segmentText, timestampSeconds } from '../lib/knowledge/chunk.ts';
import { emptyIndex, indexSources, searchIndex } from '../lib/knowledge/core.ts';

const source = (id, overrides = {}) => ({
  id, title: 'Marathon fueling and long-run planning', channel: 'Indian Running Podcast',
  url: `https://www.youtube.com/watch?v=${id}`, sourceUrl: `https://www.youtube.com/watch?v=${id}`,
  topic: 'Fuel & hydration', kind: 'video', captured: '2026-10-18',
  decision: 'auto', analysed: true,
  notes: 'Publisher episode description: how to fuel for an endurance event.',
  transcript: '[00:10] Runners should rehearse their fueling plan.\n[01:05] Some amateurs train around office hours.\n[04:22] Long runs need hydration planning.',
  ...overrides,
});

test('timestamps parse accurately, rejecting invalid times', () => {
  assert.equal(timestampSeconds('00:12'), 12);
  assert.equal(timestampSeconds('01:02:03.500'), 3723.5);
  assert.equal(timestampSeconds('99:90'), null);
  assert.equal(timestampSeconds('abc'), null);
});

test('SRT/VTT time boundaries are retained; unlabelled text never invents timestamps', () => {
  const c = segmentText('WEBVTT\n\n00:01:00.000 --> 00:01:06.000\nTrain in the morning.\n00:01:07.000 --> 00:01:10.000\nRecover after running.', 'supplied_transcript');
  assert.deepEqual(c.map(x => [x.startSeconds,x.endSeconds]), [[60,66],[67,70]]);
  assert.deepEqual(chunkText('A transcript without any timing markers', 'supplied_transcript').map(x=>x.startSeconds), [null]);
});

test('chunking covers every word of long input with a bounded size', () => {
  const tokens = Array.from({ length: 4000 }, (_, i) => `endurance${i}`);
  const chunks = chunkText(tokens.join(' '), 'supplied_transcript', 200);
  assert.ok(chunks.length > 10);
  assert.deepEqual(chunks.flatMap(c => c.text.split(/\s+/)), tokens);
  assert.ok(chunks.every(c => c.estimatedTokens <= 240));
});

test('index skips excluded sources, preserves provenance, reuses unchanged source, invalidates revisions', () => {
  const a = source('videoA');
  const b = source('videoB', { decision: 'exclude' });
  const first = indexSources([a,b], emptyIndex(), 3, '2026-10-18T00:00:00.000Z');
  assert.equal(first.stats.updated, 1);
  assert.equal(first.stats.skipped, 1);
  assert.equal(first.index.chunks[0].sourceUrl, a.sourceUrl);
  assert.equal(first.index.chunks.find(c => c.textKind === 'supplied_transcript').startSeconds, 10);
  const second = indexSources([a,b], first.index, 4, '2026-10-18T00:01:00.000Z');
  assert.equal(second.stats.reused, 1);
  assert.deepEqual(second.index.chunks, first.index.chunks);
  const third = indexSources([{...a, transcript: '[00:15] Updated new evidence.'}], second.index, 5);
  assert.equal(third.stats.updated, 1);
  assert.notEqual(third.index.chunks.find(c => c.textKind==='supplied_transcript').id, first.index.chunks.find(c => c.textKind==='supplied_transcript').id);
  const cleared = indexSources([], third.index, 6);
  assert.equal(cleared.stats.removed, 1);
  assert.equal(cleared.index.chunks.length, 0);
});

test('search matches across chunks, favors query evidence, returns timestamps and diverse sources', () => {
  const a = source('a');
  const b = source('b', { channel:'Running Club B', topic:'Training & recovery', notes:'', transcript:'[00:20] We can recover properly after long runs while working full time.' });
  const { index } = indexSources([a,b], emptyIndex(), 1);
  const hits = searchIndex(index, 'office hours running', {limit:10});
  assert.ok(hits.length > 0);
  assert.ok(hits.some(h => h.chunk.sourceId === 'a'));
  assert.ok(hits.every(h => h.score > 0));
  assert.ok(hits.every(h => h.chunk.sourceUrl.startsWith('https://')));
  assert.deepEqual(searchIndex(index, 'working full time', { topic:'Training & recovery' }).map(h=>h.chunk.sourceId), ['b']);
  assert.equal(searchIndex(index, '   ', {}).length, 0);
});

test('text kind tracks supplied transcript separately from unverified research notes', () => {
  const { index } = indexSources([source('a', { analysed:false })], emptyIndex(), 1);
  assert.ok(index.chunks.some(c => c.textKind === 'research_notes'));
  assert.ok(index.chunks.some(c => c.textKind === 'supplied_transcript'));
  assert.ok(index.chunks.every(c => c.status === 'unreviewed'));
  assert.equal(searchIndex(index, 'fueling', { reviewedOnly: true }).length, 0);
});


test('local index persists atomically and remains outside the tracked source tree', async () => {
  const previous=process.cwd();
  const dir=await mkdtemp(path.join(tmpdir(), 'scout-knowledge-'));
  try {
    process.chdir(dir);
    assert.equal((await loadIndex()).workspaceRevision, -1);
    const built=indexSources([source('persist-me')], emptyIndex(), 8).index;
    await saveIndex(built);
    const persisted=await loadIndex();
    assert.equal(persisted.workspaceRevision, 8);
    assert.equal(persisted.chunks.length, built.chunks.length);
    const raw=await readFile(path.join(dir,'.local-data','knowledge-index-v1.json'),'utf8');
    assert.ok(raw.includes('persist-me'));
  } finally {process.chdir(previous);await rm(dir,{recursive:true,force:true});}
});
