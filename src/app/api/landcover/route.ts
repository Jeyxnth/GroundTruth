import type { NextRequest } from "next/server";
import { parseQuery, respond } from "@/lib/api";
import { cached, SECONDS } from "@/lib/cache";
import { computeLandcover } from "@/lib/ee/landcover";
import { getEnv } from "@/lib/env";
import { zoneNotes } from "@/lib/geo";
import { zoneQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  return respond(
    async () => {
      const { lat, lng, radiusM } = parseQuery(zoneQuerySchema, req);
      // Year in the key so a new season window rolls the cache over automatically.
      const year = new Date().getUTCFullYear();
      // The classifier (asset id or baseline) is part of the key so switching models never serves stale results.
      const model = getEnv().GEE_CLASSIFIER_ASSET ?? "baseline";
      const data = await cached("landcover", [lat, lng, radiusM, year, model], SECONDS.month, () => computeLandcover(lat, lng, radiusM));
      const notes = zoneNotes(lat, lng);
      if (data.gapYears.length > 0) {
        notes.push(`${data.gapYears.length} year(s) have no cloud-free imagery and are shown as gaps, not interpolated.`);
      }
      return { data, meta: { lat, lng, radiusM, notes } };
    },
    { cacheSeconds: SECONDS.day },
  );
}
