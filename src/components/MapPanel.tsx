"use client";

import dynamic from "next/dynamic";
import { useId, useState } from "react";
import type { OverlayData } from "@/lib/ee/imagery";

// MapLibre is large: load it only when the map is shown, never on the server.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" aria-hidden />,
});

/** Map with a fixed height (no layout shift), occurrence-overlay toggle and legend. */
export function MapPanel({
  lat,
  lng,
  radiusM,
  interactive,
  overlay,
  overlayPending,
  onMove,
  height = 380,
}: {
  lat: number;
  lng: number;
  radiusM: number;
  interactive: boolean;
  overlay: OverlayData | null;
  overlayPending: boolean;
  onMove?: (lat: number, lng: number) => void;
  height?: number;
}) {
  const [show, setShow] = useState(true);
  const toggleId = useId();
  return (
    <section aria-label="Map" className="section rounded-lg border border-line bg-background p-3 sm:p-4">
      <div className="relative overflow-hidden rounded-md border border-line" style={{ height }}>
        <MapView
          lat={lat}
          lng={lng}
          radiusM={radiusM}
          interactive={interactive}
          overlay={overlay ? { tileUrl: overlay.tileUrl } : null}
          showOverlay={show}
          onMove={onMove}
          printable={!interactive}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <input id={toggleId} type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} disabled={!overlay} className="h-4 w-4" />
          <label htmlFor={toggleId}>
            Show water-occurrence overlay{" "}
            {!overlay && <span className="text-muted">{overlayPending ? "(loading…)" : "(unavailable)"}</span>}
          </label>
        </div>
        {overlay && show && (
          <div className="flex items-center gap-2" aria-label="Overlay legend">
            <span className="text-muted">rarely water</span>
            <span
              aria-hidden
              className="inline-block h-3 w-28 rounded-sm border border-line"
              style={{ background: `linear-gradient(90deg, ${overlay.legend.palette.join(",")})` }}
            />
            <span className="text-muted">always water</span>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        {interactive ? "Click the map, drag the pin, or use the arrow keys on the pin to analyse a different spot. " : ""}
        White circle: the analysed zone. {overlay?.legend.label ?? ""}
      </p>
    </section>
  );
}
