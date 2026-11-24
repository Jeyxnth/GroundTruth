"use client";

import { useInView } from "@/lib/client/useInView";
import type { ElevationData } from "@/lib/ee/elevation";

const m = (v: number | null, d = 1) => (v === null ? "not available" : `${v.toFixed(d)} m`);

/** How much lower (or higher) the zone sits than the land around it, within 1 km. */
export function ElevationCard({ data }: { data: ElevationData }) {
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: "0px 0px -12% 0px" });
  if (!data.available) {
    return (
      <div role="note" className="rounded-lg border border-line bg-panel p-4">
        <p className="font-medium">Ground height is not available for this point.</p>
        <p className="mt-1 text-base text-muted">{data.unavailableReason}</p>
      </div>
    );
  }
  const rel = data.relativeElevationM ?? 0;
  const lo = data.surroundingsP10M ?? 0;
  const hi = data.surroundingsP90M ?? 1;
  const zone = data.zoneMeanM ?? lo;
  const span = Math.max(hi - lo, 1);
  const pos = Math.min(1, Math.max(0, (zone - lo) / span));
  const km = data.surroundingsRadiusM / 1000;

  return (
    <div>
      <p className="text-lg leading-snug" data-testid="elevation-headline">
        {rel < -0.05 ? (
          <>
            The zone sits <strong>{Math.abs(rel).toFixed(1)} m below</strong> the land around it within {km} km
            {data.isLocalDepression ? ", in one of the lowest spots nearby." : "."}
          </>
        ) : rel > 0.05 ? (
          <>
            The zone sits <strong>{rel.toFixed(1)} m above</strong> the land around it within {km} km, so water runs away from it.
          </>
        ) : (
          <>The zone is level with the land around it within {km} km.</>
        )}
      </p>

      <div className="mt-5" ref={ref}>
        <div className="relative h-3 rounded-full bg-panel" aria-hidden>
          <div className="absolute top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-sm bg-[var(--band-high)]" style={{ left: `calc(${(inView ? pos : 0) * 100}% - 3px)`, transition: "left 1100ms cubic-bezier(0.22,1,0.36,1)" }} />
        </div>
        <div className="mt-1.5 flex justify-between text-sm text-muted">
          <span>lowest nearby: {m(data.surroundingsP10M, 0)}</span>
          <span>highest nearby: {m(data.surroundingsP90M, 0)}</span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
        {[
          ["Zone average", m(data.zoneMeanM)],
          ["Land around it", m(data.surroundingsMeanM)],
          ["Difference", m(data.relativeElevationM)],
          ["Nearby ground lower than the zone", data.surroundingsLowerShare === null ? "not available" : `${Math.round(data.surroundingsLowerShare * 100)}%`],
        ].map(([k, v]) => (
          <div key={k} className="border-t border-line pt-2">
            <dt className="text-base text-muted">{k}</dt>
            <dd className="text-xl font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-2">
        <summary className="text-base font-medium text-accent">Source</summary>
        <p className="pb-2 text-base text-muted">
          {data.dataset === "COPERNICUS/DEM/GLO30" ? "Copernicus DEM GLO-30 (30 m squares)" : "SRTM (30 m squares, backup source)"}. The land around the zone is the ring between the zone and {km} km out.
        </p>
      </details>
    </div>
  );
}
