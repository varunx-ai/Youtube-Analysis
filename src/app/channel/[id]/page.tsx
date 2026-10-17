import Link from "next/link";
import { notFound } from "next/navigation";
import OutlierStrip from "../../../components/OutlierStrip";
import { analyse, dur, fmt, OUTLIER_MULTIPLE, pct } from "../../../lib/metrics";
import { loadChannel } from "../../../lib/youtube";
import { getVideoSnapshots } from "../../../lib/db";

export const dynamic = "force-dynamic";

export default async function ChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data: Awaited<ReturnType<typeof loadChannel>>;
  try {
    data = await loadChannel(decodeURIComponent(id));
  } catch (e) {
    return (
      <>
        <p><Link href="/channels">Back to channel search</Link></p>
        <p className="error" role="alert">{e instanceof Error ? e.message : "Could not load this channel."}</p>
      </>
    );
  }
  if (!data) notFound();

  const { channel, videos } = data;
  const a = analyse(channel, videos);
  const best = [...a.scored].sort((x, y) => y.video.views - x.video.views).slice(0, 10);
  const tracked = videos.map(v => ({ video: v, history: getVideoSnapshots(v.id) })).filter(x => x.history.length >= 2);

  const stats: [string, string, string?][] = [
    ["Subscribers", fmt(channel.subs)],
    ["Median views", fmt(Math.round(a.medianViews)), `across the last ${a.sampleSize} videos`],
    ["Median views vs. subscribers", a.medianToSubs == null ? "n/a" : pct(a.medianToSubs), "how much of the audience shows up"],
    ["Likes per view", pct(a.likeRate)],
    ["Comments per view", pct(a.commentRate)],
    ["Uploads per month", a.uploadsPerMonth.toFixed(1), a.daysSinceLast != null ? `last one ${a.daysSinceLast} days ago` : undefined],
  ];

  return (
    <>
      <p className="back"><Link href="/channels">Back to channel search</Link></p>
      <header className="chead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {channel.thumb ? <img src={channel.thumb} alt="" width={56} height={56} /> : <span className="ph big" />}
        <div>
          <h1>{channel.title}</h1>
          <p className="sub">
            {channel.handle ?? ""}{channel.country ? `  ${channel.country}` : ""}
            {!channel.id.startsWith("DEMO_") && <> <a href={`https://www.youtube.com/channel/${channel.id}`} target="_blank" rel="noreferrer">Open on YouTube</a></>}
          </p>
        </div>
      </header>

      <dl className="stats">
        {stats.map(([k, v, note]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd>{note && <small>{note}</small>}</div>
        ))}
      </dl>

      <section>
        <h2>What beat the norm</h2>
        <p className="lede">
          {a.outliers.length > 0
            ? `${a.outliers.length} of ${a.sampleSize} videos got at least ${OUTLIER_MULTIPLE}x this channel's median views. These show what the audience came for.`
            : a.sampleSize < 10
              ? "Too few videos to tell what stands out."
              : `No video reached ${OUTLIER_MULTIPLE}x this channel's median, so performance here is steady rather than hit-driven.`}
        </p>
        <OutlierStrip scored={a.scored} />
        {a.outliers.length > 0 && (
          <div className="scroll">
            <table>
              <thead><tr><th>Video</th><th className="r">Views</th><th className="r">Times median</th><th className="r">Length</th></tr></thead>
              <tbody>
                {a.outliers.map((s) => (
                  <tr key={s.video.id}>
                    <td>{s.video.title}</td>
                    <td className="r">{fmt(s.video.views)}</td>
                    <td className="r hot">{s.multiple.toFixed(1)}x</td>
                    <td className="r">{dur(s.video.durationSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="two">
        <div>
          <h2>Length</h2>
          <table>
            <thead><tr><th>Format</th><th className="r">Videos</th><th className="r">Median views</th></tr></thead>
            <tbody>{a.formats.map((r) => (<tr key={r.label}><td>{r.label}</td><td className="r">{r.n}</td><td className="r">{fmt(Math.round(r.medianViews))}</td></tr>))}</tbody>
          </table>
        </div>
        <div>
          <h2>Title patterns</h2>
          {a.titleLifts.length === 0 ? <p className="empty">Not enough variety in titles to compare.</p> : (
            <table>
              <thead><tr><th>Pattern</th><th className="r">Videos</th><th className="r">Median views vs. without</th></tr></thead>
              <tbody>{a.titleLifts.map((l) => (<tr key={l.label}><td>{l.label}</td><td className="r">{l.withN}</td><td className={`r ${l.lift >= 1.25 ? "hot" : ""}`}>{l.lift.toFixed(2)}x</td></tr>))}</tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2>Historical tracking</h2>
        <p className="lede">Every refresh now preserves a time-stamped snapshot instead of overwriting the previous performance. Once this channel is refreshed across multiple days, this becomes the basis for true view-velocity and momentum analysis.</p>
        {tracked.length === 0 ? <p className="empty">Tracking starts with the first refresh. Refresh this channel on future days to build history.</p> : (
          <div className="scroll"><table><thead><tr><th>Video</th><th className="r">Snapshots</th><th className="r">Views now</th><th className="r">First recorded</th><th className="r">Views gained</th></tr></thead><tbody>
            {tracked.sort((x,y)=>y.history.length-x.history.length).slice(0,20).map(({video,history})=>{const first=history[0], last=history[history.length-1]; return <tr key={video.id}><td>{video.title}</td><td className="r">{history.length}</td><td className="r">{fmt(last.views)}</td><td className="r">{new Date(first.capturedAt).toLocaleDateString("en",{month:"short",day:"numeric"})}</td><td className="r hot">{fmt(Math.max(0,last.views-first.views))}</td></tr>})}
          </tbody></table></div>
        )}
      </section>

      <section>
        <h2>Top 10 videos by views</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Video</th><th className="r">Views</th><th className="r">Likes</th><th className="r">Comments</th><th className="r">Published</th></tr></thead>
            <tbody>
              {best.map((s) => (
                <tr key={s.video.id}>
                  <td>{s.video.title}</td>
                  <td className="r">{fmt(s.video.views)}</td>
                  <td className="r">{fmt(s.video.likes)}</td>
                  <td className="r">{fmt(s.video.comments)}</td>
                  <td className="r">{new Date(s.video.publishedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
