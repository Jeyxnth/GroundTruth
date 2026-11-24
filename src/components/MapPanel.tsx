"use client";

import dynamic from "next/dynamic";
import { useId, useState } from "react";
import type { OverlayData } from "@/lib/ee/imagery";
import { ENTRY } from "@/lib/copy";

// MapLibre is large: load it only when the map is shown, never on the server.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" aria-hidden />,
});

/** Map with a fixed height (no layout shift), overlay toggle and legend. */
export function MapPanel({
  lat,
  lng,
  radiusM,
  interactive,
  overlay,
  overlayPending,
  onMove,
  height = 380,
  zoom,
  pinVisible = true,
  helper,
}: {
  lat: number;
  lng: number;
  radiusM: number;
  interactive: boolean;
  overlay: OverlayData | null;
  overlayPending: boolean;
  onMove?: (lat: number, lng: number) => void;
  height?: number;
  zoom?: number;
  pinVisible?: boolean;
  helper?: string;
}) {
  const [show, setShow] = useState(true);
  const toggleId = useId();
  const hasOverlay = !!overlay;
  return (
    <div className="section">
      <div className="relative overflow-hidden rounded-lg border border-line" style={{ height }}>
        <MapView
          lat={lat}
          lng={lng}
          radiusM={radiusM}
          interactive={interactive}
          overlay={overlay ? { tileUrl: overlay.tileUrl } : null}
          showOverlay={show}
          onMove={onMove}
          printable={!interactive}
          zoom={zoom}
          pinVisible={pinVisible}
        />
      </div>
      {(hasOverlay || overlayPending) && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4">
          <label htmlFor={toggleId} className="tap -ml-2 cursor-pointer gap-3 px-2 text-base">
            <input id={toggleId} type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} disabled={!hasOverlay} className="h-6 w-6" />
            <span>
              Show where water has been seen{" "}
              {!hasOverlay && <span className="text-muted">(loading…)</span>}
            </span>
          </label>
          {hasOverlay && show && (
            <div className="flex items-center gap-2 text-sm text-muted" aria-label="Map legend">
              <span>seldom</span>
              <span aria-hidden className="inline-block h-3 w-24 rounded-sm border border-line" style={{ background: `linear-gradient(90deg, ${overlay.legend.palette.join(",")})` }} />
              <span>always</span>
            </div>
          )}
        </div>
      )}
      <p className="mt-1 text-sm text-muted">
        {helper ?? (interactive ? ENTRY.mapHelperAnalysis : "")} White circle: the zone that is analysed.
      </p>
    </div>
  );
}
