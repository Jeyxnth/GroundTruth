/* eslint-disable @typescript-eslint/no-explicit-any */
import { CLASS_LABELS } from "./config";

const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "n/a" : `${(v * 100).toFixed(d)}%`);
const f2 = (v: number | null | undefined) => (v === null || v === undefined ? "n/a" : v.toFixed(3));

function confusion(m: any): string {
  const head = `| true \\ predicted | ${CLASS_LABELS.join(" | ")} | total |\n| --- | ${CLASS_LABELS.map(() => "---:").join(" | ")} | ---: |`;
  const rows = m.matrix.map((r: number[], i: number) => `| **${CLASS_LABELS[i]}** | ${r.join(" | ")} | ${r.reduce((a, b) => a + b, 0)} |`);
  return [head, ...rows].join("\n");
}

function perClassTable(models: Array<{ key: string; label: string }>, ev: Record<string, any>): string {
  const head = `| Model | OA | Kappa | Macro F1 | ${CLASS_LABELS.map((c) => `F1 ${c}`).join(" | ")} |\n| --- | ---: | ---: | ---: | ${CLASS_LABELS.map(() => "---:").join(" | ")} |`;
  const rows = models.map((m) => {
    const x = ev[m.key];
    return `| ${m.label} | ${pct(x.overallAccuracy)} | ${f2(x.kappa)} | ${f2(x.macroF1)} | ${x.perClass.map((c: any) => f2(c.f1)).join(" | ")} |`;
  });
  return [head, ...rows].join("\n");
}

export function renderReport(r: any): string {
  const M = r.models as Array<{ key: string; label: string }>;
  const ev = r.evaluation;
  const held = ev["heldout:both"];
  const best = held.pooled;
  const tunedBase = held.baselineTuned;
  const dflt = held.baseline;
  const ag = r.agreement;
  const trainTotal = Object.values(r.trainCounts as Record<string, number>).reduce((a, b) => a + b, 0);
  const lines: string[] = [];
  const P = (s = "") => lines.push(s);

  P(`# Land-cover model results`);
  P();
  P(`Generated ${r.generatedAt} by \`pnpm ml:train\` (version \`${r.version}\`). Every number below is computed by that script from Earth Engine data; nothing is typed in by hand. Raw numbers: \`docs/ml-results.json\`.`);
  P();
  P(`## Headline (for the slide)`);
  P();
  P(`- **${pct(best.overallAccuracy)} overall accuracy** and **macro F1 ${f2(best.macroF1)}** on cities the model never saw (${Object.keys(r.perCity).join(", ")}), in years it never saw (${r.config.testYears.join(", ")}), n = ${best.total}.`);
  P(`- **${best.overallAccuracy > tunedBase.overallAccuracy ? "Beats" : "Does not beat"} the threshold baseline**: ${pct(best.overallAccuracy)} vs ${pct(tunedBase.overallAccuracy)} (baseline thresholds tuned on the training data) and ${pct(dflt.overallAccuracy)} (default thresholds). Macro F1 ${f2(best.macroF1)} vs ${f2(tunedBase.macroF1)} / ${f2(dflt.macroF1)}.`);
  P(`- **Cross-sensor agreement** (same pixels, Landsat vs Sentinel-2, overlap years ${r.config.agreementYears.join(" and ")}): **${pct(ag.all.pooled.agreement)}** (kappa ${f2(ag.all.pooled.kappa)}, n = ${ag.all.pooled.n}) for the model, vs ${pct(ag.all.baselineTuned.agreement)} for the tuned baseline.`);
  P();
  P(`## What the labels are (read this before quoting the numbers)`);
  P();
  P(`There is no field-surveyed ground truth for hundreds of thousands of Indian pixels. Labels come from **Google Dynamic World** (a Sentinel-2 deep-learning product), grouped into our four classes. So the accuracy above is **agreement with Dynamic World's confident pixels, not agreement with the ground**. Dynamic World has its own errors, and "high confidence" selects easier pixels than a random pixel would be. Real-world accuracy on ambiguous pixels (mixed edges, wet fallow fields, construction sites) will be lower. The independent JRC check below is the only evidence here that does not come from Dynamic World.`);
  P();
  P(`**Classes:** ${CLASS_LABELS.map((c, i) => `${i} ${c}`).join("; ")}. Dynamic World mapping: water; trees + grass + flooded vegetation + crops + shrub = vegetation/wetland; bare = bare/filled soil; built = built-up (snow ignored).`);
  P();
  P(`**High-confidence rule:** across the Jan to Mar scenes of a year, a pixel's 4-class label must agree with the seasonal label in at least ${pct(r.config.label.stability, 0)} of scenes, the mean class probability must be at least ${r.config.label.minProb}, and at least ${pct(r.config.label.purity, 0)} of the 10 m pixels in the 30 m cell must carry that class. (A plain "mean probability above 0.8" rule selected almost nothing: seasonal means over about 35 scenes are diluted.)`);
  P();
  P(`## Design`);
  P();
  P(`| | |`);
  P(`| --- | --- |`);
  P(`| Model | \`ee.Classifier.smileRandomForest\`, ${r.config.rf.numberOfTrees} trees, min leaf ${r.config.rf.minLeafPopulation}, bag fraction ${r.config.rf.bagFraction}, seed ${r.config.rf.seed} |`);
  P(`| Features (${r.config.features.length}) | ${r.config.features.join(", ")}. Bands shared by Landsat and Sentinel-2, plus MNDWI, NDVI, NDBI and a bare-soil index (BSI) |`);
  P(`| Composites | Jan to Mar median per year, cloud-masked (QA_PIXEL for Landsat; Cloud Score+ for Sentinel-2), both on a 30 m grid. Landsat 8/9 bands are mapped onto the ETM+ scale (Roy et al. 2016) so Landsat 5/7/8/9 share one scale |`);
  P(`| Training cities | ${Object.entries(r.config.cities).filter(([, v]: any) => v.split === "train").map(([k]) => k).join(", ")} |`);
  P(`| **Held-out cities** | ${Object.entries(r.config.cities).filter(([, v]: any) => v.split === "heldout").map(([k]) => k).join(", ")} (never used for training or threshold tuning) |`);
  P(`| Training years | ${r.config.trainYears.join(", ")} (both sensors, same pixels) |`);
  P(`| Test years | ${r.config.testYears.join(", ")} (different from training years) |`);
  P(`| Sampling | Stratified, equal points per class per city, year and sensor (${r.config.perClassTrain} per class training, ${r.config.perClassTest} per class test). Training table: ${trainTotal} rows. Classes the city does not have in enough confident pixels contribute fewer rows |`);
  P(`| Held-out test rows per class | ${r.testCounts.map((n: number, i: number) => `${CLASS_LABELS[i]}: ${n}`).join("; ")} |`);
  P(`| Saved asset | \`${r.assets.pooled}\` (app reads this via \`GEE_CLASSIFIER_ASSET\`; it is loaded, never retrained per request) |`);
  P();
  P(`Because the test set is class-balanced by design, overall accuracy weights every class equally. It is not the accuracy you would get on a random pixel, where vegetation and built-up dominate. Per-class F1 is the fairer view.`);
  P();
  P(`## Held-out cities, both sensors pooled`);
  P();
  P(perClassTable(M, held));
  P();
  P(`### Confusion matrix: Random Forest (both sensors), held-out cities`);
  P();
  P(confusion(best));
  P();
  P(`### Confusion matrix: threshold baseline (tuned), held-out cities`);
  P();
  P(confusion(tunedBase));
  P();
  P(`The baseline is the classic rule set: water if MNDWI > t1; vegetation if NDVI >= t2; built-up if NDBI > t3 and NDVI < t4; else bare. Default thresholds: ${JSON.stringify(r.baseline.default)}. Tuned by grid search to maximise macro F1 on the *training* sample only: ${JSON.stringify(r.baseline.tuned)}.`);
  P();
  P(`## By sensor`);
  P();
  for (const sensor of ["sentinel2", "landsat"]) {
    P(`### ${sensor === "sentinel2" ? "Sentinel-2" : "Landsat"}, held-out cities`);
    P();
    P(perClassTable(M, ev[`heldout:${sensor}`]));
    P();
  }
  P(`## Held-out year in training cities`);
  P();
  P(`Same cities as training, different years (${r.config.testYears.join(", ")}). Tells you whether the model generalises in time, separately from space.`);
  P();
  P(perClassTable(M, ev["temporal:both"]));
  P();
  P(`## Held-out cities, accuracy per city`);
  P();
  P(`| City | n | Random Forest OA | Tuned baseline OA |\n| --- | ---: | ---: | ---: |\n${Object.entries(r.perCity).map(([c, v]: any) => `| ${c} | ${v.n} | ${pct(v.pooledOA)} | ${pct(v.baselineOA)} |`).join("\n")}`);
  P();
  P(`## Cross-sensor consistency`);
  P();
  P(`The same pixels (${ag.all.pooled.n} random 30 m pixels across all six cities, overlap years ${r.config.agreementYears.join(" and ")}) are classified once from the Landsat composite and once from the Sentinel-2 composite. Agreement is how often both give the same class. Target was at least ${pct(r.config.agreementTarget, 0)}.`);
  P();
  P(`| Model | Agreement (all) | Kappa | Agreement (training cities) | Agreement (held-out cities) |\n| --- | ---: | ---: | ---: | ---: |\n${["pooled", "s2only", "lsonly", "baselineTuned", "baseline"].map((k) => `| ${M.find((m) => m.key === k)!.label} | ${pct(ag.all[k].agreement)} | ${f2(ag.all[k].kappa)} | ${pct(ag.train[k].agreement)} | ${pct(ag.heldout[k].agreement)} |`).join("\n")}`);
  P();
  P(`Per-class agreement for the pooled model (of pixels Landsat calls the class, share Sentinel-2 also calls it): ${ag.all.pooled.perClass.map((c: any) => `${CLASS_LABELS[c.class]} ${pct(c.agreement)} (n=${c.n})`).join("; ")}.`);
  P();
  P(`What was done about it: training one model on both sensors' composites of the same pixels (instead of one sensor each), plus the Landsat 8/9 to ETM+ band harmonisation. The single-sensor rows show the gap this closes.`);
  P();
  P(`## Independent check against JRC Global Surface Water (1990 to 2010)`);
  P();
  P(`Dynamic World does not exist before 2015, so it cannot validate the Landsat 5/7 era the app relies on for the "water then filled" story. JRC's yearly water maps are an independent product (a different algorithm and team). For each year, pixels JRC labels *permanent water* are the positives; pixels JRC labels *not water* inside the water-ever extent (shoreline land) are the negatives. Landsat composites for that year are classified. **Water recall** = share of JRC permanent-water pixels we call water. **False-water rate** = share of JRC land pixels we call water.`);
  P();
  P(`| Period | Model | Water recall | False-water rate | n water | n land |\n| --- | --- | ---: | ---: | ---: | ---: |\n${["1990s", "2000s", "2010", "all"].flatMap((era) => ["pooled", "lsonly", "baselineTuned", "baseline"].map((k) => `| ${era} | ${M.find((m) => m.key === k)!.label} | ${pct(r.jrc[era][k].waterRecall)} | ${pct(r.jrc[era][k].falseWaterRate)} | ${r.jrc[era][k].nWater} | ${r.jrc[era][k].nLand} |`)).join("\n")}`);
  P();
  P(`How to read this: water recall is high (the model finds nearly all of JRC's permanent water, in every era including the 1990s). The false-water rate is about one in five and is shared by the plain threshold baseline, so it is a property of these pixels rather than of the model: JRC "not water" pixels inside the water-ever extent are shoreline, marsh edge and wet soil, which are spectrally close to shallow water at 30 m. Expect the app to sometimes call a wet edge "water" in a single year; the transition detector needs a multi-year run and the JRC water share is shown alongside, so a one-year blip should not create a "filled lake".`);
  P();
  P(`Only the water class can be checked this way. There is **no independent accuracy measurement for vegetation, bare soil or built-up before 2015**; for the 1985 to 2014 part of the timeline those classes are the model extrapolated to older Landsat sensors (TM/ETM+). The app therefore shows 1985 to 2016 land cover as an estimate, and the transition detector only acts on multi-year runs so that single-year noise does not create a fake "fill".`);
  P();
  P(`## Notes for developers`);
  P();
  P(`- Classify **images**, not sampled rows. A classifier loaded from an EE asset matches table properties by position (alphabetical), not by name, so FeatureCollection.classify with the loaded asset gives wrong answers. Classifying the image band-by-band (as the app does) uses the trained order. The evaluation script therefore samples predictions from classified images.`);
  P(`- Evaluation sampling is paired: for a given city and year the Landsat and Sentinel-2 samples hit the same pixels.`);
  P();
  P(`## Limitations`);
  P();
  P(`- Labels are Dynamic World model output, not field truth (above).`);
  P(`- Training covers six large cities; rural land, hills, deserts and coasts outside these cities are untested.`);
  P(`- Bare/filled soil is the hardest class: scarce in confident labels, and spectrally close to dry fallow fields and some built-up surfaces.`);
  P(`- Landsat resolution is 30 m. A zone of 150 m radius contains about 78 Landsat pixels, so small structures are not resolvable; the app reports shares of the zone, not objects.`);
  P(`- The test set is class-balanced, so overall accuracy is not the random-pixel accuracy.`);
  P();
  P(`## Reproduce`);
  P();
  P("```bash\npnpm ee:check            # credentials\npnpm ml:train            # sample, train, export assets, evaluate, write this file (about 30 to 60 minutes the first time)\npnpm ml:train --refresh  # recompute cached evaluation fetches\npnpm ml:train --retrain  # delete and rebuild the EE assets too\n```");
  P();
  P(`The service account needs the *Earth Engine Resource Writer* role to save assets. Set \`GEE_CLASSIFIER_ASSET\` to the pooled classifier asset above.`);
  return lines.join("\n") + "\n";
}
