import { describe, expect, it } from "vitest";
import { summarizeWater, type GswStats, type YearlyWater } from "@/lib/analysis/water-summary";

const gsw = (over: Partial<GswStats> = {}): GswStats => ({
  occurrenceMean: 0, occurrenceMax: 0, fractionEverWater: 0, seasonalityMaxMonths: 0, validFraction: 1, ...over,
});
const yr = (year: number, permanent: number, seasonal: number, observed = 1): YearlyWater => ({
  year, permanentFraction: permanent, seasonalFraction: seasonal, waterFraction: permanent + seasonal, observedFraction: observed,
});
const range = (a: number, b: number, f: (y: number) => YearlyWater) => Array.from({ length: b - a + 1 }, (_, i) => f(a + i));
const dist = { meters: null, searchRadiusM: 2000 };

describe("summarizeWater", () => {
  it("reports never-water for a dry zone", () => {
    const s = summarizeWater(range(1984, 2021, (y) => yr(y, 0, 0)), gsw(), dist);
    expect(s.everWater).toBe(false);
    expect(s.classification).toBe("never");
    expect(s.yearsObserved).toBe(38);
    expect(s.firstWaterYear).toBeNull();
    expect(s.distanceBeyondSearch).toBe(true);
  });

  it("ignores sub-10% flicker (a stray pixel is not a lake)", () => {
    const s = summarizeWater(range(1984, 2021, (y) => yr(y, 0, y === 2015 ? 0.008 : 0)), gsw({ fractionEverWater: 0.002 }), dist);
    expect(s.everWater).toBe(false);
    expect(s.yearsWithWater).toBe(0);
  });

  it("finds first and last water year, peak, and permanent classification", () => {
    const series = range(1984, 2021, (y) => (y >= 1990 && y <= 2004 ? yr(y, y === 1995 ? 0.9 : 0.5, 0) : yr(y, 0, 0)));
    const s = summarizeWater(series, gsw({ fractionEverWater: 0.6 }), dist);
    expect(s.everWater).toBe(true);
    expect(s.classification).toBe("permanent");
    expect(s.firstWaterYear).toBe(1990);
    expect(s.lastWaterYear).toBe(2004);
    expect(s.yearsWithWater).toBe(15);
    expect(s.peakYear).toBe(1995);
    expect(s.peakWaterFraction).toBeCloseTo(0.9);
    expect(s.currentlyWater).toBe(false);
  });

  it("classifies mostly-seasonal water as seasonal and a mix as mixed", () => {
    const seasonal = range(1990, 2000, (y) => yr(y, 0, 0.5));
    expect(summarizeWater(seasonal, gsw({ fractionEverWater: 0.5 }), dist).classification).toBe("seasonal");
    const mixed = range(1990, 2000, (y) => (y % 2 ? yr(y, 0.5, 0) : yr(y, 0, 0.5)));
    expect(summarizeWater(mixed, gsw({ fractionEverWater: 0.5 }), dist).classification).toBe("mixed");
  });

  it("lists low-coverage years as gaps and excludes them from counts", () => {
    const series = [yr(1984, 0, 0, 0), yr(1985, 0, 0, 0.1), yr(1990, 0.5, 0, 1), yr(1991, 0.5, 0, 1)];
    const s = summarizeWater(series, gsw({ fractionEverWater: 0.5 }), dist);
    expect(s.noDataYears).toEqual([1984, 1985]);
    expect(s.yearsObserved).toBe(2);
  });

  it("flags currently-water when the latest observed years show water", () => {
    const series = range(2015, 2021, (y) => yr(y, y >= 2020 ? 0.6 : 0, 0));
    expect(summarizeWater(series, gsw({ fractionEverWater: 0.3 }), dist).currentlyWater).toBe(true);
  });

  it("derives recent seasonal share from the last five observed years only", () => {
    const series = range(2000, 2021, (y) => yr(y, 0, y === 2005 ? 0.8 : y === 2020 ? 0.2 : 0));
    expect(summarizeWater(series, gsw({ fractionEverWater: 0.2 }), dist).recentSeasonalFraction).toBeCloseTo(0.2);
  });

  it("carries the measured distance through", () => {
    const s = summarizeWater(range(2000, 2005, (y) => yr(y, 0, 0)), gsw(), { meters: 340, searchRadiusM: 2000 });
    expect(s.distanceToCurrentWaterM).toBe(340);
    expect(s.distanceBeyondSearch).toBe(false);
  });
});
