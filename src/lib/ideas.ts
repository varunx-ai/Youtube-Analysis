import { dur } from "./metrics";
import type { KeywordAnalysis } from "./insights";
import { FLOP_MIN_SUBS, MIN_AGE_DAYS } from "./insights";
import type { ResearchVideo } from "./types";

const k = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const line = (v: ResearchVideo) =>
  `- "${v.title}" | ${v.channelTitle} (${v.subs == null ? "subs hidden" : k.format(v.subs) + " subs"}) | ${k.format(v.views)} views | reach ${v.reach == null ? "n/a" : v.reach.toFixed(2) + "x"} | ${v.ageDays}d old | ${dur(v.durationSec)}`;

export function buildIdeasPrompt(q: string, a: KeywordAnalysis): string {
  const lifts = a.titleLifts.map((l) => `- ${l.label}: ${l.lift.toFixed(2)}x median reach vs. without (${l.withN} videos with)`).join("\n") || "- not enough data";
  const formats = a.formats.map((f) => `- ${f.label}: ${f.n} videos, median reach ${f.medianReach.toFixed(2)}x, median views ${k.format(f.medianViews)}`).join("\n") || "- not enough data";
  const up = a.termsUp.map((t) => `${t.term} (${t.lift.toFixed(1)}x, ${t.n} videos)`).join(", ") || "none found";
  const down = a.termsDown.map((t) => `${t.term} (${t.lift.toFixed(1)}x, ${t.n} videos)`).join(", ") || "none found";
  return `You are helping a YouTube creator come up with new video ideas for the keyword "${q}". Below is real data on ${a.videoCount} videos from ${a.channelCount} channels that YouTube returns for this keyword.

How to read it: "reach" is a video's views divided by its channel's subscriber count (minimum 1,000). A reach above 1x means the video travelled beyond the channel's own audience, which suggests the topic or angle had pull. Videos under ${MIN_AGE_DAYS} days old are excluded from winner and flop rankings because they haven't had time to perform.

WINNERS (highest reach):
${a.winners.map(line).join("\n") || "- none"}

FLOPS (lowest reach, channels with ${k.format(FLOP_MIN_SUBS)}+ subscribers):
${a.flops.map(line).join("\n") || "- none"}

RISING (published in the last 30 days, fastest views per day):
${a.rising.map(line).join("\n") || "- none"}

TITLE PATTERNS:
${lifts}

LENGTH:
${formats}

Title words and phrases that go with higher reach: ${up}
Title words and phrases that go with lower reach: ${down}

Using only this data, write:
1. What viewers searching "${q}" seem to want, based on what won (3 to 5 specific observations, each tied to example videos above).
2. What to avoid, based on the flops.
3. Ten new video ideas. For each: a working title, the angle in one sentence, the evidence from the data it rests on, and a suggested length.
4. Two or three gaps: things the winners hint at that nobody seems to cover well.

Be specific and cite the videos you're drawing from. Where the evidence is thin, say so instead of guessing.`;
}

export async function generateIdeas(prompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("No OPENAI_API_KEY set. Add it to .env.local and restart npm run dev.");

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-6-luna",
      input: [{ role: "user", content: prompt }],
      max_output_tokens: 3000,
    }),
    cache: "no-store",
  });
  const text = await res.text();
  let body: { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } } | null = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* handled below */ }
  if (!res.ok || !body) throw new Error(`OpenAI API ${res.status}: ${body?.error?.message ?? (text.slice(0, 300) || "empty response")}`);
  if (body.output_text?.trim()) return body.output_text.trim();
  const fallback = (body.output ?? []).flatMap(item => item.content ?? []).filter(item => item.type === "output_text" && item.text).map(item => item.text).join("\n").trim();
  return fallback || "OpenAI returned an empty response.";
}


export async function generateJson<T>(prompt: string): Promise<T> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("No OPENAI_API_KEY set. Add it to .env.local and restart npm run dev.");
  const attempt = async (retry:boolean): Promise<T | null> => {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method:"POST", headers:{"content-type":"application/json",authorization:`Bearer ${key}`},
      body:JSON.stringify({model:process.env.OPENAI_MODEL ?? "gpt-6-luna",input:[{role:"user",content:(retry?"Your previous response was not valid JSON. Return one valid JSON object only.\n\n":"")+prompt}],max_output_tokens:5000,text:{format:{type:"json_object"}}}),cache:"no-store"
    });
    const raw=await res.text(); let body:any=null; try{body=raw?JSON.parse(raw):null}catch{}
    if(!res.ok||!body) throw new Error(`OpenAI API ${res.status}: ${body?.error?.message ?? raw.slice(0,300)}`);
    const out=(body.output_text?.trim() || (body.output??[]).flatMap((x:any)=>x.content??[]).filter((x:any)=>x.type==="output_text").map((x:any)=>x.text).join("\n").trim());
    if(!out) throw new Error("OpenAI returned an empty structured response.");
    try{return JSON.parse(out) as T}catch{return null}
  };
  const first=await attempt(false); if(first) return first;
  const second=await attempt(true); if(second) return second;
  throw new Error("Intelligence synthesis returned invalid structured data twice. Your market analysis is still available; retry Intelligence.");
}
