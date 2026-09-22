"use client";

import { useEffect, useId, useRef, useState } from "react";

type Point = { year: number; median: number; sales: number };
type Series = { key: "a" | "b"; name: string; points: Point[] };

const PAD = { top: 24, right: 84, bottom: 36, left: 60 };
const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;

/**
 * Price per m² over the years, two series at most (the parcel's section in --chart-a, the commune in --chart-b).
 * Plain SVG, no chart library: 2px lines, 8px markers with a surface ring, direct labels on the last point,
 * crosshair + tooltip on hover/focus, and the numbers in a table for screen readers and print.
 */
export default function PriceChart({ title, series }: { title: string; series: Series[] }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at the container's real width so the 11–12px labels stay 11–12px on a phone (no viewBox shrinking).
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 230 : 300;
  const shown = series.filter((s) => s.points.length >= 2);
  const years = [...new Set(shown.flatMap((s) => s.points.map((p) => p.year)))].sort((a, b) => a - b);
  if (!shown.length || years.length < 2) return null;

  const values = shown.flatMap((s) => s.points.map((p) => p.median));
  const span = Math.max(...values) - Math.min(...values) || 1000;
  // Round ticks: the smallest step that gives at most 4 intervals over the padded range.
  const step = [100, 200, 250, 500, 1000, 2000, 5000].find((c) => (span * 1.5) / c <= 4) ?? 10000;
  const lo = Math.floor((Math.min(...values) - span * 0.25) / step) * step;
  const hi = Math.ceil((Math.max(...values) + span * 0.25) / step) * step;
  const x = (year: number) => PAD.left + ((year - years[0]) / (years[years.length - 1] - years[0])) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + step * i);
  const path = (pts: Point[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${y(p.median).toFixed(1)}`).join(" ");
  const first = shown[0];
  const area = `${path(first.points)} L${x(first.points[first.points.length - 1].year)},${H - PAD.bottom} L${x(first.points[0].year)},${H - PAD.bottom} Z`;
  const color = (k: Series["key"]) => `var(--chart-${k})`;
  const at = hover != null ? years[hover] : null;
  // Direct labels on the last point, nudged apart when the two series end close together.
  const ends = shown.map((s) => ({ s, p: s.points[s.points.length - 1] })).sort((a, b) => y(a.p.median) - y(b.p.median));
  const labelY = ends.map((e) => y(e.p.median));
  if (labelY.length === 2 && labelY[1] - labelY[0] < 30) { const mid = (labelY[0] + labelY[1]) / 2; labelY[0] = mid - 15; labelY[1] = mid + 15; }

  return (
    <figure className="border-2 border-ink bg-surface p-4 shadow-[5px_5px_0_0_var(--fg)] sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-display text-xl font-bold tracking-[-0.02em]">{title}</span>
        <span className="flex flex-wrap gap-4 font-mono text-xs uppercase tracking-wide text-fg-2">
          {shown.map((s) => (
            <span key={s.key} className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-0.5 w-5 rounded" style={{ background: color(s.key) }} />
              {s.name}
            </span>
          ))}
        </span>
      </figcaption>

      <div ref={wrap} className="relative mt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-labelledby={`${id}-desc`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            let best = 0;
            years.forEach((yr, i) => { if (Math.abs(x(yr) - px) < Math.abs(x(years[best]) - px)) best = i; });
            setHover(best);
          }}
        >
          <desc id={`${id}-desc`}>
            {title}. {shown.map((s) => `${s.name} : ${s.points.map((p) => `${p.year} ${eur(p.median)}`).join(", ")}`).join(". ")}.
          </desc>
          <defs>
            <linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color(first.key)} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color(first.key)} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--rule)" />
              <text x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-fg-2 font-mono text-[11px]">
                {Math.round(t).toLocaleString("fr-FR")}
              </text>
            </g>
          ))}
          {years.map((yr) => (
            <text key={yr} x={x(yr)} y={H - PAD.bottom + 22} textAnchor="middle" className="fill-fg-2 font-mono text-[11px]">{yr}</text>
          ))}
          <path d={area} fill={`url(#${id}-area)`} />
          {at != null && <line x1={x(at)} x2={x(at)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--fg)" strokeDasharray="3 4" strokeOpacity="0.5" />}
          {shown.map((s) => (
            <g key={s.key}>
              <path d={path(s.points)} fill="none" stroke={color(s.key)} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p) => (
                <circle key={p.year} cx={x(p.year)} cy={y(p.median)} r={at === p.year ? 6 : 4} fill={color(s.key)} stroke="var(--surface)" strokeWidth="2" />
              ))}
            </g>
          ))}
          {ends.map((e, i) => (
            <text key={e.s.key} x={x(e.p.year) + 12} y={labelY[i]} dy="0.32em" className="fill-fg font-mono text-[12px] font-bold">
              {eur(e.p.median)}
            </text>
          ))}
          {/* Keyboard access: one focusable hit area per year. */}
          {years.map((yr, i) => (
            <rect
              key={yr}
              x={x(yr) - 24}
              y={PAD.top}
              width={48}
              height={H - PAD.top - PAD.bottom}
              fill="transparent"
              tabIndex={0}
              aria-label={`${yr} : ${shown.map((s) => { const p = s.points.find((q) => q.year === yr); return `${s.name} ${p ? eur(p.median) : "pas de donnée"}`; }).join(", ")}`}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="outline-none focus-visible:stroke-[var(--focus)] focus-visible:stroke-2"
            />
          ))}
        </svg>

        {at != null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-44 border-2 border-ink bg-bg px-3 py-2 text-sm shadow-[3px_3px_0_0_var(--fg)]"
            style={{ left: `${(x(at) / W) * 100}%`, transform: `translateX(${x(at) > W / 2 ? "calc(-100% - 12px)" : "12px"})` }}
          >
            <p className="font-mono text-xs font-bold">{at}</p>
            {shown.map((s) => {
              const p = s.points.find((q) => q.year === at);
              return (
                <p key={s.key} className="mt-1 flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-fg-2">
                    <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: color(s.key) }} />
                    {s.name}
                  </span>
                  <span className="font-mono font-bold">
                    {p ? eur(p.median) : "—"}
                    {p && <span className="ml-1.5 font-normal text-fg-2">· {p.sales} ventes</span>}
                  </span>
                </p>
              );
            })}
          </div>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-fg-2">Voir les données</summary>
        <table className="mt-3 w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-fg font-mono text-xs uppercase text-fg-2">
              <th className="py-2 pr-4 font-bold">Année</th>
              {shown.map((s) => <th key={s.key} className="py-2 pr-4 font-bold">{s.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {years.map((yr) => (
              <tr key={yr} className="border-b border-rule">
                <td className="py-2 pr-4 font-mono">{yr}</td>
                {shown.map((s) => {
                  const p = s.points.find((q) => q.year === yr);
                  return <td key={s.key} className="py-2 pr-4 font-mono">{p ? `${eur(p.median)} (${p.sales} ventes)` : "—"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
