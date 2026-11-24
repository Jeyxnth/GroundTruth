"use client";

import { CountUp } from "@/components/CountUp";
import { useInView } from "@/lib/client/useInView";
import { useWidth } from "@/lib/client/useWidth";
import type { WaterHistoryData } from "@/lib/ee/water";

const CLASS_TEXT = {
  never: "never water",
  permanent: "mostly permanent water",
  seasonal: "mostly seasonal water",
  mixed: "a mix of permanent and seasonal water",
} as const;

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="border-t border-line pt-2">
      <dt className="text-base text-muted">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-sm text-muted">{hint}</dd>}
    </div>
  );
}

/** The satellite water record: was it ever water, how often, and the year-by-year share of the zone. */
export function WaterHistoryCard({ data }: { data: WaterHistoryData }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const { ref: svgRef, inView } = useInView<SVGSVGElement>({ rootMargin: "0px 0px -12% 0px" });
  const s = data.summary;
  const yearly = data.yearly;
  const first = yearly[0]?.year ?? 1984;
  const last = yearly[yearly.length - 1]?.year ?? 2021;
  const H = 140;
  const M = { top: 8, right: 6, bottom: 26, left: 40 };
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const bw = plotW / yearly.length;
  const x = (yr: number) => M.left + (yr - first) * bw;
  const y = (v: number) => M.top + plotH * (1 - v);
  const gap = new Set(s.noDataYears);
  const step = width < 420 ? 10 : 5;
  const ticks: number[] = [];
  for (let t = Math.ceil(first / step) * step; t <= last; t += step) ticks.push(t);

  return (
    <div ref={ref}>
      <p className="text-lg leading-snug" data-testid="water-headline">
        {s.everWater ? (
          <>
            Satellite records show water in this zone in <strong>{s.yearsWithWater}</strong> of <strong>{s.yearsObserved}</strong> years
            {s.firstWaterYear && s.lastWaterYear ? ` (${s.firstWaterYear} to ${s.lastWaterYear})` : ""}: {CLASS_TEXT[s.classification]}.
          </>
        ) : (
          <>
            <strong>No water</strong> was detected in this zone in any of the <strong>{s.yearsObserved}</strong> years checked ({first} to {last}).
          </>
        )}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
        <Stat label="Ever water?" value={s.everWater ? "Yes" : "No"} hint={`${Math.round(data.gsw.fractionEverWater * 100)}% of the zone, at some point`} />
        <Stat label="Wettest year" value={<CountUp value={Math.round(s.peakWaterFraction * 100)} suffix="%" />} hint={s.peakYear ? `of the zone, in ${s.peakYear}` : undefined} />
        <Stat label="How often it was water" value={<>up to <CountUp value={Math.round(data.gsw.occurrenceMax)} suffix="%" /></>} hint="of the clear images" />
        <Stat
          label="Nearest water today"
          value={s.distanceToCurrentWaterM === null ? `over ${data.distanceSearchRadiusM / 1000} km` : s.distanceToCurrentWaterM === 0 ? "In the zone" : `${Math.round(s.distanceToCurrentWaterM)} m`}
          hint="seen in the last five years"
        />
      </dl>

      <svg ref={svgRef} width={width} height={H} role="img" aria-labelledby="wh-title" className="bars mt-5 block max-w-full" data-inview={inView}>
        <title id="wh-title">
          Share of the zone that was water each year, {first} to {last}
        </title>
        <defs>
          <pattern id="wgap" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--panel)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" strokeWidth="1.5" />
          </pattern>
        </defs>
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={M.left} x2={M.left + plotW} y1={y(g)} y2={y(g)} stroke="var(--line)" />
            <text x={M.left - 6} y={y(g) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        {yearly.map((v, i) =>
          gap.has(v.year) ? (
            <g key={v.year} className="bar" style={{ "--i": i } as React.CSSProperties}>
              <rect x={x(v.year)} y={M.top} width={bw} height={plotH} fill="url(#wgap)">
                <title>{`${v.year}: not enough clear data`}</title>
              </rect>
            </g>
          ) : (
            <g key={v.year} className="bar" style={{ "--i": i } as React.CSSProperties}>
              <title>{`${v.year}: ${Math.round(v.waterFraction * 100)}% water (${Math.round(v.permanentFraction * 100)}% all year, ${Math.round(v.seasonalFraction * 100)}% part of the year)`}</title>
              <rect x={x(v.year)} y={y(v.permanentFraction)} width={bw + 0.3} height={plotH * v.permanentFraction} fill="var(--c-water)" />
              <rect x={x(v.year)} y={y(v.permanentFraction + v.seasonalFraction)} width={bw + 0.3} height={plotH * v.seasonalFraction} fill="var(--c-water)" opacity="0.45" />
            </g>
          ),
        )}
        {ticks.map((t) => (
          <text key={t} x={x(t) + bw / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--muted)" fontFamily="var(--font-geist-mono)">
            {t}
          </text>
        ))}
      </svg>
      <p className="mt-1 text-sm text-muted">
        Dark blue: water all year. Light blue: water for part of the year. Striped: not enough clear data
        {s.noDataYears.length > 0 ? ` (${s.noDataYears.length} year${s.noDataYears.length === 1 ? "" : "s"})` : ""}.
      </p>
      <details className="mt-1">
        <summary className="text-base font-medium text-accent">Source</summary>
        <p className="pb-2 text-base text-muted">
          JRC Global Surface Water, {first} to {last} (European Commission Joint Research Centre and Google). Occurrence is the share of clear observations in which a square held
          water. Later years come only from the land-cover record above.
        </p>
      </details>
    </div>
  );
}
