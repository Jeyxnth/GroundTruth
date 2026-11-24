import { evaluate, getEe } from "@/lib/ee/client";
import { SURROUNDINGS_RADIUS_M } from "@/lib/geo";

export interface ElevationData {
  available: boolean;
  /** Present when `available` is false: why no elevation values exist. */
  unavailableReason: string | null;
  dataset: "COPERNICUS/DEM/GLO30" | "USGS/SRTMGL1_003" | null;
  zoneMeanM: number | null;
  zoneMinM: number | null;
  surroundingsMeanM: number | null;
  surroundingsMinM: number | null;
  surroundingsP10M: number | null;
  surroundingsP90M: number | null;
  /** Zone mean minus surroundings mean (metres). Negative = the zone sits lower. */
  relativeElevationM: number | null;
  /** Share of surrounding pixels that are lower than the zone mean (0..1). Small = zone is among the lowest ground nearby. */
  surroundingsLowerShare: number | null;
  isLocalDepression: boolean;
  surroundingsRadiusM: number;
}

/** A zone is a "local depression" when clearly lower than its surroundings and among the lowest ground nearby. */
export const DEPRESSION_MIN_RELATIVE_M = -1.5;
export const DEPRESSION_MAX_LOWER_SHARE = 0.25;

type Stats = Record<string, number | null>;

async function stats(demId: string, kind: "collection" | "image", band: string, lat: number, lng: number, radiusM: number) {
  const ee = await getEe();
  const point = ee.Geometry.Point([lng, lat]);
  const zone = point.buffer(radiusM);
  const ring = point.buffer(SURROUNDINGS_RADIUS_M).difference(zone);

  let dem;
  if (kind === "collection") {
    const col = ee.ImageCollection(demId).select(band);
    // Mosaic of tiles; restore the native projection so reducers sample the 30 m grid.
    dem = col.mosaic().setDefaultProjection(col.first().projection());
  } else {
    dem = ee.Image(demId).select(band);
  }
  const reg = { scale: 30, maxPixels: 1e8 } as const;
  const zoneStats = dem.reduceRegion({
    reducer: ee.Reducer.mean().combine(ee.Reducer.min(), "", true).combine(ee.Reducer.count(), "", true),
    geometry: zone,
    ...reg,
  });
  const ringStats = dem.reduceRegion({
    reducer: ee.Reducer.mean()
      .combine(ee.Reducer.min(), "", true)
      .combine(ee.Reducer.percentile([10, 90]), "", true)
      .combine(ee.Reducer.count(), "", true),
    geometry: ring,
    ...reg,
  });
  // reduceRegion yields a null mean when there is no DEM data (open sea). Substitute 0 so the graph stays valid;
  // the count check afterwards reports "unavailable" instead of using it.
  const rawMean = zoneStats.get(`${band}_mean`);
  const zoneMean = ee.Number(ee.Algorithms.If(ee.Algorithms.IsEqual(rawMean, null), 0, rawMean));
  const lowerShare = dem.lt(zoneMean).reduceRegion({ reducer: ee.Reducer.mean(), geometry: ring, ...reg });
  const merged = ee.Dictionary({
    zone: zoneStats,
    ring: ringStats,
    lowerShare: lowerShare.get(band),
  });
  return evaluate<{ zone: Stats; ring: Stats; lowerShare: number | null }>(merged);
}

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const r2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

export async function computeElevation(lat: number, lng: number, radiusM: number): Promise<ElevationData> {
  const empty = (reason: string): ElevationData => ({
    available: false, unavailableReason: reason, dataset: null,
    zoneMeanM: null, zoneMinM: null, surroundingsMeanM: null, surroundingsMinM: null,
    surroundingsP10M: null, surroundingsP90M: null, relativeElevationM: null,
    surroundingsLowerShare: null, isLocalDepression: false, surroundingsRadiusM: SURROUNDINGS_RADIUS_M,
  });

  const attempts = [
    { id: "COPERNICUS/DEM/GLO30", kind: "collection", band: "DEM" },
    { id: "USGS/SRTMGL1_003", kind: "image", band: "elevation" },
  ] as const;

  for (const a of attempts) {
    const r = await stats(a.id, a.kind, a.band, lat, lng, radiusM);
    const zoneCount = num(r.zone[`${a.band}_count`]) ?? 0;
    const ringCount = num(r.ring[`${a.band}_count`]) ?? 0;
    if (zoneCount === 0 || ringCount === 0) continue; // no data here; try the fallback DEM

    const zoneMean = num(r.zone[`${a.band}_mean`]);
    const ringMean = num(r.ring[`${a.band}_mean`]);
    const relative = zoneMean !== null && ringMean !== null ? zoneMean - ringMean : null;
    const lowerShare = num(r.lowerShare);
    return {
      available: true,
      unavailableReason: null,
      dataset: a.id,
      zoneMeanM: r2(zoneMean),
      zoneMinM: r2(num(r.zone[`${a.band}_min`])),
      surroundingsMeanM: r2(ringMean),
      surroundingsMinM: r2(num(r.ring[`${a.band}_min`])),
      surroundingsP10M: r2(num(r.ring[`${a.band}_p10`])),
      surroundingsP90M: r2(num(r.ring[`${a.band}_p90`])),
      relativeElevationM: r2(relative),
      surroundingsLowerShare: lowerShare === null ? null : Math.round(lowerShare * 1000) / 1000,
      isLocalDepression:
        relative !== null &&
        lowerShare !== null &&
        relative <= DEPRESSION_MIN_RELATIVE_M &&
        lowerShare <= DEPRESSION_MAX_LOWER_SHARE,
      surroundingsRadiusM: SURROUNDINGS_RADIUS_M,
    };
  }
  return empty("No elevation data covers this point (Copernicus GLO-30 and SRTM both empty). This usually means open sea.");
}
