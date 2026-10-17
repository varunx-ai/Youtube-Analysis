import {generateJson} from './ideas';
import type {ResearchVideo} from './types';

export type MarketPlan={market:string;geography:string;audience:string;include:string[];exclude:string[];searchQueries:string[]};
export type ClassifiedVideo={videoId:string;relevant:boolean;confidence:'high'|'medium'|'low';reason:string;territory:string};

export async function buildMarketPlan(market:string):Promise<MarketPlan>{
 const p=await generateJson<MarketPlan>(`You are planning YouTube market research. Turn the user's market definition into a precise retrieval plan. Do not broaden ambiguous words literally. Return JSON only: {"market":"...","geography":"...","audience":"...","include":["..."],"exclude":["..."],"searchQueries":["..."]}. Create 8-12 diverse YouTube search queries. The queries should collectively cover the market, not be synonyms. For an India endurance market, distinguish recreational/endurance running from sprint/relay athletics, cricket uses of "runs", army recruitment tests, generic motivation, and unrelated foreign content.\nUSER MARKET: ${market}`);
 return {...p,searchQueries:(p.searchQueries||[]).filter(Boolean).slice(0,12)};
}

export async function classifyMarketVideos(plan:MarketPlan,videos:ResearchVideo[]):Promise<ClassifiedVideo[]>{
 const out:ClassifiedVideo[]=[];
 for(let i=0;i<videos.length;i+=60){
  const batch=videos.slice(i,i+60).map(v=>({id:v.id,title:v.title,channel:v.channelTitle,durationSec:v.durationSec,description:(v.description||'').slice(0,220)}));
  const r=await generateJson<{decisions:ClassifiedVideo[]}>(`Classify YouTube results for a market corpus. Be strict: relevance means this video is genuinely useful evidence about the defined content market, not merely that a keyword appears. Geography/audience constraints matter. Return every id exactly once as JSON {"decisions":[{"videoId":"...","relevant":true,"confidence":"high|medium|low","reason":"short reason","territory":"short market territory or exclusion category"}]}.\nMARKET PLAN:${JSON.stringify(plan)}\nVIDEOS:${JSON.stringify(batch)}`);
  out.push(...(r.decisions||[]));
 }
 return out;
}
