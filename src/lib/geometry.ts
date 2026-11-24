/** Small geometry helpers for the map. Pure, so they can be unit-tested. */

const EARTH_RADIUS_M = 6_371_008.8;

export interface LngLat {
  lng: number;
  lat: number;
}

/** Closed GeoJSON polygon approximating a circle of `radiusM` metres around a point (great-circle destination points). */
export interface PolygonFeature {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
}

export function circlePolygon(lat: number, lng: number, radiusM: number, steps = 72): PolygonFeature {
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const δ = radiusM / EARTH_RADIUS_M;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const θ = (2 * Math.PI * i) / steps;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
    ring.push([(((λ2 * 180) / Math.PI + 540) % 360) - 180, (φ2 * 180) / Math.PI]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

/** Haversine distance in metres. */
export function distanceM(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Round to 4 decimals (the same precision the API uses for cache keys). */
export const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/** Stable, shareable URL for a zone. */
export function zoneUrl(path: "/analyze" | "/report", z: { lat: number; lng: number; radiusM?: number; label?: string | null }): string {
  const p = new URLSearchParams({ lat: String(round4(z.lat)), lng: String(round4(z.lng)) });
  if (z.radiusM && z.radiusM !== 150) p.set("radius", String(z.radiusM));
  if (z.label) p.set("q", z.label.slice(0, 200));
  return `${path}?${p.toString()}`;
}
