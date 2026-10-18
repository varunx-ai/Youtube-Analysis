import { loadIndex } from '../../../../lib/knowledge/storage';
import { searchIndex } from '../../../../lib/knowledge/core.ts';
import { localKnowledgeAllowed, privateHeaders } from '../../../../lib/knowledge/local-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!localKnowledgeAllowed()) return Response.json({ error: 'Knowledge API requires authenticated deployment.' }, { status: 403, headers: privateHeaders });
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') || '').trim();
  if (q.length < 2 || q.length > 300) return Response.json({ error: 'Query must be 2–300 characters.' }, { status: 400, headers: privateHeaders });
  const limit = Math.min(30, Math.max(1, Number(params.get('limit')) || 10));
  try {
    const index = await loadIndex();
    const hits = searchIndex(index, q, { limit, topic: params.get('topic') || undefined, channel: params.get('channel') || undefined, reviewedOnly: params.get('reviewed') === 'true' });
    return Response.json({ query: q, method: 'lexical_bm25', indexRevision: index.workspaceRevision, totalIndexedChunks: index.chunks.length, hits }, { headers: privateHeaders });
  } catch { return Response.json({ error: 'Unable to search local evidence.' }, { status: 503, headers: privateHeaders }); }
}
