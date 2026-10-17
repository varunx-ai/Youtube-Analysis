import { promises as fs } from 'node:fs';
import path from 'node:path';
import { workspaceSchema } from '../../../lib/model';
import { seed } from '../../../lib/seed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
const file = path.join(process.cwd(), '.local-data', 'workspace.json');
type Stored = { workspace: typeof seed; revision: number; updatedAt: string | null };
async function readState(): Promise<Stored> {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8')) as Stored;
    const parsed = workspaceSchema.safeParse(data.workspace);
    if (!parsed.success || !Number.isInteger(data.revision)) throw new Error('Invalid local workspace');
    return { ...data, workspace: parsed.data };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { workspace: seed, revision: 0, updatedAt: null };
    throw error;
  }
}
export async function GET() {
  try {
    return Response.json(await readState(), { headers });
  } catch {
    return Response.json({ error: 'Local research storage is unavailable.' }, { status: 503, headers });
  }
}
// A single-process local-development writer. Do not deploy this route publicly.
let writeQueue: Promise<unknown> = Promise.resolve();
export async function PUT(request: Request) {
  const task = async () => {
    try {
      if (Number(request.headers.get('content-length') || 0) > 2_000_000)
        return Response.json({ error: 'Workspace exceeds 2 MB.' }, { status: 413, headers });
      const text = await request.text();
      if (text.length > 2_000_000) return Response.json({ error: 'Workspace exceeds 2 MB.' }, { status: 413, headers });
      const body = JSON.parse(text);
      const parsed = workspaceSchema.safeParse(body.workspace);
      if (!parsed.success || !Number.isInteger(body.revision) || body.revision < 0)
        return Response.json({ error: 'Invalid workspace.' }, { status: 400, headers });
      const old = await readState();
      if (old.revision !== body.revision)
        return Response.json({ error: 'This workspace changed in another tab. Export then reload.' }, { status: 409, headers });
      const updatedAt = new Date().toISOString();
      const revision = old.revision + 1;
      await fs.mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await fs.writeFile(temporary, JSON.stringify({ workspace: parsed.data, revision, updatedAt }));
      await fs.rename(temporary, file);
      return Response.json({ revision, updatedAt }, { headers });
    } catch {
      return Response.json({ error: 'Unable to save local workspace.' }, { status: 500, headers });
    }
  };
  const result = writeQueue.then(task, task);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}
