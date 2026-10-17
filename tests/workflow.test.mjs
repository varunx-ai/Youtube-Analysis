import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {readFile,mkdir,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const esbuild=await import(pathToFileURL(require.resolve('esbuild',{paths:[dirname(require.resolve('vite'))]})).href);
const {Miniflare}=await import(pathToFileURL(require.resolve('miniflare',{paths:[dirname(require.resolve('wrangler'))]})).href);
const {renderToStaticMarkup}=await import('react-dom/server');
const React=await import('react');
await mkdir('.sites-runtime/tests',{recursive:true});
const compile=async(entry,name,plugins=[])=>{await esbuild.build({entryPoints:[entry],outfile:'.sites-runtime/tests/'+name+'.mjs',bundle:true,platform:'node',format:'esm',packages:'external',plugins});return import(pathToFileURL(resolve('.sites-runtime/tests/'+name+'.mjs')).href+'?'+Date.now())};
const cf={name:'test-bindings',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'bindings',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env=globalThis.__testEnv',loader:'js'}))}};
const model=await compile('lib/model.ts','model');
const {seed}=await compile('lib/seed.ts','seed');
const {default:Workspace}=await compile('app/workspace.tsx','ui');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name)}
check('URL normalization deduplicates watch, Shorts and short links',()=>{
 const aliases=['https://youtu.be/YK_V-9_Msfg?t=4','https://www.youtube.com/watch?v=YK_V-9_Msfg','https://www.youtube.com/shorts/YK_V-9_Msfg'];
 assert.equal(new Set(aliases.map(model.canonicalURL)).size,1);
 assert.equal(model.mergeSources(seed.sources,[{...seed.sources[0],url:aliases[0]}]).duplicates,1);
});
check('CSV import preserves quoted commas, line breaks and unknown metrics',()=>{
 const input='title,channel,url,kind,topic,notes\n"Fuel, in India",Independent coach,https://example.com/fuel,video,Fuel & hydration,"A real source note with detail.\nSecond line."\n';
 const parsed=model.importSources(input);assert.equal(parsed.length,1);assert.equal(parsed[0].views,null);assert.match(parsed[0].notes,/Second line/);assert.equal(parsed[0].analysed,false);
 assert.equal(model.importSources(JSON.stringify(seed)).length,7);
 assert.throws(()=>model.importSources('[{"title":"Broken"}]'));
 assert.throws(()=>model.parseCSV('title,notes\nA,"unclosed'));
});
const imported=model.importSources(JSON.stringify([{title:'Indian runners ask about gel costs',channel:'Independent running community',url:'https://example.com/audience/1',kind:'audience',topic:'Fuel & hydration',notes:'A supplied audience question asks how to budget for gels on long runs.',transcript:'[00:10] How can I afford fuelling every long run while training in India?'}]));
let w={...structuredClone(seed),sources:model.mergeSources(seed.sources,imported).sources};
check('Triage separates relevance, unknown context, lexical noise and manual overrides',()=>{
 const s=imported[0];assert.equal(model.triage(s).status,'analyse');
 assert.equal(model.triage({...s,title:'Minecraft gaming marathon',kind:'video'}).status,'exclude');
 assert.equal(model.triage({...s,region:'Unclear'}).status,'hold');
 assert.equal(model.triage({...s,region:'Global',decision:'analyse',decisionReason:'Useful comparison'}).status,'analyse');
 assert.equal(model.triage({...s,kind:'video',notes:'',transcript:''}).status,'hold');
 assert.equal(model.relative({...s,views:10000,baseline:4000,baselineN:4}),null);
 assert.equal(model.relative({...s,views:10000,baseline:4000,baselineN:5}),2.5);
});
check('Collection flows through review to evidence-linked findings and ranked briefs',()=>{
 w.sources=w.sources.map(s=>s.id===imported[0].id?{...s,analysed:true}:s);
 const f=model.findings(w).find(f=>f.topic==='Fuel & hydration');assert.equal(f.evidence.length,3);assert.equal(f.channels,2);assert.equal(f.audience,1);assert.equal(f.confidence,'Moderate');
 const ranked=model.ideas(w);assert.ok(ranked.length>=4);assert.equal(ranked[0].topic,'Fuel & hydration');
 assert.ok(ranked.every(i=>i.evidence.length>0&&i.score>=0&&i.score<=100&&i.outline.length===5));
 assert.ok(ranked[0].evidence.some(s=>model.excerpts(s).some(x=>x.includes('[00:10]'))));
 const excluded={...w,sources:w.sources.map(s=>s.topic==='Fuel & hydration'?{...s,decision:'exclude'}:s)};
 assert.ok(!model.ideas(excluded).some(i=>i.topic==='Fuel & hydration'));
 const reranked=model.ideas({...w,weights:{evidence:0,gap:100,fit:0}});assert.notEqual(reranked[0].topic,ranked[0].topic);
 assert.ok(model.ideas({...w,weights:{evidence:0,gap:0,fit:0}}).every(i=>i.score===0));
});
check('Repeated patterns retain source excerpts and exclude researcher questions',()=>{
 const patterns=model.signals(w.sources);assert.ok(patterns.some(p=>p.name==='Fuelling decisions'&&p.evidence.length>=2));
 assert.ok(patterns.every(p=>p.evidence.every(e=>!e.excerpt.startsWith('Researcher question:'))));
 assert.equal(model.signals([{...imported[0],analysed:true,transcript:'',notes:'Researcher question: what is the budget?'},{...imported[0],id:'other',analysed:true,transcript:'',notes:'Researcher question: is this affordable?'}]).length,0);
});
check('Navigation resolves to one active section and one rendered workspace state',()=>{
 for(const view of ['market','triage','analysis','ideas','settings']){
 const hash='#'+view+'?source='+imported[0].id;assert.equal(model.parseRoute(hash).view,view);assert.equal(model.parseRoute(hash).source,imported[0].id);
 const html=renderToStaticMarkup(React.createElement(Workspace,{initialWorkspace:w,initialView:view,ready:true}));
 assert.equal((html.match(/aria-current="page"/g)||[]).length,1,view);assert.match(html,new RegExp('href="#'+view+'"[^>]*aria-current="page"'));assert.ok(!html.includes('Loading saved research'));
 }
 assert.equal(model.parseRoute('#studio').view,'market');
});
check('Untrusted source titles are escaped in rendered evidence',()=>{
 const x={...w,sources:[{...w.sources[0],title:'<script>alert(1)</script>'}]};
 const html=renderToStaticMarkup(React.createElement(Workspace,{initialWorkspace:x,ready:true}));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert(1)</script>'));
 assert.equal(model.safeURL('javascript:alert(1)'),'');
});
const persist=resolve('.sites-runtime/tests/d1');await rm(persist,{recursive:true,force:true});
let mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB'],d1Persist:persist});
let db=await mf.getD1Database('DB');await db.exec((await readFile('drizzle/0000_plain_black_crow.sql','utf8')).replace(/\n/g,' '));
globalThis.__testEnv={DB:db};const api=await compile('app/api/workspace/route.ts','api',[cf]);
let r=await api.GET();assert.equal(r.status,200);let payload=await r.json();assert.equal(payload.revision,0);
const put=(workspace,revision)=>api.PUT(new Request('https://site.test/api/workspace',{method:'PUT',body:JSON.stringify({workspace,revision}),headers:{'content-type':'application/json'}}));
r=await put(w,0);assert.equal(r.status,200);assert.equal((await r.json()).revision,1);
r=await api.GET();payload=await r.json();assert.equal(payload.workspace.sources.length,8);assert.equal(payload.revision,1);
checks++;console.log('PASS API → actual D1 SQLite → reload returns collected and reviewed sources');
w.saved=[model.ideas(w)[0].id];r=await put(w,1);assert.equal(r.status,200);
r=await put({...w,name:'Stale tab'},1);assert.equal(r.status,409);
r=await put({name:'Invalid'},2);assert.equal(r.status,400);
checks++;console.log('PASS saved shortlist persists; stale-tab writes and invalid payloads are rejected');
await mf.dispose();
mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB'],d1Persist:persist});
db=await mf.getD1Database('DB');globalThis.__testEnv.DB=db;
r=await api.GET();payload=await r.json();assert.equal(payload.revision,2);assert.equal(payload.workspace.saved.length,1);assert.equal(model.ideas(payload.workspace)[0].topic,'Fuel & hydration');
checks++;console.log('PASS database restart → evidence, decisions and ranked saved opportunity survive');
await mf.dispose();
const metadata=await compile('app/api/metadata/route.ts','metadata');
r=await metadata.POST(new Request('https://site.test/api/metadata',{method:'POST',body:JSON.stringify({url:'http://127.0.0.1/admin'})}));assert.equal(r.status,400);
const originalFetch=globalThis.fetch;let called='';globalThis.fetch=async url=>{called=String(url);return Response.json({title:'Verified title',author_name:'Publisher'})};
r=await metadata.POST(new Request('https://site.test/api/metadata',{method:'POST',body:JSON.stringify({url:'https://youtu.be/YK_V-9_Msfg'})}));assert.equal(r.status,200);assert.ok(called.startsWith('https://www.youtube.com/oembed?'));assert.equal((await r.json()).channel,'Publisher');
globalThis.fetch=async()=>new Response('Unavailable',{status:404});r=await metadata.POST(new Request('https://site.test/api/metadata',{method:'POST',body:JSON.stringify({url:'https://youtu.be/YK_V-9_Msfg'})}));assert.equal(r.status,422);assert.match((await r.json()).error,/manually/);globalThis.fetch=originalFetch;
checks++;console.log('PASS metadata lookup is host-restricted and failures offer a manual path');
console.log(`\n${checks} workflow checks passed. Browser interaction/visual QA unavailable; no browser was launched.`);
