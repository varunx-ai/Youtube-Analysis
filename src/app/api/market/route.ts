import {NextRequest,NextResponse} from 'next/server';
import {researchKeyword,enrichChannelBaselines} from '../../../lib/youtube';
import {analyseMarket} from '../../../lib/insights';
import {buildMarketPlan,classifyMarketVideos} from '../../../lib/market-discovery';
import type {ResearchOptions,ResearchVideo} from '../../../lib/types';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{
 const market=(req.nextUrl.searchParams.get('market')||req.nextUrl.searchParams.get('queries')||'').trim(); if(!market)return NextResponse.json({error:'Describe the market you want to research.'},{status:400});
 const pages=Math.min(2,Math.max(1,Number(req.nextUrl.searchParams.get('pages')||1))) as 1|2; const opts:ResearchOptions={pages,order:'relevance',withinDays:null};
 const plan=await buildMarketPlan(market); const all:ResearchVideo[]=[]; for(const q of plan.searchQueries)all.push(...await researchKeyword(q,opts));
 const discovered=[...new Map(all.map(v=>[v.id,v])).values()]; const decisions=await classifyMarketVideos(plan,discovered); const dm=new Map(decisions.map(d=>[d.videoId,d]));
 const clean=discovered.filter(v=>dm.get(v.id)?.relevant); const videos=await enrichChannelBaselines(clean);
 const excluded=discovered.filter(v=>!dm.get(v.id)?.relevant).map(v=>({videoId:v.id,title:v.title,channelTitle:v.channelTitle,...dm.get(v.id)}));
 const exclusionReasons=Object.entries(excluded.reduce((a:any,x:any)=>{const k=x.territory||'Other';a[k]=(a[k]||0)+1;return a},{})).map(([reason,count])=>({reason,count})).sort((a:any,b:any)=>b.count-a.count);
 const territories=Object.entries(videos.reduce((a:any,v)=>{const k=dm.get(v.id)?.territory||'Other';a[k]=(a[k]||0)+1;return a},{})).map(([territory,count])=>({territory,count})).sort((a:any,b:any)=>b.count-a.count);
 return NextResponse.json({plan,analysis:analyseMarket(videos,plan.searchQueries),videos,corpusHealth:{discovered:discovered.length,relevant:videos.length,excluded:excluded.length,channels:new Set(videos.map(v=>v.channelId)).size,withBaseline:videos.filter(v=>v.baselineMultiple!=null).length,territories,exclusionReasons},excluded:excluded.slice(0,100)});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Market research failed.'},{status:500})}}
