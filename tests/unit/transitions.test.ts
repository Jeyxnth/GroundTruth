import { describe, expect, it } from "vitest";
import { detectTransition, labelYear, type Shares, type YearObs } from "@/lib/analysis/transitions";

const S = (water: number, vegetation: number, bare: number, built: number): Shares => ({ water, vegetation, bare, built });
const WATER = S(0.9, 0.05, 0.03, 0.02);
const VEG = S(0, 0.85, 0.1, 0.05);
const BARE = S(0, 0.1, 0.8, 0.1);
const BUILT = S(0, 0.1, 0.1, 0.8);

/** Build a series from [startYear, endYear, shares] segments. */
function series(...segs: Array<[number, number, Shares | null]>): YearObs[] {
  const out: YearObs[] = [];
  for (const [a, b, shares] of segs) for (let y = a; y <= b; y++) out.push({ year: y, shares });
  return out;
}

describe("labelYear", () => {
  it("labels water when fused water share is at least 30%", () => {
    expect(labelYear({ year: 2000, shares: S(0.3, 0.3, 0.2, 0.2) })).toBe("water");
    expect(labelYear({ year: 2000, shares: S(0.05, 0.1, 0.2, 0.65), jrcWater: 0.5 })).toBe("water");
  });
  it("returns null for gap years", () => {
    expect(labelYear({ year: 2000, shares: null })).toBeNull();
  });
  it("resolves ties toward the more developed class", () => {
    expect(labelYear({ year: 2000, shares: S(0, 0.4, 0.3, 0.3) })).toBe("vegetation");
    expect(labelYear({ year: 2000, shares: S(0, 0.2, 0.4, 0.4) })).toBe("built");
  });
});

describe("detectTransition", () => {
  it("detects the fill-and-build signature with the year of each stage", () => {
    const r = detectTransition(series([1990, 2004, WATER], [2005, 2007, BARE], [2008, 2024, BUILT]));
    expect(r.kind).toBe("fill-and-build");
    expect(r.humanFillingLikely).toBe(true);
    expect(r.waterFromYear).toBe(1990);
    expect(r.waterUntilYear).toBe(2004);
    expect(r.filledFromYear).toBe(2005);
    expect(r.builtFromYear).toBe(2008);
    expect(r.latestStage).toBe("built");
    expect(r.description).toBe("Water 1990 to 2004, filled 2005 to 2007, built by 2008.");
  });

  it("calls water straight to built when no bare stage appears", () => {
    const r = detectTransition(series([1990, 2000, WATER], [2001, 2024, BUILT]));
    expect(r.kind).toBe("water-to-built");
    expect(r.humanFillingLikely).toBe(true);
    expect(r.builtFromYear).toBe(2001);
  });

  it("calls water to bare when the land is still bare", () => {
    const r = detectTransition(series([1990, 2000, WATER], [2001, 2024, BARE]));
    expect(r.kind).toBe("water-to-bare");
    expect(r.humanFillingLikely).toBe(true);
    expect(r.filledFromYear).toBe(2001);
  });

  it("distinguishes water to vegetation (natural succession) from human filling", () => {
    const r = detectTransition(series([1990, 2000, WATER], [2001, 2024, VEG]));
    expect(r.kind).toBe("water-to-vegetation");
    expect(r.humanFillingLikely).toBe(false);
    expect(r.description).toMatch(/natural succession/);
  });

  it("reports no transition when there was never sustained water", () => {
    const r = detectTransition(series([1990, 2024, BUILT]));
    expect(r.kind).toBe("none");
    expect(r.humanFillingLikely).toBe(false);
  });

  it("reports no transition when water is still present", () => {
    const r = detectTransition(series([1990, 2024, WATER]));
    expect(r.kind).toBe("none");
    expect(r.description).toMatch(/still present/);
  });

  it("ignores a single wet year (needs at least two years of water)", () => {
    const r = detectTransition(series([1990, 1999, BARE], [2000, 2000, WATER], [2001, 2024, BUILT]));
    expect(r.kind).toBe("none");
  });

  it("smooths a one-year misclassification instead of splitting the stage", () => {
    const r = detectTransition(series([1990, 1999, WATER], [2000, 2000, BUILT], [2001, 2005, WATER], [2006, 2010, BARE], [2011, 2024, BUILT]));
    expect(r.kind).toBe("fill-and-build");
    expect(r.waterFromYear).toBe(1990);
    expect(r.waterUntilYear).toBe(2005);
  });

  it("reports gap years and never interpolates across them", () => {
    const r = detectTransition(series([1990, 1995, WATER], [1996, 1999, null], [2000, 2003, BARE], [2004, 2024, BUILT]));
    expect(r.gapYears).toEqual([1996, 1997, 1998, 1999]);
    expect(r.kind).toBe("fill-and-build");
    expect(r.filledFromYear).toBe(2000); // first observed bare year, not a guessed 1996
  });

  it("returns insufficient-data with too few usable years", () => {
    const r = detectTransition(series([1990, 1992, WATER], [1993, 2024, null]));
    expect(r.kind).toBe("insufficient-data");
  });

  it("fuses JRC water so a misclassified wet year still counts as water", () => {
    const obs = series([1990, 1999, BARE], [2000, 2024, BUILT]).map((o) => (o.year < 2000 ? { ...o, jrcWater: 0.8 } : o));
    const r = detectTransition(obs);
    expect(r.kind).toBe("water-to-built");
    expect(r.waterUntilYear).toBe(1999);
  });
});
