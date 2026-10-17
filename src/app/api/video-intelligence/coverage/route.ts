import {NextRequest,NextResponse} from "next/server";
import {getVideoIntelligenceMany} from "../../../../lib/db";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){const b=await req.json() as {videoIds?:string[]};const ids=b.videoIds||[];return NextResponse.json({analyses:getVideoIntelligenceMany(ids)});}
