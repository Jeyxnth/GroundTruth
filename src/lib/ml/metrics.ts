/** Pure classification metrics. Used by scripts/ml and unit-tested; the numbers on the pitch slide come from here. */

export interface ClassMetrics {
  precision: number | null;
  recall: number | null;
  f1: number | null;
  support: number;
}

export interface Metrics {
  classes: number[];
  /** matrix[true][pred] counts, in the order of `classes`. */
  matrix: number[][];
  total: number;
  overallAccuracy: number;
  kappa: number;
  perClass: ClassMetrics[];
  /** Mean F1 over classes that appear in the reference data. */
  macroF1: number;
}

export function confusionMatrix(truth: number[], pred: number[], classes: number[]): number[][] {
  if (truth.length !== pred.length) throw new Error("truth and pred must have the same length");
  const idx = new Map(classes.map((c, i) => [c, i]));
  const m = classes.map(() => classes.map(() => 0));
  truth.forEach((t, i) => {
    const r = idx.get(t);
    const c = idx.get(pred[i] as number);
    if (r !== undefined && c !== undefined) (m[r] as number[])[c]! += 1;
  });
  return m;
}

const div = (a: number, b: number) => (b === 0 ? null : a / b);

export function metricsFromMatrix(matrix: number[][], classes: number[]): Metrics {
  const n = classes.length;
  const rowSum = matrix.map((r) => r.reduce((a, b) => a + b, 0));
  const colSum = classes.map((_, j) => matrix.reduce((a, r) => a + (r[j] as number), 0));
  const total = rowSum.reduce((a, b) => a + b, 0);
  const diag = matrix.reduce((a, r, i) => a + (r[i] as number), 0);

  const perClass: ClassMetrics[] = classes.map((_, i) => {
    const tp = (matrix[i] as number[])[i] as number;
    const precision = div(tp, colSum[i] as number);
    const recall = div(tp, rowSum[i] as number);
    const f1 = precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : precision === null && recall === null ? null : 0;
    return { precision, recall, f1, support: rowSum[i] as number };
  });

  const pe = total === 0 ? 0 : rowSum.reduce((a, r, i) => a + (r * (colSum[i] as number)) / (total * total), 0);
  const po = total === 0 ? 0 : diag / total;
  const kappa = 1 - pe === 0 ? 0 : (po - pe) / (1 - pe);

  const present = perClass.filter((c) => c.support > 0 && c.f1 !== null);
  const macroF1 = present.length ? present.reduce((a, c) => a + (c.f1 as number), 0) / present.length : 0;
  void n;
  return { classes, matrix, total, overallAccuracy: total === 0 ? 0 : po, kappa, perClass, macroF1 };
}

export function computeMetrics(truth: number[], pred: number[], classes: number[]): Metrics {
  return metricsFromMatrix(confusionMatrix(truth, pred, classes), classes);
}

export interface Agreement {
  n: number;
  /** Share of points where both predictions are the same class. */
  agreement: number;
  /** Cohen's kappa between the two predictions. */
  kappa: number;
  /** Per class: of points the first labels as c, the share the second also labels c. */
  perClass: Array<{ class: number; n: number; agreement: number | null }>;
}

export function agreementBetween(a: number[], b: number[], classes: number[]): Agreement {
  const m = metricsFromMatrix(confusionMatrix(a, b, classes), classes);
  return {
    n: m.total,
    agreement: m.overallAccuracy,
    kappa: m.kappa,
    perClass: classes.map((c, i) => ({ class: c, n: (m.perClass[i] as ClassMetrics).support, agreement: (m.perClass[i] as ClassMetrics).recall })),
  };
}
