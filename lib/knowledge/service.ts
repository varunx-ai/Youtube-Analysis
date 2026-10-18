import { promises as fs } from 'node:fs';
import path from 'node:path';
import { workspaceSchema } from '../model';
import { seed } from '../seed';
import { indexSources } from './core.ts';
import { loadIndex, saveIndex } from './storage.ts';

async function activeWorkspace() {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(process.cwd(), '.local-data', 'workspace.json'), 'utf8'));
    const valid = workspaceSchema.safeParse(raw.workspace);
    if (!valid.success || !Number.isInteger(raw.revision)) throw new Error('Invalid local workspace.');
    return { workspace: valid.data, revision: raw.revision };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { workspace: seed, revision: 0 };
    throw error;
  }
}

let running: Promise<unknown> = Promise.resolve();
export function synchronizeKnowledge() {
  // Serializes writes inside this local process; production needs DB transactions and locks.
  const task = async () => {
    const { workspace, revision } = await activeWorkspace();
    const previous = await loadIndex();
    const { index, stats } = indexSources(workspace.sources, previous, revision);
    await saveIndex(index);
    return { ...stats, revision, generatedAt: index.generatedAt };
  };
  const result = running.then(task, task);
  running = result.then(() => undefined, () => undefined);
  return result;
}

/** Search reads a current index, building it when absent or outdated.
 * This makes search immediately usable without a manual first-run action. */
export async function currentKnowledgeIndex() {
  const { revision } = await activeWorkspace();
  const index = await loadIndex();
  if (index.workspaceRevision === revision) return index;
  await synchronizeKnowledge();
  return loadIndex();
}

export async function knowledgeStatus() {
  const [{ workspace, revision }, index] = await Promise.all([activeWorkspace(), loadIndex()]);
  return {
    indexed: index.workspaceRevision >= 0,
    upToDate: index.workspaceRevision === revision,
    workspaceRevision: revision,
    indexedRevision: index.workspaceRevision,
    sourceCount: workspace.sources.length,
    indexedSources: Object.keys(index.sources).length,
    chunkCount: index.chunks.length,
    transcriptChunks: index.chunks.filter(c => c.textKind === 'supplied_transcript').length,
    reviewedChunks: index.chunks.filter(c => c.status === 'reviewed').length,
    generatedAt: index.workspaceRevision >= 0 ? index.generatedAt : null,
  };
}
