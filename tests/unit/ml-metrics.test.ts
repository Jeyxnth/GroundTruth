import { describe, expect, it } from "vitest";
import { agreementBetween, computeMetrics, confusionMatrix } from "@/lib/ml/metrics";
import { baselineClassJs, BASELINE } from "@/lib/ee/optical";

const C = [0, 1, 2, 3];

describe("confusionMatrix", () => {
  it("counts [true][pred]", () => {
    expect(confusionMatrix([0, 0, 1, 2], [0, 1, 1, 2], [0, 1, 2])).toEqual([
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });
  it("rejects mismatched lengths", () => {
    expect(() => confusionMatrix([0], [0, 1], C)).toThrow();
  });
});

describe("computeMetrics", () => {
  it("gives perfect scores for perfect predictions", () => {
    const y = [0, 1, 2, 3, 0, 1, 2, 3];
    const m = computeMetrics(y, y, C);
    expect(m.overallAccuracy).toBe(1);
    expect(m.kappa).toBe(1);
    expect(m.macroF1).toBe(1);
    m.perClass.forEach((c) => expect(c.f1).toBe(1));
  });

  it("matches hand-computed precision, recall, F1 and accuracy", () => {
    // truth: 6 of class 0, 4 of class 1. pred: class0 -> 5 right 1 wrong; class1 -> 3 right 1 wrong
    const truth = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1];
    const pred = [0, 0, 0, 0, 0, 1, 1, 1, 1, 0];
    const m = computeMetrics(truth, pred, [0, 1]);
    expect(m.overallAccuracy).toBeCloseTo(0.8);
    const c0 = m.perClass[0]!;
    expect(c0.precision).toBeCloseTo(5 / 6);
    expect(c0.recall).toBeCloseTo(5 / 6);
    const c1 = m.perClass[1]!;
    expect(c1.precision).toBeCloseTo(3 / 4);
    expect(c1.recall).toBeCloseTo(3 / 4);
    expect(c1.f1).toBeCloseTo(0.75);
    expect(m.macroF1).toBeCloseTo((5 / 6 + 0.75) / 2);
    // kappa: po=.8, pe=(6*6+4*4)/100=.52 -> (.8-.52)/.48
    expect(m.kappa).toBeCloseTo(0.28 / 0.48);
  });

  it("returns null precision/recall for absent classes and ignores them in macro F1", () => {
    const m = computeMetrics([0, 0, 1], [0, 0, 1], C);
    expect(m.perClass[2]!.f1).toBeNull();
    expect(m.perClass[3]!.recall).toBeNull();
    expect(m.macroF1).toBe(1);
  });

  it("scores a class that is never predicted as F1 0, not null", () => {
    const m = computeMetrics([0, 1], [0, 0], [0, 1]);
    expect(m.perClass[1]!.f1).toBe(0);
  });

  it("handles empty input", () => {
    const m = computeMetrics([], [], C);
    expect(m.total).toBe(0);
    expect(m.overallAccuracy).toBe(0);
  });
});

describe("agreementBetween", () => {
  it("reports overall and per-class agreement", () => {
    const a = [0, 0, 1, 1, 2, 3];
    const b = [0, 1, 1, 1, 2, 2];
    const r = agreementBetween(a, b, C);
    expect(r.n).toBe(6);
    expect(r.agreement).toBeCloseTo(4 / 6);
    expect(r.perClass[0]!.agreement).toBeCloseTo(0.5);
    expect(r.perClass[1]!.agreement).toBe(1);
    expect(r.perClass[3]!.agreement).toBe(0);
  });
});

describe("baselineClassJs (threshold baseline twin of the EE rules)", () => {
  const f = (mndwi: number, ndvi: number, ndbi: number) => ({ mndwi, ndvi, ndbi });
  it("applies water > vegetation > built > bare precedence", () => {
    expect(baselineClassJs(f(0.5, 0.5, 0.5))).toBe(0);
    expect(baselineClassJs(f(-0.5, 0.5, 0.5))).toBe(1);
    expect(baselineClassJs(f(-0.5, 0.1, 0.2))).toBe(3);
    expect(baselineClassJs(f(-0.5, 0.1, -0.2))).toBe(2);
  });
  it("uses the shared thresholds", () => {
    expect(baselineClassJs(f(BASELINE.waterMndwi + 0.001, 0, 0))).toBe(0);
    expect(baselineClassJs(f(BASELINE.waterMndwi, 0, 0))).not.toBe(0);
  });
});
