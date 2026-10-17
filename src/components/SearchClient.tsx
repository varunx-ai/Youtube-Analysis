"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ChannelHit } from "../lib/types";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const f = (n: number | null) => (n == null ? "Hidden" : compact.format(n));

type SortKey = "matches" | "subs" | "views" | "videoCount" | "perVideo";
const COLS: { key: SortKey; label: string }[] = [
  { key: "matches", label: "Matching videos" },
  { key: "subs", label: "Subscribers" },
  { key: "views", label: "Total views" },
  { key: "videoCount", label: "Videos" },
  { key: "perVideo", label: "Views per video" },
];

export default function SearchClient() {
  const [q, setQ] = useState("");
  const [order, setOrder] = useState("relevance");
  const [days, setDays] = useState("0");
  const [minSubs, setMinSubs] = useState("");
  const [maxSubs, setMaxSubs] = useState("");
  const [hits, setHits] = useState<ChannelHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("matches");

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?${new URLSearchParams({ q, order, days })}`);
      const text = await res.text();
      let body: { error?: string; hits?: ChannelHit[] };
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`The server returned status ${res.status} with no readable response. Check the terminal running npm run dev for the error.`);
      }
      if (!res.ok || !body.hits) throw new Error(body.error ?? "Search failed.");
      setHits(body.hits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    if (!hits) return [];
    const lo = minSubs ? Number(minSubs) : 0;
    const hi = maxSubs ? Number(maxSubs) : Infinity;
    const val = (h: ChannelHit) =>
      sort === "matches" ? h.matches
      : sort === "subs" ? h.channel.subs ?? -1
      : sort === "views" ? h.channel.views
      : sort === "videoCount" ? h.channel.videoCount
      : h.channel.views / Math.max(h.channel.videoCount, 1);
    return hits
      .filter((h) => h.channel.subs == null || (h.channel.subs >= lo && h.channel.subs <= hi))
      .sort((a, b) => val(b) - val(a));
  }, [hits, minSubs, maxSubs, sort]);

  return (
    <>
      <h1>Which channels cover this topic, and how big are they?</h1>
      <form onSubmit={run} className="search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keyword, e.g. ai automation for agencies" aria-label="Keyword" autoFocus />
        <button disabled={loading}>{loading ? "Searching" : "Find channels"}</button>
        <div className="opts">
          <label>Rank videos by
            <select value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="relevance">Relevance</option>
              <option value="viewCount">Views</option>
              <option value="date">Newest</option>
            </select>
          </label>
          <label>Published
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="0">Any time</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </label>
          <label>Subscribers from
            <input className="num" inputMode="numeric" value={minSubs} onChange={(e) => setMinSubs(e.target.value.replace(/\D/g, ""))} placeholder="0" />
          </label>
          <label>to
            <input className="num" inputMode="numeric" value={maxSubs} onChange={(e) => setMaxSubs(e.target.value.replace(/\D/g, ""))} placeholder="no limit" />
          </label>
        </div>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {!hits && !error && <p className="empty">Search a keyword to see the channels behind the top videos for it.</p>}
      {hits && rows.length === 0 && <p className="empty">No channels match these filters. Widen the subscriber range or try another keyword.</p>}

      {rows.length > 0 && (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                {COLS.map((c) => (
                  <th key={c.key} className="r">
                    <button className={sort === c.key ? "sorted" : ""} onClick={() => setSort(c.key)} aria-pressed={sort === c.key}>{c.label}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.channel.id}>
                  <td>
                    <Link href={`/channel/${h.channel.id}`} className="chan">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {h.channel.thumb ? <img src={h.channel.thumb} alt="" width={36} height={36} /> : <span className="ph" />}
                      <span>
                        <strong>{h.channel.title}</strong>
                        <small>{h.sampleTitles[0]}</small>
                      </span>
                    </Link>
                  </td>
                  <td className="r">{h.matches}</td>
                  <td className="r">{f(h.channel.subs)}</td>
                  <td className="r">{f(h.channel.views)}</td>
                  <td className="r">{h.channel.videoCount}</td>
                  <td className="r">{f(Math.round(h.channel.views / Math.max(h.channel.videoCount, 1)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
