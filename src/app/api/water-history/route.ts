import type { NextRequest } from "next/server";
import { parseQuery, respond } from "@/lib/api";
import { cached, SECONDS } from "@/lib/cache";
import { computeWaterHistory } from "@/lib/ee/water";
import { zoneNotes } from "@/lib/geo";
import { zoneQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return respond(
    async () => {
      const { lat, lng, radiusM } = parseQuery(zoneQuerySchema, req);
      const data = await cached("water", [lat, lng, radiusM], SECONDS.month, () => computeWaterHistory(lat, lng, radiusM));
      const notes = zoneNotes(lat, lng);
      if (data.summary.currentlyWater && data.summary.peakWaterFraction >= 0.9) {
        notes.push("Most of this zone is currently water (a lake, river or sea). Check that the pin is on land.");
      }
      if (data.summary.noDataYears.length > 0) {
        notes.push(`${data.summary.noDataYears.length} year(s) have too little valid JRC data and are shown as gaps.`);
      }
      return { data, meta: { lat, lng, radiusM, notes } };
    },
    { cacheSeconds: SECONDS.day },
  );
}
