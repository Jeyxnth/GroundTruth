import { ApiError } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { round4 } from "@/lib/geo";

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  type: string | null;
  /** [south, north, west, east] as returned by Nominatim, or null. */
  boundingBox: [number, number, number, number] | null;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
/** Nominatim policy: at most 1 request per second. Requests in this process are serialised with this spacing. */
const MIN_INTERVAL_MS = 1100;
const MAX_QUEUE = 4;

let chain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;
let queued = 0;

/** Serialise outbound calls so this instance never exceeds 1 request/second. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  if (queued >= MAX_QUEUE) {
    throw new ApiError("rate_limited", "Too many search requests at once. Please wait a moment and try again.", 429, true);
  }
  queued++;
  const run = chain.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    try {
      return await fn();
    } finally {
      queued--;
    }
  });
  chain = run.catch(() => undefined);
  return run as Promise<T>;
}

/** "12.9716, 77.5946" style input is treated as a coordinate and never sent to Nominatim. */
export function parseCoordinates(q: string): { lat: number; lng: number } | null {
  const m = q.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: round4(lat), lng: round4(lng) };
}

function userAgent(): string {
  const contact = getEnv().NOMINATIM_CONTACT;
  return contact ? `GroundTruth/0.1 (${contact})` : "GroundTruth/0.1 (land-screening hackathon app)";
}

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  boundingbox?: [string, string, string, string];
}

export async function searchNominatim(q: string, country: "in" | "all"): Promise<GeocodeResult[]> {
  const direct = parseCoordinates(q);
  if (direct) {
    return [{ label: `${direct.lat}, ${direct.lng}`, lat: direct.lat, lng: direct.lng, type: "coordinates", boundingBox: null }];
  }

  const url = new URL(NOMINATIM);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");
  if (country === "in") url.searchParams.set("countrycodes", "in");

  const items = await throttled(async () => {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": userAgent(), Accept: "application/json", "Accept-Language": "en" },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ApiError("upstream_error", "The address search service did not respond. Please retry.", 502, true);
    }
    if (res.status === 429 || res.status === 503) {
      throw new ApiError("rate_limited", "The address search service is rate limiting us. Please retry in a few seconds.", 429, true);
    }
    if (!res.ok) throw new ApiError("upstream_error", `The address search service returned an error (${res.status}).`, 502, true);
    return (await res.json()) as NominatimItem[];
  });

  return items.map((i) => {
    const bb = i.boundingbox?.map(Number);
    return {
      label: i.display_name,
      lat: round4(Number(i.lat)),
      lng: round4(Number(i.lon)),
      type: i.type ?? null,
      boundingBox: bb && bb.length === 4 && bb.every(Number.isFinite) ? (bb as [number, number, number, number]) : null,
    };
  });
}
