"use client";

import type { ElevationData } from "@/lib/ee/elevation";

const m = (v: number | null, d = 1) => (v === null ? "n/a" : `${v.toFixed(d)} m`);

/** How much lower (or higher) the zone sits than its surroundings within about 1 km. */
export function ElevationCard({ data }: { data: ElevationData }) {
  if (!data.available) {
    return (
      <div role="note" className="rounded-md border border-line bg-panel p-3 text-sm">
        <p className="font-medium">Elevation is unavailable for this point.</p>
        <p className="mt-1 text-muted">{data.unavailableReason}</p>
      </div>
    );
  }
  const rel = data.relativeElevationM ?? 0;
  const lo = data.surroundingsP10M ?? 0;
  const hi = data.surroundingsP90M ?? 1;
  const zone = data.zoneMeanM ?? lo;
  const span = Math.max(hi - lo, 1);
  const pos = Math.min(1, Math.max(0, (zone - lo) / span));

  return (
    <div>
      <p className="text-sm" data-testid="elevation-headline">
        {rel < -0.05 ? (
          <>
            The zone sits <strong>{Math.abs(rel).toFixed(1)} m below</strong> its surroundings within {data.surroundingsRadiusM / 1000} km
            {data.isLocalDepression ? ", and is among the lowest ground nearby: a local depression." : "."}
          </>
        ) : rel > 0.05 ? (
          <>
            The zone sits <strong>{rel.toFixed(1)} m above</strong> its surroundings within {data.surroundingsRadiusM / 1000} km, so water drains away from it.
          </>
        ) : (
          <>The zone is level with its surroundings within {data.surroundingsRadiusM / 1000} km.</>
        )}
      </p>

      <div className="mt-4">
        <div className="relative h-3 rounded-full bg-panel ring-1 ring-[var(--line)]" aria-hidden>
          <div className="absolute top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-sm bg-[var(--band-high)]" style={{ left: `calc(${pos * 100}% - 3px)` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>lowest 10% nearby: {m(data.surroundingsP10M, 0)}</span>
          <span>highest 10%: {m(data.surroundingsP90M, 0)}</span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Zone average", m(data.zoneMeanM)],
          ["Surroundings average", m(data.surroundingsMeanM)],
          ["Zone minus surroundings", m(data.relativeElevationM)],
          ["Nearby ground lower than zone", data.surroundingsLowerShare === null ? "n/a" : `${Math.round(data.surroundingsLowerShare * 100)}%`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-line bg-panel p-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">
        Source: {data.dataset === "COPERNICUS/DEM/GLO30" ? "Copernicus DEM GLO-30 (30 m)" : "SRTM (30 m, fallback)"}. Surroundings are the ring between the zone and {data.surroundingsRadiusM / 1000} km out.
      </p>
    </div>
  );
}
