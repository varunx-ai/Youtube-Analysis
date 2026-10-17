
export type Channel = {
  id: string;
  title: string;
  handle: string | null;
  description: string;
  country: string | null;
  subs: number | null;
  views: number;
  videoCount: number;
  thumb: string | null;
  publishedAt: string;
};

export type VideoSnapshot = {
  videoId: string;
  capturedAt: string;
  views: number;
  likes: number | null;
  comments: number | null;
};

export type VideoComment = {
  id: string;
  videoId: string;
  author: string;
  text: string;
  likeCount: number;
  publishedAt: string;
};

export type AudienceIntelligence = {
  videosAnalysed: number;
  commentsAnalysed: number;
  recurringPainPoints: string[];
  recurringQuestions: string[];
  objections: string[];
  contentRequests: string[];
  audienceLanguage: string[];
  opportunitySignals: string[];
  evidence: { videoTitle: string; channelTitle: string; signal: string }[];
  caveats: string[];
};


export type VideoTranscript = {
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  source: "manual" | "import" | "provider";
  text: string;
  fetchedAt: string;
  wordCount: number;
};

export type TranscriptAnalysis = {
  videoId: string; videoTitle: string; channelTitle: string; analysedAt: string;
  summary: string; viewerJob: string; primaryTopics: string[]; questionsAnswered: string[];
  claims: { claim: string; support: string; confidence: "high"|"medium"|"low" }[];
  frameworks: { name: string; steps: string[] }[];
  stories: { story: string; purpose: string }[]; advice: string[]; openQuestions: string[];
  distinctiveAngles: string[]; contentStructure: string[]; evidence: { signal: string; paraphrase: string }[];
};

export type TranscriptCorpusIntelligence = {
  videosAnalysed: number;
  clusters: { name:string; description:string; videoIds:string[]; channels:string[]; repeatedIdeas:string[]; unresolvedQuestions:string[] }[];
  repeatedClaims: { claim:string; prevalence:number; videos:string[]; agreement:"agreement"|"mixed"|"conflict"; note:string }[];
  contentPatterns: { pattern:string; prevalence:number; whyItMatters:string; evidence:string[] }[];
  underexploredQuestions: { question:string; evidence:string[]; opportunity:string }[];
  perspectiveGaps: { gap:string; existingTreatment:string; missingTreatment:string; evidence:string[] }[];
  methodology: string[];
};

export type Video = {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  publishedAt: string;
  durationSec: number;
  views: number;
  likes: number | null;
  comments: number | null;
  thumb: string | null;
  tags?: string[];
  categoryId?: string;
};

export type ChannelHit = {
  channel: Channel;
  matches: number;
  sampleTitles: string[];
};

export type SearchOptions = {
  order: "relevance" | "viewCount" | "date";
  withinDays: number | null;
};

export type ResearchOptions = SearchOptions & { pages: 1 | 2 | 3 };

export type ResearchVideo = Video & {
  channelTitle: string;
  subs: number | null;
  ageDays: number;
  viewsPerDay: number;
  reach: number | null;
  channelMedianViews?: number;
  baselineMultiple?: number;
  performanceScore?: number;
};

export type Evidence = {
  label: string;
  value: string;
  detail?: string;
};

export type Opportunity = {
  title: string;
  type: "keyword" | "topic" | "audience" | "format" | "freshness" | "question" | "geographic" | "perspective";
  score: number;
  confidence: "high" | "medium" | "low";
  rationale: string;
  evidence: Evidence[];
  suggestedAngles: string[];
};

export type MarketTopic = {
  topic: string;
  videos: number;
  channels: number;
  medianViews: number;
  medianRelativePerformance: number;
  supplyShare: number;
  momentum: number;
};

export type MarketAnalysis = {
  querySet: string[];
  videoCount: number;
  channelCount: number;
  medianViews: number;
  medianRelativePerformance: number;
  topics: MarketTopic[];
  opportunities: Opportunity[];
  winners: ResearchVideo[];
  underperformers: ResearchVideo[];
  formats: { label: string; videos: number; medianViews: number; medianRelativePerformance: number }[];
  lengthBuckets: { label: string; videos: number; medianViews: number; medianRelativePerformance: number }[];
  titlePatterns: { label: string; videos: number; lift: number }[];
  keywords: { term: string; videos: number; lift: number }[];
  caveats: string[];
};

export type DiscoveredTopic = {
  name: string;
  description: string;
  audienceIntent: string;
  videoIds: string[];
  videos: number;
  channels: number;
  medianViews: number;
  medianRelativePerformance: number;
  supplyShare: number;
  momentum: number;
};

export type DemandCluster = {
  name: string;
  problem: string;
  audience: string;
  context: string;
  desiredOutcome: string;
  signalCount: number;
  evidence: string[];
};

export type StrategicOpportunity = {
  title: string;
  score: number;
  confidence: "high" | "medium" | "low";
  demandScore: number;
  performanceScore: number;
  whitespaceScore: number;
  momentumScore: number;
  evidenceStrength: number;
  audience: string;
  problem: string;
  gap: string;
  whyNow: string;
  evidence: string[];
  recommendedFormat: string;
  workingTitles: string[];
  angles: string[];
};

export type ContentBrief = {
  opportunityTitle: string;
  corePromise: string;
  targetViewer: string;
  viewerProblem: string;
  uniqueAngle: string;
  format: string;
  suggestedLength: string;
  titleOptions: string[];
  thumbnailConcepts: string[];
  outline: string[];
  interviewQuestions: string[];
  shorts: string[];
  evidence: string[];
};

export type DeepMarketIntelligence = {
  marketThesis: string;
  discoveredTopics: DiscoveredTopic[];
  demandClusters: DemandCluster[];
  opportunities: StrategicOpportunity[];
  blindSpots: string[];
  methodology: string[];
};

export type VideoIntelligence = {
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  provider: "gemini";
  model: string;
  analysisVersion: string;
  analysedAt: string;
  summary: string;
  viewerProblem: string;
  targetViewer: string;
  primaryTopics: string[];
  secondaryTopics: string[];
  claims: { claim: string; support: string; confidence: "high"|"medium"|"low" }[];
  frameworks: { name: string; description: string; steps: string[] }[];
  advice: string[];
  stories: { story: string; purpose: string }[];
  structure: { timestamp: string; section: string; purpose: string }[];
  visualTreatment: string[];
  contentMechanics: { hook: string; pacing: string; storytelling: string; callToAction: string; format: string };
  distinctiveAngles: string[];
  unresolvedQuestions: string[];
  missingPerspectives: string[];
  quality: { depth: number; specificity: number; evidence: number; originality: number; usefulness: number };
  confidence: "high"|"medium"|"low";
};

export type VideoIntelligenceCoverage = {
  totalVideos: number;
  analysedVideos: number;
  analysedPct: number;
  channelsCovered: number;
  totalChannels: number;
  representativeSetSize?: number;
};
