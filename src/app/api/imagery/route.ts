import type { NextRequest } from "next/server";
import { parseQuery, respond } from "@/lib/api";
import { cached, SECONDS } from "@/lib/cache";
import { computeImagery, getOccurrenceOverlay, type OverlayData } from "@/lib/ee/imagery";
import { zoneNotes } from "@/lib/geo";
import { zoneQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  return respond(
    async () => {
      const { lat, lng, radiusM } = parseQuery(zoneQuerySchema, req);
      const year = new Date().getUTCFullYear();
      // Thumbnail and tile URLs are signed and expire, so cache for hours rather than weeks.
      const data = await cached("imagery", [lat, lng, radiusM, year], SECONDS.hour * 6, async () => {
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
    { cacheSeconds: SECONDS.hour },
  );
}
