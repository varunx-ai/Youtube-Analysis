import {NextRequest,NextResponse} from "next/server";
import {discoverTopics,synthesizeMarket} from "../../../lib/deep-intelligence";
import type {AudienceIntelligence,MarketAnalysis,ResearchVideo,TranscriptCorpusIntelligence,VideoIntelligence} from "../../../lib/types";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
 let stage="request"; const started=Date.now();
 try{
  const b=await req.json() as {videos?:ResearchVideo[];analysis?:MarketAnalysis;audience?:AudienceIntelligence|null;transcript?:TranscriptCorpusIntelligence|null;videoEvidence?:VideoIntelligence[]};
  if(!b.videos?.length||!b.analysis)return NextResponse.json({error:"Run market research first.",stage},{status:400});
  stage="topic_discovery"; const topics=await discoverTopics(b.videos);
  stage="strategic_synthesis"; const intelligence=await synthesizeMarket(b.videos,b.analysis,b.audience??null,topics,b.transcript??null,b.videoEvidence??[]);
  return NextResponse.json({intelligence,diagnostics:{durationMs:Date.now()-started,topicCount:topics.length,videoEvidenceCount:b.videoEvidence?.length??0,commentsAnalysed:b.audience?.commentsAnalysed??0}});
 }catch(e){const message=e instanceof Error?e.message:"Deep intelligence failed.";console.error("[intelligence]",{stage,durationMs:Date.now()-started,message});return NextResponse.json({error:message,stage,durationMs:Date.now()-started},{status:500})}
}
