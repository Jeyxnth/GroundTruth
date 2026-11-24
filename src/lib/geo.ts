/** Approximate bounding box of India (incl. island territories). Used only for a courtesy note. */
export const INDIA_BBOX = { minLat: 6.4, maxLat: 37.2, minLng: 68.0, maxLng: 97.5 } as const;

export const MIN_RADIUS_M = 50;
export const MAX_RADIUS_M = 500;
export const DEFAULT_RADIUS_M = 150;
export const SURROUNDINGS_RADIUS_M = 1000;

export function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

export function isWithinIndiaBounds(lat: number, lng: number): boolean {
  return (
    lat >= INDIA_BBOX.minLat &&
    lat <= INDIA_BBOX.maxLat &&
    lng >= INDIA_BBOX.minLng &&
    lng <= INDIA_BBOX.maxLng
  );
}

export const OUTSIDE_INDIA_NOTE =
  "This point appears to be outside India. The analysis still runs, but GroundTruth is tuned and validated for Indian cities.";

export function zoneNotes(lat: number, lng: number): string[] {
  return isWithinIndiaBounds(lat, lng) ? [] : [OUTSIDE_INDIA_NOTE];
}
