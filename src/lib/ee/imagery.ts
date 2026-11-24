/* eslint-disable @typescript-eslint/no-explicit-any */
import { EeError, evaluate, getEe } from "@/lib/ee/client";
import {
  FIRST_YEAR,
  SENTINEL2_FIRST_YEAR,
  buildComposite,
  chooseSensor,
  chunk,
  lastCompleteYear,
  mapPool,
  seasonFromEnv,
  seasonLabel,
  type SeasonWindow,
  type Sensor,
} from "@/lib/ee/optical";

/** Imagery is only shown for years where at least this share of the zone is cloud-free. */
const IMAGERY_MIN_VALID = 0.8;
// About 2x Sentinel-2 native resolution across the frame; the browser scales it smoothly, so Landsat reads as soft, not blocky.
const FRAME_PIXELS = 132;
const VIEW_RADIUS_FACTOR = 2.2; // frame shows ~2.2x the zone radius so the surroundings are visible

export interface ImageryFrame {
  year: number;
  sensor: Sensor;
  url: string;
}

export interface ImageryData {
  season: { label: string };
  /** Earliest and latest clear years. Null when fewer than two clear years exist. */
  before: ImageryFrame | null;
  after: ImageryFrame | null;
  frames: ImageryFrame[];
  /** Animated GIF of the frames (download or share). Null if EE could not build it. */
  gifUrl: string | null;
  gifError: string | null;
  /** Years excluded for lack of cloud-free imagery. */
  skippedYears: number[];
  frameBounds: { west: number; south: number; east: number; north: number };
  note: string;
}

const getUrl = <T>(fn: (cb: (v: T | undefined, err?: string) => void) => void, label: string): Promise<T> =>
  new Promise((resolve, reject) => {
    fn((v, err) => {
      if (err || !v) reject(new EeError(`${label}: ${err ?? "empty response"}`, /quota|too many|429/i.test(err ?? "") ? "quota" : "compute"));
      else resolve(v);
    });
  });

async function coverage(
  sensor: Sensor, years: number[], zone: any, season: SeasonWindow,
): Promise<Map<number, number>> {
  const ee = await getEe();
  const dictFor = (year: number) => {
    const { image } = buildComposite(ee, sensor, zone, year, season);
    const valid = image.select("red").mask().reduceRegion({ reducer: ee.Reducer.mean(), geometry: zone, scale: 30, maxPixels: 1e7 }).get("red");
    return ee.Dictionary({ year, valid });
  };
  const parts = await mapPool(chunk(years, 10), 3, (ys) =>
    evaluate<Array<{ year: number; valid: number | null }>>(ee.List(ys.map(dictFor))),
  );
  return new Map(parts.flat().map((r) => [r.year, r.valid ?? 0]));
}

export async function computeImagery(lat: number, lng: number, radiusM: number, now = new Date()): Promise<ImageryData> {
  const ee = await getEe();
  const season = seasonFromEnv();
  const lastYear = lastCompleteYear(now, season);
  const years = Array.from({ length: lastYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  const point = ee.Geometry.Point([lng, lat]);
  const zone = point.buffer(radiusM);
  const view = point.buffer(radiusM * VIEW_RADIUS_FACTOR).bounds();

  const [landsat, s2] = await Promise.all([
    coverage("landsat", years, zone, season),
    coverage("sentinel2", years.filter((y) => y >= SENTINEL2_FIRST_YEAR), zone, season),
  ]);

  const plan = years.map((year) => ({ year, ...chooseSensor(year, landsat.get(year) ?? null, s2.get(year) ?? null, IMAGERY_MIN_VALID) }));
  const usable = plan.filter((p): p is { year: number; sensor: Sensor; valid: number; fellBack: boolean } => p.sensor !== null);
  const skippedYears = plan.filter((p) => p.sensor === null).map((p) => p.year);

  const outline = ee.FeatureCollection([ee.Feature(point.buffer(radiusM, 0.5))]).style({ color: "FFFFFF", fillColor: "00000000", width: 2 });
  const visualised = (year: number, sensor: Sensor) => {
    // Native Sentinel-2 resolution (10 m), no resampling: bicubic resampling of composites flattens them.
    const { image } = buildComposite(ee, sensor, zone, year, season, "all", { native: true });
    return image
      .visualize({ bands: ["red", "green", "blue"], min: 0.02, max: 0.28, gamma: 1.2 })
      .blend(outline);
  };

  const frames = await mapPool(usable, 8, async (u): Promise<ImageryFrame> => {
    const url = await getUrl<string>(
      (cb) => visualised(u.year, u.sensor).getThumbURL({ region: view, dimensions: FRAME_PIXELS, format: "jpg" }, cb as any),
      `thumbnail ${u.year}`,
    );
    return { year: u.year, sensor: u.sensor, url };
  });

  let gifUrl: string | null = null;
  let gifError: string | null = null;
  if (usable.length >= 2) {
    try {
      const col = ee.ImageCollection(usable.map((u) => visualised(u.year, u.sensor)));
      gifUrl = await getUrl<string>(
        (cb) => col.getVideoThumbURL({ region: view, dimensions: 264, framesPerSecond: 3, format: "gif" }, cb as any),
        "time-lapse",
      );
    } catch (e) {
      gifError = e instanceof Error ? e.message : String(e);
    }
  }

  const bounds = await evaluate<{ coordinates: number[][][] }>(view);
  const ring = bounds.coordinates[0] ?? [];
  const lngs = ring.map((p) => p[0] as number);
  const lats = ring.map((p) => p[1] as number);

  return {
    season: { label: seasonLabel(season) },
    before: frames.length >= 2 ? (frames[0] as ImageryFrame) : null,
    after: frames.length >= 2 ? (frames[frames.length - 1] as ImageryFrame) : null,
    frames,
    gifUrl,
    gifError,
    skippedYears,
    frameBounds: { west: Math.min(...lngs), south: Math.min(...lats), east: Math.max(...lngs), north: Math.max(...lats) },
    note: `One cloud-masked median composite per year (${seasonLabel(season)}). Years with under ${Math.round(IMAGERY_MIN_VALID * 100)}% clear coverage are skipped, not filled in. Landsat frames are 30 m pixels and look soft when enlarged.`,
  };
}

// --- Water-occurrence map overlay (same for every zone; cached process-wide) ---

export interface OverlayData {
  tileUrl: string;
  legend: { min: number; max: number; palette: string[]; label: string };
  attribution: string;
}

let overlay: { value: OverlayData; expires: number } | undefined;
const OVERLAY_PALETTE = ["#c6dbef", "#6baed6", "#2171b5", "#08306b"];

export async function getOccurrenceOverlay(): Promise<OverlayData> {
  if (overlay && overlay.expires > Date.now()) return overlay.value;
  const ee = await getEe();
  const occ = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence");
  const vis = { min: 1, max: 100, palette: OVERLAY_PALETTE.map((c) => c.slice(1)) };
  const res = await getUrl<{ urlFormat?: string; mapid?: string; token?: string }>(
    (cb) => occ.updateMask(occ.gt(0)).getMap(vis, cb as any),
    "map tiles",
  );
  const tileUrl = res.urlFormat ?? (res.mapid ? `https://earthengine.googleapis.com/v1/${res.mapid}/tiles/{z}/{x}/{y}` : null);
  if (!tileUrl) throw new EeError("Earth Engine returned no tile URL", "compute");
  const value: OverlayData = {
    tileUrl,
    legend: { min: 1, max: 100, palette: OVERLAY_PALETTE, label: "Water occurrence 1984 to 2021 (% of observations)" },
    attribution: "Water occurrence: EC JRC/Google (Pekel et al. 2016)",
  };
  overlay = { value, expires: Date.now() + 6 * 3600 * 1000 };
  return value;
}
