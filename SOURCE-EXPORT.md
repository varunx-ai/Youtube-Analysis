# Channel Scout UI source export

This archive contains the source for the private Channel Scout demo built in this conversation.

Source commit: 9f2c8f484556bfa8ea41f7fd79ae0f63b512eb55

Private deployment: https://channel-scout.varun24pandey.chatgpt.site

## Main files

- app/workspace.tsx — interactive research UI, navigation, evidence drawers, forms and content briefs.
- app/globals.css — visual system and responsive styling.
- app/page.tsx and app/layout.tsx — page entry and root layout.
- lib/model.ts — source schema, triage, pattern extraction and ranking rules.
- lib/seed.ts — documented starter evidence.
- app/api/workspace/route.ts — durable workspace read/write API.
- app/api/metadata/route.ts — optional YouTube title lookup.
- db/schema.ts and drizzle/ — database schema and migration.
- tests/workflow.test.mjs — workflow verification.

## Reusing the UI in the existing YouTube intelligence tool

The UI is React/TypeScript with lucide-react icons and global CSS. Its data contract is defined in lib/model.ts. Adapt this contract and replace calls to /api/workspace and /api/metadata with the existing tool's APIs. Keep the existing tool's real discovery and analysis integrations. See README.md for behavior and limitations.

This export is the standalone demo's source, not a UI change committed to the user's existing GitHub repository. It has not been installed on the user's Mac.

## Runtime

The demo uses the Vinext Sites starter and a Cloudflare D1 binding named DB. Its complete hosted app is not a browser-only Vite app. The .openai/hosting.json project_id identifies the existing private deployment; remove that identifier before creating an independent Site. No credentials, runtime database contents or dependency folders are included.

Install dependencies with pnpm using the included lockfile. Local full-app setup needs a compatible Worker runtime and the D1 migration; copying the UI into the existing app avoids provisioning a second backend.
