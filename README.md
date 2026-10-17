# Channel Scout — Local UI baseline

This is the original Channel Scout demo **UI**, adapted to run locally with standard Next.js. The visual React workspace, evidence drawers, triage, patterns/gaps and idea screens are preserved.

## Local setup (Node >= 22)

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

Open http://localhost:3000. The original source export's `package.json` was for a ChatGPT Sites/Vinext/Cloudflare deployment; this version uses standard Next.js commands. No secrets are included.

## Persistence

The workspace API uses `.local-data/workspace.json` for **single-user local development only**. This directory is gitignored. The demo's Cloudflare D1 backend and ChatGPT owner authentication are **not** deployed here. **Do not deploy this variant publicly** until storage, authentication and authorization are implemented. The original `db/`, `drizzle/` and Sites build helpers are retained as reference and are not used by the local UI route.

## What works in the demo

- Four coherent sections: Market evidence, Video triage, Patterns & gaps, Content ideas
- Add source, import CSV/JSON, manual source evidence and transcript input
- Source evidence drawer, reviewer decisions, evidence-based research priority and briefs
- Local workspace saving and export
- Optional YouTube oEmbed metadata lookup (depends on YouTube response)

## What is NOT connected

Automated YouTube discovery, competitor metrics retrieval, transcripts, Gemini analysis, RAG, vector search, web research, and multi-agent orchestration are future integration work. The starter source data is example publisher evidence, not a live YouTube corpus.

## GitHub setup

If the remote repository is empty, extract these files into your local `Youtube-Analysis` checkout, then:

```bash
git add .
git commit -m "feat: add Channel Scout research workspace UI"
git push -u origin main
```

If you already have local uncommitted changes, back them up first and review the diff rather than overwriting files.

## Checks

```bash
corepack pnpm typecheck
corepack pnpm build
```

The original Sites/D1 integration tests under `tests/` are not a valid verification of the adapted local persistence route until rewritten for this environment.
