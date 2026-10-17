import { NextRequest, NextResponse } from "next/server";
import { analyseAudience } from "../../../lib/audience";
import { fetchVideoComments } from "../../../lib/youtube";
import type { ResearchVideo } from "../../../lib/types";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { videos?: ResearchVideo[] };
    const videos = (body.videos ?? []).slice(0, 12);
    if (!videos.length) return NextResponse.json({ error: "No videos supplied." }, { status: 400 });
    const commentsByVideo = new Map<string, Awaited<ReturnType<typeof fetchVideoComments>>>();
    const unavailable: {videoId:string;title:string;reason:string}[] = [];
    for (const v of videos) {
      try { commentsByVideo.set(v.id, await fetchVideoComments(v.id, 25)); }
      catch (e) {
        const message=e instanceof Error?e.message:"Comments unavailable";
        if (/comments disabled|disabled comments|commentsDisabled|forbidden/i.test(message)) unavailable.push({videoId:v.id,title:v.title,reason:"Comments disabled or unavailable"});
        else unavailable.push({videoId:v.id,title:v.title,reason:message});
      }
    }
    const intelligence = await analyseAudience(videos, commentsByVideo);
    intelligence.caveats.push(`${unavailable.length} of ${videos.length} selected videos had unavailable comments and were skipped.`);
    return NextResponse.json({ intelligence, unavailable });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Audience analysis failed." }, { status: 500 }); }
}
