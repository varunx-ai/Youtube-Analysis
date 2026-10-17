import { FEATURES, median, type Lift } from "./metrics";
import type { ResearchVideo } from "./types";

/** Videos younger than this haven't had time to show how they perform, so they're left out of winner/flop rankings. */
export const MIN_AGE_DAYS = 14;
/** Flops only count channels big enough that a weak result says something about the topic or angle. */
export const FLOP_MIN_SUBS = 5000;

export type Term = { term: string; n: number; lift: number };
export type FormatLift = { label: string; n: number; medianReach: number; medianViews: number };

export type KeywordAnalysis = {
  videoCount: number;
  channelCount: number;
  eligibleCount: number;
  medianViews: number;
  beatOwnAudiencePct: number; // share of eligible videos whose views exceed the channel's subscriber count
  winners: ResearchVideo[];
  flops: ResearchVideo[];
  rising: ResearchVideo[];
  titleLifts: Lift[];
  formats: FormatLift[];
  termsUp: Term[];
  termsDown: Term[];
};

const STOP = new Set(
  "the a an and or but of to in on for with from at by is are was were be been it its this that these those you your my me we our they their he she his her i do does did not no yes so if as than then just can will would should could about into over out up down all any more most some how what why when who which there here have has had get got new vs".split(" ")
);

function tokens(title: string): string[] {
  return title.toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
}

function termsOf(title: string, queryTokens: Set<string>): Set<string> {
  const t = tokens(title);
  const out = new Set<string>();
  for (const w of t) if (w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w) && !queryTokens.has(w)) out.add(w);
  for (let i = 0; i < t.length - 1; i++) {
    const [a, b] = [t[i], t[i + 1]];
    if (STOP.has(a) && STOP.has(b)) continue;
    if (queryTokens.has(a) && queryTokens.has(b)) continue;
    if (/^\d+$/.test(a) || /^\d+$/.test(b)) continue;
    out.add(`${a} ${b}`);
  }
  return out;
}

export function analyseKeyword(q: string, videos: ResearchVideo[]): KeywordAnalysis {
  const queryTokens = new Set(tokens(q));
  const eligible = videos.filter((v) => v.ageDays >= MIN_AGE_DAYS && v.reach != null);
  const reachOf = (v: ResearchVideo) => v.reach as number;

  const winners = [...eligible].sort((a, b) => reachOf(b) - reachOf(a)).slice(0, 10);
  const flops = eligible
    .filter((v) => (v.subs ?? 0) >= FLOP_MIN_SUBS)
    .sort((a, b) => reachOf(a) - reachOf(b))
    .slice(0, 10);
  const rising = videos.filter((v) => v.ageDays <= 30).sort((a, b) => b.viewsPerDay - a.viewsPerDay).slice(0, 8);

  const titleLifts: Lift[] = FEATURES.flatMap(({ label, test }) => {
    const w = eligible.filter((v) => test(v.title));
    const wo = eligible.filter((v) => !test(v.title));
    if (w.length < 4 || wo.length < 4) return [];
    const base = median(wo.map(reachOf));
    return base > 0 ? [{ label, withN: w.length, withoutN: wo.length, lift: median(w.map(reachOf)) / base }] : [];
  }).sort((a, b) => b.lift - a.lift);

  const buckets: [string, (s: number) => boolean][] = [
    ["Up to 1 minute", (s) => s <= 60],
    ["1 to 10 minutes", (s) => s > 60 && s <= 600],
    ["Over 10 minutes", (s) => s > 600],
  ];
  const formats = buckets
    .map(([label, f]) => {
      const vs = eligible.filter((v) => f(v.durationSec));
      return { label, n: vs.length, medianReach: median(vs.map(reachOf)), medianViews: median(vs.map((v) => v.views)) };
    })
    .filter((f) => f.n >= 3);

  // Which title words and word pairs travel with strong or weak results.
  const termMap = new Map<string, ResearchVideo[]>();
  for (const v of eligible) for (const t of termsOf(v.title, queryTokens)) termMap.set(t, [...(termMap.get(t) ?? []), v]);
  const terms: Term[] = [];
  for (const [term, withV] of termMap) {
    const n = withV.length;
    if (n < 4 || n > eligible.length * 0.8) continue;
    const without = eligible.length - n;
    if (without < 4) continue;
    const withSet = new Set(withV.map((v) => v.id));
    const base = median(eligible.filter((v) => !withSet.has(v.id)).map(reachOf));
    if (base > 0) terms.push({ term, n, lift: median(withV.map(reachOf)) / base });
  }
  const termsUp = terms.filter((t) => t.lift >= 1.2).sort((a, b) => b.lift - a.lift).slice(0, 12);
  const termsDown = terms.filter((t) => t.lift <= 0.8).sort((a, b) => a.lift - b.lift).slice(0, 12);

  return {
    videoCount: videos.length,
    channelCount: new Set(videos.map((v) => v.channelId)).size,
    eligibleCount: eligible.length,
    medianViews: median(videos.map((v) => v.views)),
    beatOwnAudiencePct: eligible.length ? eligible.filter((v) => (v.subs ?? 0) > 0 && v.views >= (v.subs as number)).length / eligible.length : 0,
    winners,
    flops,
    rising,
    titleLifts,
    formats,
    termsUp,
    termsDown,
  };
}

// ---------- Market intelligence layer (v2) ----------
import type { MarketAnalysis, MarketTopic, Opportunity, ResearchVideo as MarketResearchVideo } from "./types";

const MARKET_STOP = new Set(("the a an and or of to in for on with from how what why is are was were this that your you i we my our it its as at by about into than then do does did can could should would will all best new get more less very just".split(" ")));
function marketTokens(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter(x => x.length >= 3 && !MARKET_STOP.has(x));
}
function inferMarketTopics(videos: MarketResearchVideo[]): MarketTopic[] {
  const lexicon: Array<[string, RegExp]> = [
    ["training", /\b(train|training|plan|workout|tempo|interval|long run|mileage|pace)\b/i],
    ["racing", /\b(race|racing|marathon|half marathon|10k|5k|ultra|finish|race day)\b/i],
    ["shoes & gear", /\b(shoe|shoes|watch|garmin|nike|adidas|asics|hoka|gear|kit)\b/i],
    ["nutrition", /\b(nutrition|fuel|fueling|carb|protein|electrolyte|gel|diet)\b/i],
    ["injury & recovery", /\b(injury|injured|pain|recovery|physio|rehab|stretch|mobility)\b/i],
    ["beginner / consistency", /\b(beginner|first|start|started|habit|consistent|motivation|discipline)\b/i],
    ["science / performance", /\b(vo2|heart rate|hr|cadence|science|zone 2|threshold|aerobic|physiology)\b/i],
    ["stories / lifestyle", /\b(my story|journey|vlog|life|day in|transformation|experience)\b/i],
    ["coaching / advice", /\b(coach|coaching|tips|advice|mistakes|guide|how to)\b/i],
  ];
  return lexicon.map(([topic, re]) => {
    const vs = videos.filter(v => re.test(v.title) || (v.description ? re.test(v.description) : false));
    if (!vs.length) return null;
    return {
      topic, videos: vs.length, channels: new Set(vs.map(v => v.channelId)).size,
      medianViews: median(vs.map(v => v.views)),
      medianRelativePerformance: median(vs.map(v => v.baselineMultiple ?? 1)),
      supplyShare: vs.length / Math.max(videos.length, 1),
      momentum: median(vs.filter(v => v.ageDays <= 60).map(v => v.viewsPerDay)) / Math.max(median(vs.map(v => v.viewsPerDay)), 1),
    };
  }).filter(Boolean).sort((a, b) => (b!.medianRelativePerformance - a!.medianRelativePerformance)) as MarketTopic[];
}

function marketTitleTerms(videos: MarketResearchVideo[]) {
  const all = new Map<string, MarketResearchVideo[]>();
  for (const v of videos) for (const t of new Set(marketTokens(v.title))) all.set(t, [...(all.get(t) ?? []), v]);
  return [...all.entries()].flatMap(([term, vs]) => {
    const n = vs.length, other = videos.filter(v => !vs.some(x => x.id === v.id));
    if (n < 5 || other.length < 5 || n > videos.length * .75) return [];
    const a = median(vs.map(v => v.baselineMultiple ?? 1)), b = median(other.map(v => v.baselineMultiple ?? 1));
    return b > 0 ? [{ term, videos: n, lift: a / b }] : [];
  }).sort((a, b) => b.lift - a.lift);
}

function marketOpportunities(videos: MarketResearchVideo[], topics: MarketTopic[], terms: {term:string;videos:number;lift:number}[]): Opportunity[] {
  const out: Opportunity[] = [];
  for (const t of topics) {
    const gap = Math.max(0, 1 - t.supplyShare * 2);
    const performance = Math.min(t.medianRelativePerformance / 2, 1);
    const spread = Math.min(t.channels / Math.max(videos.length / 10, 1), 1);
    const score = Math.round(100 * (0.4 * performance + 0.35 * gap + 0.25 * (1 - spread)));
    if (score < 45) continue;
    out.push({
      title: `${t.topic} opportunity`, type: "topic", score,
      confidence: t.videos >= 15 ? "high" : t.videos >= 8 ? "medium" : "low",
      rationale: `This topic has ${t.videos} videos across ${t.channels} channels, represents ${(t.supplyShare * 100).toFixed(1)}% of the sample, and has ${t.medianRelativePerformance.toFixed(2)}× median relative performance.`,
      evidence: [
        { label: "Content supply", value: `${t.videos} videos`, detail: `${(t.supplyShare * 100).toFixed(1)}% of analysed videos` },
        { label: "Channel spread", value: `${t.channels} channels` },
        { label: "Relative performance", value: `${t.medianRelativePerformance.toFixed(2)}× baseline` },
      ],
      suggestedAngles: ["Beginner problem-solving angle", "India-specific implementation angle", "Deep-dive / expert conversation angle"],
    });
  }
  for (const t of terms.filter(x => x.lift >= 1.35 && x.videos >= 6).slice(0, 8)) {
    out.push({
      title: `"${t.term}" is an unusually strong title signal`, type: "keyword",
      score: Math.min(95, Math.round(50 + t.lift * 20)), confidence: t.videos >= 15 ? "high" : "medium",
      rationale: `Videos containing "${t.term}" have ${t.lift.toFixed(2)}× the median relative performance of videos without it in this sample. This is an association, not proof of causation.`,
      evidence: [{ label: "Videos", value: String(t.videos) }, { label: "Relative lift", value: `${t.lift.toFixed(2)}×` }, { label: "Method", value: "Median relative performance" }],
      suggestedAngles: [`Question built around "${t.term}"`, "Problem / mistake framing", "Comparison or case-study framing"],
    });
  }
  const recent = videos.filter(v => v.ageDays <= 60), old = videos.filter(v => v.ageDays > 60);
  if (recent.length >= 10 && old.length >= 10) {
    const rv = median(recent.map(v => v.viewsPerDay)), ov = median(old.map(v => v.viewsPerDay));
    if (rv > ov * 1.4) out.push({
      title: "Recent content is gaining momentum", type: "freshness", score: 78, confidence: "medium",
      rationale: `Median daily view velocity among videos ≤60 days old is ${(rv / Math.max(ov, 1)).toFixed(1)}× the older sample.`,
      evidence: [{ label: "Recent median velocity", value: `${Math.round(rv).toLocaleString()}/day` }, { label: "Older median velocity", value: `${Math.round(ov).toLocaleString()}/day` }],
      suggestedAngles: ["Build around emerging topics rather than evergreen-only content", "Publish while the signal is accelerating"],
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 15);
}

export function analyseMarket(videos: MarketResearchVideo[], querySet: string[]): MarketAnalysis {
  const enriched = videos.map(v => ({ ...v, baselineMultiple: v.baselineMultiple ?? 1 }));
  const topics = inferMarketTopics(enriched);
  const terms = marketTitleTerms(enriched);
  const lengthBuckets: Array<[string, (v: MarketResearchVideo) => boolean]> = [
    ["≤5m", v => v.durationSec <= 300], ["5–15m", v => v.durationSec > 300 && v.durationSec <= 900],
    ["15–30m", v => v.durationSec > 900 && v.durationSec <= 1800], ["30–60m", v => v.durationSec > 1800 && v.durationSec <= 3600], ["60m+", v => v.durationSec > 3600],
  ];
  const lengths = lengthBuckets.map(([label, f]) => { const vs = enriched.filter(f); return { label, videos: vs.length, medianViews: median(vs.map(v => v.views)), medianRelativePerformance: median(vs.map(v => v.baselineMultiple ?? 1)) }; }).filter(x => x.videos);
  const patternDefs: Array<[string, (v: MarketResearchVideo) => boolean]> = [
    ["Question", v => v.title.includes("?")], ["Numbers", v => /\d/.test(v.title)], ["How-to", v => /\bhow\b/i.test(v.title)],
    ["Mistakes / problems", v => /\b(mistake|wrong|avoid|problem)\b/i.test(v.title)], ["Comparison / best", v => /\b(vs\.?|versus|best|better|worth)\b/i.test(v.title)],
    ["First-person", v => /\b(i|my|we|tried|tested)\b/i.test(v.title)],
  ];
  const patterns = patternDefs.map(([label, f]) => { const yes = enriched.filter(f), no = enriched.filter(v => !f(v)); const base = median(no.map(v => v.baselineMultiple ?? 1)); return { label, videos: yes.length, lift: base ? median(yes.map(v => v.baselineMultiple ?? 1)) / base : 0 }; }).filter(x => x.videos >= 5 && x.lift > 0).sort((a, b) => b.lift - a.lift);
  return {
    querySet, videoCount: enriched.length, channelCount: new Set(enriched.map(v => v.channelId)).size,
    medianViews: median(enriched.map(v => v.views)), medianRelativePerformance: median(enriched.map(v => v.baselineMultiple ?? 1)),
    topics, opportunities: marketOpportunities(enriched, topics, terms),
    winners: [...enriched].sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0)).slice(0, 15),
    underperformers: [...enriched].sort((a, b) => (a.baselineMultiple ?? 1) - (b.baselineMultiple ?? 1)).slice(0, 15),
    formats: [], lengthBuckets: lengths, titlePatterns: patterns,
    keywords: terms.slice(0, 30).map(x => ({ term: x.term, videos: x.videos, lift: x.lift })),
    caveats: [
      "YouTube Data API does not expose competitor CTR, retention, impressions or subscriber conversion. Those metrics are therefore not inferred as if they were observed.",
      "Keyword opportunity is a market proxy based on retrieved YouTube results, relative performance, coverage and freshness—not proprietary YouTube search-volume data.",
      "Correlation between title/topic features and performance does not establish causation.",
      "Search results depend on YouTube's ranking and the exact query set; repeat research with multiple related queries for stronger coverage.",
    ],
  };
}
