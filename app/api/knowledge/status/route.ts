import { knowledgeStatus } from '../../../../lib/knowledge/service';
import { localKnowledgeAllowed, privateHeaders } from '../../../../lib/knowledge/local-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!localKnowledgeAllowed()) return Response.json({ error: 'Knowledge API requires authenticated deployment.' }, { status: 403, headers: privateHeaders });
  try { return Response.json(await knowledgeStatus(), { headers: privateHeaders }); }
  catch { return Response.json({ error: 'Unable to read local knowledge status.' }, { status: 503, headers: privateHeaders }); }
}
