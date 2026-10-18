'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpenText, Check, ExternalLink, Search, Video, RefreshCw, Plus, AlertCircle } from 'lucide-react';
import { canonicalURL, topics, type Source, type Workspace } from '../../lib/model';
import styles from './search.module.css';

type VideoResult = {
  id: string; title: string; channel: string; channelId: string; url: string;
  description: string; publishedAt: string; thumbnail: string | null;
  views: number | null; durationSeconds: number | null;
};
type DiscoveryResponse = { videos?: VideoResult[]; error?: string; code?: string; cached?: boolean };
type WorkspaceResponse = { workspace: Workspace; revision: number; error?: string };
const format = (value: number | null) => value == null ? 'Views unavailable' : new Intl.NumberFormat('en', { notation:'compact', maximumFractionDigits:1 }).format(value) + ' views';

export default function DiscoverySearch() {
  const [query,setQuery]=useState('');
  const [submitted,setSubmitted]=useState('');
  const [order,setOrder]=useState('relevance');
  const [videos,setVideos]=useState<VideoResult[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [keyMissing,setKeyMissing]=useState(false);
  const [topic,setTopic]=useState<Source['topic']>('Training & recovery');
  const [saved,setSaved]=useState<string[]>([]);
  const [saving,setSaving]=useState('');
  const [message,setMessage]=useState('');
  const didReadURL=useRef(false);

  async function search(q:string, selectedOrder=order){
    const clean=q.trim();
    if(clean.length<2){setError('Enter at least two characters to search YouTube.');return}
    setBusy(true);setError('');setMessage('');setKeyMissing(false);setSubmitted(clean);
    try{
      const params=new URLSearchParams({q:clean,order:selectedOrder});
      const response=await fetch(`/api/discovery/search?${params}`,{cache:'no-store'});
      const body=await response.json() as DiscoveryResponse;
      if(!response.ok){setVideos([]);setKeyMissing(body.code==='missing_key');throw new Error(body.error||'YouTube search failed')}
      setVideos(body.videos||[]);
    }catch(e){setError(e instanceof Error?e.message:'Search failed')}
    finally{setBusy(false)}
  }
  useEffect(()=>{
    if(didReadURL.current)return;
    didReadURL.current=true;
    const q=new URLSearchParams(window.location.search).get('q')?.trim() || '';
    if(q){setQuery(q);void search(q,'relevance')}
  },[]);

  async function addToWorkspace(video:VideoResult){
    setSaving(video.id);setError('');setMessage('');
    try{
      const response=await fetch('/api/workspace',{cache:'no-store'});
      const state=await response.json() as WorkspaceResponse;
      if(!response.ok)throw new Error(state.error||'Unable to load research workspace');
      if(state.workspace.sources.some(s=>canonicalURL(s.url)===canonicalURL(video.url))){
        setSaved(old=>[...new Set([...old,video.id])]);setMessage('This video is already in your research workspace.');return;
      }
      const today=new Date().toISOString().slice(0,10);
      const source:Source={
        id:`yt_${video.id}`,title:video.title.slice(0,300),channel:video.channel.slice(0,150),
        url:video.url,sourceUrl:video.url,kind:'video',published:video.publishedAt.slice(0,10),captured:today,
        topic,region:'Unclear',format:video.durationSeconds!==null&&video.durationSeconds<=180?'Short':'Long form',
        views:video.views,baseline:null,baselineN:0,duration:video.durationSeconds,
        notes:video.description?`YouTube search description (not transcript; unverified): ${video.description}`:'',
        transcript:'',decision:'auto',decisionReason:'',analysed:false,
      };
      const res=await fetch('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspace:{...state.workspace,sources:[...state.workspace.sources,source]},revision:state.revision})});
      const body=await res.json() as {error?:string};
      if(!res.ok)throw new Error(res.status===409?'Research workspace changed in another tab. Close it or refresh and retry.':body.error||'Unable to save video');
      setSaved(old=>[...new Set([...old,video.id])]);
      setMessage(`Saved “${video.title}” to Market evidence. Its description is not a verified transcript.`);
    }catch(e){setError(e instanceof Error?e.message:'Unable to add video')}
    finally{setSaving('')}
  }

  const externalURL=`https://www.youtube.com/results?search_query=${encodeURIComponent(submitted || query)}`;
  return <main className={styles.page}>
    <div className={styles.wrap}>
      <div className={styles.top}><a href="/" className={styles.back}><ArrowLeft size={16}/> Research workspace</a><a className={styles.switch} href="/knowledge"><BookOpenText size={17}/> Search saved knowledge <ArrowUpRight size={15}/></a></div>
      <div className={styles.hero}><div className={styles.eyebrow}><Video size={16}/> DISCOVERY / LIVE YOUTUBE SEARCH</div><h1>Find videos worth studying.</h1><p>Search YouTube directly. Compare candidate videos, save relevant results to your research workspace, and build a reviewable evidence base.</p></div>
      <form className={styles.searchPanel} onSubmit={(event:FormEvent)=>{event.preventDefault();void search(query)}}>
        <label htmlFor="youtube-discovery-query">Search YouTube videos</label>
        <div className={styles.searchRow}><div className={styles.searchInput}><Search size={19}/><input autoFocus id="youtube-discovery-query" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Marathon training India, HYROX beginner, Ironman 70.3…" minLength={2} maxLength={120} required/></div><button type="submit" className={styles.primary} disabled={busy}>{busy?<RefreshCw size={18} className={styles.spin}/>:<Search size={18}/>} {busy?'Searching…':'Search videos'}</button></div>
        <div className={styles.searchOptions}><label>Sort by <select value={order} onChange={e=>setOrder(e.target.value)}><option value="relevance">Relevance</option><option value="date">Newest</option><option value="viewCount">Most viewed</option></select></label><p>Each new query uses YouTube Data API quota. Repeated queries are cached for 15 minutes.</p></div>
      </form>
      {!submitted && <div className={styles.suggestions}><strong>Try a search</strong>{['marathon training India','Ironman 70.3 India','HYROX India','long run fueling'].map(term=><button key={term} onClick={()=>{setQuery(term);void search(term)}}>{term} <ArrowUpRight size={13}/></button>)}</div>}
      {error&&<div role="alert" className={styles.error}><AlertCircle size={19}/><div><strong>Search unavailable</strong><p>{error}</p>{(keyMissing || submitted)&&<a href={externalURL} target="_blank" rel="noopener noreferrer">Search YouTube directly <ExternalLink size={14}/></a>}</div></div>}
      {message&&<p role="status" className={styles.success}><Check size={17}/>{message}</p>}
      {!!videos.length&&<div className={styles.resultsHead}><div><h2>{videos.length} videos found</h2><p>These are search results, not analysed content or verified audience evidence.</p></div><label>Add to topic <select value={topic} onChange={e=>setTopic(e.target.value as Source['topic'])}>{topics.map(v=><option key={v}>{v}</option>)}</select></label></div>}
      {!!submitted&&!busy&&!error&&!videos.length&&<p className={styles.empty}>No videos matched that search. Try broader keywords.</p>}
      <div className={styles.results}>{videos.map(video=><article key={video.id} className={styles.videoCard}>
        {video.thumbnail&&<img src={video.thumbnail} alt="" loading="lazy" className={styles.thumbnail} referrerPolicy="no-referrer"/>}
        <div className={styles.videoContent}><a className={styles.videoTitle} href={video.url} target="_blank" rel="noopener noreferrer">{video.title} <ExternalLink size={14}/></a><div className={styles.videoMeta}>{video.channel} <span>·</span> {format(video.views)} {video.publishedAt&&<><span>·</span> {video.publishedAt.slice(0,10)}</>}</div><p className={styles.description}>{video.description||'No description returned by YouTube.'}</p><div className={styles.videoActions}><button className={styles.primary} disabled={!!saving||saved.includes(video.id)} onClick={()=>void addToWorkspace(video)}>{saved.includes(video.id)?<Check size={16}/>:<Plus size={16}/>} {saving===video.id?'Saving…':saved.includes(video.id)?'In workspace':'Add to research workspace'}</button><a href={video.url} target="_blank" rel="noopener noreferrer">Watch on YouTube <ArrowUpRight size={14}/></a></div></div>
      </article>)}</div>
      <div className={styles.bottom}>Looking for a passage inside the videos you already collected? <a href="/knowledge">Search the Knowledge Layer <ArrowUpRight size={14}/></a></div>
    </div>
  </main>;
}
