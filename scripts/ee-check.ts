/**
 * `pnpm ee:check` — verifies Earth Engine credentials end to end.
 * Reads .env.local (or the real environment), authenticates, and runs a tiny
 * real computation against JRC Global Surface Water.
 */
import { decodeServiceAccountKey, getEnv, missingEeEnv } from "../src/lib/env";
import { evaluate, EeError, getEe } from "../src/lib/ee/client";

const GSW_ASSET = "JRC/GSW1_4/GlobalSurfaceWater";

function fail(lines: string[]): never {
  console.error("\n✗ Earth Engine check FAILED\n");
  for (const l of lines) console.error("  " + l);
  console.error("");
  process.exit(1);
}

async function main() {
  const env = getEnv();
  const missing = missingEeEnv(env);
  if (missing.length > 0) {
    fail([
      `Missing: ${missing.join(", ")}`,
      "Set them in .env.local (see .env.example). Setup steps are in README.md → 'Earth Engine credentials'.",
    ]);
  }

  let clientEmail: string;
  try {
    clientEmail = decodeServiceAccountKey(env.GEE_SERVICE_ACCOUNT_KEY_B64!).client_email;
  } catch (e) {
    fail([(e as Error).message]);
  }
  console.log(`• Service account : ${clientEmail}`);
  console.log(`• Project         : ${env.GEE_PROJECT_ID}`);

  let ee;
  try {
    ee = await getEe();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hints: string[] = [msg];
    if (e instanceof EeError && e.kind === "auth") {
      hints.push("The key was rejected. Re-download a fresh JSON key and re-encode it as base64.");
    } else if (e instanceof EeError && e.kind === "init") {
      hints.push(
        "Likely causes: Earth Engine API not enabled on the project; project not registered for Earth Engine",
        "(https://code.earthengine.google.com/register); or the service account lacks the",
        "'Earth Engine Resource Viewer' (or Writer) and 'Service Usage Consumer' roles.",
      );
    }
    fail(hints);
  }
  console.log("✓ Authenticated and initialized");

  // Real computation: JRC occurrence at a known lake (Ulsoor Lake, Bengaluru).
  try {
    const point = ee.Geometry.Point([77.6205, 12.9826]);
    const occ = ee.Image(GSW_ASSET)
      .select("occurrence")
      .reduceRegion({ reducer: ee.Reducer.max(), geometry: point.buffer(100), scale: 30 });
    const result = await evaluate<{ occurrence: number | null }>(occ, 30_000);
    console.log(`✓ Read ${GSW_ASSET}: max occurrence near Ulsoor Lake = ${result.occurrence}%`);
    if (result.occurrence === null) {
      fail(["Query ran but returned null; the dataset may not be reachable from this project."]);
    }
  } catch (e) {
    fail([`Initialized, but a test query failed: ${e instanceof Error ? e.message : String(e)}`]);
  }

  // Asset root: needed from phase 3 on (saving the trained classifier). A warning, not a failure.
  const root = `projects/${env.GEE_PROJECT_ID}/assets`;
  const rootOk = await new Promise<boolean>((resolve) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ee as any).data.getAsset(root, (a: unknown, err?: unknown) => resolve(!err && !!a)),
  );
  if (rootOk) console.log(`✓ Asset root exists: ${root}`);
  else {
    console.log(`⚠ Cannot access asset root ${root}.`);
    console.log("  Needed to save the trained classifier (phase 3). Create the root folder in the Code Editor");
    console.log("  (Assets tab, with this project selected) and make sure the service account has the");
    console.log("  'Earth Engine Resource Writer' role. See README → 'Earth Engine credentials'.");
  }

  console.log("\n✓ Earth Engine credentials work.\n");
}

main().catch((e) => fail([e instanceof Error ? e.message : String(e)]));
