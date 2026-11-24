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
// Frames are 3:2 (900 m by 600 m for the default zone). They are rendered large and smoothed (bicubic from the native grid),
// so 30 m Landsat squares read as soft detail instead of hard blocks.
const FRAME_W = 720;
const FRAME_H = 480;
const VIEW_RADIUS_FACTOR = 2; // the frame is 3 x 2 of this many zone radii, so the surroundings are visible

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
  /** Diameter of the analysed zone as a share of the frame width (the page draws the ring crisply over the picture). */
  ringFraction: number;
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
  // 3:2 rectangle around the point (Mercator keeps the pixel aspect equal to the ground aspect).
  const R = radiusM * VIEW_RADIUS_FACTOR;
  const dLat = R / 111_320;
  const dLng = R / (111_320 * Math.cos((lat * Math.PI) / 180));
  const frameBounds = { west: lng - 1.5 * dLng, south: lat - dLat, east: lng + 1.5 * dLng, north: lat + dLat };
  const view = ee.Geometry.Rectangle([frameBounds.west, frameBounds.south, frameBounds.east, frameBounds.north]);

  const [landsat, s2] = await Promise.all([
    coverage("landsat", years, zone, season),
    coverage("sentinel2", years.filter((y) => y >= SENTINEL2_FIRST_YEAR), zone, season),
  ]);

  const plan = years.map((year) => ({ year, ...chooseSensor(year, landsat.get(year) ?? null, s2.get(year) ?? null, IMAGERY_MIN_VALID) }));
  const usable = plan.filter((p): p is { year: number; sensor: Sensor; valid: number; fellBack: boolean } => p.sensor !== null);
  const skippedYears = plan.filter((p) => p.sensor === null).map((p) => p.year);

  const visualised = (year: number, sensor: Sensor) => {
    // Pin the composite to its native grid first (a composite has no fixed projection, and resampling one without that
    // flattens it), then resample bicubically so enlarging gives smooth detail instead of hard squares.
    const { image } = buildComposite(ee, sensor, zone, year, season, "all", { native: true });
    return image
      .reproject({ crs: "EPSG:3857", scale: sensor === "landsat" ? 30 : 10 })
      .resample("bicubic")
      .visualize({ bands: ["red", "green", "blue"], min: 0.03, max: 0.24, gamma: 1.15 });
  };

  const frames = await mapPool(usable, 8, async (u): Promise<ImageryFrame> => {
    const url = await getUrl<string>(
      (cb) => visualised(u.year, u.sensor).getThumbURL({ region: view, dimensions: `${FRAME_W}x${FRAME_H}`, format: "jpg" }, cb as any),
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
        (cb) => col.getVideoThumbURL({ region: view, dimensions: "480x320", framesPerSecond: 3, format: "gif" }, cb as any),
        "time-lapse",
      );
    } catch (e) {
      gifError = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    season: { label: seasonLabel(season) },
    before: frames.length >= 2 ? (frames[0] as ImageryFrame) : null,
    after: frames.length >= 2 ? (frames[frames.length - 1] as ImageryFrame) : null,
    frames,
    gifUrl,
    gifError,
    skippedYears,
    frameBounds,
    ringFraction: (2 * radiusM) / (3 * R),
    note: `One cloud-masked median composite per year (${seasonLabel(season)}). Years with under ${Math.round(IMAGERY_MIN_VALID * 100)}% clear coverage are skipped, not filled in. Landsat squares are 30 m, so older pictures are smooth but not sharp.`,
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
  overlay = { value, expires: Date.now() + 15 * 60 * 1000 }; // signed tile URLs expire
  return value;
}
