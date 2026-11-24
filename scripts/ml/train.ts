/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * `pnpm ml:train` — trains the land-cover Random Forest in Earth Engine, evaluates it, and writes docs/ml-results.md.
 *
 * Stages (each is cached under scripts/ml/.cache, so reruns resume; use --refresh to recompute fetched results,
 * --retrain to delete and rebuild the EE assets):
 *   A  sample stratified training pixels (Dynamic World labels) -> EE table asset
 *   B  train 3 classifiers from that table (pooled sensors, S2-only, Landsat-only) -> EE classifier assets
 *   C  evaluate on held-out cities and a held-out year
 *   D  cross-sensor agreement in overlap years
 *   E  independent historical water check against JRC (Landsat 5/7 era)
 *   F  write docs/ml-results.md and docs/ml-results.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getEe } from "../../src/lib/ee/client";
import { getEnv } from "../../src/lib/env";
import { FEATURE_BANDS, classifyBaseline, baselineClassJs, BASELINE, type BaselineThresholds, type Sensor } from "../../src/lib/ee/optical";
import { agreementBetween, computeMetrics, type Metrics } from "../../src/lib/ml/metrics";
import * as C from "./config";
import { assetExists, cachedJson, deleteAsset, featureImage, fetchRows, log, pool, region, runTask, sampleTable } from "./lib";
import { renderReport } from "./report";

const SENSORS: Sensor[] = ["sentinel2", "landsat"];
const argv = process.argv.slice(2);
const version = argv.find((a) => a.startsWith("--version="))?.split("=")[1] ?? "v1";
const retrain = argv.includes("--retrain");

type Row = Record<string, any>;
const IDS = [...C.CLASS_IDS];

async function main() {
  const ee: any = await getEe();
  const project = getEnv().GEE_PROJECT_ID!;
  const A = (n: string) => `projects/${project}/assets/${n}`;
  const TABLE = A(`groundtruth_train_${version}`);
  const RF_POOLED = A(`groundtruth_rf_${version}`);
  const RF_S2 = A(`groundtruth_rf_${version}_s2only`);
  const RF_LS = A(`groundtruth_rf_${version}_lsonly`);

  // ---------- Stage A: training table ----------
  if (retrain) for (const id of [TABLE, RF_POOLED, RF_S2, RF_LS]) if (await assetExists(id)) await deleteAsset(id);
  if (!(await assetExists(TABLE))) {
    log("A: building training table", C.TRAIN_CITIES.join(","), C.TRAIN_YEARS.join(","));
    const parts: any[] = [];
    for (const city of C.TRAIN_CITIES) for (const year of C.TRAIN_YEARS) for (const sensor of SENSORS)
      parts.push(sampleTable(ee, { city, year, sensor, perClass: C.PER_CLASS_TRAIN, seed: 1 }));
    const table = ee.FeatureCollection(parts).flatten();
    await runTask(ee.batch.Export.table.toAsset(table, `gt_train_${version}`, TABLE), "training table");
  } else log("A: training table exists", TABLE);

  // ---------- Stage B: classifiers ----------
  const train = ee.FeatureCollection(TABLE);
  const rf = () => ee.Classifier.smileRandomForest({ ...C.RF });
  const fit = (fc: any) => rf().train({ features: fc, classProperty: "label", inputProperties: [...FEATURE_BANDS] });
  const defs = [
    { id: RF_POOLED, name: "pooled", fc: train },
    { id: RF_S2, name: "s2only", fc: train.filter(ee.Filter.eq("sensor", "sentinel2")) },
    { id: RF_LS, name: "lsonly", fc: train.filter(ee.Filter.eq("sensor", "landsat")) },
  ];
  const todo = [];
  for (const d of defs) if (!(await assetExists(d.id))) todo.push(d);
  if (todo.length) {
    log("B: training + exporting", todo.map((d) => d.name).join(","));
    await Promise.all(todo.map((d) => runTask(ee.batch.Export.classifier.toAsset(fit(d.fc), `gt_rf_${d.name}_${version}`, d.id), `classifier ${d.name}`)));
  } else log("B: classifier assets exist");
  const clf = { pooled: ee.Classifier.load(RF_POOLED), s2only: ee.Classifier.load(RF_S2), lsonly: ee.Classifier.load(RF_LS) };

  // Training-set facts (class counts per sensor) from a bounded fetch
  const trainRows: Row[] = await cachedJson("train_rows", async () => {
    const parts = IDS.map((k) => train.filter(ee.Filter.eq("label", k)).randomColumn("r", 7).sort("r").limit(1200));
    return fetchRowsRaw(ee.FeatureCollection(parts).flatten());
  });
  const trainCounts: Record<string, number> = await cachedJson("train_counts", async () => {
    const out: Record<string, number> = {};
    for (const s of SENSORS) for (const k of IDS) {
      const n: number = await new Promise((res, rej) => train.filter(ee.Filter.and(ee.Filter.eq("sensor", s), ee.Filter.eq("label", k))).size().evaluate((v: number, e?: string) => (e ? rej(new Error(e)) : res(v))));
      out[`${s}:${k}`] = n;
    }
    return out;
  });
  log("train counts", JSON.stringify(trainCounts));

  // Baseline thresholds: default, and tuned on the training sample (fair comparison)
  const tuned = tuneBaseline(trainRows);
  log("baseline tuned", JSON.stringify(tuned.t), "train macroF1", tuned.f1.toFixed(3));

  // ---------- Stage C: evaluation ----------
  type Job = { set: "heldout" | "temporal"; city: string; year: number; sensor: Sensor };
  const jobs: Job[] = [];
  for (const [set, cities] of [["heldout", C.HELDOUT_CITIES], ["temporal", C.TRAIN_CITIES]] as const)
    for (const city of cities) for (const year of C.TEST_YEARS) for (const sensor of SENSORS) jobs.push({ set, city, year, sensor });

  log("C: evaluating", jobs.length, "city/year/sensor tables");
  const evalRows = await pool(jobs, 2, async (j) => {
    const tbl = sampleTable(ee, { city: j.city, year: j.year, sensor: j.sensor, perClass: C.PER_CLASS_TEST, seed: 777, classifiers: { p_pooled: clf.pooled, p_s2only: clf.s2only, p_lsonly: clf.lsonly } });
    const rows = await fetchRows<Row>(`eval_${j.set}_${j.city}_${j.year}_${j.sensor}`, tbl);
    log(`  ${j.set} ${j.city} ${j.year} ${j.sensor}: ${rows.length} rows`);
    return rows.map((r): Row => ({ ...r, set: j.set }));
  });
  const all = evalRows.flat();

  const models: Array<{ key: string; label: string; predict: (r: Row) => number }> = [
    { key: "pooled", label: "Random Forest (trained on both sensors)", predict: (r) => r.p_pooled },
    { key: "s2only", label: "Random Forest (Sentinel-2 only)", predict: (r) => r.p_s2only },
    { key: "lsonly", label: "Random Forest (Landsat only)", predict: (r) => r.p_lsonly },
    { key: "baseline", label: "Threshold baseline (default thresholds)", predict: (r) => baselineClassJs(r as any) },
    { key: "baselineTuned", label: "Threshold baseline (tuned on training data)", predict: (r) => baselineClassJs(r as any, tuned.t) },
  ];
  const evaluation: Record<string, Record<string, Metrics>> = {};
  for (const set of ["heldout", "temporal"]) for (const sensor of [...SENSORS, "both"]) {
    const rows = all.filter((r) => r.set === set && (sensor === "both" || r.sensor === sensor));
    evaluation[`${set}:${sensor}`] = {};
    for (const m of models) evaluation[`${set}:${sensor}`]![m.key] = computeMetrics(rows.map((r) => r.label), rows.map(m.predict), IDS);
  }
  // Per-city detail for the held-out cities (pooled model vs tuned baseline)
  const perCity: Record<string, { n: number; pooledOA: number; baselineOA: number }> = {};
  for (const city of C.HELDOUT_CITIES) {
    const rows = all.filter((r) => r.set === "heldout" && r.city === city);
    perCity[city] = {
      n: rows.length,
      pooledOA: computeMetrics(rows.map((r) => r.label), rows.map((r) => r.p_pooled), IDS).overallAccuracy,
      baselineOA: computeMetrics(rows.map((r) => r.label), rows.map((r) => baselineClassJs(r as any, tuned.t)), IDS).overallAccuracy,
    };
  }
  const testCounts = IDS.map((k) => all.filter((r) => r.set === "heldout" && r.label === k).length);

  // ---------- Stage D: cross-sensor agreement ----------
  log("D: cross-sensor agreement");
  const agreeJobs = Object.keys(C.CITIES).flatMap((city) => C.AGREEMENT_YEARS.map((year) => ({ city, year })));
  const agreeRows = (
    await pool(agreeJobs, 2, async (j) => {
      const g = region(ee, j.city);
      const ls = featureImage(ee, "landsat", g, j.year);
      const s2 = featureImage(ee, "sentinel2", g, j.year);
      const bands: any[] = [];
      for (const [name, c] of Object.entries(clf)) {
        bands.push(ls.classify(c).rename(`${name}_ls`), s2.classify(c).rename(`${name}_s2`));
      }
      bands.push(classifyBaseline(ee, ls, tuned.t).rename("baselineTuned_ls"), classifyBaseline(ee, s2, tuned.t).rename("baselineTuned_s2"));
      bands.push(classifyBaseline(ee, ls).rename("baseline_ls"), classifyBaseline(ee, s2).rename("baseline_s2"));
      const img = ee.Image.cat(bands);
      const rows = await fetchRows<Row>(`agree_${j.city}_${j.year}`, img.sample({ region: g, scale: 30, numPixels: C.AGREEMENT_POINTS, seed: 5, tileScale: 4, dropNulls: true, geometries: false }));
      log(`  agreement ${j.city} ${j.year}: ${rows.length} px`);
      return rows.map((r): Row => ({ ...r, city: j.city, split: C.CITIES[j.city]!.split }));
    })
  ).flat();
  const agreement: Record<string, Record<string, ReturnType<typeof agreementBetween>>> = {};
  for (const group of ["all", "train", "heldout"]) {
    const rows = agreeRows.filter((r) => group === "all" || r.split === group);
    agreement[group] = {};
    for (const name of ["pooled", "s2only", "lsonly", "baseline", "baselineTuned"])
      agreement[group]![name] = agreementBetween(rows.map((r) => r[`${name}_ls`]), rows.map((r) => r[`${name}_s2`]), IDS);
  }
  log("agreement(all): " + Object.entries(agreement.all!).map(([k, v]) => `${k}=${(v.agreement * 100).toFixed(1)}%`).join(" "));

  // ---------- Stage E: independent historical water check vs JRC ----------
  log("E: JRC historical water check");
  const jrcJobs = Object.keys(C.CITIES).flatMap((city) => C.JRC_CHECK_YEARS.map((year) => ({ city, year })));
  const jrcRows = (
    await pool(jrcJobs, 2, async (j) => {
      const g = region(ee, j.city);
      const wc = ee.ImageCollection("JRC/GSW1_4/YearlyHistory").filter(ee.Filter.eq("year", j.year)).first().select("waterClass");
      // JRC permanent water -> 0 (water); JRC "not water" pixels inside the ever-water extent -> 1 (land)
      const lab = ee.Image.constant(1).where(wc.eq(3), 0).updateMask(wc.eq(3).or(wc.eq(1))).toInt().rename("label");
      const feats = featureImage(ee, "landsat", g, j.year);
      const sampled = feats.addBands(lab).addBands(feats.classify(clf.pooled).rename("p_pooled")).addBands(feats.classify(clf.lsonly).rename("p_lsonly"))
        .stratifiedSample({ numPoints: 0, classBand: "label", region: g, scale: 30, classValues: [0, 1], classPoints: [150, 150], seed: 11, tileScale: 4, dropNulls: true, geometries: false });
      const tbl = sampled;
      const rows = await fetchRows<Row>(`jrc_${j.city}_${j.year}`, tbl);
      log(`  jrc ${j.city} ${j.year}: ${rows.length} rows`);
      return rows.map((r): Row => ({ ...r, city: j.city, year: j.year }));
    })
  ).flat();
  const jrcModels: Array<[string, (r: Row) => number]> = [
    ["pooled", (r) => r.p_pooled], ["lsonly", (r) => r.p_lsonly],
    ["baseline", (r) => baselineClassJs(r as any)], ["baselineTuned", (r) => baselineClassJs(r as any, tuned.t)],
  ];
  const jrc: Record<string, Record<string, { waterRecall: number | null; falseWaterRate: number | null; nWater: number; nLand: number }>> = {};
  for (const [era, years] of [["1990s", [1990, 1995]], ["2000s", [2000, 2005]], ["2010", [2010]], ["all", C.JRC_CHECK_YEARS]] as const) {
    const rows = jrcRows.filter((r) => (years as readonly number[]).includes(r.year));
    const w = rows.filter((r) => r.label === 0), l = rows.filter((r) => r.label === 1);
    jrc[era] = {};
    for (const [name, p] of jrcModels) {
      jrc[era]![name] = {
        waterRecall: w.length ? w.filter((r) => p(r) === 0).length / w.length : null,
        falseWaterRate: l.length ? l.filter((r) => p(r) === 0).length / l.length : null,
        nWater: w.length, nLand: l.length,
      };
    }
  }

  // ---------- Stage F: report ----------
  const results = {
    generatedAt: new Date().toISOString(), version,
    assets: { table: TABLE, pooled: RF_POOLED, s2only: RF_S2, lsonly: RF_LS },
    config: { cities: C.CITIES, trainYears: C.TRAIN_YEARS, testYears: C.TEST_YEARS, agreementYears: C.AGREEMENT_YEARS, jrcCheckYears: C.JRC_CHECK_YEARS, season: C.SEASON,
      label: { stability: C.LABEL_STABILITY, minProb: C.LABEL_MIN_PROB, purity: C.LABEL_PURITY }, perClassTrain: C.PER_CLASS_TRAIN, perClassTest: C.PER_CLASS_TEST, rf: C.RF, features: [...FEATURE_BANDS], agreementTarget: C.AGREEMENT_TARGET },
    trainCounts, testCounts, baseline: { default: BASELINE, tuned: tuned.t, tunedTrainMacroF1: tuned.f1 },
    evaluation, perCity, agreement, jrc,
    models: models.map(({ key, label }) => ({ key, label })),
  };
  mkdirSync("docs", { recursive: true });
  writeFileSync("docs/ml-results.json", JSON.stringify(results, null, 2));
  writeFileSync("docs/ml-results.md", renderReport(results as any));
  log("F: wrote docs/ml-results.md");
  console.log(`\nSet in .env.local:\nGEE_CLASSIFIER_ASSET=${RF_POOLED}\n`);
}

/** fetch without disk caching (used inside cachedJson, which caches the result itself). */
async function fetchRowsRaw(fc: any): Promise<Row[]> {
  const { evaluate } = await import("../../src/lib/ee/client");
  const res = await evaluate<{ features: Array<{ properties: Row }> }>(fc, 420_000);
  return res.features.map((f) => f.properties);
}

/** Coarse grid search of the baseline thresholds, maximising macro F1 on the training sample. */
function tuneBaseline(rows: Row[]): { t: BaselineThresholds; f1: number } {
  let best = { t: BASELINE, f1: -1 };
  const labels = rows.map((r) => r.label);
  for (const waterMndwi of [-0.4, -0.3, -0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.3])
    for (const vegNdvi of [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5])
      for (const builtNdbi of [-0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4])
        for (const builtNdvi of [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]) {
          const t = { waterMndwi, vegNdvi, builtNdbi, builtNdvi };
          const f1 = computeMetrics(labels, rows.map((r) => baselineClassJs(r as any, t)), IDS).macroF1;
          if (f1 > best.f1) best = { t, f1 };
        }
  return best;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
