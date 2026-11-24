import { describe, expect, it } from "vitest";
import { RISK_CONFIG, bandFor, computeRisk, type RiskInputs } from "@/lib/analysis/risk";
import type { TransitionResult } from "@/lib/analysis/transitions";
import type { WaterSummary } from "@/lib/analysis/water-summary";

const NOW = 2026;

const noWater: WaterSummary = {
  everWater: false, classification: "never", yearsObserved: 38, yearsWithWater: 0,
  firstWaterYear: null, lastWaterYear: null, peakWaterFraction: 0, peakYear: null,
  recentSeasonalFraction: 0, currentlyWater: false, noDataYears: [],
  distanceToCurrentWaterM: 400, distanceBeyondSearch: false,
};
const oldLake: WaterSummary = {
  ...noWater, everWater: true, classification: "permanent", yearsWithWater: 20,
  firstWaterYear: 1988, lastWaterYear: 2007, peakWaterFraction: 0.9, peakYear: 1995,
  distanceToCurrentWaterM: 80,
};
const none: TransitionResult = {
  kind: "none", humanFillingLikely: false, runs: [], waterFromYear: null, waterUntilYear: null,
  filledFromYear: null, builtFromYear: null, latestStage: "built", gapYears: [], description: "",
};
const fillAndBuild = (filled: number, built: number): TransitionResult => ({
  ...none, kind: "fill-and-build", humanFillingLikely: true, waterFromYear: 1988,
  waterUntilYear: filled - 1, filledFromYear: filled, builtFromYear: built,
});

const base: RiskInputs = { water: noWater, transition: none, relativeElevationM: 1, currentYear: NOW };
const factor = (r: ReturnType<typeof computeRisk>, id: string) => r.factors.find((f) => f.id === id)!;

describe("RISK_CONFIG", () => {
  it("has factor maxima summing to 100", () => {
    expect(Object.values(RISK_CONFIG.max).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("bandFor", () => {
  it("applies the configured thresholds", () => {
    expect(bandFor(0)).toBe("Low");
    expect(bandFor(RISK_CONFIG.bands.moderateMin - 1)).toBe("Low");
    expect(bandFor(RISK_CONFIG.bands.moderateMin)).toBe("Moderate");
    expect(bandFor(RISK_CONFIG.bands.highMin - 1)).toBe("Moderate");
    expect(bandFor(RISK_CONFIG.bands.highMin)).toBe("High");
    expect(bandFor(100)).toBe("High");
  });
});

describe("computeRisk", () => {
  it("scores a never-water, higher-ground zone as 0 / Low", () => {
    const r = computeRisk(base);
    expect(r.score).toBe(0);
    expect(r.band).toBe("Low");
    expect(r.partial).toBe(false);
    expect(r.coverage).toBe(1);
  });

  it("does not let nearby water raise the score when the zone has no water history", () => {
    const r = computeRisk({ ...base, water: { ...noWater, distanceToCurrentWaterM: 0 } });
    expect(factor(r, "distance").points).toBe(0);
    expect(r.band).toBe("Low");
  });

  it("scores a recently filled, low-lying former lake as High", () => {
    const r = computeRisk({ water: oldLake, transition: fillAndBuild(2012, 2015), relativeElevationM: -3, currentYear: NOW });
    expect(r.band).toBe("High");
    expect(r.score).toBeGreaterThanOrEqual(RISK_CONFIG.bands.highMin);
    expect(factor(r, "recency").points).toBe(RISK_CONFIG.max.recency * 0.8); // 14 years ago: second tier
    expect(factor(r, "elevation").points).toBe(RISK_CONFIG.max.elevation);
  });

  it("gives older fills fewer recency points", () => {
    const recent = computeRisk({ water: oldLake, transition: fillAndBuild(2020, 2022), relativeElevationM: 0, currentYear: NOW });
    const old = computeRisk({ water: oldLake, transition: fillAndBuild(1992, 1995), relativeElevationM: 0, currentYear: NOW });
    expect(factor(recent, "recency").points).toBeGreaterThan(factor(old, "recency").points);
    expect(factor(old, "recency").points).toBeGreaterThan(0);
  });

  it("treats natural water-to-vegetation as much lower risk than human filling", () => {
    const natural: TransitionResult = { ...none, kind: "water-to-vegetation", waterUntilYear: 2005, waterFromYear: 1988 };
    const a = computeRisk({ water: oldLake, transition: natural, relativeElevationM: 0, currentYear: NOW });
    const b = computeRisk({ water: oldLake, transition: fillAndBuild(2006, 2008), relativeElevationM: 0, currentYear: NOW });
    expect(factor(a, "recency").points).toBeLessThan(factor(b, "recency").points / 2);
  });

  it("gives full recency points when the zone still shows water", () => {
    const wet = { ...oldLake, currentlyWater: true };
    const r = computeRisk({ water: wet, transition: none, relativeElevationM: 0, currentYear: NOW });
    expect(factor(r, "recency").points).toBe(RISK_CONFIG.max.recency);
  });

  it("scales elevation points linearly with depression and ignores higher ground", () => {
    const at = (rel: number) => factor(computeRisk({ ...base, relativeElevationM: rel }), "elevation").points;
    expect(at(2)).toBe(0);
    expect(at(0)).toBe(0);
    expect(at(-1.5)).toBe(10);
    expect(at(-3)).toBe(20);
    expect(at(-9)).toBe(20); // capped
  });

  it("scales distance points by tier", () => {
    const at = (d: number | null) =>
      factor(computeRisk({ ...base, water: { ...oldLake, distanceToCurrentWaterM: d } }), "distance").points;
    expect(at(0)).toBe(10);
    expect(at(90)).toBe(9);
    expect(at(2000)).toBe(0);
    expect(at(null)).toBe(0);
  });

  it("scores recent seasonal flooding up to the cap", () => {
    const at = (share: number) =>
      factor(computeRisk({ ...base, water: { ...noWater, recentSeasonalFraction: share } }), "flooding").points;
    expect(at(0)).toBe(0);
    expect(at(0.125)).toBe(5);
    expect(at(0.9)).toBe(10);
  });

  it("marks unavailable inputs as unavailable with zero points instead of guessing", () => {
    const r = computeRisk({ water: null, transition: null, relativeElevationM: null, currentYear: NOW });
    expect(r.factors.every((f) => !f.available && f.points === 0)).toBe(true);
    expect(r.factors.every((f) => f.reason.startsWith("Unavailable:"))).toBe(true);
    expect(r.partial).toBe(true);
    expect(r.coverage).toBe(0);
    expect(r.score).toBe(0);
  });

  it("flags partial coverage when only elevation is missing", () => {
    const r = computeRisk({ ...base, relativeElevationM: null });
    expect(r.partial).toBe(true);
    expect(r.coverage).toBeCloseTo(0.8);
  });

  it("gives every factor a one-sentence reason and keeps points within each maximum", () => {
    const r = computeRisk({ water: oldLake, transition: fillAndBuild(2010, 2012), relativeElevationM: -2, currentYear: NOW });
    for (const f of r.factors) {
      expect(f.reason.length).toBeGreaterThan(10);
      expect(f.points).toBeGreaterThanOrEqual(0);
      expect(f.points).toBeLessThanOrEqual(f.maxPoints);
    }
    expect(r.factors).toHaveLength(6);
  });
});
