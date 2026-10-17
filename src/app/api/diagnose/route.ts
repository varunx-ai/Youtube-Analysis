import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Open http://localhost:3000/api/diagnose to check your key and connection. Costs 1 quota unit.
export async function GET() {
  const raw = process.env.YOUTUBE_API_KEY ?? "";
  const key = raw.trim().replace(/^["']|["']$/g, "");
  const info: Record<string, unknown> = {
    nodeVersion: process.version,
    keyPresent: key.length > 0,
    keyLength: key.length,
    keyStartsWith: key.slice(0, 4),
    keyHadExtraWhitespaceOrQuotes: key !== raw,
  };
  if (!key) return NextResponse.json({ ...info, problem: "No YOUTUBE_API_KEY found. Check .env.local and restart npm run dev." });

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=UC_x5XG1OV2P6uZZ5FSM9Ttw&key=${encodeURIComponent(key)}`,
      { cache: "no-store" }
    );
    const text = await res.text();
    return NextResponse.json({ ...info, status: res.status, ok: res.ok, contentType: res.headers.get("content-type"), body: text.slice(0, 600) });
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    return NextResponse.json({ ...info, fetchFailed: err.message, cause: String(err.cause ?? "") });
  }
}
