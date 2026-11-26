import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as geocode } from "@/app/api/geocode/route";
import { GET as water } from "@/app/api/water-history/route";
import { GET as landcover } from "@/app/api/landcover/route";
import { GET as elevation } from "@/app/api/elevation/route";
import { GET as imagery } from "@/app/api/imagery/route";
import { POST as summary } from "@/app/api/summary/route";
import { detectTransition } from "@/lib/analysis/transitions";
import { buildFacts } from "@/lib/analysis/facts";
import { computeRisk } from "@/lib/analysis/risk";
import { validateSummary } from "@/lib/analysis/summary";
import { missingEeEnv, parseEnv } from "@/lib/env";
import { CONTROL_SITES, DEMO_SITES } from "@/lib/sites";

const missing = missingEeEnv(parseEnv(process.env as Record<string, string | undefined>));
const eeReady = missing.length === 0;
if (!eeReady) {
  console.warn(`\n[integration] Earth Engine tests SKIPPED: missing ${missing.join(", ")}. Run \`pnpm ee:check\`.\n`);
}
const eeIt = it.skipIf(!eeReady);
const SLOW = 240_000;

const url = (path: string, params: Record<string, string | number>) => {
  const u = new URL(`http://localhost${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return new NextRequest(u);
};
const call = async (res: Response) => ({ status: res.status, body: (await res.json()) as Record<string, any> }); // eslint-disable-line @typescript-eslint/no-explicit-any
const at = (s: { lat: number; lng: number }) => ({ lat: s.lat, lng: s.lng });

const demo = DEMO_SITES.find((s) => s.id === "chowbaga-kolkata")!;
const control = CONTROL_SITES.find((s) => s.id === "dharampeth-nagpur")!;

describe("input validation on every route (no Earth Engine needed)", () => {
  const routes = { water, landcover, elevation, imagery } as const;
  for (const [name, handler] of Object.entries(routes)) {
    it(`${name}: rejects bad coordinates with a typed 400 and no stack trace`, async () => {
      const { status, body } = await call(await handler(url(`/api/${name}`, { lat: 95, lng: 10 })));
      expect(status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("invalid_input");
      expect(JSON.stringify(body)).not.toMatch(/\bat .*\.(ts|js):\d+/);
    });
    it(`${name}: rejects out-of-range radius and missing params`, async () => {
      expect((await call(await handler(url(`/api/${name}`, { lat: 12, lng: 80, radius: 9999 })))).status).toBe(400);
      expect((await call(await handler(url(`/api/${name}`, {})))).status).toBe(400);
    });
  }

  it("geocode: rejects a too-short query", async () => {
    const { status, body } = await call(await geocode(url("/api/geocode", { q: "a" })));
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_input");
  });

  it("summary: rejects invalid JSON and invalid facts", async () => {
    const bad = new NextRequest("http://localhost/api/summary", { method: "POST", body: "{nope" });
    expect((await call(await summary(bad))).status).toBe(400);
    const empty = new NextRequest("http://localhost/api/summary", { method: "POST", body: JSON.stringify({ facts: { x: 1 } }) });
    const { status, body } = await call(await summary(empty));
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_input");
  });
});

describe("geocode (live Nominatim)", () => {
  it("finds an Indian address, restricted to India by default", async () => {
    const { status, body } = await call(await geocode(url("/api/geocode", { q: "Velachery, Chennai" })));
    expect(status).toBe(200);
    const first = body.data.results[0];
    expect(first.inIndia).toBe(true);
    expect(first.lat).toBeGreaterThan(12.8);
    expect(first.lat).toBeLessThan(13.2);
  });

  it("returns a typed 404 when the address is not found", async () => {
    const { status, body } = await call(await geocode(url("/api/geocode", { q: "zzqxjv nonexistent place 9981" })));
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("treats a lat,lng pair as coordinates without calling Nominatim", async () => {
    const { status, body } = await call(await geocode(url("/api/geocode", { q: "12.9413, 80.2179" })));
    expect(status).toBe(200);
    expect(body.data.results[0]).toMatchObject({ lat: 12.9413, lng: 80.2179, type: "coordinates" });
  });
});

describe.skipIf(!eeReady)("analysis routes against real Earth Engine data", () => {
  eeIt("water-history: demo site had water; control never did", async () => {
    const d = await call(await water(url("/api/water-history", at(demo))));
    expect(d.status).toBe(200);
    expect(d.body.data.dataset.yearly).toMatch(/JRC\/GSW/);
    expect(d.body.data.yearly.length).toBeGreaterThanOrEqual(35);
    expect(d.body.data.summary.everWater).toBe(true);
    expect(d.body.data.summary.firstWaterYear).toBeLessThan(2000);
    expect(d.body.data.summary.yearsWithWater).toBeGreaterThanOrEqual(8);

    const c = await call(await water(url("/api/water-history", at(control))));
    expect(c.body.data.summary.everWater).toBe(false);
    expect(c.body.data.summary.classification).toBe("never");
    expect(c.body.data.summary.yearsWithWater).toBe(0);
  }, SLOW);

  eeIt("landcover: per-year shares, gaps flagged, demo shows a water-to-land change, control none", async () => {
    const d = await call(await landcover(url("/api/landcover", at(demo))));
    expect(d.status).toBe(200);
    const years = d.body.data.years as Array<{ year: number; sensor: string | null; shares: Record<string, number> | null }>;
    expect(years[0]!.year).toBe(1985);
    expect(years.length).toBeGreaterThanOrEqual(40);
    for (const y of years.filter((y) => y.shares)) {
      const sum = Object.values(y.shares!).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
    // Landsat before 2017, Sentinel-2 from 2017 (unless explicitly flagged as a fallback)
    expect(years.filter((y) => y.year < 2017 && y.sensor).every((y) => y.sensor === "landsat")).toBe(true);
    expect(years.some((y) => y.year >= 2017 && y.sensor === "sentinel2")).toBe(true);
    // gap years carry no shares and a reason, never interpolated values
    for (const y of d.body.data.years.filter((y: { shares: unknown }) => y.shares === null)) {
      expect(y.gapReason).toMatch(/cloud-free/);
    }
    const w = await call(await water(url("/api/water-history", at(demo))));
    const jrc = new Map<number, number>(w.body.data.yearly.map((y: { year: number; waterFraction: number }) => [y.year, y.waterFraction]));
    const t = detectTransition(years.map((y) => ({ year: y.year, shares: y.shares as never, jrcWater: jrc.get(y.year) ?? null })));
    expect(t.kind).not.toBe("none");
    expect(t.kind).not.toBe("insufficient-data");
    expect(t.waterFromYear).toBeLessThan(2000);

    const c = await call(await landcover(url("/api/landcover", at(control))));
    const ct = detectTransition(c.body.data.years.map((y: { year: number; shares: never }) => ({ year: y.year, shares: y.shares })));
    expect(ct.kind).toBe("none");
  }, SLOW);

  eeIt("elevation: finite relative elevation for land; unavailable for open sea", async () => {
    const d = await call(await elevation(url("/api/elevation", at(demo))));
    expect(d.status).toBe(200);
    expect(d.body.data.available).toBe(true);
    expect(Number.isFinite(d.body.data.relativeElevationM)).toBe(true);
    expect(d.body.data.dataset).toMatch(/COPERNICUS|SRTM/);

    const c = await call(await elevation(url("/api/elevation", at(control))));
    expect(c.body.data.available).toBe(true);

    const sea = await call(await elevation(url("/api/elevation", { lat: 12, lng: 85 })));
    expect(sea.status).toBe(200);
    expect(sea.body.data.available).toBe(false);
    expect(sea.body.data.unavailableReason).toMatch(/sea|no elevation data/i);
    expect(sea.body.data.relativeElevationM).toBeNull();
  }, SLOW);

  eeIt("outside India: still analysed, with a note", async () => {
    const r = await call(await elevation(url("/api/elevation", { lat: 51.5074, lng: -0.1278 })));
    expect(r.status).toBe(200);
    expect(r.body.meta.notes.join(" ")).toMatch(/outside India/);
  }, SLOW);

  eeIt("imagery: before/after frames, time-lapse GIF and tile overlay URLs", async () => {
    const d = await call(await imagery(url("/api/imagery", at(control))));
    expect(d.status).toBe(200);
    const data = d.body.data;
    expect(data.frames.length).toBeGreaterThanOrEqual(10);
    expect(data.frames.every((f: { url: string }) => f.url.startsWith("https://"))).toBe(true);
    expect(data.before.year).toBeLessThan(data.after.year);
    expect(data.after.year).toBeGreaterThanOrEqual(2023);
    expect(data.gifUrl).toMatch(/^https:\/\//);
    expect(data.overlay.tileUrl).toMatch(/\{z\}.*\{x\}.*\{y\}|\{x\}.*\{y\}.*\{z\}/);
    // skipped years are listed, not silently filled
    expect(Array.isArray(data.skippedYears)).toBe(true);
  }, SLOW);

  eeIt("end to end for the demo and control: facts -> summary route validates against the facts", async () => {
    for (const site of [demo, control]) {
      const [w, lc, el] = await Promise.all([
        call(await water(url("/api/water-history", at(site)))),
        call(await landcover(url("/api/landcover", at(site)))),
        call(await elevation(url("/api/elevation", at(site)))),
      ]);
      const jrc = new Map<number, number>(w.body.data.yearly.map((y: { year: number; waterFraction: number }) => [y.year, y.waterFraction]));
      const transition = detectTransition(lc.body.data.years.map((y: { year: number; shares: never }) => ({ year: y.year, shares: y.shares, jrcWater: jrc.get(y.year) ?? null })));
      const risk = computeRisk({ water: w.body.data.summary, transition, relativeElevationM: el.body.data.relativeElevationM, currentYear: new Date().getFullYear() });
      const facts = buildFacts({
        label: `${site.name}, ${site.city}`, inIndia: true, radiusM: 150, firstYear: lc.body.data.firstYear, lastYear: lc.body.data.lastYear,
        seasonWindow: lc.body.data.season.label, water: w.body.data.summary, transition, elevation: el.body.data, risk,
      });
      const res = await call(await summary(new NextRequest("http://localhost/api/summary", { method: "POST", body: JSON.stringify({ facts }) })));
      expect(res.status).toBe(200);
      expect(validateSummary(res.body.data.text, facts)).toEqual({ ok: true, problems: [] });
      if (site === control) expect(risk.band).toBe("Low");
      else expect(risk.score).toBeGreaterThan(risk.score === 0 ? 0 : -1);
    }
  }, SLOW);
});
