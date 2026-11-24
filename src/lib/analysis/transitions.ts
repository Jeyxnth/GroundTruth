/**
 * Transition detection: finds the classic fill-and-build signature
 * (water -> bare/filled -> built-up) in a per-year land-cover series, and tells it
 * apart from natural water -> vegetation succession (siltation, weeds).
 * Pure and deterministic; no data is interpolated: years without usable imagery are gaps.
 */

export type Stage = "water" | "vegetation" | "bare" | "built";

export interface Shares {
  water: number;
  vegetation: number;
  bare: number;
  built: number;
}

export interface YearObs {
  year: number;
  /** Class shares of the zone, or null when the year has no cloud-free coverage. */
  shares: Shares | null;
  /** Optional JRC water share of the zone for the same year; fused with the classifier's water share. */
  jrcWater?: number | null;
}

export interface StageRun {
  stage: Stage;
  startYear: number;
  endYear: number;
}

export type TransitionKind =
  | "fill-and-build"
  | "water-to-bare"
  | "water-to-built"
  | "water-to-vegetation"
  | "none"
  | "insufficient-data";

export interface TransitionResult {
  kind: TransitionKind;
  /** True for fill-and-build / water-to-bare / water-to-built; false for natural-looking succession. */
  humanFillingLikely: boolean;
  runs: StageRun[];
  waterFromYear: number | null;
  waterUntilYear: number | null;
  filledFromYear: number | null;
  builtFromYear: number | null;
  latestStage: Stage | null;
  gapYears: number[];
  description: string;
}

/** A year is "water" when the fused water share is at least this. */
export const WATER_STAGE_MIN_SHARE = 0.3;
/** A water era must span at least this many usable years to count (rejects one-off wet years). */
export const MIN_WATER_ERA_YEARS = 2;
/** Fewer usable years than this and no conclusion is drawn. */
export const MIN_USABLE_YEARS = 6;

export function labelYear(o: YearObs): Stage | null {
  if (!o.shares) return null;
  const waterScore = Math.max(o.shares.water, o.jrcWater ?? 0);
  if (waterScore >= WATER_STAGE_MIN_SHARE) return "water";
  const { vegetation, bare, built } = o.shares;
  // Ties resolve towards the more developed class.
  if (built >= bare && built >= vegetation) return "built";
  if (bare >= vegetation) return "bare";
  return "vegetation";
}

/** 3-point mode filter over the usable sequence: removes single-year flips without inventing data. */
function smooth(labels: Stage[]): Stage[] {
  return labels.map((l, i) => {
    const prev = labels[i - 1];
    const next = labels[i + 1];
    if (prev !== undefined && next !== undefined && prev === next && prev !== l) return prev;
    return l;
  });
}

function collapse(years: number[], labels: Stage[]): StageRun[] {
  const runs: StageRun[] = [];
  labels.forEach((stage, i) => {
    const year = years[i] as number;
    const last = runs[runs.length - 1];
    if (last && last.stage === stage) last.endYear = year;
    else runs.push({ stage, startYear: year, endYear: year });
  });
  return runs;
}

const span = (r: StageRun) => (r.startYear === r.endYear ? `${r.startYear}` : `${r.startYear} to ${r.endYear}`);

export function detectTransition(series: YearObs[]): TransitionResult {
  const sorted = [...series].sort((a, b) => a.year - b.year);
  const gapYears = sorted.filter((o) => o.shares === null).map((o) => o.year);
  const usable = sorted.filter((o) => o.shares !== null);

  const base = {
    humanFillingLikely: false,
    waterFromYear: null,
    waterUntilYear: null,
    filledFromYear: null,
    builtFromYear: null,
    gapYears,
  };

  if (usable.length < MIN_USABLE_YEARS) {
    return {
      ...base,
      kind: "insufficient-data",
      runs: [],
      latestStage: null,
      description: `Only ${usable.length} year(s) have cloud-free imagery, which is not enough to detect a land-use change.`,
    };
  }

  const years = usable.map((o) => o.year);
  const labels = smooth(usable.map((o) => labelYear(o) as Stage));
  const runs = collapse(years, labels);
  const latestStage = runs[runs.length - 1]?.stage ?? null;

  // Water eras that last long enough to be real.
  const eraYears = (r: StageRun) => years.filter((y) => y >= r.startYear && y <= r.endYear).length;
  const waterRuns = runs.filter((r) => r.stage === "water" && eraYears(r) >= MIN_WATER_ERA_YEARS);
  const firstWater = waterRuns[0];
  const lastWater = waterRuns[waterRuns.length - 1];

  if (!firstWater || !lastWater) {
    return {
      ...base,
      kind: "none",
      runs,
      latestStage,
      description: "No sustained water period was detected in the land-cover record, so no water-to-land change applies.",
    };
  }

  const lastWaterIdx = runs.indexOf(lastWater);
  const after = runs.slice(lastWaterIdx + 1);
  const common = { ...base, runs, latestStage, waterFromYear: firstWater.startYear, waterUntilYear: lastWater.endYear };

  if (after.length === 0) {
    return {
      ...common,
      kind: "none",
      description: `Water was present from ${firstWater.startYear} and is still present in the latest year, so no filling was detected.`,
    };
  }

  const firstAfter = after[0] as StageRun;
  const bareRun = after.find((r) => r.stage === "bare");
  const builtRun = after.find((r) => r.stage === "built");
  const waterPart = `Water ${span({ ...lastWater, startYear: firstWater.startYear })}`;

  if (firstAfter.stage === "vegetation") {
    return {
      ...common,
      kind: "water-to-vegetation",
      builtFromYear: builtRun?.startYear ?? null,
      description:
        `${waterPart}, then vegetation from ${firstAfter.startYear}. ` +
        "This looks like natural succession (siltation or weeds) rather than deliberate filling" +
        (builtRun ? `; the zone was built up from ${builtRun.startYear}.` : "."),
    };
  }

  if (bareRun && builtRun && bareRun.startYear < builtRun.startYear) {
    return {
      ...common,
      kind: "fill-and-build",
      humanFillingLikely: true,
      filledFromYear: bareRun.startYear,
      builtFromYear: builtRun.startYear,
      description: `${waterPart}, filled ${span(bareRun)}, built by ${builtRun.startYear}.`,
    };
  }

  if (firstAfter.stage === "built") {
    return {
      ...common,
      kind: "water-to-built",
      humanFillingLikely: true,
      builtFromYear: firstAfter.startYear,
      description: `${waterPart}, then built-up from ${firstAfter.startYear} with no separate bare-soil stage visible in the yearly record.`,
    };
  }

  return {
    ...common,
    kind: "water-to-bare",
    humanFillingLikely: true,
    filledFromYear: firstAfter.startYear,
    description: `${waterPart}, then bare or filled ground from ${firstAfter.startYear}; not built up as of the latest year.`,
  };
}
