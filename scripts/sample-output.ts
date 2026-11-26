/**
 * `pnpm sample` — runs every API route handler for one demo and one control site against real data
 * and writes the JSON to docs/sample-output/. Also writes an assembled result (transition, risk, facts, summary).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { GET as water } from "../src/app/api/water-history/route";
import { GET as landcover } from "../src/app/api/landcover/route";
import { GET as elevation } from "../src/app/api/elevation/route";
import { GET as imagery } from "../src/app/api/imagery/route";
import { POST as summary } from "../src/app/api/summary/route";
import { detectTransition } from "../src/lib/analysis/transitions";
import { computeRisk } from "../src/lib/analysis/risk";
import { buildFacts } from "../src/lib/analysis/facts";
import { CONTROL_SITES, DEMO_SITES, type Site } from "../src/lib/sites";

process.env.GT_DISABLE_NEXT_CACHE = "1";
const OUT = "docs/sample-output";
mkdirSync(OUT, { recursive: true });

const get = async (h: (r: NextRequest) => Promise<Response>, path: string, s: Site) => {
  const t = Date.now();
  const res = await h(new NextRequest(`http://localhost${path}?lat=${s.lat}&lng=${s.lng}`));
  const body = await res.json();
  console.log(`  ${path} -> ${res.status} in ${Date.now() - t} ms`);
  if (!body.ok) throw new Error(`${path}: ${JSON.stringify(body.error)}`);
  return body;
};

async function run(site: Site) {
  console.log(`\n${site.kind.toUpperCase()}: ${site.name}, ${site.city} (${site.lat}, ${site.lng})`);
  const [w, lc, el, im] = await Promise.all([
    get(water, "/api/water-history", site),
    get(landcover, "/api/landcover", site),
    get(elevation, "/api/elevation", site),
    get(imagery, "/api/imagery", site),
  ]);
  const jrc = new Map<number, number>(w.data.yearly.map((y: { year: number; waterFraction: number }) => [y.year, y.waterFraction]));
  const transition = detectTransition(
    lc.data.years.map((y: { year: number; shares: never }) => ({ year: y.year, shares: y.shares, jrcWater: jrc.get(y.year) ?? null })),
  );
  const risk = computeRisk({ water: w.data.summary, transition, relativeElevationM: el.data.relativeElevationM, currentYear: new Date().getFullYear() });
  const facts = buildFacts({
    label: `${site.name}, ${site.city}`, inIndia: true, radiusM: 150, firstYear: lc.data.firstYear, lastYear: lc.data.lastYear,
    seasonWindow: lc.data.season.label, water: w.data.summary, transition, elevation: el.data, risk,
  });
  const sres = await summary(new NextRequest("http://localhost/api/summary", { method: "POST", body: JSON.stringify({ facts }) }));
  const sum = await sres.json();

  const slug = site.id;
  const save = (name: string, data: unknown) => writeFileSync(`${OUT}/${slug}.${name}.json`, JSON.stringify(data, null, 2));
  save("water-history", w);
  save("landcover", lc);
  save("elevation", el);
  // Signed EE URLs embed the project id and expire; keep the shape, drop the URLs.
  save("imagery", JSON.parse(JSON.stringify(im, (k, v) => (typeof v === "string" && v.startsWith("https://earthengine.googleapis.com") ? "<signed-url-redacted>" : v))));
  save("assembled", { site: { id: site.id, name: site.name, city: site.city, lat: site.lat, lng: site.lng }, transition, risk, facts, summary: sum.data });
  console.log(`  transition: ${transition.kind} | ${transition.description}`);
  console.log(`  risk: ${risk.score}/100 ${risk.band} | ${risk.factors.map((f) => `${f.id} ${f.points}/${f.maxPoints}`).join(", ")}`);
  console.log(`  summary (${sum.data.source}): ${sum.data.text}`);
}

async function main() {
  await run(DEMO_SITES.find((s) => s.id === "chowbaga-kolkata")!);
  await run(CONTROL_SITES.find((s) => s.id === "dharampeth-nagpur")!);
  console.log(`\nSaved to ${OUT}/`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
