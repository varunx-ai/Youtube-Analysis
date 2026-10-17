import { NextRequest, NextResponse } from "next/server";
import { buildIdeasPrompt, generateIdeas } from "../../../lib/ideas";
import { analyseKeyword } from "../../../lib/insights";
import { parseOptions } from "../../../lib/options";
import { researchKeyword } from "../../../lib/youtube";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const q = (body.q ?? "").trim();
  if (!q) return NextResponse.json({ error: "Missing keyword." }, { status: 400 });
  try {
    // Same keyword and options as the research run, so this reads the cache and costs no YouTube quota.
    const videos = await researchKeyword(q, parseOptions({ get: (k) => body[k] ?? null }));
    const prompt = buildIdeasPrompt(q, analyseKeyword(q, videos));
    if (body.mode === "prompt") return NextResponse.json({ prompt });
    return NextResponse.json({ ideas: await generateIdeas(prompt) });
  } catch (e) {
    console.error("Ideas failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not generate ideas." }, { status: 500 });
  }
}
