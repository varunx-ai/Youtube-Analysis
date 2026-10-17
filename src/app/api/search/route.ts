import { NextRequest, NextResponse } from "next/server";
import { searchChannels } from "../../../lib/youtube";
import type { SearchOptions } from "../../../lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = (p.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ error: "Enter a keyword to search." }, { status: 400 });

  const order = p.get("order");
  const days = Number(p.get("days"));
  const opts: SearchOptions = {
    order: order === "viewCount" || order === "date" ? order : "relevance",
    withinDays: days > 0 ? days : null,
  };
  try {
    return NextResponse.json({ hits: await searchChannels(q, opts) });
  } catch (e) {
    console.error("Search failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Search failed." }, { status: 500 });
  }
}
