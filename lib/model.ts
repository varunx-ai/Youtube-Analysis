import { z } from 'zod';
export const topics = ['Fuel & hydration','Training & recovery','Race craft','First triathlon','Strength & hybrid','Community & access'] as const;
export type Topic = typeof topics[number];
export const sourceSchema = z.object({
  id:z.string().min(1).max(100), title:z.string().min(1).max(300), channel:z.string().min(1).max(150),
  url:z.string().url().max(2000).refine(s=>/^https?:/.test(s)), sourceUrl:z.string().url().max(2000).refine(s=>/^https?:/.test(s)),
  kind:z.enum(['video','podcast','article','audience']), published:z.string().max(30), captured:z.string().max(30),
  topic:z.enum(topics), region:z.enum(['India','Global','Unclear']), format:z.enum(['Long form','Short','Article','Comment']),
  views:z.number().int().nonnegative().nullable(), baseline:z.number().nonnegative().nullable(), baselineN:z.number().int().nonnegative(),
  duration:z.number().nonnegative().nullable(), notes:z.string().max(50000), transcript:z.string().max(150000),
  decision:z.enum(['auto','analyse','hold','exclude']), decisionReason:z.string().max(1000), analysed:z.boolean(),
});
export type Source = z.infer<typeof sourceSchema>;
export const workspaceSchema = z.object({
  name:z.string().min(1).max(150), audience:z.string().min(1).max(500), queries:z.array(z.string().min(1).max(200)).max(30),
  sources:z.array(sourceSchema).max(500), saved:z.array(z.string().max(100)).max(100),
  weights:z.object({evidence:z.number().min(0).max(100),gap:z.number().min(0).max(100),fit:z.number().min(0).max(100)}),
});
export type Workspace=z.infer<typeof workspaceSchema>;
export function safeURL(input:string){try {const u=new URL(input);if(!['http:','https:'].includes(u.protocol))return '';return u.href}catch{return ''}}
export function canonicalURL(input:string){
  const url=safeURL(input);if(!url)return '';const u=new URL(url);
  if(['youtu.be','www.youtu.be'].includes(u.hostname)) return 'https://www.youtube.com/watch?v='+u.pathname.split('/')[1];
  if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(u.hostname)){
    const id=u.searchParams.get('v')||u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1];
    if(id)return 'https://www.youtube.com/watch?v='+id;
  }
  u.hash='';for(const key of [...u.searchParams.keys()])if(key.startsWith('utm_'))u.searchParams.delete(key);
  return u.href.replace(/\/$/,'');
}
export function mergeSources(existing:Source[],incoming:Source[]){
  const seen=new Set(existing.map(s=>canonicalURL(s.url)));let duplicates=0;
  const added=incoming.filter(s=>{const k=canonicalURL(s.url);if(seen.has(k)){duplicates++;return false}seen.add(k);return true});
  return {sources:[...existing,...added],added:added.length,duplicates};
}
export function relative(s:Source){return s.views!==null&&s.baseline!==null&&s.baseline>0&&s.baselineN>=5?s.views/s.baseline:null}
export function triage(s:Source){
  if(s.decision!=='auto')return {status:s.decision,reason:s.decisionReason||'Manual researcher decision',manual:true};
  if(/\b(gaming|minecraft|movie marathon|study marathon|coding marathon)\b/i.test(s.title))return {status:'exclude',reason:'Keyword collision: not endurance fitness.',manual:false};
  if(s.region==='Global')return {status:'hold',reason:'Global reference: verify transfer to an Indian audience.',manual:false};
  if(s.region==='Unclear')return {status:'hold',reason:'Local relevance needs review.',manual:false};
  if(s.kind==='audience')return {status:'analyse',reason:'Direct audience signal. Check context and sample bias.',manual:false};
  if(s.notes.trim().length<25&&!s.transcript.trim())return {status:'hold',reason:'Add source notes or a transcript before analysis.',manual:false};
  const r=relative(s);
  if(r!==null&&r>=1.5)return {status:'analyse',reason:`${r.toFixed(1)}× comparable channel baseline (n=${s.baselineN}).`,manual:false};
  return {status:'analyse',reason:r!==null?'Relevant comparison: useful even without breakout reach.':'Relevant topic reference; performance is unverified.',manual:false};
}
export const eligible=(s:Source)=>triage(s).status==='analyse';
export function excerpts(s:Source){return (s.transcript||s.notes).split(/\n+/).map(x=>x.trim()).filter(x=>x.length>15).slice(0,5)}
export function signals(sources:Source[]){
 const themes=[
  {name:'Fuelling decisions',pattern:/\b(fuel\w*|gel[ s]|carbohydrate\w*|nutrition)\b/i},
  {name:'Training load & recovery',pattern:/\b(training|recovery|sleep|mileage)\b/i},
  {name:'Local race conditions',pattern:/\b(heat|humidity|weather|course|route|pacing)\b/i},
  {name:'Cost & access',pattern:/\b(cost\w*|budget\w*|afford\w*|price\w*|access|equipment)\b/i},
  {name:'Community & participation',pattern:/\b(community|communities|participation|regional|organisers|organizers)\b/i},
 ];
 return themes.map(theme=>{
  const evidence=sources.filter(s=>s.analysed&&eligible(s)).flatMap(s=>{
   const lines=(s.transcript||s.notes).split(/\n+/).filter(line=>!/^\s*Researcher question:/i.test(line));
   const excerpt=lines.find(line=>theme.pattern.test(line));
   return excerpt?[{source:s,excerpt:excerpt.trim()}]:[];
  });
  return {name:theme.name,evidence,channels:new Set(evidence.map(e=>e.source.channel)).size};
 }).filter(s=>s.evidence.length>=2).sort((a,b)=>b.evidence.length-a.evidence.length);
}
export function findings(w:Workspace){return topics.map(topic=>{
  const all=w.sources.filter(s=>s.topic===topic&&triage(s).status!=='exclude');
  const evidence=all.filter(s=>s.analysed&&eligible(s));
  const channels=new Set(evidence.map(s=>s.channel));
  const audience=evidence.filter(s=>s.kind==='audience').length;
  return {topic,all,evidence,channels:channels.size,audience,confidence:evidence.length>=3&&channels.size>=2?'Moderate':'Exploratory'};
});}
const concepts:Record<Topic,{title:string;angle:string;question:string;viewer:string;format:string;outline:string[]}>={
 'Fuel & hydration':{title:'What does a first-marathon fuelling plan actually cost in India?',angle:'A transparent cost-per-long-run comparison, with a sports dietitian checking the assumptions.',question:'Which locally available options are practical, tolerable and affordable?',viewer:'First-time Indian marathoners overwhelmed by gels and nutrition advice',format:'12–16 min field test + expert review',outline:['Show the runner, race target and budget','Compare labelled carbohydrate amounts and real receipts','Document a rehearsed long-run plan and tolerance','Have an expert separate observations from general advice','Offer a blank planning worksheet']},
 'Training & recovery':{title:'Can an Indian 9-to-6 runner make a marathon plan work?',angle:'Follow one ordinary training week with commute, sleep and missed-session decisions visible.',question:'How do working runners adapt ambitious training advice to limited time?',viewer:'Time-constrained amateur runners in Indian cities',format:'15 min week-in-the-life + coach debrief',outline:['Set an honest time budget','Map the planned week against actual constraints','Show one adaptation and its trade-off','Ask a coach to review the decisions','Share the next week’s plan and uncertainty']},
 'Race craft':{title:'The Mumbai marathon plan you can rehearse before race day',angle:'A course-led checklist built around decision points, with a local coach and runner.',question:'What changes in pacing and preparation when local conditions change?',viewer:'Indian runners preparing for their first destination marathon',format:'10–14 min route breakdown',outline:['Define the runner and race goal','Map difficult course segments','Explain preparation decisions with a local coach','Walk through a practice scenario','Publish a race-day checklist']},
 'First triathlon':{title:'Your first 70.3 in India: the costs nobody puts in one place',angle:'An itemised beginner journey with actual participant receipts, training time and logistics.',question:'What are the real barriers between wanting a triathlon and starting?',viewer:'Indian runners considering their first triathlon',format:'18 min interview + cost breakdown',outline:['Start with the beginner’s constraints','Audit equipment and entry expenses','Map swim access and weekly training time','Compare essential and optional spending','Make a go/no-go checklist']},
 'Strength & hybrid':{title:'Running and lifting: what can a real Indian training week hold?',angle:'A documented schedule experiment reviewed by a qualified endurance and strength coach.',question:'How do recreational runners fit strength into race preparation?',viewer:'Indian amateur athletes combining gym and distance running',format:'14 min documented training experiment',outline:['Define the two goals and starting point','Show the weekly schedule','Record perceived fatigue and adjustments','Review limitations with a coach','Share a reusable planning template']},
 'Community & access':{title:'Finding your first running community without feeling out of place',angle:'Follow a new runner visiting three local groups; compare access, language and support.',question:'What makes a beginner feel welcome enough to come back?',viewer:'New Indian runners looking for an approachable local group',format:'12 min city field report',outline:['Meet the beginner and their hesitations','Visit different community formats','Compare costs, language, pace groups and access','Ask organisers about newcomer support','Share a practical first-visit checklist']},
};
export function ideas(w:Workspace){return findings(w).filter(f=>f.evidence.length>0).map(f=>{
 const c=concepts[f.topic];const ev=Math.min(100,f.evidence.length*16+f.channels*12+f.audience*10);
 const gap=f.all.length<3?85:f.all.length<5?65:40;
 const fit=f.evidence.filter(s=>s.region==='India').length/f.evidence.length*100;
 const total=w.weights.evidence+w.weights.gap+w.weights.fit;
 const score=total?Math.round((ev*w.weights.evidence+gap*w.weights.gap+fit*w.weights.fit)/total):0;
 return {id:f.topic,...c,...f,score,components:{evidence:ev,gap,fit},gapReason:`${f.all.length} source${f.all.length===1?'':'s'} in this workspace; market-wide supply is unknown.`,validation:`Search for existing versions of “${c.question}” and interview 3–5 target viewers before committing.`};
 }).sort((a,b)=>b.score-a.score||a.topic.localeCompare(b.topic));}
export type Idea=ReturnType<typeof ideas>[number];
export function parseCSV(text:string){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}else cell+=c}
 if(quoted)throw new Error('Unclosed CSV quote.');if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}
 const head=rows.shift()?.map(x=>x.trim())||[];return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]||''])));
}
export function importSources(text:string):Source[]{
 const parsed=/^[\[{]/.test(text.trim())?JSON.parse(text):parseCSV(text);const raw=Array.isArray(parsed)?parsed:parsed.sources;if(!Array.isArray(raw))throw new Error('Use a JSON array, workspace export or CSV header row.');
 return raw.map((x)=>sourceSchema.parse({kind:'video',published:'',captured:new Date().toISOString().slice(0,10),topic:topics[0],region:'India',format:'Long form',notes:'',transcript:'',decision:'auto',decisionReason:'',...x,id:crypto.randomUUID(),sourceUrl:x.sourceUrl||x.url,views:x.views===''||x.views==null?null:Number(x.views),baseline:x.baseline===''||x.baseline==null?null:Number(x.baseline),duration:x.duration===''||x.duration==null?null:Number(x.duration),baselineN:Number(x.baselineN||0),analysed:false}));
}
export function parseRoute(hash:string){const [path,query='']=hash.replace(/^#\/?/,'').split('?');return {view:['market','triage','analysis','ideas','settings'].includes(path)?path:'market',source:new URLSearchParams(query).get('source')}}
