import type eeType from "@google/earthengine";
import { getEnv } from "@/lib/env";

type EE = typeof eeType;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EEAny = any;

/** Bands shared by Landsat 5/7/8/9 and Sentinel-2, in a common order. */
export const COMMON_BANDS = ["blue", "green", "red", "nir", "swir1", "swir2"] as const;
/** Model features: common bands + indices. Keep in sync with scripts/ml. */
export const FEATURE_BANDS = [...COMMON_BANDS, "mndwi", "ndvi", "ndbi", "bsi"] as const;

export const CLASS_NAMES = ["water", "vegetation", "bare", "built"] as const;
export type ClassName = (typeof CLASS_NAMES)[number];

export type Sensor = "landsat" | "sentinel2";

export const FIRST_YEAR = 1985; // first full Jan-Mar season after Landsat 5 / GSW start (1984)
export const SENTINEL2_FIRST_YEAR = 2017;
/** Minimum share of the zone that must have cloud-free data for a year to be used. */
export const MIN_VALID_FRACTION = 0.5;

export interface SeasonWindow {
  startMonth: number;
  endMonth: number;
}

export function seasonFromEnv(): SeasonWindow {
  const env = getEnv();
  return { startMonth: env.SEASON_START_MONTH, endMonth: env.SEASON_END_MONTH };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const seasonLabel = (s: SeasonWindow) =>
  s.startMonth === s.endMonth ? MONTHS[s.startMonth - 1]! : `${MONTHS[s.startMonth - 1]} to ${MONTHS[s.endMonth - 1]}`;

/** Last year whose season window has fully passed. */
export function lastCompleteYear(now: Date, season: SeasonWindow): number {
  return now.getUTCMonth() + 1 > season.endMonth ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function seasonDates(ee: EE, year: number, season: SeasonWindow) {
  const start = ee.Date.fromYMD(year, season.startMonth, 1);
  const end = start.advance(season.endMonth - season.startMonth + 1, "month");
  return { start, end };
}

// Roy et al. (2016) OLS coefficients: Landsat 8/9 OLI -> Landsat 7 ETM+ reflectance
// (blue, green, red, nir, swir1, swir2), so L5/7 and L8/9 sit on one radiometric scale.
const OLI_TO_ETM_SLOPE = [0.8474, 0.8483, 0.9047, 0.8462, 0.8937, 0.9071];
const OLI_TO_ETM_INTERCEPT = [0.0003, 0.0088, 0.0061, 0.0412, 0.0254, 0.0172];

const LS_ETM_BANDS = ["SR_B1", "SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B7"];
const LS_OLI_BANDS = ["SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6", "SR_B7"];

/** `etm` = Landsat 5 TM + 7 ETM+ (the sensors of the 1985 to 2016 record); `oli` = Landsat 8/9; `all` = every Landsat. */
export type LandsatSubset = "all" | "etm" | "oli";

function landsatCollection(ee: EE, region: EEAny, year: number, season: SeasonWindow, subset: LandsatSubset = "all"): EEAny {
  const { start, end } = seasonDates(ee, year, season);
  const prep = (src: string[], oli: boolean) => (img: EEAny) => {
    // QA_PIXEL bits 1..4: dilated cloud, cirrus, cloud, cloud shadow
    const clear = img.select("QA_PIXEL").bitwiseAnd(30).eq(0);
    let sr = img.select(src, [...COMMON_BANDS]).multiply(0.0000275).add(-0.2);
    if (oli) sr = sr.multiply(ee.Image.constant(OLI_TO_ETM_SLOPE)).add(ee.Image.constant(OLI_TO_ETM_INTERCEPT));
    return sr.clamp(0, 1).updateMask(clear);
  };
  const col = (id: string, src: string[], oli: boolean) =>
    ee.ImageCollection(id).filterBounds(region).filterDate(start, end).map(prep(src, oli));
  const etm = () => col("LANDSAT/LT05/C02/T1_L2", LS_ETM_BANDS, false).merge(col("LANDSAT/LE07/C02/T1_L2", LS_ETM_BANDS, false));
  const oli = () => col("LANDSAT/LC08/C02/T1_L2", LS_OLI_BANDS, true).merge(col("LANDSAT/LC09/C02/T1_L2", LS_OLI_BANDS, true));
  return subset === "etm" ? etm() : subset === "oli" ? oli() : etm().merge(oli());
}

function sentinel2Collection(ee: EE, region: EEAny, year: number, season: SeasonWindow): EEAny {
  const { start, end } = seasonDates(ee, year, season);
  const csPlus = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED");
  return ee
    .ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(region)
    .filterDate(start, end)
    .linkCollection(csPlus, ["cs_cdf"])
    .map((img: EEAny) =>
      img
        .select(["B2", "B3", "B4", "B8", "B11", "B12"], [...COMMON_BANDS])
        .divide(10000)
        .clamp(0, 1)
        // Cloud Score+: keep pixels that are at least 60% likely to be clear
        .updateMask(img.select("cs_cdf").gte(0.6)),
    );
}

export interface Composite {
  /** Median composite with the six COMMON_BANDS, masked where no clear observation exists. */
  image: EEAny;
  /** Number of scenes entering the composite (before pixel masking). */
  scenes: EEAny;
}

/** One cloud-masked median composite for the season of `year`, at a 30 m grid for both sensors. */
export function buildComposite(
  ee: EE,
  sensor: Sensor,
  region: EEAny,
  year: number,
  season: SeasonWindow,
  landsatSubset: LandsatSubset = "all",
  opts: { native?: boolean } = {},
): Composite {
  // A fully masked image carrying the six bands: keeps the composite well-formed when a year has no scenes.
  const blank = ee.ImageCollection([
    ee.Image.constant([0, 0, 0, 0, 0, 0]).rename([...COMMON_BANDS]).updateMask(ee.Image.constant(0)),
  ]);
  if (sensor === "landsat") {
    const col = landsatCollection(ee, region, year, season, landsatSubset);
    return { image: col.merge(blank).median(), scenes: col.size() };
  }
  const col = sentinel2Collection(ee, region, year, season);
  // Display only: keep Sentinel-2 at its native 10 m instead of the 30 m classification grid.
  if (opts.native) return { image: col.merge(blank).median(), scenes: col.size() };
  const median = col
    .merge(blank)
    .median()
    .setDefaultProjection(ee.Projection("EPSG:4326").atScale(10));
  // Aggregate 10 m pixels to the Landsat grid so both sensors are classified at the same resolution.
  const image = median
    .reduceResolution({ reducer: ee.Reducer.mean(), maxPixels: 64 })
    .reproject({ crs: "EPSG:4326", scale: 30 });
  return { image, scenes: col.size() };
}

/** Appends MNDWI, NDVI, NDBI and a bare-soil index. */
export function withIndices(image: EEAny): EEAny {
  const nd = (a: string, b: string, name: string) => image.normalizedDifference([a, b]).rename(name);
  const bsi = image
    .expression("((swir1 + red) - (nir + blue)) / ((swir1 + red) + (nir + blue))", {
      swir1: image.select("swir1"),
      red: image.select("red"),
      nir: image.select("nir"),
      blue: image.select("blue"),
    })
    .rename("bsi");
  return image.addBands([nd("green", "swir1", "mndwi"), nd("nir", "red", "ndvi"), nd("swir1", "nir", "ndbi"), bsi]);
}

export type Method = "random-forest" | "threshold-baseline";

/**
 * Plain threshold rules (the ML baseline). Used only when no trained classifier asset is configured.
 * Output band `cls`: 0 water, 1 vegetation, 2 bare, 3 built.
 */
export interface BaselineThresholds {
  /** water when MNDWI is above this */
  waterMndwi: number;
  /** vegetation when NDVI is at least this */
  vegNdvi: number;
  /** built-up when NDBI is above this ... */
  builtNdbi: number;
  /** ... and NDVI is below this */
  builtNdvi: number;
}

export const BASELINE: BaselineThresholds = { waterMndwi: 0.1, vegNdvi: 0.3, builtNdbi: 0.05, builtNdvi: 0.2 };

/** JS twin of classifyBaseline, for evaluating the baseline on sampled rows. Precedence: water > vegetation > built > bare. */
export function baselineClassJs(f: { mndwi: number; ndvi: number; ndbi: number }, t: BaselineThresholds = BASELINE): number {
  if (f.mndwi > t.waterMndwi) return 0;
  if (f.ndvi >= t.vegNdvi) return 1;
  if (f.ndbi > t.builtNdbi && f.ndvi < t.builtNdvi) return 3;
  return 2;
}

export function classifyBaseline(ee: EE, features: EEAny, t: BaselineThresholds = BASELINE): EEAny {
  const mndwi = features.select("mndwi");
  const ndvi = features.select("ndvi");
  const ndbi = features.select("ndbi");
  const cls = ee.Image.constant(2) // default: bare / filled soil
    .where(ndbi.gt(t.builtNdbi).and(ndvi.lt(t.builtNdvi)), 3) // built-up
    .where(ndvi.gte(t.vegNdvi), 1) // vegetation / wetland
    .where(mndwi.gt(t.waterMndwi), 0); // water
  return cls.rename("cls").updateMask(features.select("blue").mask());
}

export interface ClassifierHandle {
  method: Method;
  classify: (ee: EE, features: EEAny) => EEAny;
}

/** Trained Random Forest from the configured EE asset, else the threshold baseline (flagged in the response). */
export function getClassifier(): ClassifierHandle {
  const asset = getEnv().GEE_CLASSIFIER_ASSET;
  if (!asset) return { method: "threshold-baseline", classify: classifyBaseline };
  return {
    method: "random-forest",
    classify: (ee, features) =>
      features
        .select([...FEATURE_BANDS])
        .classify(ee.Classifier.load(asset))
        .rename("cls")
        .updateMask(features.select("blue").mask()),
  };
}

/** Choose the sensor for a year from measured coverage: Sentinel-2 from 2017, falling back to Landsat when S2 L2A is too sparse. */
export function chooseSensor(
  year: number,
  validLandsat: number | null,
  validS2: number | null,
  minValid = MIN_VALID_FRACTION,
): { sensor: Sensor; valid: number; fellBack: boolean } | { sensor: null; valid: number; fellBack: false } {
  const l = validLandsat ?? 0;
  const s = validS2 ?? 0;
  if (year >= SENTINEL2_FIRST_YEAR) {
    if (s >= minValid) return { sensor: "sentinel2", valid: s, fellBack: false };
    if (l >= minValid) return { sensor: "landsat", valid: l, fellBack: true };
    return { sensor: null, valid: Math.max(s, l), fellBack: false };
  }
  return l >= minValid ? { sensor: "landsat", valid: l, fellBack: false } : { sensor: null, valid: l, fellBack: false };
}

/** Run async work over items with bounded concurrency. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return out;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
