import type { NextRequest } from "next/server";
import { ApiError, parseQuery, respond } from "@/lib/api";
import { cached, SECONDS } from "@/lib/cache";
import { searchNominatim } from "@/lib/geocode";
import { isWithinIndiaBounds, zoneNotes } from "@/lib/geo";
import { geocodeQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(req: NextRequest) {
  return respond(
    async () => {
      const { q, country } = parseQuery(geocodeQuerySchema, req);
      const results = await cached("geocode", [country, q.toLowerCase()], SECONDS.week, () => searchNominatim(q, country));
      if (results.length === 0) {
        throw new ApiError(
          "not_found",
          country === "in"
            ? "No matching address found in India. Try adding the city or locality, or paste a lat, lng pair."
            : "No matching address found. Try adding the city or locality, or paste a lat, lng pair.",
          404,
        );
      }
      const first = results[0]!;
      return {
        data: { query: q, country, results: results.map((r) => ({ ...r, inIndia: isWithinIndiaBounds(r.lat, r.lng) })) },
        meta: { notes: zoneNotes(first.lat, first.lng) },
      };
    },
    { cacheSeconds: SECONDS.day },
  );
}
