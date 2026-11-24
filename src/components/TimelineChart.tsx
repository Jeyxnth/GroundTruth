"use client";

import { DATING_NOTE, GAP_NOTE, describeTransition } from "@/lib/copy";
import { useInView } from "@/lib/client/useInView";
import { useWidth } from "@/lib/client/useWidth";
import type { LandcoverData, LandcoverYear } from "@/lib/ee/landcover";
import type { WaterHistoryData } from "@/lib/ee/water";
import type { Stage, TransitionResult } from "@/lib/analysis/transitions";

const STACK: Array<{ key: Stage; label: string; color: string }> = [
  { key: "water", label: "Water", color: "var(--c-water)" },
  { key: "vegetation", label: "Plants", color: "var(--c-veg)" },
  { key: "bare", label: "Bare or filled ground", color: "var(--c-bare)" },
  { key: "built", label: "Buildings", color: "var(--c-built)" },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const sensorName = (s: LandcoverYear["sensor"]) => (s === "sentinel2" ? "Sentinel-2" : s === "landsat" ? "Landsat" : "no data");

/** Push labels apart so none overlap, keeping order. */
function spread(ys: number[], minGap: number, lo: number, hi: number): number[] {
  const out = [...ys];
  for (let i = 1; i < out.length; i++) if (out[i]! - out[i - 1]! < minGap) out[i] = out[i - 1]! + minGap;
  const over = (out[out.length - 1] ?? 0) - hi;
  if (over > 0) for (let i = 0; i < out.length; i++) out[i] = out[i]! - over;
  for (let i = 0; i < out.length; i++) if (out[i]! < lo) out[i] = lo;
  return out;
}

export function TimelineChart({ landcover, water, transition }: { landcover: LandcoverData; water: WaterHistoryData | null; transition: TransitionResult | null }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const { ref: svgRef, inView } = useInView<SVGSVGElement>({ rootMargin: "0px 0px -12% 0px" });
  const wide = width >= 640;
  const years = landcover.years;
  const first = years[0]!.year;
  const last = years[years.length - 1]!.year;
  const H = wide ? 300 : 240;
  const M = { top: 12, right: wide ? 190 : 6, bottom: 28, left: 40 };
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const bw = plotW / years.length;
  const x = (year: number) => M.left + (year - first) * bw;
  const y = (share: number) => M.top + plotH * (1 - share);

  const firstS2 = years.find((v) => v.sensor === "sentinel2")?.year;
  const jrc = new Map((water?.yearly ?? []).map((v) => [v.year, v]));
  const jrcPoints = years
    .filter((v) => jrc.has(v.year) && (jrc.get(v.year)!.observedFraction ?? 0) >= 0.5)
    .map((v) => `${x(v.year) + bw / 2},${y(jrc.get(v.year)!.waterFraction)}`);

  const latest = [...years].reverse().find((v) => v.shares);
  const latestShares = latest?.shares ?? null;
  let labels: Array<{ label: string; color: string; y: number; share: number }> = [];
  if (latestShares && wide) {
    let acc = 0;
    const raw = STACK.map((s) => {
      const share = latestShares[s.key];
      const mid = acc + share / 2;
      acc += share;
      return { label: s.label, color: s.color, share, y: y(mid) };
    }).reverse();
    const ys = spread(raw.map((r) => r.y), 18, M.top + 8, M.top + plotH);
    labels = raw.map((r, i) => ({ ...r, y: ys[i]! }));
  }

  const step = width < 420 ? 10 : 5;
  const ticks: number[] = [];
  for (let t = Math.ceil(first / step) * step; t <= last; t += step) ticks.push(t);
  const gapCount = years.filter((v) => !v.shares).length;
  const bgStroke = { paintOrder: "stroke", stroke: "#0009", strokeWidth: 3 } as const;

  return (
    <div ref={ref}>
      <svg ref={svgRef} width={width} height={H} role="img" aria-labelledby="tl-title tl-desc" className="bars block max-w-full" data-inview={inView}>
        <title id="tl-title">
          What was on the land each year, {first} to {last}
        </title>
        <desc id="tl-desc">
          Stacked bars show the share of the zone that is water, plants, bare or filled ground and buildings each January to March. Striped years have no clear image.{" "}
          {transition ? describeTransition(transition) : ""}
        </desc>
        <defs>
          <pattern id="gap" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--panel)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" strokeWidth="1.5" />
          </pattern>
        </defs>

        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={M.left} x2={M.left + plotW} y1={y(g)} y2={y(g)} stroke="var(--line)" />
            <text x={M.left - 6} y={y(g) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
              {pct(g)}
            </text>
          </g>
        ))}

        {years.map((v, i) => {
          if (!v.shares) {
            return (
              <g key={v.year} className="bar" style={{ "--i": i } as React.CSSProperties}>
                <rect x={x(v.year)} y={M.top} width={bw} height={plotH} fill="url(#gap)">
                  <title>{`${v.year}: no clear image`}</title>
                </rect>
              </g>
            );
          }
          let acc = 0;
          return (
            <g key={v.year} className="bar" style={{ "--i": i } as React.CSSProperties}>
              <title>{`${v.year} (${sensorName(v.sensor)}): ` + STACK.map((s) => `${s.label} ${pct(v.shares![s.key])}`).join(", ")}</title>
              {STACK.map((s) => {
                const share = v.shares![s.key];
                const rect = <rect key={s.key} x={x(v.year)} y={y(acc + share)} width={bw + 0.4} height={plotH * share} fill={s.color} />;
                acc += share;
                return rect;
              })}
            </g>
          );
        })}

        {jrcPoints.length > 1 && <polyline points={jrcPoints.join(" ")} fill="none" stroke="var(--foreground)" strokeWidth="1.6" strokeDasharray="4 3" />}

        {firstS2 && (
          <g>
            <line x1={x(firstS2)} x2={x(firstS2)} y1={M.top} y2={M.top + plotH} stroke="#fff" strokeWidth="1" strokeDasharray="2 3" />
            <text x={x(firstS2) - 4} y={M.top + 13} fontSize="12" fill="#fff" textAnchor="end" style={bgStroke}>
              Finer images start →
            </text>
          </g>
        )}

        {ticks.map((t) => (
          <text key={t} x={x(t) + bw / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--muted)" fontFamily="var(--font-geist-mono)">
            {t}
          </text>
        ))}

        {labels.map((l) => (
          <g key={l.label}>
            <rect x={M.left + plotW + 10} y={l.y - 9} width="11" height="11" fill={l.color} />
            <text x={M.left + plotW + 26} y={l.y + 1} fontSize="13" fill="var(--foreground)">
              {l.label} {pct(l.share)}
            </text>
          </g>
        ))}
      </svg>

      {/* Narrow screens: the same direct labels, set below the chart where there is room to read them. */}
      {!wide && latestShares && (
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-base" aria-label={`Share of the zone in ${latest!.year}`}>
          {STACK.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-3 w-3 shrink-0" style={{ background: s.color }} />
              {s.label} {pct(latestShares[s.key])}
            </li>
          ))}
        </ul>
      )}
      {jrcPoints.length > 1 && <p className="mt-2 text-sm text-muted">Dashed line: the share of the zone that satellite water maps show as water.</p>}

      <p className="mt-3 text-base text-muted" data-testid="dating-note">
        {DATING_NOTE}
        {gapCount > 0 ? ` ${GAP_NOTE(gapCount)}` : ""}
      </p>
      <p className="mt-3 text-sm text-muted">
        Each year uses images from {landcover.season.label.replace(" to ", " to ")}, when skies are clearest. Older images are coarser.
      </p>

      <details className="mt-2">
        <summary className="text-base font-medium text-accent">Sources and the data table</summary>
        <p className="mt-2 text-base text-muted">
          Images before {firstS2 ?? "2017"} are from Landsat (30 m squares). From {firstS2 ?? "2017"} they are from Sentinel-2 (10 m squares, averaged to 30 m for the
          counts). Land type is decided by a computer model trained on Google Dynamic World land maps.
          {landcover.method !== "random-forest" ? " The trained model is not active here, so a simpler rule set was used." : ""}
        </p>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Share of the zone by year</caption>
            <thead>
              <tr>
                <th scope="col" className="py-1.5">Year</th>
                <th scope="col">Images</th>
                {STACK.map((s) => (
                  <th key={s.key} scope="col">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((v) => (
                <tr key={v.year} className="border-t border-line">
                  <th scope="row" className="py-1.5 font-mono font-normal">{v.year}</th>
                  <td>{sensorName(v.sensor)}</td>
                  {STACK.map((s) => (
                    <td key={s.key}>{v.shares ? pct(v.shares[s.key]) : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
