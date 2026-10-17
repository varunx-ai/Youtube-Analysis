import type { AudienceIntelligence, ResearchVideo, VideoComment } from "./types";
import { generateIdeas } from "./ideas";

const clip = (s: string, n = 500) => s.replace(/\s+/g, " ").trim().slice(0, n);

export function buildAudiencePrompt(videos: ResearchVideo[], commentsByVideo: Map<string, VideoComment[]>): string {
  const blocks = videos.map(v => {
    const comments = commentsByVideo.get(v.id) ?? [];
    if (!comments.length) return "";
    return `VIDEO: ${v.title}\nCHANNEL: ${v.channelTitle}\nPERFORMANCE: ${v.views.toLocaleString()} views; ${v.baselineMultiple?.toFixed(2) ?? "n/a"}x channel baseline\nCOMMENTS:\n${comments.slice(0, 20).map(c => `- ${clip(c.text)}`).join("\n")}`;
  }).filter(Boolean).join("\n\n---\n\n");

  return `You are a rigorous YouTube audience researcher. Analyse the viewer comments below together with the performance context.

Do not invent audience needs. Only report patterns that are supported by multiple comments or by a particularly strong repeated signal. Distinguish a request from a complaint, and distinguish a question from a generic compliment.

Return JSON with exactly these keys:
recurringPainPoints: string[]
recurringQuestions: string[]
objections: string[]
contentRequests: string[]
audienceLanguage: string[]
opportunitySignals: string[]
evidence: {videoTitle:string, channelTitle:string, signal:string}[]

Rules:
- 3–8 items per list where evidence allows; otherwise fewer.
- audienceLanguage should contain distinctive phrases/concepts viewers repeatedly use, paraphrased rather than quoting long comments.
- opportunitySignals should describe unresolved demand: something viewers ask for, struggle with, compare, or want adapted.
- evidence should name specific videos and explain the signal in one sentence.
- Never claim demographic facts unless explicitly supported.

DATA:
${blocks || "No comments were available."}`;
}

function extractJson(text: string): Partial<AudienceIntelligence> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try { return JSON.parse(match[0]) as Partial<AudienceIntelligence>; } catch { return {}; }
}

export async function analyseAudience(videos: ResearchVideo[], commentsByVideo: Map<string, VideoComment[]>): Promise<AudienceIntelligence> {
  const commentsAnalysed = [...commentsByVideo.values()].reduce((n, xs) => n + xs.length, 0);
  if (!commentsAnalysed) return {
    videosAnalysed: videos.length, commentsAnalysed: 0, recurringPainPoints: [], recurringQuestions: [], objections: [], contentRequests: [], audienceLanguage: [], opportunitySignals: [], evidence: [],
    caveats: ["No public comments were available for the selected videos."]
  };
  const raw = await generateIdeas(buildAudiencePrompt(videos, commentsByVideo));
  const j = extractJson(raw);
  return {
    videosAnalysed: videos.length,
    commentsAnalysed,
    recurringPainPoints: j.recurringPainPoints ?? [],
    recurringQuestions: j.recurringQuestions ?? [],
    objections: j.objections ?? [],
    contentRequests: j.contentRequests ?? [],
    audienceLanguage: j.audienceLanguage ?? [],
    opportunitySignals: j.opportunitySignals ?? [],
    evidence: j.evidence ?? [],
    caveats: [
      "Comments are self-selected and are not a representative sample of all viewers.",
      "Comment themes indicate expressed demand, not search volume or market size.",
      "The model is instructed to report repeated evidence rather than infer unsupported demographics or motivations."
    ],
  };
}
