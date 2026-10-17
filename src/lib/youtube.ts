import { addQuota, getCachedSearch, getChannel, getComments, getVideos, quotaUsedToday, recordVideoSnapshots, setCachedSearch, upsertChannel, upsertComments, upsertVideos, videosFresh } from "./db";
import { mockResearch, mockSearch, mockVideos } from "./mock";
import type { Channel, ChannelHit, ResearchOptions, ResearchVideo, SearchOptions, Video } from "./types";

const BASE = "https://www.googleapis.com/youtube/v3";
const KEY = process.env.YOUTUBE_API_KEY?.trim().replace(/^["']|["']$/g, "");
const LIMIT = Number(process.env.YT_DAILY_LIMIT ?? 9000);

export const isDemo = !KEY;
export const QUOTA_LIMIT = LIMIT;

// Quota cost per call: search.list = 100, everything else we use = 1.
async function call<T>(endpoint: string, params: Record<string, string>, cost: number): Promise<T> {
  if (quotaUsedToday() + cost > LIMIT) {
    throw new Error(`Daily quota cap reached (${LIMIT} units). It resets at midnight Pacific time, or raise YT_DAILY_LIMIT.`);
  }
  // Method names are "search.list" etc., but the URL path is just "search".
  const url = `${BASE}/${endpoint.replace(/\.list$/, "")}?${new URLSearchParams({ ...params, key: KEY! })}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* handled below */ }
  if (!res.ok || !body) {
    throw new Error(`YouTube API ${res.status}: ${body?.error?.message ?? (text.slice(0, 200) || "empty response")}`);
  }
  addQuota(cost);
  return body as T;
}

const chunk = <T,>(xs: T[], n: number) =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fetchChannels(ids: string[]): Promise<Channel[]> {
  const out: Channel[] = [];
  for (const group of chunk(ids, 50)) {
    const data = await call<any>("channels.list", { part: "snippet,statistics", id: group.join(","), maxResults: "50" }, 1);
    for (const it of data.items ?? []) {
      out.push({
        id: it.id,
        title: it.snippet.title,
        handle: it.snippet.customUrl ?? null,
        description: it.snippet.description ?? "",
        country: it.snippet.country ?? null,
        subs: it.statistics.hiddenSubscriberCount ? null : Number(it.statistics.subscriberCount ?? 0),
        views: Number(it.statistics.viewCount ?? 0),
        videoCount: Number(it.statistics.videoCount ?? 0),
        thumb: it.snippet.thumbnails?.default?.url ?? null,
        publishedAt: it.snippet.publishedAt,
      });
    }
  }
  return out;
}

export async function searchChannels(q: string, opts: SearchOptions): Promise<ChannelHit[]> {
  const key = JSON.stringify([q.trim().toLowerCase(), opts, isDemo]);
  const cached = getCachedSearch(key);
  if (cached) {
    const rows = JSON.parse(cached) as { id: string; matches: number; sampleTitles: string[] }[];
    return rows.flatMap((r) => {
      const channel = getChannel(r.id);
      return channel ? [{ channel, matches: r.matches, sampleTitles: r.sampleTitles }] : [];
    });
  }

  let hits: ChannelHit[];
  if (isDemo) {
    hits = mockSearch(q, opts);
    hits.forEach((h) => upsertChannel(h.channel));
  } else {
    const params: Record<string, string> = { part: "snippet", type: "video", q, maxResults: "50", order: opts.order };
    if (opts.withinDays) params.publishedAfter = new Date(Date.now() - opts.withinDays * 86400000).toISOString();
    const data = await call<any>("search.list", params, 100);

    const byChannel = new Map<string, { matches: number; titles: string[] }>();
    for (const it of data.items ?? []) {
      const id = it.snippet.channelId as string;
      const e = byChannel.get(id) ?? { matches: 0, titles: [] };
      e.matches++;
      if (e.titles.length < 3) e.titles.push(it.snippet.title);
      byChannel.set(id, e);
    }
    const channels = await fetchChannels([...byChannel.keys()]);
    channels.forEach(upsertChannel);
    hits = channels
      .map((channel) => ({ channel, matches: byChannel.get(channel.id)!.matches, sampleTitles: byChannel.get(channel.id)!.titles }))
      .sort((a, b) => b.matches - a.matches);
  }

  setCachedSearch(key, q, JSON.stringify(hits.map((h) => ({ id: h.channel.id, matches: h.matches, sampleTitles: h.sampleTitles }))));
  return hits;
}

const parseDuration = (iso: string) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
};

async function fetchRecentVideos(channelId: string, max = 100): Promise<Video[]> {
  // A channel's uploads playlist id is its channel id with the "UC" prefix swapped for "UU".
  const playlistId = "UU" + channelId.slice(2);
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < max) {
    const data = await call<any>(
      "playlistItems.list",
      { part: "contentDetails", playlistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) },
      1
    );
    for (const it of data.items ?? []) ids.push(it.contentDetails.videoId);
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  const out: Video[] = [];
  for (const group of chunk(ids.slice(0, max), 50)) {
    const data = await call<any>("videos.list", { part: "snippet,contentDetails,statistics", id: group.join(","), maxResults: "50" }, 1);
    for (const it of data.items ?? []) {
      out.push({
        id: it.id,
        channelId,
        title: it.snippet.title,
        publishedAt: it.snippet.publishedAt,
        durationSec: parseDuration(it.contentDetails.duration),
        views: Number(it.statistics.viewCount ?? 0),
        likes: it.statistics.likeCount != null ? Number(it.statistics.likeCount) : null,
        comments: it.statistics.commentCount != null ? Number(it.statistics.commentCount) : null,
        thumb: it.snippet.thumbnails?.medium?.url ?? null,
      });
    }
  }
  return out;
}

/** Returns the channel and its recent videos, fetching from YouTube only if our cache is older than 24h. */
export async function loadChannel(id: string): Promise<{ channel: Channel; videos: Video[] } | null> {
  let channel = getChannel(id);
  if (!channel && !isDemo) {
    [channel] = await fetchChannels([id]);
    if (channel) upsertChannel(channel);
  }
  if (!channel) return null;

  if (!videosFresh(id)) {
    const vs = isDemo ? mockVideos(channel) : await fetchRecentVideos(id);
    upsertVideos(vs);
  }
  return { channel, videos: getVideos(id) };
}

const toVideo = (it: any): Video => ({
  id: it.id,
  channelId: it.snippet.channelId,
  title: it.snippet.title,
  publishedAt: it.snippet.publishedAt,
  durationSec: parseDuration(it.contentDetails.duration),
  views: Number(it.statistics.viewCount ?? 0),
  likes: it.statistics.likeCount != null ? Number(it.statistics.likeCount) : null,
  comments: it.statistics.commentCount != null ? Number(it.statistics.commentCount) : null,
  thumb: it.snippet.thumbnails?.medium?.url ?? null,
});

/** Roughly pages*100 + a few units. Shown in the UI before the user spends it. */
export const researchCost = (pages: number) => pages * 100 + pages * 2 + 2;

/**
 * Keyword -> the videos YouTube returns for it (50 per page) with full stats, plus the channels behind them.
 * Cached for 7 days per keyword and options, so re-opening a result or generating ideas costs nothing.
 */
export async function researchKeyword(q: string, opts: ResearchOptions): Promise<ResearchVideo[]> {
  const key = JSON.stringify(["research", q.trim().toLowerCase(), opts, isDemo]);
  const cached = getCachedSearch(key);
  let videos: Video[];

  if (cached) {
    videos = JSON.parse(cached) as Video[];
  } else if (isDemo) {
    const m = mockResearch(q, opts.pages);
    m.channels.forEach(upsertChannel);
    videos = m.videos;
    setCachedSearch(key, q, JSON.stringify(videos));
  } else {
    const ids: string[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < opts.pages; page++) {
      const params: Record<string, string> = { part: "snippet", type: "video", q, maxResults: "50", order: opts.order };
      if (opts.withinDays) params.publishedAfter = new Date(Date.now() - opts.withinDays * 86400000).toISOString();
      if (pageToken) params.pageToken = pageToken;
      const data = await call<any>("search.list", params, 100);
      for (const it of data.items ?? []) if (it.id?.videoId) ids.push(it.id.videoId);
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    videos = [];
    for (const group of chunk([...new Set(ids)], 50)) {
      const data = await call<any>("videos.list", { part: "snippet,contentDetails,statistics", id: group.join(","), maxResults: "50" }, 1);
      videos.push(...(data.items ?? []).map(toVideo));
    }
    const channels = await fetchChannels([...new Set(videos.map((v) => v.channelId))]);
    channels.forEach(upsertChannel);
    setCachedSearch(key, q, JSON.stringify(videos));
  }

  const now = Date.now();
  const channelIds = [...new Set(videos.map(v => v.channelId))];
  // Build a local baseline from cached channel histories when available.
  const baselines = new Map<string, number>();
  for (const id of channelIds) {
    const history = getVideos(id);
    if (history.length >= 5) {
      const sorted = history.map(x => x.views).sort((a,b)=>a-b);
      const m = Math.floor(sorted.length/2);
      baselines.set(id, sorted.length % 2 ? sorted[m] : (sorted[m-1]+sorted[m])/2);
    }
  }
  recordVideoSnapshots(videos);

  return videos.map((v) => {
    const ch = getChannel(v.channelId);
    const subs = ch?.subs ?? null;
    const ageDays = Math.max(0, Math.floor((now - new Date(v.publishedAt).getTime()) / 86400000));
    const baseline = baselines.get(v.channelId) ?? null;
    const multiple = baseline && baseline > 0 ? v.views / baseline : null;
    const reachValue = subs == null ? null : v.views / Math.max(subs, 1000);
    const velocity = v.views / Math.max(ageDays, 1);
    const score = (multiple == null ? 0 : Math.min(multiple,10)*0.65)
      + (reachValue == null ? 0 : Math.min(reachValue,10)*0.2)
      + Math.min(velocity / Math.max(baseline ? baseline/30 : 1,1),10)*0.15;
    return {
      ...v,
      channelTitle: ch?.title ?? "Unknown channel",
      subs,
      ageDays,
      viewsPerDay: velocity,
      reach: reachValue,
      channelMedianViews: baseline ?? undefined,
      baselineMultiple: multiple ?? undefined,
      performanceScore: score,
    };
  });
}

export async function enrichChannelBaselines(videos: ResearchVideo[]): Promise<ResearchVideo[]> {
  const ids=[...new Set(videos.map(v=>v.channelId))];
  for(const id of ids){ try{ await loadChannel(id); }catch(e){ console.warn(`[baseline] ${id}: ${e instanceof Error?e.message:'failed'}`); } }
  const baselines=new Map<string,number>();
  for(const id of ids){ const h=getVideos(id); if(h.length>=5){ const a=h.map(x=>x.views).sort((x,y)=>x-y); const m=Math.floor(a.length/2); baselines.set(id,a.length%2?a[m]:(a[m-1]+a[m])/2); } }
  return videos.map(v=>{ const baseline=baselines.get(v.channelId); const multiple=baseline&&baseline>0?v.views/baseline:undefined; return {...v,channelMedianViews:baseline,baselineMultiple:multiple,performanceScore:multiple==null?v.performanceScore:Math.min(multiple,10)*.75+Math.min(v.viewsPerDay/Math.max(baseline/30,1),10)*.25}; });
}

export async function fetchVideoComments(videoId: string, max = 30): Promise<import("./types").VideoComment[]> {
  const cached = getComments(videoId);
  if (cached) return cached.slice(0, max);
  if (isDemo) {
    const demo = [
      "How would you adapt this for a first-time marathon?",
      "Can you make a version for runners in India?",
      "What would you do if you only had four days a week to train?",
      "Which part of this matters most for beginners?",
      "Would love a follow-up comparing the options in more detail.",
      "I tried this and the hardest part was staying consistent.",
    ].map((text, i) => ({ id: `DEMO_COMMENT_${videoId}_${i}`, videoId, author: `viewer${i+1}`, text, likeCount: 20 - i, publishedAt: new Date(Date.now() - i * 86400000).toISOString() }));
    upsertComments(videoId, demo);
    return demo.slice(0, max);
  }
  const data = await call<any>("commentThreads.list", {
    part: "snippet",
    videoId,
    maxResults: String(Math.min(max, 100)),
    order: "relevance",
    textFormat: "plainText",
  }, 1);
  const comments = (data.items ?? []).map((it: any) => {
    const c = it.snippet?.topLevelComment?.snippet;
    return {
      id: it.id,
      videoId,
      author: c?.authorDisplayName ?? "viewer",
      text: c?.textDisplay ?? "",
      likeCount: Number(c?.likeCount ?? 0),
      publishedAt: c?.publishedAt ?? new Date().toISOString(),
    };
  }).filter((x: import("./types").VideoComment) => x.text.trim());
  upsertComments(videoId, comments);
  return comments;
}
