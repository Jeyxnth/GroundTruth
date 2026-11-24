import { describe, expect, it, vi } from "vitest";
import { buildFacts, type Facts } from "@/lib/analysis/facts";
import { computeRisk } from "@/lib/analysis/risk";
import { collectAllowed, templateSummary, validateSummary } from "@/lib/analysis/summary";
import { summarize } from "@/lib/llm";
import { factsSchema } from "@/lib/validation";

const facts: Facts = {
  location: { label: "Perungudi, Chennai", inIndia: true },
  analysis: { radiusM: 150, firstYearAnalysed: 1985, lastYearAnalysed: 2026, seasonWindow: "Jan to Mar", surroundingsRadiusKm: 1 },
  water: {
    everWater: true, classification: "seasonal", yearsWithWater: 9, yearsObserved: 29,
    firstWaterYear: 1988, lastWaterYear: 2021, peakWaterSharePercent: 90, currentlyWater: false,
    distanceToCurrentWaterM: 120,
  },
  transition: {
    kind: "fill-and-build", humanFillingLikely: true, waterFromYear: 1988, waterUntilYear: 2004,
    filledFromYear: 2005, builtFromYear: 2008, latestStage: "built",
  },
  elevation: { relativeElevationM: -1.8, isLocalDepression: true },
  risk: {
    score: 62, maxScore: 100, band: "High",
    topFactors: [{ name: "Water history", points: 17, maxPoints: 25 }],
    unavailableFactors: [],
  },
};

const GOOD =
  "Satellite records show water here in 9 of 29 observed years, between 1988 and 2021. " +
  "The land-cover record shows water until 2004, filled ground from 2005, and built-up land from 2008. " +
  "The zone sits about 1.8 m below its surroundings. " +
  "The screening risk score is 62 out of 100, which is High. " +
  "Please verify this against official land records.";

describe("collectAllowed", () => {
  it("collects every number and year from nested facts", () => {
    const { numbers, years } = collectAllowed(facts);
    expect(numbers).toContain(62);
    expect(numbers).toContain(-1.8);
    expect(years.has(1988)).toBe(true);
    expect(years.has(2008)).toBe(true);
    expect(years.has(62)).toBe(false);
  });
});

describe("validateSummary", () => {
  it("accepts text whose years and numbers all come from the facts", () => {
    expect(validateSummary(GOOD, facts)).toEqual({ ok: true, problems: [] });
  });

  it("rejects a year that is not in the facts", () => {
    const bad = GOOD.replace("1988", "1979");
    const v = validateSummary(bad, facts);
    expect(v.ok).toBe(false);
    expect(v.problems.join()).toMatch(/year 1979/);
  });

  it("rejects an invented number", () => {
    const v = validateSummary(GOOD.replace("62 out of 100", "75 out of 100"), facts);
    expect(v.ok).toBe(false);
    expect(v.problems.join()).toMatch(/number 75/);
  });

  it("accepts rounded versions of fact numbers (1.8 m, or 2 m is rejected at 1dp precision)", () => {
    expect(validateSummary(GOOD, facts).ok).toBe(true);
    const v = validateSummary(GOOD.replace("1.8 m", "3.4 m"), facts);
    expect(v.ok).toBe(false);
  });

  it("accepts a percent written from a fraction fact", () => {
    const f: Facts = { ...facts, water: { ...facts.water!, peakWaterSharePercent: 90 } };
    const text = `${GOOD} Water covered up to 90 percent of the zone at its peak.`.replace("Please verify this against official land records.", "");
    expect(validateSummary(text + " Verify with official land records. Thanks.", f).problems.join()).not.toMatch(/number 90/);
  });

  it("rejects spelled-out counts that are not in the facts", () => {
    const v = validateSummary(GOOD.replace("Please verify", "Seven lakes nearby were lost, so please verify").replace("Seven", "seven"), facts);
    expect(v.ok).toBe(false);
    expect(v.problems.join()).toMatch(/seven/);
  });

  it("enforces 3 to 5 sentences", () => {
    expect(validateSummary("Only one sentence here.", facts).ok).toBe(false);
    expect(validateSummary(Array(6).fill("A sentence.").join(" "), facts).ok).toBe(false);
  });

  it("rejects legal conclusions and purchase advice", () => {
    expect(validateSummary(GOOD + " This is safe to buy.", facts).ok).toBe(false);
    expect(validateSummary(GOOD.replace("Please verify", "This is an illegal plot, please verify"), facts).ok).toBe(false);
  });

  it("rejects empty text", () => {
    expect(validateSummary("   ", facts)).toEqual({ ok: false, problems: ["empty summary"] });
  });
});

describe("templateSummary", () => {
  it("passes its own validation for a fill-and-build site", () => {
    const text = templateSummary(facts);
    expect(validateSummary(text, facts)).toEqual({ ok: true, problems: [] });
    expect(text).toMatch(/1988/);
    expect(text).toMatch(/2008/);
  });

  it("passes validation for a never-water control with missing sections", () => {
    const control: Facts = {
      ...facts,
      water: { ...facts.water!, everWater: false, classification: "never", yearsWithWater: 0, firstWaterYear: null, lastWaterYear: null, peakWaterSharePercent: 0, distanceToCurrentWaterM: null },
      transition: { ...facts.transition!, kind: "none", humanFillingLikely: false, waterFromYear: null, waterUntilYear: null, filledFromYear: null, builtFromYear: null },
      elevation: null,
      risk: { score: 0, maxScore: 100, band: "Low", topFactors: [], unavailableFactors: ["Relative elevation"] },
    };
    const text = templateSummary(control);
    expect(validateSummary(text, control)).toEqual({ ok: true, problems: [] });
    expect(text).toMatch(/No water was detected/);
  });

  it("says plainly when sections are unavailable", () => {
    const empty: Facts = { ...facts, water: null, transition: null, elevation: null, risk: null };
    const text = templateSummary(empty);
    expect(text).toMatch(/could not be computed/);
    expect(validateSummary(text, empty).ok).toBe(true);
  });
});

describe("buildFacts", () => {
  it("produces JSON that satisfies the summary route schema", () => {
    const risk = computeRisk({ water: null, transition: null, relativeElevationM: null, currentYear: 2026 });
    const f = buildFacts({
      label: null, inIndia: true, radiusM: 150, firstYear: 1985, lastYear: 2026, seasonWindow: "Jan to Mar",
      water: null, transition: null, elevation: null, risk,
    });
    expect(factsSchema.safeParse(f).success).toBe(true);
    expect(f.risk?.unavailableFactors).toHaveLength(6);
  });
});

describe("summarize (LLM path with injected client)", () => {
  const client = (text: string, stop = "end_turn") =>
    ({
      messages: { create: vi.fn().mockResolvedValue({ stop_reason: stop, content: [{ type: "text", text }] }) },
    }) as never;

  it("uses the LLM text when it validates", async () => {
    const r = await summarize(facts, client(GOOD));
    expect(r.source).toBe("llm");
    expect(r.text).toBe(GOOD);
    expect(r.fallbackReason).toBeNull();
  });

  it("falls back to the template when the LLM invents a year", async () => {
    const r = await summarize(facts, client(GOOD.replace("1988", "1971")));
    expect(r.source).toBe("template");
    expect(r.fallbackReason).toMatch(/failed validation/);
    expect(validateSummary(r.text, facts).ok).toBe(true);
  });

  it("falls back on refusal and on API errors", async () => {
    expect((await summarize(facts, client("", "refusal"))).source).toBe("template");
    const failing = { messages: { create: vi.fn().mockRejectedValue(new Error("boom")) } } as never;
    const r = await summarize(facts, failing);
    expect(r.source).toBe("template");
  });

  it("uses the template when no API key is configured", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const r = await summarize(facts);
      expect(r.source).toBe("template");
      expect(r.fallbackReason).toMatch(/ANTHROPIC_API_KEY/);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});
