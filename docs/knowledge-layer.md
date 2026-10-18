# Knowledge Layer — Phase 1 (local-only)

This milestone makes existing Channel Scout source material **searchable without an LLM call**. It does not claim to have watched or verified any videos. The saved source notes and manually supplied transcript text are the only indexed content. Public YouTube transcripts are not fetched automatically.

## Data flow

```
Workspace stored in .local-data/workspace.json (or starter seed)
   → Explicit POST /api/knowledge/sync
   → Per-source SHA-256 fingerprint + incremental chunking
   → Versioned, atomic .local-data/knowledge-index-v1.json
   → GET /api/knowledge/search?q=...
   → Ranked source-linked excerpts (lexical BM25)
```

Open `/knowledge` through the link in the research workspace to index and search. The JSON index is gitignored. Re-index after changes; `/api/knowledge/status` indicates staleness relative to the workspace revision. `GET /api/knowledge/search` accepts `q`, `limit` (max 30), `topic`, `channel`, and `reviewed=true`.

Each chunk retains its source ID, source link, source type, review status, content type (`research_notes` vs `supplied_transcript`), timestamp when supplied, ordinal position, and estimated tokens. It keeps the source text: summaries are **not** substitutes for original evidence. Only `decision=exclude` is automatically skipped, and unreviewed material remains labeled as unreviewed.

Timestamp parsing supports transcript `[mm:ss]` / `[hh:mm:ss]` and SRT/VTT cue ranges. No inferred timestamps. Token counts are **size estimates** for text chunking, not model-specific billed token measurements.

Reindexing reuses unchanged source chunks, invalidates modified content, and removes sources no longer present or explicitly excluded. Queries use per-chunk BM25-style lexical ranking with a three-result-per-source diversity cap. **It is not embedding search or semantic RAG.** Synonyms will not necessarily match.

## Run and test

```bash
corepack pnpm install
corepack pnpm typecheck
corepack pnpm test:knowledge
corepack pnpm dev
```

Open http://localhost:3000/knowledge. The Knowledge API returns 403 when `NODE_ENV=production`. Neither the workspace persistence API nor this local Knowledge Layer has production-grade authentication. **Do not deploy the local variant publicly.**

## Next milestones

1. A production-safe storage adapter (Postgres, authenticated access, project/tenant boundaries, transactional indexing).
2. Real tokenizers and configurable chunk sizing; evaluate retrieval quality on labeled questions.
3. Versioned embeddings + hybrid lexical/vector retrieval and reranking; preserve the exact evidence-link contracts.
4. Structured per-video analysis and corpus-level aggregation that distinguishes sampled evidence from broad corpus statistics.
5. Agent context-builder and evaluations grounded in original source excerpts.
