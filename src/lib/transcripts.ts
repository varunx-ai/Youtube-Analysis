import { generateIdeas } from "./ideas";
import { getTranscript, upsertTranscript } from "./db";
import type { ResearchVideo, TranscriptAnalysis, VideoTranscript } from "./types";

function parseJson<T>(raw:string):T {
  const cleaned=raw.trim().replace(/^```(?:json)?/i,"").replace(/```$/,"").trim();
  const a=cleaned.indexOf("{"); const b=cleaned.lastIndexOf("}");
  if(a<0||b<a) throw new Error("Transcript intelligence returned invalid JSON.");
  return JSON.parse(cleaned.slice(a,b+1)) as T;
}

export function saveTranscript(video:ResearchVideo,text:string,source:VideoTranscript["source"]="manual"):VideoTranscript {
  const clean=text.replace(/\r/g,"").replace(/\n{3,}/g,"\n\n").trim();
  if(clean.length<80) throw new Error("Transcript is too short to analyse.");
  const t:VideoTranscript={videoId:video.id,videoTitle:video.title,channelTitle:video.channelTitle,source,text:clean,fetchedAt:new Date().toISOString(),wordCount:clean.split(/\s+/).length};
  upsertTranscript(t); return t;
}
export function transcriptFor(videoId:string){return getTranscript(videoId)}

export async function analyseTranscript(video:ResearchVideo, transcript:VideoTranscript):Promise<TranscriptAnalysis>{
  const max=60000; const text=transcript.text.slice(0,max);
  const raw=await generateIdeas(`You are analysing what a YouTube video ACTUALLY says, not its metadata. Extract useful content-market evidence. Stay grounded in the supplied transcript; do not infer demographics, search volume, CTR, retention, or facts that are not stated. Paraphrase rather than quoting long passages.\n\nReturn JSON only with exactly this structure:\n{"summary":"...","viewerJob":"...","primaryTopics":["..."],"questionsAnswered":["..."],"claims":[{"claim":"...","support":"what reasoning/evidence the speaker gives","confidence":"high|medium|low"}],"frameworks":[{"name":"...","steps":["..."]}],"stories":[{"story":"...","purpose":"why it is used"}],"advice":["..."],"openQuestions":["questions/problems raised but not fully resolved"],"distinctiveAngles":["what is genuinely distinctive about the treatment"],"contentStructure":["ordered sections/beats"],"evidence":[{"signal":"...","paraphrase":"..."}]}. Keep arrays selective and evidence-rich.\n\nVIDEO: ${video.title}\nCHANNEL: ${video.channelTitle}\nTRANSCRIPT (${transcript.wordCount} words; ${text.length<transcript.text.length?"truncated for analysis":"complete"}):\n${text}`);
  const j=parseJson<Omit<TranscriptAnalysis,"videoId"|"videoTitle"|"channelTitle"|"analysedAt">>(raw);
  return {videoId:video.id,videoTitle:video.title,channelTitle:video.channelTitle,analysedAt:new Date().toISOString(),...j};
}
