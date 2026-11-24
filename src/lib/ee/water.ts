/* eslint-disable @typescript-eslint/no-explicit-any */
import { evaluate, getEe } from "@/lib/ee/client";
import {
  summarizeWater,
  type GswStats,
  type WaterSummary,
  type YearlyWater,
} from "@/lib/analysis/water-summary";

const GSW_ID = "JRC/GSW1_4/GlobalSurfaceWater"; // newest JRC GSW version in the EE catalog (checked: no 1_5 / 2_0)
const YEARLY_ID = "JRC/GSW1_4/YearlyHistory";
const DISTANCE_SEARCH_RADIUS_M = 2000;

export interface WaterHistoryData {
  dataset: { occurrence: string; yearly: string };
  yearly: YearlyWater[];
  gsw: GswStats;
  summary: WaterSummary;
  distanceSearchRadiusM: number;
}

interface FeatureCollectionResult {
  features: Array<{ properties: Record<string, number | null> }>;
}

export async function computeWaterHistory(lat: number, lng: number, radiusM: number): Promise<WaterHistoryData> {
  const ee = await getEe();
  const zone = ee.Geometry.Point([lng, lat]).buffer(radiusM);
  const yearly = ee.ImageCollection(YEARLY_ID);

  // Per-year share of the zone that is seasonal / permanent water, and how much of it was observed.
  const perYear = yearly.map((img: any) => {
    // YearlyHistory is masked outside the ever-water extent: treat that as observed, not water.
    const wc = img.select("waterClass").unmask(1);
    const stack = ee.Image.cat([
      wc.gt(0).rename("observed"),
      wc.eq(2).rename("seasonal"),
      wc.eq(3).rename("permanent"),
    ]).unmask(0);
    const stats = stack.reduceRegion({ reducer: ee.Reducer.mean(), geometry: zone, scale: 30, maxPixels: 1e7 });
    return ee.Feature(null, stats).set("year", img.get("year"));
  });

  // Whole-record statistics from the occurrence image.
  const gswImg = ee.Image(GSW_ID);
  const occ = gswImg.select("occurrence").unmask(0);
  const seas = gswImg.select("seasonality").unmask(0);
  const gswMean = ee.Image.cat([occ.rename("occ"), occ.gt(0).rename("ever"), gswImg.select("occurrence").mask().rename("valid")]).reduceRegion({
    reducer: ee.Reducer.mean(), geometry: zone, scale: 30, maxPixels: 1e7,
  });
  const gswMax = ee.Image.cat([occ.rename("occ"), seas.rename("seas")]).reduceRegion({
    reducer: ee.Reducer.max(), geometry: zone, scale: 30, maxPixels: 1e7,
  });

  // Distance from the zone to water seen in the last 5 JRC years.
  const lastYear = ee.Number(yearly.aggregate_max("year"));
  const recentWater = yearly
    .filter(ee.Filter.gte("year", lastYear.subtract(4)))
    .map((img: any) => img.select("waterClass").gte(2).unmask(0))
    .max()
    .setDefaultProjection(ee.Projection("EPSG:4326").atScale(30));
  // Input is 0/1 with masked pixels unmasked to 0, so skipMasked=false and 0 means "water inside the zone".
  const dist = recentWater
    .distance(ee.Kernel.euclidean(DISTANCE_SEARCH_RADIUS_M, "meters"), false)
    .rename("dist")
    .reduceRegion({ reducer: ee.Reducer.min(), geometry: zone, scale: 30, maxPixels: 1e7 });

  const [fc, mean, max, d] = await Promise.all([
    evaluate<FeatureCollectionResult>(perYear),
    evaluate<Record<string, number | null>>(gswMean),
    evaluate<Record<string, number | null>>(gswMax),
    evaluate<Record<string, number | null>>(dist),
  ]);

  const yearlyOut: YearlyWater[] = fc.features
    .map((f) => f.properties)
    .filter((p) => typeof p.year === "number")
    .map((p) => ({
      year: p.year as number,
      observedFraction: p.observed ?? 0,
      seasonalFraction: p.seasonal ?? 0,
      permanentFraction: p.permanent ?? 0,
      waterFraction: (p.seasonal ?? 0) + (p.permanent ?? 0),
    }))
    .sort((a, b) => a.year - b.year);

  const gsw: GswStats = {
    occurrenceMean: mean.occ ?? 0,
    occurrenceMax: max.occ ?? 0,
    fractionEverWater: mean.ever ?? 0,
    seasonalityMaxMonths: max.seas ?? 0,
    validFraction: mean.valid ?? 0,
  };

  // The distance image is zero inside water, so 0 means water is in the zone; null means none within range.
  // The kernel radius is approximate on a geographic grid; anything beyond the nominal radius counts as "none in range".
  const meters = typeof d.dist === "number" && d.dist <= DISTANCE_SEARCH_RADIUS_M ? d.dist : null;

  return {
    dataset: { occurrence: GSW_ID, yearly: YEARLY_ID },
    yearly: yearlyOut,
    gsw,
    summary: summarizeWater(yearlyOut, gsw, { meters, searchRadiusM: DISTANCE_SEARCH_RADIUS_M }),
    distanceSearchRadiusM: DISTANCE_SEARCH_RADIUS_M,
  };
}
