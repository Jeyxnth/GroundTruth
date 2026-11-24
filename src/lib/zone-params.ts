import { zoneQuerySchema } from "@/lib/validation";
import type { Zone } from "@/lib/client/useAnalysis";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Validate page search params with the same schema the API uses. */
export function parseZoneParams(sp: RawSearchParams): { ok: true; zone: Zone } | { ok: false; message: string } {
  const r = zoneQuerySchema.safeParse({ lat: first(sp.lat), lng: first(sp.lng), radius: first(sp.radius) });
  if (!r.success) return { ok: false, message: r.error.issues.map((i) => i.message).join("; ") };
  const label = first(sp.q)?.trim().slice(0, 200) || null;
  return { ok: true, zone: { lat: r.data.lat, lng: r.data.lng, radiusM: r.data.radiusM, label } };
}
