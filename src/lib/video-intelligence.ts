import type { ResearchVideo, VideoIntelligence } from "./types";

export const VIDEO_ANALYSIS_VERSION="gemini-youtube-generatecontent-v3";
const clamp=(n:unknown)=>Math.max(0,Math.min(100,Number(n)||0));

function parseJson(text:string){
  const clean=text.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
  try{return JSON.parse(clean)}catch{}
  const a=clean.indexOf("{"),b=clean.lastIndexOf("}");
  if(a>=0&&b>a)return JSON.parse(clean.slice(a,b+1));
  throw new Error(`Gemini returned non-JSON output: ${clean.slice(0,240)}`);
}
function outputText(body:any):string{
  if(typeof body?.output_text==="string")return body.output_text;
  if(typeof body?.outputText==="string")return body.outputText;
  const outputs=body?.outputs??body?.output??[];
  if(Array.isArray(outputs)){const t=outputs.map((x:any)=>x?.text??x?.content?.text??"").filter(Boolean).join("\n");if(t)return t;}
  const parts=body?.candidates?.flatMap((c:any)=>c?.content?.parts??[])??[];
  return parts.map((p:any)=>p?.text).filter(Boolean).join("\n");
}
function message(body:any){return body?.error?.message||body?.message||body?.detail||"video analysis failed"}

export function geminiConfig(){return {configured:Boolean(process.env.GEMINI_API_KEY),model:process.env.GEMINI_MODEL||"gemini-3.8-flash",api:"GenerateContent YouTube URL",analysisVersion:VIDEO_ANALYSIS_VERSION}}

export async function analyseVideoWithGemini(v:ResearchVideo):Promise<VideoIntelligence>{
  const key=process.env.GEMINI_API_KEY;
  if(!key)throw new Error("Gemini configuration: GEMINI_API_KEY is missing.");
  const model=process.env.GEMINI_MODEL||"gemini-3.8-flash";
  const prompt=`You are the video-evidence analyst for a content intelligence product. Watch the supplied public YouTube video using BOTH audio and visual evidence. Do not infer private analytics, demographics, retention, CTR, search volume, or facts not present in the video/metadata. Be specific and concise. Timestamps must be grounded in the video.\n\nVIDEO METADATA: ${JSON.stringify({title:v.title,channel:v.channelTitle,views:v.views,publishedAt:v.publishedAt,durationSec:v.durationSec,description:(v.description||"").slice(0,1200)})}\n\nReturn one JSON object only with: {"summary":"","viewerProblem":"","targetViewer":"","primaryTopics":[],"secondaryTopics":[],"claims":[{"claim":"","support":"","confidence":"high|medium|low"}],"frameworks":[{"name":"","description":"","steps":[]}],"advice":[],"stories":[{"story":"","purpose":""}],"structure":[{"timestamp":"MM:SS or HH:MM:SS","section":"","purpose":""}],"visualTreatment":[],"contentMechanics":{"hook":"","pacing":"","storytelling":"","callToAction":"","format":""},"distinctiveAngles":[],"unresolvedQuestions":[],"missingPerspectives":[],"quality":{"depth":0,"specificity":0,"evidence":0,"originality":0,"usefulness":0},"confidence":"high|medium|low"}. Quality scores are 0-100 and describe this video's treatment, not market demand.`;
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),120000);
  let res:Response; let body:any;
  try{
    res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",signal:controller.signal,headers:{"x-goog-api-key":key,"content-type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt},{file_data:{file_uri:`https://www.youtube.com/watch?v=${v.id}`}}]}],generationConfig:{responseMimeType:"application/json",temperature:0.2}})});
    body=await res.json().catch(async()=>({raw:await res.text().catch(()=>"")}));
  }catch(e){if(e instanceof Error&&e.name==="AbortError")throw new Error("Gemini timeout: video analysis exceeded 120 seconds.");throw e}finally{clearTimeout(timer)}
  if(!res.ok)throw new Error(`Gemini HTTP ${res.status}: ${message(body)}`);
  const text=outputText(body); if(!text)throw new Error(`Gemini returned no text output. Response keys: ${Object.keys(body||{}).join(", ")}`);
  const p=parseJson(text);
  return {videoId:v.id,videoTitle:v.title,channelTitle:v.channelTitle,provider:"gemini",model,analysisVersion:VIDEO_ANALYSIS_VERSION,analysedAt:new Date().toISOString(),summary:String(p.summary||""),viewerProblem:String(p.viewerProblem||""),targetViewer:String(p.targetViewer||""),primaryTopics:Array.isArray(p.primaryTopics)?p.primaryTopics:[],secondaryTopics:Array.isArray(p.secondaryTopics)?p.secondaryTopics:[],claims:Array.isArray(p.claims)?p.claims:[],frameworks:Array.isArray(p.frameworks)?p.frameworks:[],advice:Array.isArray(p.advice)?p.advice:[],stories:Array.isArray(p.stories)?p.stories:[],structure:Array.isArray(p.structure)?p.structure:[],visualTreatment:Array.isArray(p.visualTreatment)?p.visualTreatment:[],contentMechanics:p.contentMechanics||{hook:"",pacing:"",storytelling:"",callToAction:"",format:""},distinctiveAngles:Array.isArray(p.distinctiveAngles)?p.distinctiveAngles:[],unresolvedQuestions:Array.isArray(p.unresolvedQuestions)?p.unresolvedQuestions:[],missingPerspectives:Array.isArray(p.missingPerspectives)?p.missingPerspectives:[],quality:{depth:clamp(p.quality?.depth),specificity:clamp(p.quality?.specificity),evidence:clamp(p.quality?.evidence),originality:clamp(p.quality?.originality),usefulness:clamp(p.quality?.usefulness)},confidence:["high","medium","low"].includes(p.confidence)?p.confidence:"medium"};
}

export function selectRepresentativeVideos(videos:ResearchVideo[],_limit=3):ResearchVideo[]{
 const eligible=videos.filter(v=>v.baselineMultiple!=null);
 const pool=eligible.length>=3?eligible:videos;
 if(!pool.length)return [];
 const winner=[...pool].sort((a,b)=>(b.baselineMultiple??0)-(a.baselineMultiple??0))[0];
 const remaining=pool.filter(v=>v.id!==winner.id);
 const typical=[...remaining].sort((a,b)=>Math.abs((a.baselineMultiple??1)-1)-Math.abs((b.baselineMultiple??1)-1))[0];
 const usedChannels=new Set([winner?.channelId,typical?.channelId]);
 const emerging=[...remaining.filter(v=>v.id!==typical?.id)].sort((a,b)=>{const ad=usedChannels.has(a.channelId)?0:1,bd=usedChannels.has(b.channelId)?0:1;return bd-ad||b.viewsPerDay-a.viewsPerDay})[0];
 return [winner,typical,emerging].filter(Boolean) as ResearchVideo[];
}
