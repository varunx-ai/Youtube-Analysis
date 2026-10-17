import type { Scored } from "../lib/metrics";

// Every recent video as a dot: left to right is publish date, height is views as a multiple of the channel's median.
export default function OutlierStrip({ scored }: { scored: Scored[] }) {
  const W = 960, H = 280, L = 44, R = 12, T = 12, B = 28;
  const pts = scored.filter((s) => s.multiple > 0);
  if (pts.length < 2) return null;

  const times = pts.map((s) => new Date(s.video.publishedAt).getTime());
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const maxLog = Math.max(Math.log10(Math.max(...pts.map((s) => s.multiple))), 1);
  const minLog = -1;
  const x = (t: number) => L + ((t - t0) / Math.max(t1 - t0, 1)) * (W - L - R);
  const y = (m: number) => T + (1 - (Math.log10(Math.max(m, 0.1)) - minLog) / (maxLog - minLog)) * (H - T - B);
  const ticks = [0.1, 0.3, 1, 3, 10, 30, 100].filter((m) => Math.log10(m) <= maxLog + 0.05);
  const month = (t: number) => new Date(t).toLocaleDateString("en", { month: "short", year: "2-digit" });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Views of each recent video as a multiple of the channel median, over time" className="strip">
      {ticks.map((m) => (
        <g key={m}>
          <line x1={L} x2={W - R} y1={y(m)} y2={y(m)} className={m === 1 ? "base" : "grid"} />
          <text x={L - 8} y={y(m) + 4} textAnchor="end">{m}x</text>
        </g>
      ))}
      <text x={L} y={H - 8}>{month(t0)}</text>
      <text x={W - R} y={H - 8} textAnchor="end">{month(t1)}</text>
      {pts.map((s) => (
        <circle key={s.video.id} cx={x(new Date(s.video.publishedAt).getTime())} cy={y(s.multiple)} r={s.outlier ? 6 : 3.5} className={s.outlier ? "dot hot" : "dot"}>
          <title>{`${s.video.title}\n${s.video.views.toLocaleString()} views, ${s.multiple.toFixed(1)}x median`}</title>
        </circle>
      ))}
    </svg>
  );
}
