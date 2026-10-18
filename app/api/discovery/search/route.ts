import { localKnowledgeAllowed, privateHeaders } from '../../../../lib/knowledge/local-only.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
};
type VideoDetail = { id?: string; statistics?: { viewCount?: string }; contentDetails?: { duration?: string } };
type DiscoveryItem = {
  id: string; title: string; channel: string; channelId: string; url: string;
  description: string; publishedAt: string; thumbnail: string | null;
  views: number | null; durationSeconds: number | null;
};

const cache = new Map<string, { at: number; videos: DiscoveryItem[] }>();
const TTL = 15 * 60_000;
function durationSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : null;
}

export async function GET(request: Request) {
  if (!localKnowledgeAllowed()) return Response.json({ error: 'Private discovery requires authentication before deployment.' }, { status: 403, headers: privateHeaders });
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') || '').trim();
  const order = params.get('order') || 'relevance';
  if (q.length < 2 || q.length > 120) return Response.json({ error: 'Enter a search of 2–120 characters.' }, { status: 400, headers: privateHeaders });
  if (!['relevance', 'date', 'viewCount'].includes(order)) return Response.json({ error: 'Invalid ordering.' }, { status: 400, headers: privateHeaders });
  const key = process.env.YOUTUBE_API_KEY?.trim().replace(/^["']|["']$/g, '');
  if (!key) return Response.json({ code: 'missing_key', error: 'Add YOUTUBE_API_KEY to .env.local and restart Channel Scout to search YouTube in the app.' }, { status: 503, headers: privateHeaders });
  const cacheKey = JSON.stringify([q.toLowerCase(), order]);
  const stored = cache.get(cacheKey);
  if (stored && Date.now() - stored.at < TTL) return Response.json({ query: q, videos: stored.videos, cached: true }, { headers: privateHeaders });
  try {
    const searchURL = new URL('https://www.googleapis.com/youtube/v3/search');
    searchURL.search = new URLSearchParams({ key, q, part: 'snippet', type: 'video', maxResults: '20', order, safeSearch: 'moderate' }).toString();
    const response = await fetch(searchURL, { cache: 'no-store', signal: AbortSignal.timeout(16000) });
    if (!response.ok) return Response.json({ error: `YouTube search failed (HTTP ${response.status}). Check your API key, quota, and YouTube Data API permissions.` }, { status: 502, headers: privateHeaders });
    const body = await response.json() as { items?: YouTubeSearchItem[] };
    const rows = (body.items || []).filter(it => /^[\w-]{11}$/.test(it.id?.videoId || '')).map(it => {
      const id = it.id!.videoId!;
      return {
        id, title: (it.snippet?.title || 'Untitled video').slice(0, 300),
        channel: (it.snippet?.channelTitle || 'Unknown channel').slice(0, 150),
        channelId: it.snippet?.channelId || '', url: `https://www.youtube.com/watch?v=${id}`,
        description: (it.snippet?.description || '').slice(0, 3000),
        publishedAt: it.snippet?.publishedAt || '',
        thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null,
        views: null as number | null, durationSeconds: null as number | null,
      };
    });
    if (rows.length) {
      try {
        const detailURL = new URL('https://www.googleapis.com/youtube/v3/videos');
        detailURL.search = new URLSearchParams({ key, part: 'statistics,contentDetails', id: rows.map(v => v.id).join(','), maxResults: '50' }).toString();
        const detailResponse = await fetch(detailURL, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (detailResponse.ok) {
          const details = await detailResponse.json() as { items?: VideoDetail[] };
          const lookup = new Map((details.items || []).map(d => [d.id, d]));
          for (const row of rows) {
            const item = lookup.get(row.id);
            const count = item?.statistics?.viewCount;
            row.views = count != null && Number.isSafeInteger(Number(count)) ? Number(count) : null;
            row.durationSeconds = durationSeconds(item?.contentDetails?.duration);
          }
        }
      } catch { /* Missing optional metrics must not hide search results. */ }
    }
    cache.set(cacheKey, { at: Date.now(), videos: rows });
    if (cache.size > 60) cache.delete(cache.keys().next().value!);
    return Response.json({ query: q, videos: rows, cached: false }, { headers: privateHeaders });
  } catch {
    return Response.json({ error: 'Unable to reach the YouTube API. Check your connection and retry.' }, { status: 502, headers: privateHeaders });
  }
}
