"use client";

import type { LandcoverData, LandcoverYear } from "@/lib/ee/landcover";
import type { WaterHistoryData } from "@/lib/ee/water";
import type { TransitionResult, Stage } from "@/lib/analysis/transitions";

const W = 820;
const H = 300;
const M = { top: 14, right: 168, bottom: 34, left: 40 };

const STACK: Array<{ key: Stage; label: string; color: string }> = [
  { key: "water", label: "Water", color: "var(--c-water)" },
  { key: "vegetation", label: "Vegetation / wetland", color: "var(--c-veg)" },
  { key: "bare", label: "Bare / filled soil", color: "var(--c-bare)" },
  { key: "built", label: "Built-up", color: "var(--c-built)" },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Push labels apart so none overlap, keeping order. */
function spread(ys: number[], minGap: number, lo: number, hi: number): number[] {
  const out = [...ys];
  for (let i = 1; i < out.length; i++) if (out[i]! - out[i - 1]! < minGap) out[i] = out[i - 1]! + minGap;
  const over = (out[out.length - 1] ?? 0) - hi;
  if (over > 0) for (let i = 0; i < out.length; i++) out[i] = out[i]! - over;
  for (let i = 0; i < out.length; i++) if (out[i]! < lo) out[i] = lo;
  return out;
}

export function TimelineChart({
  landcover,
  water,
  transition,
}: {
  landcover: LandcoverData;
  water: WaterHistoryData | null;
  transition: TransitionResult | null;
}) {
  const years = landcover.years;
  const first = years[0]!.year;
  const last = years[years.length - 1]!.year;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const bw = plotW / years.length;
  const x = (year: number) => M.left + (year - first) * bw;
  const y = (share: number) => M.top + plotH * (1 - share);

  const firstS2 = years.find((v) => v.sensor === "sentinel2")?.year;
  const jrc = new Map((water?.yearly ?? []).map((v) => [v.year, v]));
  const jrcPoints = years
    .filter((v) => jrc.has(v.year) && (jrc.get(v.year)!.observedFraction ?? 0) >= 0.5)
    .map((v) => `${x(v.year) + bw / 2},${y(jrc.get(v.year)!.waterFraction)}`);

  // Direct labels at the right edge, from the latest year with data
  const latest = [...years].reverse().find((v) => v.shares);
  let labels: Array<{ label: string; color: string; y: number; share: number }> = [];
  if (latest?.shares) {
    let acc = 0;
    const raw = STACK.map((s) => {
      const share = latest.shares![s.key];
      const mid = acc + share / 2;
      acc += share;
      return { label: s.label, color: s.color, share, y: y(mid) };
    }).reverse(); // top of chart first
    const ys = spread(raw.map((r) => r.y), 15, M.top + 6, M.top + plotH);
    labels = raw.map((r, i) => ({ ...r, y: ys[i]! }));
  }

  const ticks: number[] = [];
  for (let t = Math.ceil(first / 5) * 5; t <= last; t += 5) ticks.push(t);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby="tl-title tl-desc"
        className="h-auto w-full"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <title id="tl-title">Land cover of the zone by year, {first} to {last}</title>
        <desc id="tl-desc">
          Stacked bars show the share of the zone that is water, vegetation, bare soil and built-up each January to March. Hatched
          years had no cloud-free imagery. {transition?.description ?? ""}
        </desc>
        <defs>
          <pattern id="gap" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--panel)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" strokeWidth="1.5" />
          </pattern>
        </defs>

        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={M.left} x2={M.left + plotW} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth="1" />
            <text x={M.left - 6} y={y(g) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {pct(g)}
            </text>
          </g>
        ))}

        {years.map((v: LandcoverYear) => {
          if (!v.shares) {
            return (
              <rect key={v.year} x={x(v.year)} y={M.top} width={bw} height={plotH} fill="url(#gap)">
                <title>{`${v.year}: no cloud-free imagery (${Math.round(v.validFraction * 100)}% of the zone clear)`}</title>
              </rect>
            );
          }
          let acc = 0;
          return (
            <g key={v.year}>
              <title>
                {`${v.year} (${v.sensor === "sentinel2" ? "Sentinel-2" : "Landsat"}): ` +
                  STACK.map((s) => `${s.label} ${pct(v.shares![s.key])}`).join(", ")}
              </title>
              {STACK.map((s) => {
                const share = v.shares![s.key];
                const rect = <rect key={s.key} x={x(v.year)} y={y(acc + share)} width={bw + 0.4} height={plotH * share} fill={s.color} />;
                acc += share;
                return rect;
              })}
            </g>
          );
        })}

        {jrcPoints.length > 1 && (
          <polyline points={jrcPoints.join(" ")} fill="none" stroke="var(--foreground)" strokeWidth="1.6" strokeDasharray="4 3" />
        )}

        {firstS2 && (
          <g>
            <line x1={x(firstS2)} x2={x(firstS2)} y1={M.top} y2={M.top + plotH} stroke="var(--foreground)" strokeWidth="1" strokeDasharray="2 3" />
            <text x={x(firstS2) + 4} y={M.top + 11} fontSize="10" fill="#fff" style={{ paintOrder: "stroke", stroke: "#0008", strokeWidth: 3 }}>
              Sentinel-2 →
            </text>
            <text x={x(firstS2) - 4} y={M.top + 11} fontSize="10" textAnchor="end" fill="#fff" style={{ paintOrder: "stroke", stroke: "#0008", strokeWidth: 3 }}>
              ← Landsat
            </text>
          </g>
        )}

        {ticks.map((t) => (
          <text key={t} x={x(t) + bw / 2} y={H - 14} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {t}
          </text>
        ))}

        {labels.map((l) => (
          <g key={l.label}>
            <rect x={M.left + plotW + 8} y={l.y - 8} width="10" height="10" fill={l.color} />
            <text x={M.left + plotW + 22} y={l.y + 1} fontSize="11" fill="var(--foreground)">
              {l.label} {pct(l.share)}
            </text>
          </g>
        ))}
        {jrcPoints.length > 1 && (
          <text x={M.left + plotW - 4} y={H - 2} textAnchor="end" fontSize="10" fill="var(--muted)">
            - - dashed line: JRC water share of the zone
          </text>
        )}
      </svg>

      {transition && (
        <p className="mt-3 rounded-md border border-line bg-panel p-3 text-sm" data-testid="transition">
          <span className="font-semibold">Detected change: </span>
          {transition.description}
          {transition.gapYears.length > 0 && (
            <span className="text-muted"> {transition.gapYears.length} year(s) had no cloud-free imagery and are shown hatched, not filled in.</span>
          )}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        Each year is the median of cloud-free {landcover.season.label} images ({firstS2 ? `Landsat before ${firstS2}, Sentinel-2 from ${firstS2}` : "Landsat"}). Method:{" "}
        {landcover.method === "random-forest" ? "Random Forest classifier" : "threshold rules (interim)"}.
      </p>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-accent">Show the data as a table</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Land-cover shares by year</caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Sensor</th>
                {STACK.map((s) => (
                  <th key={s.key} scope="col">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((v) => (
                <tr key={v.year}>
                  <th scope="row">{v.year}</th>
                  <td>{v.sensor ? (v.sensor === "sentinel2" ? "Sentinel-2" : "Landsat") : "no data"}</td>
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
