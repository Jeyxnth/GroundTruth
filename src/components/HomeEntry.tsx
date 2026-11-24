"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPanel } from "@/components/MapPanel";
import { SearchBox } from "@/components/SearchBox";
import { ENTRY, MY_LOCATION_LABEL } from "@/lib/copy";
import { round4, zoneUrl } from "@/lib/geometry";

const INDIA_CENTER = { lat: 22.5, lng: 79.0 };

type Geo = "idle" | "asking" | "denied" | "failed";

/** The three ways in: type a place, use the phone's location (asked only on tap), or drop a pin on a map. */
export function HomeEntry() {
  const router = useRouter();
  const [geo, setGeo] = useState<Geo>("idle");
  const [mapOpen, setMapOpen] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setGeo("failed");
      return;
    }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => router.push(zoneUrl("/analyze", { lat: p.coords.latitude, lng: p.coords.longitude, label: MY_LOCATION_LABEL })),
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "failed"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div>
      <SearchBox onSelect={(p) => router.push(zoneUrl("/analyze", { lat: p.lat, lng: p.lng, label: p.label }))} />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button type="button" className="btn btn-ghost flex-1" onClick={useMyLocation} disabled={geo === "asking"}>
          {geo === "asking" ? "Finding your location…" : ENTRY.useLocation}
        </button>
        <button type="button" className="btn btn-ghost flex-1" onClick={() => setMapOpen((v) => !v)} aria-expanded={mapOpen}>
          {ENTRY.dropPin}
        </button>
      </div>
      <p className="mt-2 text-base text-muted" aria-live="polite">
        {geo === "denied" ? ENTRY.locationDenied : geo === "failed" ? ENTRY.locationFailed : ENTRY.locationExplain}
      </p>

      {mapOpen && (
        <div className="mt-5 fade-in">
          <MapPanel
            lat={pin?.lat ?? INDIA_CENTER.lat}
            lng={pin?.lng ?? INDIA_CENTER.lng}
            radiusM={150}
            interactive
            overlay={null}
            overlayPending={false}
            zoom={4.2}
            pinVisible={!!pin}
            height={340}
            helper={ENTRY.mapHelperHome}
            onMove={(lat, lng) => setPin({ lat: round4(lat), lng: round4(lng) })}
          />
          <button
            type="button"
            className="btn btn-primary mt-3 w-full sm:w-auto"
            disabled={!pin}
            onClick={() => pin && router.push(zoneUrl("/analyze", { lat: pin.lat, lng: pin.lng }))}
          >
            {ENTRY.analysePin}
          </button>
        </div>
      )}
    </div>
  );
}
