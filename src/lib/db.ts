// Simple JSON-file store (./data/store.json). No native modules, so it installs and runs anywhere Node runs.
// When this becomes a multi-user product, swap this file for Postgres; the exported functions are the whole interface.
import fs from "node:fs";
import path from "node:path";
import type { Channel, Video, VideoComment, VideoSnapshot, VideoTranscript, VideoIntelligence } from "./types";

type Store = {
  channels: Record<string, Channel>;
  videos: Record<string, { fetchedAt: number; items: Video[] }>;
  searches: Record<string, { results: string; createdAt: number }>;
  quota: Record<string, number>;
  snapshots: Record<string, VideoSnapshot[]>;
  comments: Record<string, { fetchedAt: number; items: VideoComment[] }>;
  transcripts: Record<string, VideoTranscript>;
  videoIntelligence: Record<string, VideoIntelligence>;
};

const dir = path.join(process.cwd(), "data");
const file = path.join(dir, "store.json");
const DAY = 24 * 3600 * 1000;

function load(): Store {
  const empty: Store = { channels: {}, videos: {}, searches: {}, quota: {}, snapshots: {}, comments: {}, transcripts: {}, videoIntelligence: {} };
  try {
    return { ...empty, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return empty;
  }
}

const g = globalThis as unknown as { __scoutStore?: Store };
const store: Store = g.__scoutStore ?? (g.__scoutStore = load());

function save() {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(store));
    fs.renameSync(tmp, file);
  } catch (e) {
    console.error("Could not save data/store.json:", e);
  }
}

export function upsertChannel(c: Channel) {
  store.channels[c.id] = c;
  save();
}

export function getChannel(id: string): Channel | null {
  return store.channels[id] ?? null;
}

export function recordVideoSnapshots(vs: Video[]) {
  const capturedAt = new Date().toISOString();
  for (const v of vs) {
    const history = store.snapshots[v.id] ?? [];
    const last = history[history.length - 1];
    if (!last || last.views !== v.views || last.likes !== v.likes || last.comments !== v.comments || Date.now() - new Date(last.capturedAt).getTime() >= DAY) {
      store.snapshots[v.id] = [...history, { videoId: v.id, capturedAt, views: v.views, likes: v.likes, comments: v.comments }].slice(-365);
    }
  }
  save();
}

export function upsertVideos(vs: Video[]) {
  recordVideoSnapshots(vs);
  const byChannel = new Map<string, Video[]>();
  for (const v of vs) byChannel.set(v.channelId, [...(byChannel.get(v.channelId) ?? []), v]);
  for (const [id, items] of byChannel) store.videos[id] = { fetchedAt: Date.now(), items };
  save();
}

export function getVideos(channelId: string): Video[] {
  const items = store.videos[channelId]?.items ?? [];
  return [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getVideoSnapshots(videoId: string): VideoSnapshot[] {
  return [...(store.snapshots[videoId] ?? [])];
}

export function upsertComments(videoId: string, items: VideoComment[]) {
  store.comments[videoId] = { fetchedAt: Date.now(), items };
  save();
}

export function getComments(videoId: string, maxAgeMs = 7 * DAY): VideoComment[] | null {
  const r = store.comments[videoId];
  return r && Date.now() - r.fetchedAt < maxAgeMs ? r.items : null;
}

export function upsertTranscript(t: VideoTranscript) { store.transcripts[t.videoId] = t; save(); }
export function getTranscript(videoId: string): VideoTranscript | null { return store.transcripts[videoId] ?? null; }
export function getTranscripts(videoIds?: string[]): VideoTranscript[] {
  const all=Object.values(store.transcripts);
  return videoIds ? all.filter(t=>videoIds.includes(t.videoId)) : all;
}


export function upsertVideoIntelligence(v: VideoIntelligence) { store.videoIntelligence[v.videoId] = v; save(); }
export function getVideoIntelligence(videoId: string): VideoIntelligence | null { return store.videoIntelligence[videoId] ?? null; }
export function getVideoIntelligenceMany(videoIds?: string[]): VideoIntelligence[] {
  const all=Object.values(store.videoIntelligence);
  return videoIds ? all.filter(v=>videoIds.includes(v.videoId)) : all;
}

export function videosFresh(channelId: string, maxAgeMs = DAY): boolean {
  const e = store.videos[channelId];
  return !!e && e.items.length > 0 && Date.now() - e.fetchedAt < maxAgeMs;
}

export function getCachedSearch(key: string, maxAgeMs = 7 * DAY): string | null {
  const r = store.searches[key];
  return r && Date.now() - r.createdAt < maxAgeMs ? r.results : null;
}

export function setCachedSearch(key: string, _query: string, results: string) {
  void _query;
  store.searches[key] = { results, createdAt: Date.now() };
  save();
}

const today = () => new Date().toISOString().slice(0, 10);

export function quotaUsedToday(): number {
  return store.quota[today()] ?? 0;
}

export function addQuota(units: number) {
  store.quota[today()] = (store.quota[today()] ?? 0) + units;
  save();
}
