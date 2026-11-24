/** Experiment design for the land-cover Random Forest. Everything tunable lives here. */

export type Split = "train" | "heldout";

/** [west, south, east, north] boxes over each city and its surroundings. */
export const CITIES: Record<string, { bbox: [number, number, number, number]; split: Split }> = {
  bengaluru: { bbox: [77.45, 12.8, 77.8, 13.15], split: "train" },
  chennai: { bbox: [80.1, 12.85, 80.35, 13.25], split: "train" },
  hyderabad: { bbox: [78.25, 17.25, 78.6, 17.55], split: "train" },
  mumbai: { bbox: [72.82, 18.95, 73.1, 19.3], split: "train" },
  // Held out: never seen in training, different climate and land cover (east and north-east India).
  kolkata: { bbox: [88.25, 22.4, 88.55, 22.75], split: "heldout" },
  guwahati: { bbox: [91.6, 26.05, 91.85, 26.25], split: "heldout" },
};

export const TRAIN_CITIES = Object.keys(CITIES).filter((c) => CITIES[c]!.split === "train");
export const HELDOUT_CITIES = Object.keys(CITIES).filter((c) => CITIES[c]!.split === "heldout");

/** Training uses these years; evaluation uses different years too, so cities and time are both held out. */
export const TRAIN_YEARS = [2019, 2020, 2022];
export const TEST_YEARS = [2021, 2023];
/** Overlap years (Landsat and Sentinel-2 both available) used for cross-sensor agreement. */
export const AGREEMENT_YEARS = [2021, 2023];
/** Historical years for the independent JRC water check (Landsat 5/7 era, before Dynamic World exists). */
export const JRC_CHECK_YEARS = [1990, 1995, 2000, 2005, 2010];

export const SEASON = { startMonth: 1, endMonth: 3 } as const;

/** High-confidence label rules (see dwLabel in lib.ts). */
export const LABEL_STABILITY = 0.8; // share of scenes agreeing with the seasonal label
export const LABEL_MIN_PROB = 0.5; // mean seasonal probability of that class
export const LABEL_PURITY = 0.89; // share of the 3x3 10 m pixels in a 30 m cell with the same class (8 of 9)

export const PER_CLASS_TRAIN = 350; // per city x year x sensor
export const PER_CLASS_TEST = 250; // per city x year x sensor
export const AGREEMENT_POINTS = 1500; // random pixels per city x year

export const RF = { numberOfTrees: 200, minLeafPopulation: 2, bagFraction: 0.6, seed: 42 } as const;

export const CLASS_IDS = [0, 1, 2, 3] as const;
export const CLASS_LABELS = ["water", "vegetation/wetland", "bare/filled soil", "built-up"] as const;

/** Agreement below this (pooled model, overlap years) triggers the fix step. */
export const AGREEMENT_TARGET = 0.85;
