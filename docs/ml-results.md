# Land-cover model results

Generated 2026-11-24T14:03:55.401Z by `pnpm ml:train` (version `v1`). Every number below is computed by that script from Earth Engine data; nothing is typed in by hand. Raw numbers: `docs/ml-results.json`.

## Headline (for the slide)

- **92.5% overall accuracy** and **macro F1 0.924** on cities the model never saw (kolkata, guwahati), in years it never saw (2021, 2023), n = 7094.
- **Beats the threshold baseline**: 92.5% vs 71.1% (baseline thresholds tuned on the training data) and 58.2% (default thresholds). Macro F1 0.924 vs 0.648 / 0.490.
- **Cross-sensor agreement** (same pixels, Landsat vs Sentinel-2, overlap years 2021 and 2023): **86.0%** (kappa 0.773, n = 18000) for the model, vs 85.0% for the tuned baseline.

## What the labels are (read this before quoting the numbers)

There is no field-surveyed ground truth for hundreds of thousands of Indian pixels. Labels come from **Google Dynamic World** (a Sentinel-2 deep-learning product), grouped into our four classes. So the accuracy above is **agreement with Dynamic World's confident pixels, not agreement with the ground**. Dynamic World has its own errors, and "high confidence" selects easier pixels than a random pixel would be. Real-world accuracy on ambiguous pixels (mixed edges, wet fallow fields, construction sites) will be lower. The independent JRC check below is the only evidence here that does not come from Dynamic World.

**Classes:** 0 water; 1 vegetation/wetland; 2 bare/filled soil; 3 built-up. Dynamic World mapping: water; trees + grass + flooded vegetation + crops + shrub = vegetation/wetland; bare = bare/filled soil; built = built-up (snow ignored).

**High-confidence rule:** across the Jan to Mar scenes of a year, a pixel's 4-class label must agree with the seasonal label in at least 80% of scenes, the mean class probability must be at least 0.5, and at least 89% of the 10 m pixels in the 30 m cell must carry that class. (A plain "mean probability above 0.8" rule selected almost nothing: seasonal means over about 35 scenes are diluted.)

## Design

| | |
| --- | --- |
| Model | `ee.Classifier.smileRandomForest`, 200 trees, min leaf 2, bag fraction 0.6, seed 42 |
| Features (10) | blue, green, red, nir, swir1, swir2, mndwi, ndvi, ndbi, bsi. Bands shared by Landsat and Sentinel-2, plus MNDWI, NDVI, NDBI and a bare-soil index (BSI) |
| Composites | Jan to Mar median per year, cloud-masked (QA_PIXEL for Landsat; Cloud Score+ for Sentinel-2), both on a 30 m grid. Landsat 8/9 bands are mapped onto the ETM+ scale (Roy et al. 2016) so Landsat 5/7/8/9 share one scale |
| Training cities | bengaluru, chennai, hyderabad, mumbai |
| **Held-out cities** | kolkata, guwahati (never used for training or threshold tuning) |
| Training years | 2019, 2020, 2022 (both sensors, same pixels) |
| Test years | 2021, 2023 (different from training years) |
| Sampling | Stratified, equal points per class per city, year and sensor (350 per class training, 250 per class test). Training table: 32030 rows. Classes the city does not have in enough confident pixels contribute fewer rows |
| Held-out test rows per class | water: 2000; vegetation/wetland: 2000; bare/filled soil: 1094; built-up: 2000 |
| Saved asset | `projects/groundtruth-515710/assets/groundtruth_rf_v1` (app reads this via `GEE_CLASSIFIER_ASSET`; it is loaded, never retrained per request) |

Because the test set is class-balanced by design, overall accuracy weights every class equally. It is not the accuracy you would get on a random pixel, where vegetation and built-up dominate. Per-class F1 is the fairer view.

## Held-out cities, both sensors pooled

| Model | OA | Kappa | Macro F1 | F1 water | F1 vegetation/wetland | F1 bare/filled soil | F1 built-up |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Random Forest (trained on both sensors) | 92.5% | 0.898 | 0.924 | 0.991 | 0.912 | 0.909 | 0.885 |
| Random Forest (Sentinel-2 only) | 88.0% | 0.836 | 0.865 | 0.985 | 0.901 | 0.761 | 0.815 |
| Random Forest (Landsat only) | 89.3% | 0.855 | 0.897 | 0.992 | 0.835 | 0.928 | 0.832 |
| Threshold baseline (default thresholds) | 58.2% | 0.431 | 0.490 | 0.955 | 0.799 | 0.026 | 0.182 |
| Threshold baseline (tuned on training data) | 71.1% | 0.609 | 0.648 | 0.992 | 0.679 | 0.922 | 0.000 |

### Confusion matrix: Random Forest (both sensors), held-out cities

| true \ predicted | water | vegetation/wetland | bare/filled soil | built-up | total |
| --- | ---: | ---: | ---: | ---: | ---: |
| **water** | 1965 | 26 | 3 | 6 | 2000 |
| **vegetation/wetland** | 1 | 1751 | 0 | 248 | 2000 |
| **bare/filled soil** | 0 | 0 | 926 | 168 | 1094 |
| **built-up** | 0 | 64 | 15 | 1921 | 2000 |

### Confusion matrix: threshold baseline (tuned), held-out cities

| true \ predicted | water | vegetation/wetland | bare/filled soil | built-up | total |
| --- | ---: | ---: | ---: | ---: | ---: |
| **water** | 1975 | 25 | 0 | 0 | 2000 |
| **vegetation/wetland** | 3 | 1997 | 0 | 0 | 2000 |
| **bare/filled soil** | 2 | 21 | 1071 | 0 | 1094 |
| **built-up** | 1 | 1842 | 157 | 0 | 2000 |

The baseline is the classic rule set: water if MNDWI > t1; vegetation if NDVI >= t2; built-up if NDBI > t3 and NDVI < t4; else bare. Default thresholds: {"waterMndwi":0.1,"vegNdvi":0.3,"builtNdbi":0.05,"builtNdvi":0.2}. Tuned by grid search to maximise macro F1 on the *training* sample only: {"waterMndwi":-0.1,"vegNdvi":0.15,"builtNdbi":0.4,"builtNdvi":0.1}.

## By sensor

### Sentinel-2, held-out cities

| Model | OA | Kappa | Macro F1 | F1 water | F1 vegetation/wetland | F1 bare/filled soil | F1 built-up |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Random Forest (trained on both sensors) | 94.2% | 0.922 | 0.945 | 0.996 | 0.917 | 0.961 | 0.905 |
| Random Forest (Sentinel-2 only) | 95.0% | 0.932 | 0.953 | 0.994 | 0.924 | 0.977 | 0.917 |
| Random Forest (Landsat only) | 87.0% | 0.825 | 0.872 | 0.995 | 0.821 | 0.883 | 0.787 |
| Threshold baseline (default thresholds) | 62.6% | 0.492 | 0.542 | 0.974 | 0.863 | 0.011 | 0.320 |
| Threshold baseline (tuned on training data) | 71.6% | 0.618 | 0.643 | 0.996 | 0.702 | 0.874 | 0.000 |

### Landsat, held-out cities

| Model | OA | Kappa | Macro F1 | F1 water | F1 vegetation/wetland | F1 bare/filled soil | F1 built-up |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Random Forest (trained on both sensors) | 90.8% | 0.875 | 0.902 | 0.985 | 0.906 | 0.852 | 0.866 |
| Random Forest (Sentinel-2 only) | 81.1% | 0.739 | 0.751 | 0.975 | 0.879 | 0.429 | 0.722 |
| Random Forest (Landsat only) | 91.6% | 0.886 | 0.922 | 0.989 | 0.850 | 0.976 | 0.875 |
| Threshold baseline (default thresholds) | 53.7% | 0.370 | 0.434 | 0.935 | 0.744 | 0.042 | 0.017 |
| Threshold baseline (tuned on training data) | 70.6% | 0.601 | 0.656 | 0.988 | 0.657 | 0.979 | 0.000 |

## Held-out year in training cities

Same cities as training, different years (2021, 2023). Tells you whether the model generalises in time, separately from space.

| Model | OA | Kappa | Macro F1 | F1 water | F1 vegetation/wetland | F1 bare/filled soil | F1 built-up |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Random Forest (trained on both sensors) | 91.9% | 0.892 | 0.920 | 0.990 | 0.898 | 0.939 | 0.852 |
| Random Forest (Sentinel-2 only) | 85.0% | 0.798 | 0.844 | 0.990 | 0.871 | 0.770 | 0.748 |
| Random Forest (Landsat only) | 89.0% | 0.854 | 0.887 | 0.988 | 0.886 | 0.895 | 0.779 |
| Threshold baseline (default thresholds) | 52.3% | 0.363 | 0.505 | 0.899 | 0.729 | 0.197 | 0.195 |
| Threshold baseline (tuned on training data) | 69.9% | 0.598 | 0.622 | 0.958 | 0.669 | 0.860 | 0.000 |

## Held-out cities, accuracy per city

| City | n | Random Forest OA | Tuned baseline OA |
| --- | ---: | ---: | ---: |
| kolkata | 3094 | 90.7% | 66.4% |
| guwahati | 4000 | 94.0% | 74.8% |

## Cross-sensor consistency

The same pixels (18000 random 30 m pixels across all six cities, overlap years 2021 and 2023) are classified once from the Landsat composite and once from the Sentinel-2 composite. Agreement is how often both give the same class. Target was at least 85%.

| Model | Agreement (all) | Kappa | Agreement (training cities) | Agreement (held-out cities) |
| --- | ---: | ---: | ---: | ---: |
| Random Forest (trained on both sensors) | 86.0% | 0.773 | 86.7% | 84.6% |
| Random Forest (Sentinel-2 only) | 82.8% | 0.717 | 84.1% | 80.0% |
| Random Forest (Landsat only) | 75.0% | 0.624 | 74.7% | 75.7% |
| Threshold baseline (tuned on training data) | 85.0% | 0.553 | 82.5% | 90.1% |
| Threshold baseline (default thresholds) | 65.3% | 0.442 | 61.9% | 72.3% |

Per-class agreement for the pooled model (of pixels Landsat calls the class, share Sentinel-2 also calls it): water 95.0% (n=2201); vegetation/wetland 85.1% (n=7051); bare/filled soil 71.4% (n=269); built-up 84.9% (n=8479).

What was done about it: training one model on both sensors' composites of the same pixels (instead of one sensor each), plus the Landsat 8/9 to ETM+ band harmonisation. The single-sensor rows show the gap this closes.

## Independent check against JRC Global Surface Water (1990 to 2010)

Dynamic World does not exist before 2015, so it cannot validate the Landsat 5/7 era the app relies on for the "water then filled" story. JRC's yearly water maps are an independent product (a different algorithm and team). For each year, pixels JRC labels *permanent water* are the positives; pixels JRC labels *not water* inside the water-ever extent (shoreline land) are the negatives. Landsat composites for that year are classified. **Water recall** = share of JRC permanent-water pixels we call water. **False-water rate** = share of JRC land pixels we call water.

| Period | Model | Water recall | False-water rate | n water | n land |
| --- | --- | ---: | ---: | ---: | ---: |
| 1990s | Random Forest (trained on both sensors) | 96.0% | 23.6% | 1800 | 1800 |
| 1990s | Random Forest (Landsat only) | 96.0% | 24.9% | 1800 | 1800 |
| 1990s | Threshold baseline (tuned on training data) | 97.1% | 22.9% | 1800 | 1800 |
| 1990s | Threshold baseline (default thresholds) | 94.2% | 12.4% | 1800 | 1800 |
| 2000s | Random Forest (trained on both sensors) | 98.6% | 22.0% | 1800 | 1800 |
| 2000s | Random Forest (Landsat only) | 98.7% | 25.1% | 1800 | 1800 |
| 2000s | Threshold baseline (tuned on training data) | 98.8% | 22.2% | 1800 | 1800 |
| 2000s | Threshold baseline (default thresholds) | 97.6% | 12.6% | 1800 | 1800 |
| 2010 | Random Forest (trained on both sensors) | 98.0% | 19.3% | 900 | 900 |
| 2010 | Random Forest (Landsat only) | 97.9% | 21.4% | 900 | 900 |
| 2010 | Threshold baseline (tuned on training data) | 98.8% | 20.6% | 900 | 900 |
| 2010 | Threshold baseline (default thresholds) | 96.0% | 8.3% | 900 | 900 |
| all | Random Forest (trained on both sensors) | 97.4% | 22.1% | 4500 | 4500 |
| all | Random Forest (Landsat only) | 97.4% | 24.3% | 4500 | 4500 |
| all | Threshold baseline (tuned on training data) | 98.1% | 22.2% | 4500 | 4500 |
| all | Threshold baseline (default thresholds) | 95.9% | 11.7% | 4500 | 4500 |

How to read this: water recall is high (the model finds nearly all of JRC's permanent water, in every era including the 1990s). The false-water rate is about one in five and is shared by the plain threshold baseline, so it is a property of these pixels rather than of the model: JRC "not water" pixels inside the water-ever extent are shoreline, marsh edge and wet soil, which are spectrally close to shallow water at 30 m. Expect the app to sometimes call a wet edge "water" in a single year; the transition detector needs a multi-year run and the JRC water share is shown alongside, so a one-year blip should not create a "filled lake".

Only the water class can be checked this way. There is **no independent accuracy measurement for vegetation, bare soil or built-up before 2015**; for the 1985 to 2014 part of the timeline those classes are the model extrapolated to older Landsat sensors (TM/ETM+). The app therefore shows 1985 to 2016 land cover as an estimate, and the transition detector only acts on multi-year runs so that single-year noise does not create a fake "fill".

## Notes for developers

- Classify **images**, not sampled rows. A classifier loaded from an EE asset matches table properties by position (alphabetical), not by name, so FeatureCollection.classify with the loaded asset gives wrong answers. Classifying the image band-by-band (as the app does) uses the trained order. The evaluation script therefore samples predictions from classified images.
- Evaluation sampling is paired: for a given city and year the Landsat and Sentinel-2 samples hit the same pixels.

## Limitations

- Labels are Dynamic World model output, not field truth (above).
- Training covers six large cities; rural land, hills, deserts and coasts outside these cities are untested.
- Bare/filled soil is the hardest class: scarce in confident labels, and spectrally close to dry fallow fields and some built-up surfaces.
- Landsat resolution is 30 m. A zone of 150 m radius contains about 78 Landsat pixels, so small structures are not resolvable; the app reports shares of the zone, not objects.
- The test set is class-balanced, so overall accuracy is not the random-pixel accuracy.

## Reproduce

```bash
pnpm ee:check            # credentials
pnpm ml:train            # sample, train, export assets, evaluate, write this file (about 30 to 60 minutes the first time)
pnpm ml:train --refresh  # recompute cached evaluation fetches
pnpm ml:train --retrain  # delete and rebuild the EE assets too
```

The service account needs the *Earth Engine Resource Writer* role to save assets. Set `GEE_CLASSIFIER_ASSET` to the pooled classifier asset above.
