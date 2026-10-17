"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { KeywordAnalysis } from "../lib/insights";
import type { ResearchVideo } from "../lib/types";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const n = (x: number | null) => (x == null ? "Hidden" : compact.format(x));
const pct = (x: number) => `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`;
const x1 = (x: number | null) => (x == null ? "n/a" : `${x < 10 ? x.toFixed(1) : Math.round(x)}x`);
const age = (d: number) => (d < 30 ? `${d}d` : d < 365 ? `${Math.round(d / 30)}mo` : `${(d / 365).toFixed(1)}y`);
const len = (s: number) => (s <= 60 ? `${s}s` : `${Math.round(s / 60)}m`);
const COST = { 1: 105, 2: 210, 3: 315 } as const;

type Result = { videos: ResearchVideo[]; analysis: KeywordAnalysis };
type SortKey = "reach" | "views" | "viewsPerDay" | "likeRate" | "commentRate" | "ageDays";

const ratio = (a: number | null, b: number) => (a == null || b === 0 ? -1 : a / b);

function VideoLink({ v }: { v: ResearchVideo }) {
  return v.id.startsWith("DEMO_") ? <>{v.title}</> : (
    <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer">{v.title}</a>
  );
}

function VideoTable({ rows, empty }: { rows: ResearchVideo[]; empty: string }) {
  if (!rows.length) return <p className="empty">{empty}</p>;
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>Video</th><th>Channel</th><th className="r">Subs</th><th className="r">Views</th>
            <th className="r" title="Views divided by the channel's subscribers">Reach</th>
            <th className="r">Age</th><th className="r">Length</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td className="vt"><VideoLink v={v} /></td>
              <td><Link href={`/channel/${v.channelId}`}>{v.channelTitle}</Link></td>
              <td className="r">{n(v.subs)}</td>
              <td className="r">{n(v.views)}</td>
              <td className="r hot">{x1(v.reach)}</td>
              <td className="r">{age(v.ageDays)}</td>
              <td className="r">{len(v.durationSec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Terms({ terms, empty }: { terms: { term: string; n: number; lift: number }[]; empty: string }) {
  if (!terms.length) return <p className="empty">{empty}</p>;
  return (
    <table>
      <thead><tr><th>Word or phrase</th><th className="r">Videos</th><th className="r">Reach vs. without</th></tr></thead>
      <tbody>{terms.map((t) => (<tr key={t.term}><td>{t.term}</td><td className="r">{t.n}</td><td className="r">{t.lift.toFixed(2)}x</td></tr>))}</tbody>
    </table>
  );
}

export default function ResearchClient() {
  const [q, setQ] = useState("");
  const [pages, setPages] = useState<1 | 2 | 3>(2);
  const [order, setOrder] = useState("relevance");
  const [days, setDays] = useState("0");
  const [res, setRes] = useState<(Result & { q: string; pages: number; order: string; days: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("reach");
  const [limit, setLimit] = useState(30);
  const [ideas, setIdeas] = useState<string | null>(null);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function parse(r: Response): Promise<Record<string, unknown>> {
    const t = await r.text();
    try { return JSON.parse(t); } catch {
      throw new Error(`The server returned status ${r.status} with no readable response. Check the terminal running npm run dev.`);
    }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setError(null); setIdeas(null); setIdeasError(null);
    try {
      const r = await fetch(`/api/research?${new URLSearchParams({ q, pages: String(pages), order, days })}`);
      const body = await parse(r);
      if (!r.ok || !body.videos) throw new Error((body.error as string) ?? "Research failed.");
      setRes({ videos: body.videos as ResearchVideo[], analysis: body.analysis as KeywordAnalysis, q, pages, order, days });
      setLimit(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed.");
    } finally { setLoading(false); }
  }

  async function ideasCall(mode: "generate" | "prompt") {
    if (!res) return;
    setIdeasBusy(true); setIdeasError(null);
    try {
      const r = await fetch("/api/ideas", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: res.q, pages: String(res.pages), order: res.order, days: res.days, mode }),
      });
      const body = await parse(r);
      if (!r.ok) throw new Error((body.error as string) ?? "Failed.");
      if (mode === "prompt") {
        await navigator.clipboard.writeText(body.prompt as string);
        setCopied(true); setTimeout(() => setCopied(false), 2500);
      } else setIdeas(body.ideas as string);
    } catch (err) {
      setIdeasError(err instanceof Error ? err.message : "Failed.");
    } finally { setIdeasBusy(false); }
  }

  const sorted = useMemo(() => {
    if (!res) return [];
    const val = (v: ResearchVideo) =>
      sort === "reach" ? v.reach ?? -1 : sort === "views" ? v.views : sort === "viewsPerDay" ? v.viewsPerDay
      : sort === "likeRate" ? ratio(v.likes, v.views) : sort === "commentRate" ? ratio(v.comments, v.views) : -v.ageDays;
    return [...res.videos].sort((a, b) => val(b) - val(a));
  }, [res, sort]);

  const a = res?.analysis;
  const COLS: [SortKey, string][] = [["reach", "Reach"], ["views", "Views"], ["viewsPerDay", "Views per day"], ["likeRate", "Likes per view"], ["commentRate", "Comments per view"], ["ageDays", "Newest"]];

  return (
    <>
      <h1>What is working on YouTube for a keyword, and what isn&apos;t?</h1>
      <form onSubmit={run} className="search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keyword, e.g. ai agents for small business" aria-label="Keyword" autoFocus />
        <button disabled={loading}>{loading ? "Researching" : "Research keyword"}</button>
        <div className="opts">
          <label>Videos to scan
            <select value={pages} onChange={(e) => setPages(Number(e.target.value) as 1 | 2 | 3)}>
              <option value={1}>50</option><option value={2}>100</option><option value={3}>150</option>
            </select>
          </label>
          <label>Look at
            <select value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="relevance">Most relevant</option>
              <option value="viewCount">Most viewed</option>
              <option value="date">Newest</option>
            </select>
          </label>
          <label>Published
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="0">Any time</option><option value="90">Last 90 days</option><option value="365">Last year</option>
            </select>
          </label>
          <span>Uses about {COST[pages]} API units</span>
        </div>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {!res && !error && <p className="empty">Enter a keyword to see the videos YouTube returns for it, which ones beat their channel&apos;s size, and which fell flat.</p>}

      {res && a && (
        <>
          <p className="lede" style={{ marginTop: 28 }}>
            {a.videoCount} videos from {a.channelCount} channels. Median views {n(Math.round(a.medianViews))}.{" "}
            {a.eligibleCount > 0 && <>{Math.round(a.beatOwnAudiencePct * 100)}% of videos older than 14 days got more views than their channel has subscribers.</>}
          </p>

          <section>
            <h2>What worked</h2>
            <p className="lede">Reach is views divided by the channel&apos;s subscribers. A high number means the topic or angle pulled viewers beyond the channel&apos;s own audience.</p>
            <VideoTable rows={a.winners} empty="Not enough older videos with known subscriber counts to rank." />
            <div className="two">
              <div>
                <h3>Words that go with strong reach</h3>
                <Terms terms={a.termsUp} empty="No words appear often enough to compare." />
              </div>
              <div>
                <h3>Title patterns</h3>
                {a.titleLifts.length === 0 ? <p className="empty">Not enough variety to compare.</p> : (
                  <table>
                    <thead><tr><th>Pattern</th><th className="r">Videos</th><th className="r">Reach vs. without</th></tr></thead>
                    <tbody>{a.titleLifts.map((l) => (<tr key={l.label}><td>{l.label}</td><td className="r">{l.withN}</td><td className={`r ${l.lift >= 1.25 ? "hot" : ""}`}>{l.lift.toFixed(2)}x</td></tr>))}</tbody>
                  </table>
                )}
                {a.formats.length > 0 && (
                  <>
                    <h3>Length</h3>
                    <table>
                      <thead><tr><th>Length</th><th className="r">Videos</th><th className="r">Median reach</th></tr></thead>
                      <tbody>{a.formats.map((f) => (<tr key={f.label}><td>{f.label}</td><td className="r">{f.n}</td><td className="r">{x1(f.medianReach)}</td></tr>))}</tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          </section>

          <section>
            <h2>What didn&apos;t</h2>
            <p className="lede">Videos from channels with 5K or more subscribers that reached the fewest people relative to their size. A weak result from a big channel points to the topic or angle, not the audience.</p>
            <VideoTable rows={a.flops} empty="No large channels in this set to compare against." />
            <h3>Words that go with weak reach</h3>
            <Terms terms={a.termsDown} empty="No words appear often enough to compare." />
          </section>

          {a.rising.length > 0 && (
            <section>
              <h2>Rising now</h2>
              <p className="lede">Published in the last 30 days, ranked by views per day. These show what is catching on at the moment.</p>
              <VideoTable rows={a.rising} empty="" />
            </section>
          )}

          <section>
            <h2>New video ideas</h2>
            <p className="lede">OpenAI reads the winners, flops and patterns above and proposes evidence-backed ideas. This reuses the data you just loaded and costs no additional YouTube quota.</p>
            <div className="actions">
              <button className="primary" onClick={() => ideasCall("generate")} disabled={ideasBusy}>{ideasBusy ? "Thinking" : "Generate ideas"}</button>
              <button className="secondary" onClick={() => ideasCall("prompt")} disabled={ideasBusy}>{copied ? "Copied" : "Copy as prompt"}</button>
            </div>
            {ideasError && <p className="error" role="alert">{ideasError}</p>}
            {ideas && <div className="ideas">{ideas}</div>}
          </section>

          <section>
            <h2>All {res.videos.length} videos</h2>
            <div className="sorts" role="group" aria-label="Sort videos by">
              {COLS.map(([k, label]) => (
                <button key={k} className={sort === k ? "sorted" : ""} aria-pressed={sort === k} onClick={() => { setSort(k); setLimit(30); }}>{label}</button>
              ))}
            </div>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Video</th><th>Channel</th><th className="r">Views</th><th className="r">Per day</th>
                    <th className="r">Likes per view</th><th className="r">Comments per view</th><th className="r">Reach</th><th className="r">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, limit).map((v) => (
                    <tr key={v.id}>
                      <td className="vt"><VideoLink v={v} /></td>
                      <td>{v.channelTitle}</td>
                      <td className="r">{n(v.views)}</td>
                      <td className="r">{n(Math.round(v.viewsPerDay))}</td>
                      <td className="r">{v.likes == null ? "Hidden" : pct(v.likes / Math.max(v.views, 1))}</td>
                      <td className="r">{v.comments == null ? "Off" : pct(v.comments / Math.max(v.views, 1))}</td>
                      <td className="r">{x1(v.reach)}</td>
                      <td className="r">{age(v.ageDays)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {limit < sorted.length && <p><button className="secondary" onClick={() => setLimit(sorted.length)}>Show all {sorted.length}</button></p>}
          </section>
        </>
      )}
    </>
  );
}
