import type { NextRequest } from "next/server";
import { parseQuery, respond } from "@/lib/api";
import { cached } from "@/lib/cache";
import { computeImagery, getOccurrenceOverlay, type OverlayData } from "@/lib/ee/imagery";
import { zoneNotes } from "@/lib/geo";
import { zoneQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

const IMAGERY_BUCKET_S = 15 * 60;

export async function GET(req: NextRequest) {
  return respond(
    async () => {
      const { lat, lng, radiusM } = parseQuery(zoneQuerySchema, req);
      const year = new Date().getUTCFullYear();
      // Thumbnail and tile URLs are signed and expire (a cached link went 401 within hours), so the cache key rotates every
      // 15 minutes: a served link is never older than that. EE caches the heavy work, so the recompute is much faster.
      const bucket = Math.floor(Date.now() / (IMAGERY_BUCKET_S * 1000));
      const data = await cached("imagery", ["v5", bucket, lat, lng, radiusM, year], IMAGERY_BUCKET_S, async () => {
        const [imagery, overlay] = await Promise.all([
          computeImagery(lat, lng, radiusM),
          getOccurrenceOverlay().then(
            (o): { overlay: OverlayData | null; overlayError: string | null } => ({ overlay: o, overlayError: null }),
            (e): { overlay: OverlayData | null; overlayError: string | null } => ({
              overlay: null,
              overlayError: e instanceof Error ? e.message : "overlay unavailable",
            }),
          ),
        ]);
        return { ...imagery, ...overlay };
      });
      const notes = zoneNotes(lat, lng);
      if (data.skippedYears.length > 0) {
        notes.push(`${data.skippedYears.length} year(s) were skipped for lack of clear imagery.`);
      }
      return { data, meta: { lat, lng, radiusM, notes } };
    },
    { cacheSeconds: 300 },
  );
}
