import {NextRequest,NextResponse} from "next/server";
import {buildContentBrief} from "../../../lib/deep-intelligence";
import type {DeepMarketIntelligence,StrategicOpportunity} from "../../../lib/types";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){try{const b=await req.json() as {opportunity?:StrategicOpportunity;intelligence?:DeepMarketIntelligence};if(!b.opportunity||!b.intelligence)return NextResponse.json({error:"Choose an opportunity first."},{status:400});return NextResponse.json({brief:await buildContentBrief(b.opportunity,b.intelligence)});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Brief generation failed."},{status:500})}}
