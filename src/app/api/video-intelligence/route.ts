import {NextRequest,NextResponse} from "next/server";
import {analyseVideoWithGemini,VIDEO_ANALYSIS_VERSION} from "../../../lib/video-intelligence";
import {getVideoIntelligence,upsertVideoIntelligence} from "../../../lib/db";
import type {ResearchVideo} from "../../../lib/types";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){try{const b=await req.json() as {video?:ResearchVideo;refresh?:boolean};if(!b.video?.id)return NextResponse.json({error:"Video is required."},{status:400});const cached=getVideoIntelligence(b.video.id);if(cached&&!b.refresh&&cached.analysisVersion===VIDEO_ANALYSIS_VERSION)return NextResponse.json({analysis:cached,cached:true});const analysis=await analyseVideoWithGemini(b.video);upsertVideoIntelligence(analysis);return NextResponse.json({analysis,cached:false});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Video analysis failed."},{status:500})}}
