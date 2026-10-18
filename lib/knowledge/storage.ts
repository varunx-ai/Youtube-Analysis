import { promises as fs } from 'node:fs';
import path from 'node:path';
import { emptyIndex } from './core.ts';
import type { KnowledgeIndex } from './types.ts';

const pathname = () => path.join(process.cwd(), '.local-data', 'knowledge-index-v1.json');

export async function loadIndex(): Promise<KnowledgeIndex> {
  try {
    const data: unknown = JSON.parse(await fs.readFile(pathname(), 'utf8'));
    if (!data || typeof data !== 'object' || !('schemaVersion' in data) || data.schemaVersion !== 1 ||
        !('sources' in data) || !('chunks' in data) || !Array.isArray(data.chunks))
      throw new Error('Invalid knowledge index.');
    return data as KnowledgeIndex;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return emptyIndex();
    throw e;
  }
}

export async function saveIndex(index: KnowledgeIndex): Promise<void> {
  await fs.mkdir(path.dirname(pathname()), { recursive: true });
  const tmp = `${pathname()}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(index), { mode: 0o600 });
    await fs.rename(tmp, pathname());
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
  }
}
