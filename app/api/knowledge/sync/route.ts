import { synchronizeKnowledge } from '../../../../lib/knowledge/service';
import { localKnowledgeAllowed, privateHeaders } from '../../../../lib/knowledge/local-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST() {
  if (!localKnowledgeAllowed()) return Response.json({ error: 'Knowledge API requires authenticated deployment.' }, { status: 403, headers: privateHeaders });
  try { return Response.json(await synchronizeKnowledge(), { headers: privateHeaders }); }
  catch { return Response.json({ error: 'Indexing failed. Check workspace data and local disk access.' }, { status: 500, headers: privateHeaders }); }
}
