import type { NextRequest } from "next/server";
import { parseQuery, respond } from "@/lib/api";
import { cached, SECONDS } from "@/lib/cache";
import { computeElevation } from "@/lib/ee/elevation";
import { zoneNotes } from "@/lib/geo";
import { zoneQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return respond(
    async () => {
      const { lat, lng, radiusM } = parseQuery(zoneQuerySchema, req);
      const data = await cached("elevation", [lat, lng, radiusM], SECONDS.month, () => computeElevation(lat, lng, radiusM));
      const notes = zoneNotes(lat, lng);
      if (!data.available && data.unavailableReason) notes.push(data.unavailableReason);
      return { data, meta: { lat, lng, radiusM, notes } };
    },
    { cacheSeconds: SECONDS.day },
  );
}
