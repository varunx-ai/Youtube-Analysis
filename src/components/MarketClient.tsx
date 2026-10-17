
"use client";
import {useState} from "react";
import type {AudienceIntelligence, ContentBrief, DeepMarketIntelligence, MarketAnalysis, ResearchVideo, StrategicOpportunity, TranscriptAnalysis, TranscriptCorpusIntelligence} from "../lib/types";

const compact=new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1});
const n=(x:number)=>compact.format(x);
const pct=(x:number)=>`${(x*100).toFixed(1)}%`;

function Score({x}:{x:number}){return <strong className={x>=75?"score high":x>=55?"score":"score low"}>{x}/100</strong>}

function Bar({label,value}:{label:string,value:number}){return <div className="signal-bar"><span>{label}</span><i><em style={{width:`${Math.max(2,Math.min(100,value))}%`}}/></i><b>{value}</b></div>}
function OpportunityCard({o,onBrief,busy}:{o:StrategicOpportunity;onBrief:()=>void;busy:boolean}){return <article className="strategic-card"><div className="opphead"><span>{o.confidence} confidence</span><Score x={o.score}/></div><h3>{o.title}</h3><p className="opportunity-problem">{o.problem}</p><div className="signal-bars"><Bar label="Demand" value={o.demandScore}/><Bar label="Performance" value={o.performanceScore}/><Bar label="Whitespace" value={o.whitespaceScore}/><Bar label="Momentum" value={o.momentumScore}/><Bar label="Evidence" value={o.evidenceStrength}/></div><div className="gap"><b>THE GAP</b><p>{o.gap}</p></div><p><b>Why now:</b> {o.whyNow}</p><div className="proof">{o.evidence.slice(0,4).map((e,i)=><span key={i}>↳ {e}</span>)}</div><div className="angles">{o.angles.map((a,i)=><span key={i}>{a}</span>)}</div><button className="brief-button" disabled={busy} onClick={onBrief}>{busy?"Generating…":"Generate content brief →"}</button></article>}
function BriefView({brief}:{brief:ContentBrief}){return <div className="brief"><p className="eyebrow">CONTENT BRIEF</p><h2>{brief.opportunityTitle}</h2><div className="brief-hero"><div><span>CORE PROMISE</span><p>{brief.corePromise}</p></div><div><span>TARGET VIEWER</span><p>{brief.targetViewer}</p></div><div><span>UNIQUE ANGLE</span><p>{brief.uniqueAngle}</p></div></div><div className="two"><div><h3>Title options</h3><ol>{brief.titleOptions.map((x,i)=><li key={i}>{x}</li>)}</ol><h3>Thumbnail concepts</h3><ol>{brief.thumbnailConcepts.map((x,i)=><li key={i}>{x}</li>)}</ol></div><div><h3>Episode structure</h3><ol>{brief.outline.map((x,i)=><li key={i}>{x}</li>)}</ol></div></div>{brief.interviewQuestions.length>0&&<div><h3>Interview questions</h3><ol className="questions">{brief.interviewQuestions.map((x,i)=><li key={i}>{x}</li>)}</ol></div>}<div><h3>Shorts / clips</h3><div className="angles">{brief.shorts.map((x,i)=><span key={i}>{x}</span>)}</div></div></div>}

export default function MarketClient(){
  const [queries,setQueries]=useState("running in India,Indian marathon training,Indian running podcast,running shoes India");
  const [pages,setPages]=useState("2");
  const [analysis,setAnalysis]=useState<MarketAnalysis|null>(null);
  const [videos,setVideos]=useState<ResearchVideo[]>([]);
  const [deep,setDeep]=useState<DeepMarketIntelligence|null>(null);
  const [deepBusy,setDeepBusy]=useState(false);
  const [deepError,setDeepError]=useState("");
  const [brief,setBrief]=useState<ContentBrief|null>(null);
  const [briefBusy,setBriefBusy]=useState(false);
  const [audience,setAudience]=useState<AudienceIntelligence|null>(null);
  const [audienceBusy,setAudienceBusy]=useState(false);
  const [audienceError,setAudienceError]=useState("");
  const [transcriptVideoId,setTranscriptVideoId]=useState("");
  const [transcriptText,setTranscriptText]=useState("");
  const [transcriptAnalyses,setTranscriptAnalyses]=useState<TranscriptAnalysis[]>([]);
  const [transcriptCorpus,setTranscriptCorpus]=useState<TranscriptCorpusIntelligence|null>(null);
  const [transcriptBusy,setTranscriptBusy]=useState(false);
  const [transcriptError,setTranscriptError]=useState("");
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function run(){
    setBusy(true);setError("");
    try{
      const r=await fetch(`/api/market?queries=${encodeURIComponent(queries)}&pages=${pages}`);
      const b=await r.json(); if(!r.ok)throw new Error(b.error||"Research failed");
      setAnalysis(b.analysis);
      setVideos(b.videos??[]);
      setDeep(null); setBrief(null);
      setAudience(null);
      setAudienceError("");
      setTranscriptAnalyses([]); setTranscriptCorpus(null); setTranscriptVideoId(""); setTranscriptText("");
    }catch(e){setError(e instanceof Error?e.message:"Research failed")}
    finally{setBusy(false)}
  }
  return <>
    <header className="hero">
      <p className="eyebrow">MARKET INTELLIGENCE</p>
      <h1>Understand a content market before you enter it.</h1>
      <p className="lede">Run several related YouTube searches together. The engine deduplicates the results, normalizes performance by creator baseline, and separates evidence from interpretation.</p>
      <div className="market-form">
        <label>Research queries</label>
        <textarea value={queries} onChange={e=>setQueries(e.target.value)} rows={3}/>
        <div className="row">
          <label>Results/query <select value={pages} onChange={e=>setPages(e.target.value)}><option value="1">50</option><option value="2">100</option><option value="3">150</option></select></label>
          <button onClick={run} disabled={busy}>{busy?"Analysing…":"Analyse market"}</button>
        </div>
      </div>
    </header>
    {error&&<p className="error">{error}</p>}
    {analysis&&<>
      <section>
        <div className="stats">
          <div><dt>Videos analysed</dt><dd>{n(analysis.videoCount)}</dd></div>
          <div><dt>Channels</dt><dd>{n(analysis.channelCount)}</dd></div>
          <div><dt>Median views</dt><dd>{n(Math.round(analysis.medianViews))}</dd></div>
          <div><dt>Median relative performance</dt><dd>{analysis.medianRelativePerformance.toFixed(2)}×</dd></div>
        </div>
      </section>

      <section>
        <h2>Audience intelligence</h2>
        <p className="lede">Go beyond views. Pull the most relevant public comments from the strongest videos and identify repeated pain points, questions, objections and requests.</p>
        <div className="actions">
          <button className="primary" disabled={audienceBusy} onClick={async()=>{
            setAudienceBusy(true); setAudienceError("");
            try {
              const r=await fetch("/api/audience",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({videos:analysis.winners.slice(0,12)})});
              const b=await r.json(); if(!r.ok) throw new Error(b.error||"Audience analysis failed");
              setAudience(b.intelligence);
            } catch(e) { setAudienceError(e instanceof Error?e.message:"Audience analysis failed"); }
            finally { setAudienceBusy(false); }
          }}>{audienceBusy?"Reading comments…":"Analyse audience comments"}</button>
          <span className="muted-note">Uses up to 12 videos × 25 comments. Cached for 7 days.</span>
        </div>
        {audienceError&&<p className="error">{audienceError}</p>}
        {audience&&<>
          <div className="stats" style={{marginTop:18}}>
            <div><dt>Videos analysed</dt><dd>{audience.videosAnalysed}</dd></div>
            <div><dt>Comments analysed</dt><dd>{audience.commentsAnalysed}</dd></div>
            <div><dt>Unresolved demand signals</dt><dd>{audience.opportunitySignals.length}</dd></div>
            <div><dt>Content requests</dt><dd>{audience.contentRequests.length}</dd></div>
          </div>
          <div className="two audience-grid">
            <div><h3>Recurring pain points</h3><ul className="signal-list">{audience.recurringPainPoints.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
            <div><h3>Recurring questions</h3><ul className="signal-list">{audience.recurringQuestions.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
            <div><h3>What viewers ask creators to make</h3><ul className="signal-list">{audience.contentRequests.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
            <div><h3>Opportunity signals</h3><ul className="signal-list">{audience.opportunitySignals.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
          </div>
          {audience.evidence.length>0&&<div className="scroll"><table><thead><tr><th>Video</th><th>Channel</th><th>Audience signal</th></tr></thead><tbody>{audience.evidence.map((x,i)=><tr key={i}><td>{x.videoTitle}</td><td>{x.channelTitle}</td><td>{x.signal}</td></tr>)}</tbody></table></div>}
          <p className="lede" style={{marginTop:12}}>{audience.caveats.join(" ")}</p>
        </>}
      </section>

      <section className="transcript-section">
        <p className="eyebrow">CONTENT EVIDENCE · TRANSCRIPTS</p>
        <h2>Understand what creators actually say</h2>
        <p className="lede">Titles tell us packaging. Comments tell us expressed audience demand. Transcripts tell us the actual supply: arguments, advice, frameworks, stories, questions answered and questions left unresolved.</p>
        <div className="transcript-workbench">
          <label>Video to analyse<select value={transcriptVideoId} onChange={e=>setTranscriptVideoId(e.target.value)}><option value="">Select a market video…</option>{videos.slice().sort((a,b)=>(b.performanceScore??0)-(a.performanceScore??0)).slice(0,40).map(v=><option value={v.id} key={v.id}>{v.title} — {v.channelTitle}</option>)}</select></label>
          <label>Transcript<textarea rows={9} placeholder="Paste the video's transcript here. Timestamps are fine." value={transcriptText} onChange={e=>setTranscriptText(e.target.value)}/></label>
          <div className="actions"><button className="primary" disabled={transcriptBusy||!transcriptVideoId||transcriptText.trim().length<80} onClick={async()=>{const video=videos.find(v=>v.id===transcriptVideoId);if(!video)return;setTranscriptBusy(true);setTranscriptError("");try{const r=await fetch("/api/transcript",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({video,text:transcriptText})});const b=await r.json();if(!r.ok)throw new Error(b.error||"Transcript analysis failed");setTranscriptAnalyses(xs=>[...xs.filter(x=>x.videoId!==b.analysis.videoId),b.analysis]);setTranscriptText("");setTranscriptCorpus(null)}catch(e){setTranscriptError(e instanceof Error?e.message:"Transcript analysis failed")}finally{setTranscriptBusy(false)}}}>{transcriptBusy?"Reading transcript…":"Analyse transcript"}</button><span className="muted-note">Stored locally in data/store.json. Analyse several representative winners, average performers and misses—not winners alone.</span></div>
        </div>
        {transcriptError&&<p className="error">{transcriptError}</p>}
        {transcriptAnalyses.length>0&&<>
          <div className="stats" style={{marginTop:18}}><div><dt>Transcripts analysed</dt><dd>{transcriptAnalyses.length}</dd></div><div><dt>Questions answered</dt><dd>{transcriptAnalyses.reduce((a,x)=>a+x.questionsAnswered.length,0)}</dd></div><div><dt>Claims extracted</dt><dd>{transcriptAnalyses.reduce((a,x)=>a+x.claims.length,0)}</dd></div><div><dt>Open questions</dt><dd>{transcriptAnalyses.reduce((a,x)=>a+x.openQuestions.length,0)}</dd></div></div>
          <div className="transcript-cards">{transcriptAnalyses.map(a=><article key={a.videoId}><p className="eyebrow">{a.channelTitle}</p><h3>{a.videoTitle}</h3><p>{a.summary}</p><div className="gap"><b>VIEWER JOB</b><p>{a.viewerJob}</p></div><b>Actually covers</b><div className="angles">{a.primaryTopics.map((x,i)=><span key={i}>{x}</span>)}</div>{a.openQuestions.length>0&&<><b>Leaves unresolved</b><ul className="signal-list">{a.openQuestions.slice(0,5).map((x,i)=><li key={i}>{x}</li>)}</ul></>}</article>)}</div>
          <div className="actions"><button disabled={transcriptBusy||transcriptAnalyses.length<2} onClick={async()=>{setTranscriptBusy(true);setTranscriptError("");try{const r=await fetch("/api/transcript-corpus",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({analyses:transcriptAnalyses})});const b=await r.json();if(!r.ok)throw new Error(b.error||"Cross-video analysis failed");setTranscriptCorpus(b.intelligence)}catch(e){setTranscriptError(e instanceof Error?e.message:"Cross-video analysis failed")}finally{setTranscriptBusy(false)}}}>Compare transcripts across market →</button><span className="muted-note">Use 5–15 diverse videos for a much stronger market read.</span></div>
        </>}
        {transcriptCorpus&&<div className="corpus-intel"><h3 className="section-kicker">What the market actually talks about</h3><div className="topic-cards">{transcriptCorpus.clusters.map((c,i)=><article key={i}><b>{c.name}</b><p>{c.description}</p><small>{c.videoIds.length} videos · {c.channels.length} creators</small>{c.unresolvedQuestions.slice(0,3).map((q,j)=><p key={j}>↳ {q}</p>)}</article>)}</div><h3 className="section-kicker">Underexplored questions</h3><div className="demand-grid">{transcriptCorpus.underexploredQuestions.map((q,i)=><article key={i}><b>{q.question}</b><p>{q.opportunity}</p>{q.evidence.slice(0,3).map((e,j)=><small key={j}>↳ {e}</small>)}</article>)}</div><h3 className="section-kicker">Perspective gaps</h3><div className="demand-grid">{transcriptCorpus.perspectiveGaps.map((g,i)=><article key={i}><b>{g.gap}</b><p><strong>Existing:</strong> {g.existingTreatment}</p><p><strong>Missing:</strong> {g.missingTreatment}</p></article>)}</div></div>}
      </section>

      <section className="deep-section">
        <p className="eyebrow">PHASE 3 · STRATEGY ENGINE</p>
        <h2>Deep market intelligence</h2>
        <p className="lede">Discover the market taxonomy from the corpus itself, combine it with audience demand, and rank whitespace using multiple independent signals.</p>
        <div className="actions"><button className="primary" disabled={deepBusy} onClick={async()=>{setDeepBusy(true);setDeepError("");setBrief(null);try{const r=await fetch("/api/intelligence",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({videos,analysis,audience,transcript:transcriptCorpus})});const b=await r.json();if(!r.ok)throw new Error(b.error||"Intelligence failed");setDeep(b.intelligence)}catch(e){setDeepError(e instanceof Error?e.message:"Intelligence failed")}finally{setDeepBusy(false)}}}>{deepBusy?"Building market map…":"Build deep intelligence"}</button><span className="muted-note">Best after audience analysis, but can run from performance evidence alone.</span></div>
        {deepError&&<p className="error">{deepError}</p>}
        {deep&&<>
          <div className="thesis"><span>MARKET THESIS</span><p>{deep.marketThesis}</p></div>
          <h3 className="section-kicker">Discovered topic map</h3>
          <div className="topic-cards">{deep.discoveredTopics.map(t=><article key={t.name}><div className="topic-top"><b>{t.name}</b><span>{t.medianRelativePerformance.toFixed(2)}×</span></div><p>{t.description}</p><small>{t.audienceIntent}</small><div className="topic-meta"><span>{t.videos} videos</span><span>{t.channels} channels</span><span>{(t.supplyShare*100).toFixed(1)}% supply</span><span>{t.momentum.toFixed(1)}× momentum</span></div></article>)}</div>
          {deep.demandClusters.length>0&&<><h3 className="section-kicker">Audience demand clusters</h3><div className="demand-grid">{deep.demandClusters.map((d,i)=><article key={i}><div className="demand-head"><b>{d.name}</b><span>{d.signalCount} signals</span></div><p>{d.problem}</p><dl><dt>Audience</dt><dd>{d.audience}</dd><dt>Context</dt><dd>{d.context}</dd><dt>Desired outcome</dt><dd>{d.desiredOutcome}</dd></dl>{d.evidence.slice(0,3).map((e,j)=><small key={j}>↳ {e}</small>)}</article>)}</div></>}
          <h3 className="section-kicker">Ranked opportunities</h3>
          <div className="strategic-opps">{deep.opportunities.map((o,i)=><OpportunityCard key={i} o={o} busy={briefBusy} onBrief={async()=>{setBriefBusy(true);setBrief(null);try{const r=await fetch("/api/brief",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({opportunity:o,intelligence:deep})});const b=await r.json();if(!r.ok)throw new Error(b.error||"Brief failed");setBrief(b.brief)}catch(e){setDeepError(e instanceof Error?e.message:"Brief failed")}finally{setBriefBusy(false)}}}/>)}</div>
          {brief&&<BriefView brief={brief}/>}
          <div className="method"><b>Blind spots</b>{deep.blindSpots.map((x,i)=><p key={i}>• {x}</p>)}</div>
        </>}
      </section>

      <section>
        <h2>Baseline market signals</h2>
        <p className="lede">These are opportunities generated from the observed dataset—not generic LLM ideas.</p>
        <div className="opps">
          {analysis.opportunities.map((o,i)=><article className="opp" key={i}>
            <div className="opphead"><span>{o.type}</span><Score x={o.score}/></div>
            <h3>{o.title}</h3>
            <p>{o.rationale}</p>
            <div className="evidence">{o.evidence.map((e,j)=><div key={j}><b>{e.label}</b><span>{e.value}</span>{e.detail&&<small>{e.detail}</small>}</div>)}</div>
            <div className="angles">{o.suggestedAngles.map((a,j)=><span key={j}>{a}</span>)}</div>
          </article>)}
        </div>
      </section>

      <section>
        <h2>Topic landscape</h2>
        <div className="scroll"><table><thead><tr><th>Topic</th><th className="r">Videos</th><th className="r">Channels</th><th className="r">Supply</th><th className="r">Relative performance</th><th className="r">Momentum</th></tr></thead>
        <tbody>{analysis.topics.map(t=><tr key={t.topic}><td>{t.topic}</td><td className="r">{t.videos}</td><td className="r">{t.channels}</td><td className="r">{pct(t.supplyShare)}</td><td className="r">{t.medianRelativePerformance.toFixed(2)}×</td><td className="r">{t.momentum.toFixed(2)}×</td></tr>)}</tbody></table></div>
      </section>

      <section className="two">
        <div><h2>Title signals</h2><table><thead><tr><th>Pattern</th><th className="r">Videos</th><th className="r">Lift</th></tr></thead><tbody>{analysis.titlePatterns.map(x=><tr key={x.label}><td>{x.label}</td><td className="r">{x.videos}</td><td className="r">{x.lift.toFixed(2)}×</td></tr>)}</tbody></table></div>
        <div><h2>Keyword signals</h2><table><thead><tr><th>Term</th><th className="r">Videos</th><th className="r">Lift</th></tr></thead><tbody>{analysis.keywords.slice(0,15).map(x=><tr key={x.term}><td>{x.term}</td><td className="r">{x.videos}</td><td className="r">{x.lift.toFixed(2)}×</td></tr>)}</tbody></table></div>
      </section>

      <section>
        <h2>What worked</h2>
        <div className="scroll"><table><thead><tr><th>Video</th><th>Channel</th><th className="r">Views</th><th className="r">Baseline</th><th className="r">Reach</th><th className="r">Age</th></tr></thead>
        <tbody>{analysis.winners.map(v=><tr key={v.id}><td><a href={`https://youtube.com/watch?v=${v.id}`} target="_blank">{v.title}</a></td><td>{v.channelTitle}</td><td className="r">{n(v.views)}</td><td className="r">{v.baselineMultiple?v.baselineMultiple.toFixed(1)+"×":"—"}</td><td className="r">{v.reach?v.reach.toFixed(2)+"×":"—"}</td><td className="r">{v.ageDays}d</td></tr>)}</tbody></table></div>
      </section>

      <section>
        <h2>What underperformed</h2>
        <div className="scroll"><table><thead><tr><th>Video</th><th>Channel</th><th className="r">Views</th><th className="r">Baseline</th><th className="r">Age</th></tr></thead>
        <tbody>{analysis.underperformers.map(v=><tr key={v.id}><td><a href={`https://youtube.com/watch?v=${v.id}`} target="_blank">{v.title}</a></td><td>{v.channelTitle}</td><td className="r">{n(v.views)}</td><td className="r">{v.baselineMultiple?v.baselineMultiple.toFixed(2)+"×":"—"}</td><td className="r">{v.ageDays}d</td></tr>)}</tbody></table></div>
      </section>

      <section className="caveats"><h2>Methodology & limitations</h2><ul>{analysis.caveats.map(x=><li key={x}>{x}</li>)}</ul></section>
    </>}
  </>
}
