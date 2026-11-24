"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { ENTRY } from "@/lib/copy";
import { circlePolygon } from "@/lib/geometry";

export interface MapOverlay {
  tileUrl: string;
}

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const NUDGE_DEG = 0.0003; // about 33 m per arrow-key press

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface State {
  lat: number;
  lng: number;
  radiusM: number;
  pinVisible: boolean;
  overlay: MapOverlay | null;
  showOverlay: boolean;
  onMove?: (lat: number, lng: number) => void;
  interactive: boolean;
}

/** Add the occurrence raster once its tile URL exists, and show or hide it. */
function syncOverlay(map: MapLibreMap, s: Pick<State, "overlay" | "showOverlay">) {
  const { overlay: o, showOverlay: show } = s;
  if (o && !map.getSource("occ")) {
    map.addSource("occ", { type: "raster", tiles: [o.tileUrl], tileSize: 256, maxzoom: 15, attribution: "Water occurrence © EC JRC / Google" });
    map.addLayer({ id: "occ-layer", type: "raster", source: "occ", paint: { "raster-opacity": 0.8, "raster-fade-duration": prefersReducedMotion() ? 0 : 300 } }, "zone-fill");
  }
  if (map.getLayer("occ-layer")) map.setLayoutProperty("occ-layer", "visibility", show ? "visible" : "none");
}

function syncZone(map: MapLibreMap, s: Pick<State, "lat" | "lng" | "radiusM" | "pinVisible">) {
  (map.getSource("zone") as GeoJSONSource | undefined)?.setData(circlePolygon(s.lat, s.lng, s.radiusM));
  for (const id of ["zone-fill", "zone-line"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", s.pinVisible ? "visible" : "none");
}

/**
 * Satellite map (Esri World Imagery) with the analysed zone outline, a draggable pin (44 px hit area), tap-to-move,
 * keyboard nudging and an optional Earth Engine water-occurrence overlay.
 */
export default function MapView({
  lat,
  lng,
  radiusM,
  interactive,
  overlay,
  showOverlay,
  onMove,
  printable = false,
  zoom = 16,
  pinVisible = true,
}: {
  lat: number;
  lng: number;
  radiusM: number;
  interactive: boolean;
  overlay: MapOverlay | null;
  showOverlay: boolean;
  onMove?: (lat: number, lng: number) => void;
  printable?: boolean;
  zoom?: number;
  pinVisible?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const pinElRef = useRef<HTMLDivElement | null>(null);
  const readyRef = useRef(false);
  // Latest props, readable from long-lived map callbacks without re-creating the map
  const latest = useRef<State>({ lat, lng, radiusM, pinVisible, overlay, showOverlay, onMove, interactive });
  useEffect(() => {
    latest.current = { lat, lng, radiusM, pinVisible, overlay, showOverlay, onMove, interactive };
  });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let nudgeTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const ml = await import("maplibre-gl");
      ml.setWorkerUrl("/vendor/maplibre/worker.mjs");
      if (cancelled || !container.current) return;
      const p = latest.current;

      const map = new ml.Map({
        container: container.current,
        center: [p.lng, p.lat],
        zoom,
        maxZoom: 19,
        attributionControl: { compact: true },
        interactive: p.interactive,
        canvasContextAttributes: { preserveDrawingBuffer: printable },
        style: {
          version: 8,
          sources: {
            esri: {
              type: "raster",
              tiles: [ESRI],
              tileSize: 256,
              maxzoom: 19,
              attribution: "Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community",
            },
          },
          layers: [{ id: "esri", type: "raster", source: "esri" }],
        },
      });
      mapRef.current = map;

      if (p.interactive) {
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
      }

      // 44 px transparent hit area around a 22 px visible dot
      const el = document.createElement("div");
      el.style.cssText = "width:44px;height:44px;display:flex;align-items:center;justify-content:center;";
      const dot = document.createElement("div");
      dot.style.cssText = "width:22px;height:22px;border-radius:50%;background:#fff;border:5px solid #b3261e;box-shadow:0 1px 6px rgba(0,0,0,.55);";
      el.appendChild(dot);
      el.style.display = p.pinVisible ? "flex" : "none";
      pinElRef.current = el;
      if (p.interactive) {
        el.tabIndex = 0;
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", ENTRY.pinLabel);
        el.style.cursor = "grab";
        el.addEventListener("keydown", (ev) => {
          const d: Record<string, [number, number]> = { ArrowUp: [NUDGE_DEG, 0], ArrowDown: [-NUDGE_DEG, 0], ArrowLeft: [0, -NUDGE_DEG], ArrowRight: [0, NUDGE_DEG] };
          const delta = d[ev.key];
          if (!delta || !markerRef.current) return;
          ev.preventDefault();
          const cur = markerRef.current.getLngLat();
          markerRef.current.setLngLat([cur.lng + delta[1], cur.lat + delta[0]]);
          clearTimeout(nudgeTimer);
          nudgeTimer = setTimeout(() => {
            const m = markerRef.current?.getLngLat();
            if (m) latest.current.onMove?.(m.lat, m.lng);
          }, 700);
        });
      } else {
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", "Analysed location pin");
      }
      const marker = new ml.Marker({ element: el, draggable: p.interactive }).setLngLat([p.lng, p.lat]).addTo(map);
      markerRef.current = marker;
      marker.on("dragend", () => {
        const m = marker.getLngLat();
        latest.current.onMove?.(m.lat, m.lng);
      });
      if (p.interactive) {
        map.on("click", (ev) => latest.current.onMove?.(ev.lngLat.lat, ev.lngLat.lng));
        map.getCanvas().style.cursor = "crosshair";
      }

      map.on("load", () => {
        const cur = latest.current;
        map.addSource("zone", { type: "geojson", data: circlePolygon(cur.lat, cur.lng, cur.radiusM) });
        map.addLayer({ id: "zone-fill", type: "fill", source: "zone", paint: { "fill-color": "#ffffff", "fill-opacity": 0.1 } });
        map.addLayer({ id: "zone-line", type: "line", source: "zone", paint: { "line-color": "#ffffff", "line-width": 2 } });
        readyRef.current = true;
        container.current?.setAttribute("data-ready", "true"); // lets tests and scripts know the map is interactive
        syncZone(map, cur);
        syncOverlay(map, cur);
      });
    })();

    return () => {
      cancelled = true;
      clearTimeout(nudgeTimer);
      readyRef.current = false;
      markerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; everything else flows through refs and the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep marker, zone outline and camera in sync with the zone.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    markerRef.current?.setLngLat([lng, lat]);
    if (pinElRef.current) pinElRef.current.style.display = pinVisible ? "flex" : "none";
    syncZone(map, { lat, lng, radiusM, pinVisible });
    const c = map.getCenter();
    const moved = Math.abs(c.lat - lat) > 1e-5 || Math.abs(c.lng - lng) > 1e-5;
    if (moved && pinVisible) {
      if (prefersReducedMotion()) map.jumpTo({ center: [lng, lat] });
      else map.easeTo({ center: [lng, lat], duration: 700, easing: (t) => 1 - Math.pow(1 - t, 3) });
    }
  }, [lat, lng, radiusM, pinVisible]);

  // Water-occurrence overlay: add when the tile URL arrives, toggle with the checkbox.
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) syncOverlay(map, latest.current);
  }, [overlay, showOverlay]);

  return <div ref={container} role="region" aria-label="Satellite map of the analysed zone" className="h-full w-full bg-panel" data-testid="map" />;
}
