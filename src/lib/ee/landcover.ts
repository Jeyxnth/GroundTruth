import { evaluate, getEe } from "@/lib/ee/client";
import {
  CLASS_NAMES,
  FIRST_YEAR,
  MIN_VALID_FRACTION,
  SENTINEL2_FIRST_YEAR,
  buildComposite,
  chooseSensor,
  chunk,
  getClassifier,
  lastCompleteYear,
  mapPool,
  seasonFromEnv,
  seasonLabel,
  withIndices,
  type Method,
  type SeasonWindow,
  type Sensor,
} from "@/lib/ee/optical";
import type { Shares } from "@/lib/analysis/transitions";

export interface LandcoverYear {
  year: number;
  /** Sensor actually used. Null when no sensor had enough cloud-free coverage (a gap, never interpolated). */
  sensor: Sensor | null;
  /** True when Sentinel-2 L2A was too sparse this year and Landsat was used instead. */
  sensorFallback: boolean;
  /** Share of the zone with cloud-free data in the chosen (or best) sensor, 0..1. */
  validFraction: number;
  scenes: number | null;
  /** Class shares of the valid pixels (sum to 1), or null for a gap year. */
  shares: Shares | null;
  /** Why shares is null. */
  gapReason: string | null;
}

export interface LandcoverData {
  method: Method;
  methodNote: string;
  season: { startMonth: number; endMonth: number; label: string };
  firstYear: number;
  lastYear: number;
  years: LandcoverYear[];
  gapYears: number[];
  minValidFraction: number;
}

interface RawYear {
  year: number;
  scenes: number | null;
  hist: Record<string, number> | null;
}
interface Parsed {
  valid: number; // fraction of zone with data
  shares: Shares | null;
  scenes: number | null;
}

function parseHist(raw: RawYear): Parsed {
  const hist = raw.hist ?? {};
  const total = Object.values(hist).reduce((a, b) => a + b, 0);
  if (total <= 0) return { valid: 0, shares: null, scenes: raw.scenes };
  const count = (k: number) => hist[String(k)] ?? 0;
  const valid = total - count(-1);
  const shares: Shares | null =
    valid > 0
      ? {
          water: count(0) / valid,
          vegetation: count(1) / valid,
          bare: count(2) / valid,
          built: count(3) / valid,
        }
      : null;
  return { valid: valid / total, shares, scenes: raw.scenes };
}

async function seriesFor(
  sensor: Sensor,
  years: number[],
  lat: number,
  lng: number,
  radiusM: number,
  season: SeasonWindow,
): Promise<Map<number, Parsed>> {
  const ee = await getEe();
  const zone = ee.Geometry.Point([lng, lat]).buffer(radiusM);
  const classifier = getClassifier();

  const dictFor = (year: number) => {
    const { image, scenes } = buildComposite(ee, sensor, zone, year, season);
    const cls = classifier.classify(ee, withIndices(image));
    // -1 marks "no clear observation" so the histogram also yields the valid fraction.
    const hist = cls
      .unmask(-1)
      .reduceRegion({ reducer: ee.Reducer.frequencyHistogram(), geometry: zone, scale: 30, maxPixels: 1e7 })
      .get("cls");
    return ee.Dictionary({ year, scenes, hist });
  };

  const parts = await mapPool(chunk(years, 8), 3, (ys) => evaluate<RawYear[]>(ee.List(ys.map(dictFor))));
  const out = new Map<number, Parsed>();
  for (const raw of parts.flat()) out.set(raw.year, parseHist(raw));
  return out;
}

export async function computeLandcover(lat: number, lng: number, radiusM: number, now = new Date()): Promise<LandcoverData> {
  const season = seasonFromEnv();
  const lastYear = lastCompleteYear(now, season);
  const allYears = Array.from({ length: lastYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  const s2Years = allYears.filter((y) => y >= SENTINEL2_FIRST_YEAR);

  const [landsat, s2] = await Promise.all([
    seriesFor("landsat", allYears, lat, lng, radiusM, season),
    seriesFor("sentinel2", s2Years, lat, lng, radiusM, season),
  ]);

  const classifier = getClassifier();
  const years: LandcoverYear[] = allYears.map((year) => {
    const l = landsat.get(year);
    const s = s2.get(year);
    const pick = chooseSensor(year, l?.valid ?? null, s?.valid ?? null);
    if (pick.sensor === null) {
      return {
        year, sensor: null, sensorFallback: false, validFraction: pick.valid,
        scenes: (year >= SENTINEL2_FIRST_YEAR ? s?.scenes : l?.scenes) ?? null,
        shares: null,
        gapReason: `Less than ${Math.round(MIN_VALID_FRACTION * 100)}% of the zone had cloud-free imagery in ${seasonLabel(season)} ${year}.`,
      };
    }
    const src = pick.sensor === "sentinel2" ? s : l;
    return {
      year, sensor: pick.sensor, sensorFallback: pick.fellBack, validFraction: pick.valid,
      scenes: src?.scenes ?? null, shares: src?.shares ?? null, gapReason: null,
    };
  });

  return {
    method: classifier.method,
    methodNote:
      classifier.method === "random-forest"
        ? "Random Forest trained in Earth Engine on Dynamic World labels (see docs/ml-results.md)."
        : "Interim threshold rules (MNDWI/NDVI/NDBI). The trained Random Forest is not configured yet, so built-up versus bare soil is approximate.",
    season: { ...season, label: seasonLabel(season) },
    firstYear: FIRST_YEAR,
    lastYear,
    years,
    gapYears: years.filter((y) => y.shares === null).map((y) => y.year),
    minValidFraction: MIN_VALID_FRACTION,
  };
}

export { CLASS_NAMES };
