/** API routes are intentionally disabled in production pending real authentication. */
export function localKnowledgeAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}
export const privateHeaders = { 'Cache-Control': 'no-store, private' };
