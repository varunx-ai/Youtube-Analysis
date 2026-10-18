import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GET } from '../app/api/discovery/search/route.ts';

const url = (q, order='relevance') => `http://localhost:3000/api/discovery/search?q=${encodeURIComponent(q)}&order=${order}`;
const videoId = 'abc123xyz01';

// These are mocked network responses; no YouTube requests and no key exposure.
test('search requires a query and cannot run publicly without authentication', async () => {
  assert.equal((await GET(new Request(url('a')))).status, 400);
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try { assert.equal((await GET(new Request(url('marathon training')))).status, 403); }
  finally { process.env.NODE_ENV = previous; }
});

test('missing API key returns an actionable error, not fabricated videos', async () => {
  const previous = process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
  try {
    const response = await GET(new Request(url('marathon beginners')));
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, 'missing_key');
    assert.match(body.error, /YOUTUBE_API_KEY/);
  } finally { if(previous === undefined)delete process.env.YOUTUBE_API_KEY;else process.env.YOUTUBE_API_KEY=previous; }
});

test('real discovery endpoint maps YouTube results, retrieves metrics, and caches repeated search', async () => {
  const before = process.env.YOUTUBE_API_KEY;
  const oldFetch = globalThis.fetch;
  process.env.YOUTUBE_API_KEY = 'test-only-not-a-real-key';
  const calls=[];
  globalThis.fetch=async (u) => {
    const parsed=new URL(String(u));calls.push(parsed);
    if(parsed.pathname.endsWith('/search')) return Response.json({items:[{id:{videoId},snippet:{title:'Marathon Training in India',channelTitle:'Run India',channelId:'UC1234',description:'Training guidance',publishedAt:'2026-10-15T00:00:00Z',thumbnails:{medium:{url:'https://i.ytimg.com/vi/x/mqdefault.jpg'}}}}]});
    if(parsed.pathname.endsWith('/videos'))return Response.json({items:[{id:videoId,statistics:{viewCount:'34000'},contentDetails:{duration:'PT12M30S'}}]});
    throw new Error('Unexpected endpoint');
  };
  try {
    const response=await GET(new Request(url('specific marathon research')));
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.cached,false);
    assert.equal(body.videos.length,1);
    assert.equal(body.videos[0].views,34000);
    assert.equal(body.videos[0].durationSeconds,750);
    assert.equal(body.videos[0].url,`https://www.youtube.com/watch?v=${videoId}`);
    assert.equal(calls.length,2);
    assert.equal(calls[0].searchParams.get('key'),'test-only-not-a-real-key');
    assert.equal(calls[0].searchParams.get('q'),'specific marathon research');
    const repeat=await GET(new Request(url('specific marathon research')));
    assert.equal((await repeat.json()).cached,true);
    assert.equal(calls.length,2);
    assert.ok(!JSON.stringify(body).includes('test-only-not-a-real-key'));
  }finally{globalThis.fetch=oldFetch;if(before===undefined)delete process.env.YOUTUBE_API_KEY;else process.env.YOUTUBE_API_KEY=before;}
});

test('main workspace visibly links to both search experiences',async()=>{
  const main=await readFile(new URL('../app/workspace.tsx',import.meta.url),'utf8');
  assert.match(main,/data-testid="discovery-search-form"/);
  assert.match(main,/data-testid="discover-nav"/);
  assert.match(main,/data-testid="knowledge-nav"/);
  const knowledge=await readFile(new URL('../app/knowledge/KnowledgeExplorer.tsx',import.meta.url),'utf8');
  assert.match(knowledge,/href="\/search"/);
  assert.doesNotMatch(knowledge,/disabled=\{busy\|\|!status\?\.indexed\}/);
  const api=await readFile(new URL('../app/api/knowledge/search/route.ts',import.meta.url),'utf8');
  assert.match(api,/currentKnowledgeIndex\(\)/);
});
