'use client';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, BookOpenText, ExternalLink, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import styles from './knowledge.module.css';

type Status = {
  indexed: boolean; upToDate: boolean; workspaceRevision: number; indexedRevision: number;
  sourceCount: number; indexedSources: number; chunkCount: number;
  transcriptChunks: number; reviewedChunks: number; generatedAt: string | null;
};
type Hit = {
  chunk: {
    id:string; title:string; channel:string; topic:string; sourceUrl:string;
    textKind:'supplied_transcript'|'research_notes'; status:'reviewed'|'unreviewed';
    startSeconds:number|null; endSeconds:number|null;
  };
  score: number; matchedTerms:string[]; excerpt:string;
};
type SearchResponse = { hits:Hit[]; query:string; method:string; totalIndexedChunks:number; error?:string };

function timestamp(seconds:number|null) {
  if (seconds === null) return null;
  const s=Math.floor(seconds), hours=Math.floor(s/3600), minutes=Math.floor((s%3600)/60), secs=s%60;
  return (hours ? `${hours}:` : '') + `${hours ? String(minutes).padStart(2,'0') : minutes}:${String(secs).padStart(2,'0')}`;
}

export default function KnowledgeExplorer() {
  const [status,setStatus]=useState<Status|null>(null);
  const [query,setQuery]=useState('marathon training');
  const [searched,setSearched]=useState('');
  const [hits,setHits]=useState<Hit[]>([]);
  const [reviewedOnly,setReviewedOnly]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  async function refresh() {
    const r=await fetch('/api/knowledge/status', {cache:'no-store'});
    const body=await r.json();
    if (!r.ok) throw new Error(body.error || 'Unable to get index status');
    setStatus(body);
  }
  useEffect(()=>{
    const fromURL = new URLSearchParams(window.location.search).get('q')?.trim();
    const initialQuery = fromURL && fromURL.length >= 2 ? fromURL : 'marathon training';
    setQuery(initialQuery);
    // Search builds an index on demand. No separate indexing step required.
    void doSearch(initialQuery, false);
  },[]);
  async function sync() {
    setLoading(true);setError('');
    try {
      const r=await fetch('/api/knowledge/sync',{method:'POST'});
      const body=await r.json();
      if(!r.ok)throw new Error(body.error||'Indexing failed');
      await refresh();
      if(searched) await doSearch(searched);
    } catch(e){setError(e instanceof Error?e.message:'Indexing failed')}
    finally{setLoading(false)}
  }
  async function doSearch(q=query, reviewed=reviewedOnly) {
    setBusy(true);setError('');
    try {
      const params=new URLSearchParams({q,limit:'15'});
      if(reviewed)params.set('reviewed','true');
      const r=await fetch(`/api/knowledge/search?${params}`,{cache:'no-store'});
      const body=await r.json() as SearchResponse;
      if(!r.ok)throw new Error(body.error||'Search failed');
      setHits(body.hits);setSearched(q);await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Search failed')}
    finally{setBusy(false)}
  }
  const submit=(e:FormEvent)=>{e.preventDefault();void doSearch()};
  return <main className={styles.page}>
    <div className={styles.wrap}>
      <a className={styles.back} href="/"><ArrowLeft size={15}/> Back to research workspace</a>
      <div className={styles.hero}>
        <div className={styles.eyebrow}><BookOpenText size={16}/> SEARCH / SAVED RESEARCH</div>
        <h1>Find evidence in your workspace.</h1>
        <p>Search across your saved source notes and supplied transcripts. The index is built automatically when needed, and each result links to its original source.</p>
        <a href="/search" className={styles.discoverLink}>Looking for new videos? Search YouTube <ExternalLink size={15}/></a>
      </div>
      <section className={styles.panel} aria-label="Index status">
        <div className={styles.panelHead}>
          <div><strong>Local evidence index</strong><span>{status?.generatedAt ? `Last indexed ${new Date(status.generatedAt).toLocaleString()}` : 'Not indexed yet'}</span></div>
          <button className={styles.primary} type="button" disabled={loading} onClick={()=>void sync()}><RefreshCw size={15}/>{loading?'Refreshing…':'Refresh index'}</button>
        </div>
        <div className={styles.metrics}>
          <div><strong>{status?.indexedSources ?? '—'}</strong><span>Indexed sources</span></div>
          <div><strong>{status?.chunkCount ?? '—'}</strong><span>Evidence chunks</span></div>
          <div><strong>{status?.transcriptChunks ?? '—'}</strong><span>Transcript chunks</span></div>
          <div><strong>{status?.reviewedChunks ?? '—'}</strong><span>Reviewed chunks</span></div>
        </div>
        {status && !status.upToDate && <p className={styles.warning}><ShieldAlert size={15}/> Workspace has changes not reflected in this index. Refresh before treating results as current.</p>}
      </section>
      <section className={styles.panel} aria-label="Evidence search">
        <form className={styles.searchForm} onSubmit={submit}>
          <label htmlFor="knowledge-query">Search saved notes and transcripts</label>
          <div className={styles.searchRow}><input id="knowledge-query" minLength={2} maxLength={300} required value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. fuelling for long runs"/><button className={styles.primary} type="submit" disabled={busy}><Search size={16}/>{busy?'Searching…':'Search knowledge'}</button></div>
          <p className={styles.searchHint}>Type your question and press Enter. No manual indexing is required.</p>
          <label className={styles.checkbox}><input type="checkbox" checked={reviewedOnly} onChange={e=>{setReviewedOnly(e.target.checked);if(searched)void doSearch(searched,e.target.checked)}}/> Reviewed sources only</label>
        </form>
      </section>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {searched && <section className={styles.results} aria-label="Search results"><div className={styles.resultsHead}><h2>{hits.length} passages found</h2><span>Exact-text ranking · BM25 · Not semantic search</span></div>
        {hits.map(hit=><article key={hit.chunk.id} className={styles.hit}>
          <div className={styles.hitMeta}><span>{hit.chunk.topic}</span><span>{hit.chunk.textKind==='supplied_transcript'?'Supplied transcript':'Research notes'}</span><span>{hit.chunk.status==='reviewed'?'Reviewed':'Not reviewed'}</span></div>
          <h3>{hit.chunk.title}</h3>
          <p className={styles.channel}>{hit.chunk.channel}{timestamp(hit.chunk.startSeconds)!==null?` · ${timestamp(hit.chunk.startSeconds)}`:''}</p>
          <p className={styles.excerpt}>{hit.excerpt}</p>
          <div className={styles.hitFooter}><span>Matched: {hit.matchedTerms.join(', ')}</span><a href={hit.chunk.sourceUrl} target="_blank" rel="noopener noreferrer">Original source <ExternalLink size={13}/></a></div>
        </article>)}
        {!hits.length&&<p className={styles.empty}>No matching evidence was found. Try different keywords or add more source transcripts in Market Evidence.</p>}
      </section>}
      <p className={styles.note}>Local development only. Search covers saved material, not all of YouTube. Excluded sources are omitted. Timestamp labels appear only when present in the supplied source. The current implementation is lexical search; embeddings and semantic RAG are future work.</p>
    </div>
  </main>;
}
