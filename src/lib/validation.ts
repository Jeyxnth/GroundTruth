import { z } from "zod";
import { DEFAULT_RADIUS_M, MAX_RADIUS_M, MIN_RADIUS_M, round4 } from "@/lib/geo";

/** Query-string number: rejects empty strings (which Number() would turn into 0), NaN and Infinity. */
const numberParam = (name: string, min: number, max: number) =>
  z
    .string({ error: `${name} is required` })
    .trim()
    .min(1, `${name} is required`)
    .transform((s) => Number(s))
    .pipe(
      z
        .number({ error: `${name} must be a number` })
        .finite(`${name} must be a finite number`)
        .min(min, `${name} must be between ${min} and ${max}`)
        .max(max, `${name} must be between ${min} and ${max}`),
    );

export const zoneQuerySchema = z
  .object({
    lat: numberParam("lat", -90, 90),
    lng: numberParam("lng", -180, 180),
    radius: numberParam("radius", MIN_RADIUS_M, MAX_RADIUS_M).optional(),
  })
  .transform((v) => ({
    lat: round4(v.lat), // 4 dp (~11 m): also the cache key
    lng: round4(v.lng),
    radiusM: v.radius ?? DEFAULT_RADIUS_M,
  }));
export type ZoneQuery = z.infer<typeof zoneQuerySchema>;

export const geocodeQuerySchema = z.object({
  q: z.string().trim().min(3, "q must be at least 3 characters").max(200, "q must be at most 200 characters"),
  country: z.enum(["in", "all"]).default("in"),
});
export type GeocodeQuery = z.infer<typeof geocodeQuerySchema>;

const stage = z.enum(["water", "vegetation", "bare", "built"]);
const nullableNumber = z.number().nullable();

/** Facts JSON accepted by POST /api/summary. Strictly typed so the LLM only ever sees known fields. */
export const factsSchema = z.object({
  location: z.object({ label: z.string().max(300).nullable(), inIndia: z.boolean() }),
  analysis: z.object({
    radiusM: z.number(),
    firstYearAnalysed: z.number().int(),
    lastYearAnalysed: z.number().int(),
    seasonWindow: z.string(),
    surroundingsRadiusKm: z.number(),
  }),
  water: z
    .object({
      everWater: z.boolean(),
      classification: z.enum(["never", "permanent", "seasonal", "mixed"]),
      yearsWithWater: z.number().int(),
      yearsObserved: z.number().int(),
      firstWaterYear: z.number().int().nullable(),
      lastWaterYear: z.number().int().nullable(),
      peakWaterSharePercent: z.number(),
      currentlyWater: z.boolean(),
      distanceToCurrentWaterM: nullableNumber,
    })
    .nullable(),
  transition: z
    .object({
      kind: z.enum([
        "fill-and-build",
        "water-to-bare",
        "water-to-built",
        "water-to-vegetation",
        "none",
        "insufficient-data",
      ]),
      humanFillingLikely: z.boolean(),
      waterFromYear: z.number().int().nullable(),
      waterUntilYear: z.number().int().nullable(),
      filledFromYear: z.number().int().nullable(),
      builtFromYear: z.number().int().nullable(),
      latestStage: stage.nullable(),
    })
    .nullable(),
  elevation: z
    .object({
      relativeElevationM: nullableNumber,
      isLocalDepression: z.boolean(),
    })
    .nullable(),
  risk: z
    .object({
      score: z.number(),
      maxScore: z.number(),
      band: z.enum(["Low", "Moderate", "High"]),
      topFactors: z.array(z.object({ name: z.string(), points: z.number(), maxPoints: z.number() })).max(8),
      unavailableFactors: z.array(z.string()),
    })
    .nullable(),
});
export type FactsInput = z.infer<typeof factsSchema>;
