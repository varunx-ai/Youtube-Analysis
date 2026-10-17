export const OUTLIER_MULTIPLE = 3;

import type { Channel, Video } from "./types";

export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a,b)=>a-b);
  const m = Math.floor(s.length/2);
  return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
};

export const percentile = (xs:number[], p:number) => {
  if (!xs.length) return 0;
  const s=[...xs].sort((a,b)=>a-b);
  const i=(s.length-1)*p, lo=Math.floor(i), hi=Math.ceil(i);
  return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(i-lo);
};

export const ratio=(a:number,b:number)=>b>0?a/b:0;

export const ageDays=(publishedAt:string)=>{
  const d=(Date.now()-new Date(publishedAt).getTime())/86400000;
  return Math.max(0, Math.floor(d));
};

export const relativeToChannel=(v:Video, channelVideos:Video[])=>{
  const eligible=channelVideos.filter(x=>x.id!==v.id && x.views>=0);
  const base=median(eligible.map(x=>x.views));
  return base>0?v.views/base:null;
};

export const reach=(views:number,subs:number|null)=>{
  if(subs==null) return null;
  return views/Math.max(subs,1000);
};

export const performanceScore=(v:Video, channelVideos:Video[], subs:number|null)=>{
  const rel=relativeToChannel(v,channelVideos) ?? 0;
  const r=reach(v.views,subs) ?? 0;
  // Conservative composite: relative channel performance dominates;
  // audience reach is a secondary signal, not a replacement for baseline.
  const age=Math.max(ageDays(v.publishedAt),1);
  const velocity=v.views/age;
  const velocityNorm=velocity/(median(channelVideos.map(x=>x.views/Math.max(ageDays(x.publishedAt),1)))||1);
  return 0.55*Math.min(rel,10)+0.25*Math.min(r,10)+0.20*Math.min(velocityNorm,10);
};

export type Scored = {video:Video; multiple:number; reach:number|null; velocity:number; score:number; outlier:boolean};
export type Lift = {label:string; withN:number; withoutN:number; lift:number};
export type FormatRow = {label:string;n:number;medianViews:number;medianReach:number;medianRelative:number};

export type Analysis = {
  sampleSize:number;
  medianViews:number;
  medianToSubs:number|null;
  likeRate:number;
  commentRate:number;
  uploadsPerMonth:number;
  daysSinceLast:number|null;
  scored:Scored[];
  outliers:Scored[];
  formats:FormatRow[];
  titleLifts:Lift[];
  percentiles:{p25:number;p50:number;p75:number;p90:number};
};

export const FEATURES:{label:string;test:(t:string)=>boolean}[]=[
  {label:"Contains a number",test:t=>/\d/.test(t)},
  {label:"Asks a question",test:t=>t.includes("?")},
  {label:"How-to framing",test:t=>/\bhow\b/i.test(t)},
  {label:"Problem / mistake framing",test:t=>/\b(mistake|problem|wrong|avoid|don't|never)\b/i.test(t)},
  {label:"Outcome framing",test:t=>/\b(get|increase|improve|build|run|lose|learn|fix|reach|train)\b/i.test(t)},
  {label:"Comparison framing",test:t=>/\b(vs\.?|versus|compare|best|better|worth)\b/i.test(t)},
  {label:"First-person / experiment",test:t=>/\b(i|my|we|our|tried|tested)\b/i.test(t)},
  {label:"Long title (60+ characters)",test:t=>t.length>=60},
];

export function analyse(channel:Channel,videos:Video[]):Analysis{
  const med=median(videos.map(v=>v.views));
  const scored=videos.map(video=>{
    const multiple=relativeToChannel(video,videos) ?? 0;
    const r=reach(video.views,channel.subs);
    const velocity=video.views/Math.max(ageDays(video.publishedAt),1);
    return {video,multiple,reach:r,velocity,score:performanceScore(video,videos,channel.subs),outlier:videos.length>=10&&multiple>=3};
  });
  const rated=videos.filter(v=>v.likes!=null&&v.views>0);
  const commented=videos.filter(v=>v.comments!=null&&v.views>0);
  const times=videos.map(v=>new Date(v.publishedAt).getTime()).filter(Number.isFinite);
  const newest=times.length?Math.max(...times):null, oldest=times.length?Math.min(...times):null;
  const spanMonths=newest&&oldest?Math.max((newest-oldest)/(30.4*86400000),1):1;

  const buckets:[string,(s:number)=>boolean][]=[
    ["Shorts / ≤60s",s=>s<=60],["1–5m",s=>s>60&&s<=300],["5–10m",s=>s>300&&s<=600],
    ["10–20m",s=>s>600&&s<=1200],["20–45m",s=>s>1200&&s<=2700],["45m+",s=>s>2700]
  ];
  const formats=buckets.map(([label,f])=>{
    const vs=videos.filter(v=>f(v.durationSec));
    return {label,n:vs.length,medianViews:median(vs.map(v=>v.views)),medianReach:median(vs.map(v=>reach(v.views,channel.subs)??0)),medianRelative:median(vs.map(v=>relativeToChannel(v,videos)??0))};
  }).filter(x=>x.n);

  const titleLifts=FEATURES.flatMap(({label,test})=>{
    const w=videos.filter(v=>test(v.title)),wo=videos.filter(v=>!test(v.title));
    if(w.length<5||wo.length<5)return [];
    const base=median(wo.map(v=>relativeToChannel(v,videos)??0));
    return base>0?[{label,withN:w.length,withoutN:wo.length,lift:median(w.map(v=>relativeToChannel(v,videos)??0))/base}]:[];
  }).sort((a,b)=>b.lift-a.lift);

  return {
    sampleSize:videos.length,medianViews:med,
    medianToSubs:channel.subs?med/channel.subs:null,
    likeRate:median(rated.map(v=>v.likes!/v.views)),
    commentRate:median(commented.map(v=>v.comments!/v.views)),
    uploadsPerMonth:videos.length/spanMonths,
    daysSinceLast:newest?Math.floor((Date.now()-newest)/86400000):null,
    scored,outliers:scored.filter(x=>x.outlier).sort((a,b)=>b.multiple-a.multiple),
    formats,titleLifts,
    percentiles:{p25:percentile(videos.map(v=>v.views),.25),p50:percentile(videos.map(v=>v.views),.5),p75:percentile(videos.map(v=>v.views),.75),p90:percentile(videos.map(v=>v.views),.9)}
  };
}

export const fmt=(n:number|null|undefined)=>n==null?"Hidden":new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(n);
export const pct=(x:number)=>`${(x*100).toFixed(x<.01?2:1)}%`;
export const dur=(s:number)=>{const m=Math.floor(s/60);return m>=60?`${Math.floor(m/60)}h ${m%60}m`:`${m}:${String(s%60).padStart(2,"0")}`};
