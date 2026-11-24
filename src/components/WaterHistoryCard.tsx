"use client";

import type { WaterHistoryData } from "@/lib/ee/water";

const W = 760;
const H = 150;
const M = { top: 8, right: 8, bottom: 26, left: 40 };

const CLASS_TEXT = { never: "never water", permanent: "mostly permanent water", seasonal: "mostly seasonal water", mixed: "a mix of permanent and seasonal water" } as const;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

/** JRC Global Surface Water backbone: was it ever water, how often, and the year-by-year water share. */
export function WaterHistoryCard({ data }: { data: WaterHistoryData }) {
  const s = data.summary;
  const yearly = data.yearly;
  const first = yearly[0]?.year ?? 1984;
  const last = yearly[yearly.length - 1]?.year ?? 2021;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const bw = plotW / yearly.length;
  const x = (yr: number) => M.left + (yr - first) * bw;
  const y = (v: number) => M.top + plotH * (1 - v);
  const gap = new Set(s.noDataYears);
  const ticks: number[] = [];
  for (let t = Math.ceil(first / 5) * 5; t <= last; t += 5) ticks.push(t);

  return (
    <div>
      <p className="text-sm" data-testid="water-headline">
        {s.everWater ? (
          <>
            Satellite records show water in this zone in <strong>{s.yearsWithWater}</strong> of <strong>{s.yearsObserved}</strong> observed years
            {s.firstWaterYear && s.lastWaterYear ? ` (${s.firstWaterYear} to ${s.lastWaterYear})` : ""}, classed as {CLASS_TEXT[s.classification]}.
          </>
        ) : (
          <>
            <strong>No water</strong> was detected in this zone in any of the <strong>{s.yearsObserved}</strong> observed years ({first} to {last}).
          </>
        )}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Ever water?" value={s.everWater ? "Yes" : "No"} hint={`${Math.round(data.gsw.fractionEverWater * 100)}% of zone pixels, ever`} />
        <Stat label="Peak water share" value={`${Math.round(s.peakWaterFraction * 100)}%`} hint={s.peakYear ? `in ${s.peakYear}` : undefined} />
        <Stat label="Max occurrence" value={`${Math.round(data.gsw.occurrenceMax)}%`} hint="of valid observations" />
        <Stat
          label="Nearest current water"
          value={s.distanceToCurrentWaterM === null ? `> ${data.distanceSearchRadiusM / 1000} km` : s.distanceToCurrentWaterM === 0 ? "In zone" : `${Math.round(s.distanceToCurrentWaterM)} m`}
          hint="last 5 JRC years"
        />
      </dl>

      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="wh-title" className="mt-4 h-auto w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <title id="wh-title">Share of the zone that was water each year, {first} to {last}</title>
        <defs>
          <pattern id="wgap" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--panel)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" strokeWidth="1.5" />
          </pattern>
        </defs>
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={M.left} x2={M.left + plotW} y1={y(g)} y2={y(g)} stroke="var(--line)" />
            <text x={M.left - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(g * 100)}%</text>
          </g>
        ))}
        {yearly.map((v) =>
          gap.has(v.year) ? (
            <rect key={v.year} x={x(v.year)} y={M.top} width={bw} height={plotH} fill="url(#wgap)">
              <title>{`${v.year}: not enough valid satellite data`}</title>
            </rect>
          ) : (
            <g key={v.year}>
              <title>{`${v.year}: ${Math.round(v.waterFraction * 100)}% water (${Math.round(v.permanentFraction * 100)}% permanent, ${Math.round(v.seasonalFraction * 100)}% seasonal)`}</title>
              <rect x={x(v.year)} y={y(v.permanentFraction)} width={bw + 0.3} height={plotH * v.permanentFraction} fill="var(--c-water)" />
              <rect x={x(v.year)} y={y(v.permanentFraction + v.seasonalFraction)} width={bw + 0.3} height={plotH * v.seasonalFraction} fill="var(--c-water)" opacity="0.45" />
            </g>
          ),
        )}
        {ticks.map((t) => (
          <text key={t} x={x(t) + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{t}</text>
        ))}
      </svg>
      <p className="mt-1 text-xs text-muted">
        Dark blue: permanent water. Light blue: seasonal water. Hatched: too little valid data ({s.noDataYears.length} year{s.noDataYears.length === 1 ? "" : "s"}). Source:{" "}
        {data.dataset.occurrence.replace("/GlobalSurfaceWater", "")} (JRC, 1984 to 2021; later years come from the land-cover timeline only).
      </p>
    </div>
  );
}
