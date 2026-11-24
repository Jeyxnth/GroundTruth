import type { TransitionResult } from "@/lib/analysis/transitions";
import type { WaterSummary } from "@/lib/analysis/water-summary";

/** All tunable weights and thresholds live here. Factor maxima sum to 100. */
export const RISK_CONFIG = {
  max: {
    everWater: 25,
    permanence: 15,
    recency: 20,
    distance: 10,
    elevation: 20,
    flooding: 10,
  },
  bands: { moderateMin: 25, highMin: 55 },
  everWater: { yearsForFullScore: 20, minShare: 0.4, peakTiers: [{ min: 0.5, scale: 1 }, { min: 0.25, scale: 0.8 }, { min: 0, scale: 0.6 }] },
  permanence: { permanent: 1, mixed: 0.75, seasonal: 0.55 },
  /** Fraction of max by years since filling, for human filling (water -> bare/built). */
  recencyHuman: [
    { withinYears: 10, scale: 1 },
    { withinYears: 20, scale: 0.8 },
    { withinYears: 30, scale: 0.6 },
    { withinYears: Infinity, scale: 0.4 },
  ],
  recencyNatural: [
    { withinYears: 20, scale: 0.25 },
    { withinYears: Infinity, scale: 0.1 },
  ],
  /** Zone still shows water in the latest years. */
  recencyStillWater: 1,
  distance: [
    { withinM: 0, scale: 1 },
    { withinM: 100, scale: 0.9 },
    { withinM: 250, scale: 0.7 },
    { withinM: 500, scale: 0.4 },
    { withinM: 1000, scale: 0.2 },
  ],
  elevation: { fullScoreDepressionM: 3 },
  flooding: { fullScoreSeasonalShare: 0.25 },
} as const;

export type RiskBand = "Low" | "Moderate" | "High";
export type FactorId = keyof typeof RISK_CONFIG.max;

export interface RiskFactor {
  id: FactorId;
  name: string;
  points: number;
  maxPoints: number;
  /** False when the input could not be computed; contributes 0 and is called out, never guessed. */
  available: boolean;
  reason: string;
}

export interface RiskResult {
  score: number;
  band: RiskBand;
  factors: RiskFactor[];
  /** Share of the 100 points whose inputs were available (1 = all). */
  coverage: number;
  partial: boolean;
}

export interface RiskInputs {
  water: WaterSummary | null;
  transition: TransitionResult | null;
  /** Zone mean elevation minus surroundings mean (metres; negative = lower). Null when unavailable. */
  relativeElevationM: number | null;
  currentYear: number;
  firstYear?: number;
  lastYear?: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const pts = (max: number, scale: number) => r1(max * clamp01(scale));

export function bandFor(score: number): RiskBand {
  if (score >= RISK_CONFIG.bands.highMin) return "High";
  if (score >= RISK_CONFIG.bands.moderateMin) return "Moderate";
  return "Low";
}

export function computeRisk(input: RiskInputs): RiskResult {
  const { water, transition, relativeElevationM, currentYear } = input;
  const M = RISK_CONFIG.max;
  const factors: RiskFactor[] = [];
  const add = (f: RiskFactor) => factors.push(f);
  const unavailable = (id: FactorId, name: string, why: string) =>
    add({ id, name, points: 0, maxPoints: M[id], available: false, reason: `Unavailable: ${why}` });

  // 1. Ever water, and for how long
  const N1 = "Water history";
  if (!water) unavailable("everWater", N1, "water history could not be computed.");
  else if (!water.everWater) {
    add({ id: "everWater", name: N1, points: 0, maxPoints: M.everWater, available: true, reason: "No water was detected in this zone in any observed year." });
  } else {
    const c = RISK_CONFIG.everWater;
    const durationScale = c.minShare + (1 - c.minShare) * clamp01(water.yearsWithWater / c.yearsForFullScore);
    const peakScale = c.peakTiers.find((t) => water.peakWaterFraction >= t.min)?.scale ?? 0.6;
    add({
      id: "everWater",
      name: N1,
      points: pts(M.everWater, durationScale * peakScale),
      maxPoints: M.everWater,
      available: true,
      reason: `Water covered at least 10% of the zone in ${water.yearsWithWater} of ${water.yearsObserved} observed years (peak ${Math.round(water.peakWaterFraction * 100)}%).`,
    });
  }

  // 2. Permanent vs seasonal
  const N2 = "Permanent vs seasonal water";
  if (!water) unavailable("permanence", N2, "water history could not be computed.");
  else if (!water.everWater || water.classification === "never") {
    add({ id: "permanence", name: N2, points: 0, maxPoints: M.permanence, available: true, reason: "No water, so there is no permanent or seasonal water body here." });
  } else {
    const scale = RISK_CONFIG.permanence[water.classification];
    const word = { permanent: "Mostly permanent", seasonal: "Mostly seasonal", mixed: "A mix of permanent and seasonal" }[water.classification];
    add({ id: "permanence", name: N2, points: pts(M.permanence, scale), maxPoints: M.permanence, available: true, reason: `${word} water: permanent water bodies carry stronger legal protection and deeper fill.` });
  }

  // 3. How recently it was filled
  const N3 = "How recently it was filled";
  if (!water || !transition) unavailable("recency", N3, "land-cover change could not be computed.");
  else if (!water.everWater) {
    add({ id: "recency", name: N3, points: 0, maxPoints: M.recency, available: true, reason: "No water history, so nothing was filled." });
  } else if (transition.kind === "insufficient-data") {
    unavailable("recency", N3, "too few cloud-free years to date a land-use change.");
  } else if (transition.kind === "none") {
    if (water.currentlyWater) {
      add({ id: "recency", name: N3, points: pts(M.recency, RISK_CONFIG.recencyStillWater), maxPoints: M.recency, available: true, reason: "The zone still shows water in recent years: it is, or sits on, a live water body." });
    } else {
      add({ id: "recency", name: N3, points: 0, maxPoints: M.recency, available: true, reason: "Water history exists but no filling or building-over was detected." });
    }
  } else {
    const since = transition.filledFromYear ?? transition.builtFromYear ?? (transition.waterUntilYear ? transition.waterUntilYear + 1 : null);
    if (since === null) {
      unavailable("recency", N3, "the year of change could not be determined.");
    } else {
      const age = Math.max(0, currentYear - since);
      const tiers = transition.humanFillingLikely ? RISK_CONFIG.recencyHuman : RISK_CONFIG.recencyNatural;
      const scale = tiers.find((t) => age <= t.withinYears)?.scale ?? 0.1;
      const how = transition.humanFillingLikely ? "was filled or built over" : "gave way to plants (this looks natural)";
      add({ id: "recency", name: N3, points: pts(M.recency, scale), maxPoints: M.recency, available: true, reason: `The images suggest the water ${how} from about ${since}, ${age} years ago.` });
    }
  }

  // 4. Distance to current water
  const N4 = "Distance to current water";
  if (!water) unavailable("distance", N4, "water history could not be computed.");
  else if (!water.everWater) {
    add({ id: "distance", name: N4, points: 0, maxPoints: M.distance, available: true, reason: "The zone has no water history, so nearby water does not add to the screening risk." });
  } else if (water.distanceToCurrentWaterM === null) {
    add({ id: "distance", name: N4, points: 0, maxPoints: M.distance, available: true, reason: "No current water body within the 2 km search radius." });
  } else {
    const d = water.distanceToCurrentWaterM;
    const tier = RISK_CONFIG.distance.find((t) => d <= t.withinM);
    add({ id: "distance", name: N4, points: pts(M.distance, tier?.scale ?? 0), maxPoints: M.distance, available: true, reason: d === 0 ? "Current water is inside the zone." : `Nearest current water is about ${Math.round(d)} m away.` });
  }

  // 5. Relative elevation
  const N5 = "Relative elevation";
  if (relativeElevationM === null) unavailable("elevation", N5, "elevation data could not be computed for this zone.");
  else {
    const depression = Math.max(0, -relativeElevationM);
    const scale = depression / RISK_CONFIG.elevation.fullScoreDepressionM;
    add({
      id: "elevation",
      name: N5,
      points: pts(M.elevation, scale),
      maxPoints: M.elevation,
      available: true,
      reason: depression > 0 ? `The zone sits about ${r1(depression)} m below its surroundings within 1 km, so water drains toward it.` : "The zone is not lower than its surroundings within 1 km.",
    });
  }

  // 6. Recent seasonal flooding signal
  const N6 = "Recent seasonal flooding";
  if (!water || water.recentSeasonalFraction === null) unavailable("flooding", N6, "no recent satellite water observations.");
  else {
    const share = water.recentSeasonalFraction;
    add({
      id: "flooding",
      name: N6,
      points: pts(M.flooding, share / RISK_CONFIG.flooding.fullScoreSeasonalShare),
      maxPoints: M.flooding,
      available: true,
      reason: share > 0 ? `Seasonal water covered up to ${Math.round(share * 100)}% of the zone in the last ${5} observed years.` : "No seasonal water was seen in the zone in the last 5 observed years.",
    });
  }

  const score = Math.round(factors.reduce((s, f) => s + f.points, 0));
  const availableMax = factors.filter((f) => f.available).reduce((s, f) => s + f.maxPoints, 0);
  const total = Object.values(M).reduce((a, b) => a + b, 0);
  return {
    score,
    band: bandFor(score),
    factors,
    coverage: availableMax / total,
    partial: factors.some((f) => !f.available),
  };
}
