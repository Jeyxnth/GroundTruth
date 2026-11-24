import type { RiskResult } from "@/lib/analysis/risk";
import type { TransitionResult } from "@/lib/analysis/transitions";
import type { WaterSummary } from "@/lib/analysis/water-summary";
import type { FactsInput } from "@/lib/validation";

export type Facts = FactsInput;

export interface FactsSources {
  label: string | null;
  inIndia: boolean;
  radiusM: number;
  firstYear: number;
  lastYear: number;
  seasonWindow: string;
  water: WaterSummary | null;
  transition: TransitionResult | null;
  elevation: { relativeElevationM: number | null; isLocalDepression: boolean } | null;
  risk: RiskResult | null;
}

/**
 * Flattens computed results into the one JSON object the summary is allowed to use.
 * Everything the LLM may state must be a value in here; fractions are pre-converted to percents.
 */
export function buildFacts(s: FactsSources): Facts {
  const { water, transition, elevation, risk } = s;
  return {
    location: { label: s.label, inIndia: s.inIndia },
    analysis: {
      radiusM: s.radiusM,
      firstYearAnalysed: s.firstYear,
      lastYearAnalysed: s.lastYear,
      seasonWindow: s.seasonWindow,
      surroundingsRadiusKm: 1,
    },
    water: water && {
      everWater: water.everWater,
      classification: water.classification,
      yearsWithWater: water.yearsWithWater,
      yearsObserved: water.yearsObserved,
      firstWaterYear: water.firstWaterYear,
      lastWaterYear: water.lastWaterYear,
      peakWaterSharePercent: Math.round(water.peakWaterFraction * 100),
      currentlyWater: water.currentlyWater,
      distanceToCurrentWaterM: water.distanceToCurrentWaterM === null ? null : Math.round(water.distanceToCurrentWaterM),
    },
    transition: transition && {
      kind: transition.kind,
      humanFillingLikely: transition.humanFillingLikely,
      waterFromYear: transition.waterFromYear,
      waterUntilYear: transition.waterUntilYear,
      filledFromYear: transition.filledFromYear,
      builtFromYear: transition.builtFromYear,
      latestStage: transition.latestStage,
    },
    elevation: elevation && {
      relativeElevationM: elevation.relativeElevationM === null ? null : Math.round(elevation.relativeElevationM * 10) / 10,
      isLocalDepression: elevation.isLocalDepression,
    },
    risk: risk && {
      score: risk.score,
      maxScore: 100,
      band: risk.band,
      topFactors: [...risk.factors]
        .filter((f) => f.available && f.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, 4)
        .map((f) => ({ name: f.name, points: Math.round(f.points), maxPoints: f.maxPoints })),
      unavailableFactors: risk.factors.filter((f) => !f.available).map((f) => f.name),
    },
  };
}
