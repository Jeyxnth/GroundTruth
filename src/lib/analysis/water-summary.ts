/** Pure functions: raw JRC numbers in, interpretable water-history summary out. */

/** A year "has water" when at least this share of the zone is water (filters single-pixel flicker). */
export const WATER_YEAR_MIN_FRACTION = 0.1;
/** A year counts as observed when at least this share of the zone has a valid JRC observation. */
export const OBSERVED_MIN_FRACTION = 0.5;
/** How many of the most recent observed years count as "recent". */
export const RECENT_YEARS = 5;

export interface YearlyWater {
  year: number;
  /** Share of the zone that is water (seasonal or permanent), 0..1 of the whole zone. */
  waterFraction: number;
  permanentFraction: number;
  seasonalFraction: number;
  /** Share of the zone with a valid (non-no-data) observation. */
  observedFraction: number;
}

export interface GswStats {
  occurrenceMean: number;
  occurrenceMax: number;
  fractionEverWater: number;
  seasonalityMaxMonths: number;
  /** Share of the zone where the JRC occurrence layer has data at all (0 = JRC has no observations here). */
  validFraction: number;
}

export type WaterClassification = "never" | "permanent" | "seasonal" | "mixed";

export interface WaterSummary {
  everWater: boolean;
  classification: WaterClassification;
  yearsObserved: number;
  yearsWithWater: number;
  firstWaterYear: number | null;
  lastWaterYear: number | null;
  peakWaterFraction: number;
  peakYear: number | null;
  /** Largest seasonal-water share of the zone across the most recent observed years. */
  recentSeasonalFraction: number | null;
  currentlyWater: boolean;
  /** Years with too little valid data to judge (shown as gaps, never interpolated). */
  noDataYears: number[];
  distanceToCurrentWaterM: number | null;
  /** True when no current water was found within the search radius (distance is then "greater than"). */
  distanceBeyondSearch: boolean;
}

export function summarizeWater(
  yearly: YearlyWater[],
  gsw: GswStats,
  distance: { meters: number | null; searchRadiusM: number },
): WaterSummary {
  const sorted = [...yearly].sort((a, b) => a.year - b.year);
  const observed = sorted.filter((y) => y.observedFraction >= OBSERVED_MIN_FRACTION);
  const noDataYears = sorted.filter((y) => y.observedFraction < OBSERVED_MIN_FRACTION).map((y) => y.year);
  const waterYears = observed.filter((y) => y.waterFraction >= WATER_YEAR_MIN_FRACTION);

  const everWater = waterYears.length > 0 || gsw.fractionEverWater >= WATER_YEAR_MIN_FRACTION;

  let classification: WaterClassification = "never";
  if (waterYears.length > 0) {
    const mostlyPermanent = waterYears.filter((y) => y.permanentFraction >= y.seasonalFraction).length;
    const share = mostlyPermanent / waterYears.length;
    classification = share >= 0.7 ? "permanent" : share <= 0.3 ? "seasonal" : "mixed";
  } else if (everWater) {
    classification = gsw.seasonalityMaxMonths >= 12 ? "permanent" : "seasonal";
  }

  let peak: YearlyWater | undefined;
  for (const y of observed) if (!peak || y.waterFraction > peak.waterFraction) peak = y;

  const recent = observed.slice(-RECENT_YEARS);
  const recentSeasonalFraction = recent.length ? Math.max(...recent.map((y) => y.seasonalFraction)) : null;
  const latest = observed.slice(-3);
  const currentlyWater = latest.length > 0 && latest.some((y) => y.waterFraction >= WATER_YEAR_MIN_FRACTION);

  return {
    everWater,
    classification,
    yearsObserved: observed.length,
    yearsWithWater: waterYears.length,
    firstWaterYear: waterYears[0]?.year ?? null,
    lastWaterYear: waterYears[waterYears.length - 1]?.year ?? null,
    peakWaterFraction: peak?.waterFraction ?? 0,
    peakYear: peak && peak.waterFraction > 0 ? peak.year : null,
    recentSeasonalFraction,
    currentlyWater,
    noDataYears,
    distanceToCurrentWaterM: distance.meters,
    distanceBeyondSearch: distance.meters === null,
  };
}
