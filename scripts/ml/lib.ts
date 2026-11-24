/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { evaluate, getEe } from "../../src/lib/ee/client";
import { FEATURE_BANDS, buildComposite, withIndices, type Sensor } from "../../src/lib/ee/optical";
import { CITIES, LABEL_MIN_PROB, LABEL_PURITY, LABEL_STABILITY, SEASON } from "./config";

const CACHE_DIR = "scripts/ml/.cache";
mkdirSync(CACHE_DIR, { recursive: true });

export const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

export function region(ee: any, city: string) {
  return ee.Geometry.Rectangle(CITIES[city]!.bbox);
}

/** Per-sensor feature image: six shared bands + MNDWI, NDVI, NDBI, BSI. Same code path the app uses. */
export function featureImage(ee: any, sensor: Sensor, geom: any, year: number) {
  return withIndices(buildComposite(ee, sensor, geom, year, SEASON).image).select([...FEATURE_BANDS]);
}

/**
 * Dynamic World label at 30 m, 4 classes (0 water, 1 vegetation/wetland, 2 bare, 3 built-up).
 * A pixel is high-confidence only if, across the season's scenes: the per-scene 4-class label agrees with the
 * seasonal label in at least LABEL_STABILITY of scenes, and the mean class probability is at least LABEL_MIN_PROB.
 * Then a 30 m cell is kept only if at least LABEL_PURITY of its 10 m pixels carry the same class.
 */
export function dwLabel(ee: any, geom: any, year: number) {
  const start = ee.Date.fromYMD(year, SEASON.startMonth, 1);
  const end = start.advance(SEASON.endMonth - SEASON.startMonth + 1, "month");
  const dw = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1").filterBounds(geom).filterDate(start, end);
  const p = dw.select(["water", "trees", "grass", "flooded_vegetation", "crops", "shrub_and_scrub", "bare", "built"]).mean();
  const probs = ee.Image.cat([
    p.select("water"),
    p.select(["trees", "grass", "flooded_vegetation", "crops", "shrub_and_scrub"]).reduce(ee.Reducer.sum()),
    p.select("bare"),
    p.select("built"),
  ]).rename(["w", "v", "b", "u"]);
  const probLabel = probs.toArray().arrayArgmax().arrayGet([0]).toInt();
  const maxProb = probs.reduce(ee.Reducer.max());
  const agree = dw
    .map((img: any) =>
      img.select("label").remap([0, 1, 2, 3, 4, 5, 6, 7, 8], [0, 1, 1, 1, 1, 1, 3, 2, -1]).eq(probLabel).rename("a"),
    )
    .mean();
  const stable = probLabel.updateMask(agree.gte(LABEL_STABILITY).and(maxProb.gte(LABEL_MIN_PROB)));
  // Purity at 30 m: share of 10 m pixels in the cell that carry each class (unstable pixels count against every class).
  const ind = ee.Image.cat([0, 1, 2, 3].map((k: number) => stable.eq(k).unmask(0).rename("k" + k)));
  const p30 = ind
    .setDefaultProjection(ee.Projection("EPSG:4326").atScale(10))
    .reduceResolution({ reducer: ee.Reducer.mean(), maxPixels: 16 })
    .reproject({ crs: "EPSG:4326", scale: 30 });
  const purity = p30.reduce(ee.Reducer.max());
  return p30.toArray().arrayArgmax().arrayGet([0]).toInt().rename("label").updateMask(purity.gte(LABEL_PURITY));
}

/** Stratified sample (equal points per class) of features + DW label for one city, year and sensor. */
export function sampleTable(
  ee: any,
  o: { city: string; year: number; sensor: Sensor; perClass: number; seed: number; classifiers?: Record<string, any> },
) {
  const geom = region(ee, o.city);
  const feats = featureImage(ee, o.sensor, geom, o.year);
  let stack = feats.addBands(dwLabel(ee, geom, o.year));
  // Predictions are made on the IMAGE (bands in trained order), exactly as the app does. Classifying sampled rows with a
  // loaded classifier matches properties by position, not name, and gives wrong results.
  for (const [name, c] of Object.entries(o.classifiers ?? {})) stack = stack.addBands(feats.classify(c).rename(name));
  return stack
    .stratifiedSample({
      numPoints: 0,
      classBand: "label",
      region: geom,
      scale: 30,
      classValues: [0, 1, 2, 3],
      classPoints: [o.perClass, o.perClass, o.perClass, o.perClass],
      seed: o.seed,
      tileScale: 4,
      dropNulls: true,
      geometries: true,
    })
    .map((f: any) => f.set({ city: o.city, year: o.year, sensor: o.sensor }));
}

/** evaluate() with an on-disk cache so reruns of later stages are fast. Collections must stay under 5000 rows. */
export async function fetchRows<T = Record<string, any>>(name: string, fc: any, timeoutMs = 420_000): Promise<T[]> {
  const file = `${CACHE_DIR}/${name}.json`;
  if (existsSync(file) && !process.argv.includes("--refresh")) return JSON.parse(readFileSync(file, "utf8")) as T[];
  let res: { features: Array<{ properties: T }> } | undefined;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await evaluate<{ features: Array<{ properties: T }> }>(fc, timeoutMs);
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      log(`  retry ${name} after: ${e instanceof Error ? e.message : e}`);
      await new Promise((r) => setTimeout(r, 15_000 * attempt));
    }
  }
  const rows = res.features.map((f) => f.properties);
  writeFileSync(file, JSON.stringify(rows));
  return rows;
}

export async function cachedJson<T>(name: string, make: () => Promise<T>): Promise<T> {
  const file = `${CACHE_DIR}/${name}.json`;
  if (existsSync(file) && !process.argv.includes("--refresh")) return JSON.parse(readFileSync(file, "utf8")) as T;
  const v = await make();
  writeFileSync(file, JSON.stringify(v));
  return v;
}

export async function assetExists(assetId: string): Promise<boolean> {
  const ee: any = await getEe();
  return new Promise((resolve) => ee.data.getAsset(assetId, (a: unknown, err?: unknown) => resolve(!err && !!a)));
}

export async function deleteAsset(assetId: string): Promise<void> {
  const ee: any = await getEe();
  await new Promise<void>((resolve, reject) => ee.data.deleteAsset(assetId, (_: unknown, err?: string) => (err ? reject(new Error(err)) : resolve())));
}

/** Start an export task and wait until it finishes. */
export async function runTask(task: any, label: string, pollMs = 10_000, timeoutMs = 45 * 60_000): Promise<void> {
  const ee: any = await getEe();
  await new Promise<void>((resolve, reject) => task.start(() => resolve(), (e: string) => reject(new Error(`start ${label}: ${e}`))));
  const t0 = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, pollMs));
    const st: any = await new Promise((resolve, reject) =>
      ee.data.getTaskStatus(task.id, (s: any[], err?: string) => (err ? reject(new Error(err)) : resolve(s?.[0]))),
    );
    log(`  task ${label}: ${st?.state}`);
    if (st?.state === "COMPLETED") return;
    if (st?.state === "FAILED" || st?.state === "CANCELLED") throw new Error(`task ${label} ${st.state}: ${st.error_message ?? ""}`);
    if (Date.now() - t0 > timeoutMs) throw new Error(`task ${label} timed out`);
  }
}

export async function pool<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i] as T, i);
      }
    }),
  );
  return out;
}
