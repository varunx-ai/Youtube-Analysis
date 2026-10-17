import {NextRequest,NextResponse} from "next/server";
import {analyseVideoWithGemini,selectRepresentativeVideos,VIDEO_ANALYSIS_VERSION} from "../../../../lib/video-intelligence";
import {getVideoIntelligence,upsertVideoIntelligence} from "../../../../lib/db";
import type {ResearchVideo} from "../../../../lib/types";
import {filterMarketRelevant} from "../../../../lib/relevance";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
 try{
  const b=await req.json() as {videos?:ResearchVideo[];limit?:number;refresh?:boolean};
  if(!b.videos?.length)return NextResponse.json({error:"Build a market first."},{status:400});
  const gate=filterMarketRelevant(b.videos);
  if(!gate.relevant.length)return NextResponse.json({error:"No sufficiently relevant endurance-running videos remained after the relevance gate.",excluded:gate.excluded.slice(0,20).map(x=>({videoId:x.video.id,title:x.video.title,score:x.score,reasons:x.reasons}))},{status:422});
  const chosen=selectRepresentativeVideos(gate.relevant,3),analyses:any[]=[],outcomes:any[]=[];
  for(const v of chosen){
   const started=Date.now();
   try{const cached=getVideoIntelligence(v.id);if(cached&&!b.refresh&&cached.analysisVersion===VIDEO_ANALYSIS_VERSION){analyses.push(cached);outcomes.push({videoId:v.id,title:v.title,status:"cached",durationMs:Date.now()-started});continue}
    const a=await analyseVideoWithGemini(v);upsertVideoIntelligence(a);analyses.push(a);outcomes.push({videoId:v.id,title:v.title,status:"analysed",durationMs:Date.now()-started});
   }catch(e){const error=e instanceof Error?e.message:"Unknown Gemini failure";console.error(`[Gemini video] ${v.id} ${v.title}: ${error}`);outcomes.push({videoId:v.id,title:v.title,status:"failed",durationMs:Date.now()-started,error})}
  }
  const counts={requested:chosen.length,analysed:outcomes.filter(x=>x.status==="analysed").length,cached:outcomes.filter(x=>x.status==="cached").length,failed:outcomes.filter(x=>x.status==="failed").length};
  return NextResponse.json({counts:{...counts,eligible:gate.relevant.length,excluded:gate.excluded.length},selected:chosen.map(v=>v.id),analyses,outcomes,failures:outcomes.filter(x=>x.status==="failed"),excluded:gate.excluded.slice(0,50).map(x=>({videoId:x.video.id,title:x.video.title,score:x.score,reasons:x.reasons}))});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Representative analysis failed."},{status:500})}
}
