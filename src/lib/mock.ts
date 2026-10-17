// Demo data, used automatically when YOUTUBE_API_KEY is not set.
import type { Channel, ChannelHit, SearchOptions, Video } from "./types";

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const SUFFIX = ["Lab", "Daily", "Explained", "Weekly", "Studio", "Insider", "Notes", "Academy"];
const TITLES = [
  "How I {q} in 30 days",
  "{q}: 7 mistakes everyone makes",
  "The truth about {q}",
  "Is {q} worth it in 2026?",
  "{q} for beginners (full guide)",
  "I tried {q} for a year",
  "Why {q} is changing fast",
  "5 {q} tools you need",
  "{q} — what nobody tells you",
  "Behind the scenes of {q}",
  "{q} tips that actually work",
  "WATCH THIS before you start {q}",
];

export function mockSearch(q: string, _o: SearchOptions): ChannelHit[] {
  void _o;
  return Array.from({ length: 12 }, (_, i) => {
    const r = rng(`${q}:${i}`);
    const subs = Math.round(Math.exp(7 + r() * 8));
    const videoCount = 20 + Math.floor(r() * 400);
    const channel: Channel = {
      id: `DEMO_${encodeURIComponent(q.toLowerCase().replace(/\s+/g, "-"))}_${i}`,
      title: `${cap(q)} ${SUFFIX[i % SUFFIX.length]}`,
      handle: `@${q.replace(/\s+/g, "").toLowerCase()}${SUFFIX[i % SUFFIX.length].toLowerCase()}`,
      description: `Demo channel about ${q}. Add a YouTube API key to see real channels.`,
      country: ["US", "IN", "GB", "CA"][Math.floor(r() * 4)],
      subs,
      views: Math.round(subs * (20 + r() * 150)),
      videoCount,
      thumb: null,
      publishedAt: new Date(Date.now() - (200 + r() * 2500) * 86400000).toISOString(),
    };
    return {
      channel,
      matches: Math.max(1, Math.round(r() * 9)),
      sampleTitles: [TITLES[i % TITLES.length].replace("{q}", q)],
    };
  }).sort((a, b) => b.matches - a.matches);
}

export function mockVideos(channel: Channel): Video[] {
  const r = rng(channel.id);
  const topic = channel.title.split(" ").slice(0, -1).join(" ").toLowerCase() || "this";
  const base = Math.max(300, (channel.subs ?? 5000) * (0.02 + r() * 0.15));
  const n = 80;
  const cadenceDays = 2 + r() * 8;
  return Array.from({ length: n }, (_, i) => {
    const title = TITLES[Math.floor(r() * TITLES.length)].replace("{q}", topic);
    const spike = r() < 0.08 ? 3 + r() * 9 : 1;
    const views = Math.round(base * Math.exp((r() - 0.5) * 1.2) * spike);
    const short = r() < 0.25;
    return {
      id: `${channel.id}_v${i}`,
      channelId: channel.id,
      title,
      publishedAt: new Date(Date.now() - (i * cadenceDays + r() * 2) * 86400000).toISOString(),
      durationSec: short ? 20 + Math.floor(r() * 40) : 240 + Math.floor(r() * 1500),
      views,
      likes: Math.round(views * (0.02 + r() * 0.05)),
      comments: Math.round(views * (0.001 + r() * 0.004)),
      thumb: null,
    };
  });
}

export function mockResearch(q: string, pages: number): { channels: Channel[]; videos: Video[] } {
  const channels = mockSearch(q, { order: "relevance", withinDays: null }).map((h) => h.channel);
  const videos = channels.flatMap((c) => mockVideos(c).filter((_, i) => i % 7 === 0));
  return { channels, videos: videos.slice(0, pages * 50) };
}
