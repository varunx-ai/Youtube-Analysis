import { NextRequest, NextResponse } from "next/server";
import { analyseKeyword } from "../../../lib/insights";
import { researchKeyword } from "../../../lib/youtube";
import { parseOptions } from "../../../lib/options";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = (p.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ error: "Enter a keyword to research." }, { status: 400 });
  try {
    const videos = await researchKeyword(q, parseOptions(p));
    return NextResponse.json({ videos, analysis: analyseKeyword(q, videos) });
  } catch (e) {
    console.error("Research failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Research failed." }, { status: 500 });
  }
}
