
# Channel Scout — Content Intelligence v2

Channel Scout is a general-purpose YouTube content-market research system.

The first vertical is **running in India**, but the architecture is deliberately not running-specific.

## What changed from v1

- Market research can combine multiple related queries.
- Videos are normalized against creator baseline, not just raw views.
- Relative performance, reach and velocity are treated as separate signals.
- Topic discovery and title/keyword signals are separated from interpretation.
- Opportunity scoring is evidence-backed and confidence-labelled.
- Methodology caveats are shown explicitly.
- Market, channel and video analytics are conceptually separated.
- Existing YouTube caching and quota controls are preserved.
- Video refreshes now create timestamped historical snapshots without overwriting prior observations.
- Audience intelligence can ingest public top comments from the strongest videos and extract recurring pain points, questions, objections and content requests.
- Audience evidence is explicitly separated from interpretation and includes caveats about comment-sample bias.

## Important data limitation

YouTube Data API does **not** expose competitor CTR, retention, impressions or subscriber conversion. The product must never fabricate these metrics.

Keyword search volume is also not claimed unless a real keyword-volume provider is connected. The current opportunity engine uses YouTube result coverage, performance, freshness and channel spread as observable proxies.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `YOUTUBE_API_KEY` for real data.

The in-app intelligence / idea-generation flow uses `OPENAI_API_KEY` and the OpenAI Responses API. `OPENAI_MODEL` is optional and defaults to `gpt-6-luna`.

## Product model

```text
Workspace
  └── Research Project
       ├── Queries / Keywords
       ├── Channels
       ├── Videos
       ├── Topics
       ├── Audience signals
       ├── Analytics
       └── Intelligence / Opportunities
```

## Next logical builds

1. Thumbnail feature extraction and title/thumbnail packaging analysis.
2. Transcript ingestion through a permitted/public transcript source or user-supplied transcripts.
3. Cross-channel semantic topic clustering using embeddings.
4. Saved research projects and persistent reports.
5. A combined evidence graph linking query → video → performance history → audience signal → opportunity → recommended content.
6. Real keyword-demand data from a dedicated provider.
7. Evidence-linked LLM analyst that can answer research questions against the stored corpus.
8. User accounts / multi-user quota.
9. Additional platforms beyond YouTube.

## Phase 3: Deep market intelligence

The Market workflow now has three evidence levels:
1. **Baseline market research** — deterministic YouTube performance, title, length and channel-normalized signals.
2. **Audience intelligence** — public comment evidence for repeated questions, pain points and requests.
3. **Deep intelligence** — OpenAI discovers semantic topic clusters from the actual corpus, synthesizes demand + performance + whitespace + momentum + evidence strength, and ranks strategic opportunities.

Each ranked opportunity can generate an actionable content brief with target viewer, promise, angle, title options, thumbnail concepts, episode structure, interview questions and Shorts ideas. Running is only the initial use case; the semantic taxonomy is deliberately not hard-coded to running.

## Phase 4: transcript intelligence
Market research can now ingest transcript text for individual videos and extract what the content actually covers: viewer jobs, topics, questions answered, claims and their support, frameworks, stories, advice, structure, distinctive angles, and unresolved questions. Analyse multiple transcripts to build cross-video content clusters, repeated claims/conflicts, underexplored questions, and perspective gaps. This transcript corpus is passed into Deep Market Intelligence alongside performance and comment evidence.

Transcript acquisition is deliberately provider-agnostic. The first implementation accepts pasted/imported transcript text and persists it in `data/store.json`; this avoids making brittle scraping a dependency. An automated transcript provider can later call the same storage/analysis layer without changing the intelligence model.

## Phase 6: Gemini video intelligence

The Studio now separates model responsibilities:
- YouTube Data API: market/channel/video metrics and comments
- Gemini: direct understanding of public YouTube videos (audio + visual), cached as structured evidence
- OpenAI: cross-market synthesis and strategic intelligence

Add `GEMINI_API_KEY` to `.env.local`. `GEMINI_MODEL` is optional and defaults to `gemini-3.8-flash`.
In `/studio`, build a market, then use **Analyse representative set** under Videos. Individual videos can also be analysed on demand. Cached analyses are reused across Channels, Insights and Intelligence.

Gemini's direct YouTube URL support is a preview capability and only works with public videos, so the integration is isolated behind the video-intelligence layer rather than embedded throughout the app.

## Phase 7 — stabilization + information architecture

Studio is organized as: Overview → Videos → Channels → Audience → Insights → Intelligence → Opportunities.

Video analysis uses Gemini's Interactions API with a public YouTube URL as a native video input. Batch analysis returns per-video outcomes (`analysed`, `cached`, `failed`) and preserves the actual provider error. `/api/video-intelligence/health` reports configured provider/model without exposing the API key.

Intelligence now sends a compact evidence pack rather than the full raw corpus. API failures report the failing stage (`topic_discovery` or `strategic_synthesis`) and duration.

## Phase 7 corrected — Gemini YouTube transport

Video intelligence uses the Gemini GenerateContent v1beta YouTube URL input (`file_data.file_uri`) rather than the broken Phase 7 `/v1/interactions` request. Public YouTube URL analysis is currently a Gemini preview feature. Representative analysis now applies a lightweight endurance-running relevance gate first so obvious lexical false positives (for example gaming "marathons") do not consume Gemini calls. Batch responses expose analysed/cached/failed/excluded counts and per-video provider errors.
