import { expect, test, type Page } from "@playwright/test";
import { CONTROL_SITES, DEMO_SITES } from "../../src/lib/sites";
import { missingEeEnv, parseEnv } from "../../src/lib/env";
import { zoneUrl } from "../../src/lib/geometry";

// These tests drive the real app against real Earth Engine data, so they need credentials.
// The server reads .env.local; the test process needs the same values only to decide whether to run.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local */
}
const missing = missingEeEnv(parseEnv(process.env as Record<string, string | undefined>));
const eeReady = missing.length === 0 || !!process.env.E2E_BASE_URL;
if (!eeReady) console.warn(`[e2e] Earth Engine tests SKIPPED: missing ${missing.join(", ")}. Run \`pnpm ee:check\`.`);

const SECTIONS = ["risk", "summary", "imagery", "timeline", "water", "elevation"];
const LOAD_TIMEOUT = 180_000;

const control = CONTROL_SITES[0]!;
const demo = DEMO_SITES.find((s) => s.id === "ulwe-navi-mumbai")!;
const open = (page: Page, s: { lat: number; lng: number; name: string; city: string }, path: "/analyze" | "/report" = "/analyze") =>
  page.goto(zoneUrl(path, { lat: s.lat, lng: s.lng, label: `${s.name}, ${s.city}` }));

async function waitForAllSections(page: Page) {
  for (const id of SECTIONS) {
    await expect(page.locator(`#${id}`)).toHaveAttribute("data-status", "ok", { timeout: LOAD_TIMEOUT });
  }
}

test.describe("home page (no Earth Engine needed)", () => {
  test("explains the product, shows labelled search, examples and the disclaimer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Know what your land was");
    await expect(page.getByLabel("Address, locality or coordinates")).toBeVisible();
    await expect(page.getByRole("list", { name: "Examples built on former water" }).getByRole("link")).toHaveCount(DEMO_SITES.length);
    await expect(page.getByRole("list", { name: "Control examples that were never water" }).getByRole("link")).toHaveCount(CONTROL_SITES.length);
    await expect(page.getByText("Screening tool, not a legal opinion.")).toBeVisible();
  });

  test("search handles an address that is not found, in plain words", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Address, locality or coordinates").fill("zzqxjv nonexistent place 9981");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: /could not find that place in India/i })).toBeVisible({ timeout: 30_000 });
  });

  test("rejects too-short input without calling the server", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Address, locality or coordinates").fill("ab");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Type at least 3 letters" })).toBeVisible();
  });

  test("a single match opens the analysis straight away (coordinate pair)", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Address, locality or coordinates").fill("21.14, 79.065");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/analyze\?lat=21\.14&lng=79\.065/);
  });

  test("an invalid location shows a clear message instead of crashing", async ({ page }) => {
    await page.goto("/analyze?lat=999&lng=10");
    await expect(page.getByRole("alert").filter({ hasText: /lat/i })).toBeVisible();
    await page.goto("/report?lat=abc&lng=10");
    await expect(page.getByRole("alert").filter({ hasText: /lat/i })).toBeVisible();
  });

  test("focus is visible on interactive elements", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
    expect(outline).not.toBe("none");
  });

  test("use my location asks only when tapped, then opens the analysis for that spot", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 21.14, longitude: 79.065 });
    await page.goto("/");
    await expect(page.getByText(/Your phone will ask to share your location/)).toBeVisible();
    await page.getByRole("button", { name: "Use my current location" }).click();
    await expect(page).toHaveURL(/\/analyze\?lat=21\.14&lng=79\.065/, { timeout: 20_000 });
    await expect(page.getByText(/Phone locations can be off by tens of meters/)).toBeVisible();
  });

  test("a denied location explains what to do instead", async ({ page, context }) => {
    await context.clearPermissions();
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_ok, err) => err?.({ code: 1, message: "denied", PERMISSION_DENIED: 1 } as GeolocationPositionError);
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Use my current location" }).click();
    await expect(page.getByText(/Location is off for this site/)).toBeVisible();
  });

  test("drop a pin: the map opens, checking is disabled until a spot is tapped", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Drop a pin on the map" }).click();
    await expect(page.getByTestId("map")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("map")).toHaveAttribute("data-ready", "true", { timeout: 30_000 }); // the map library loads lazily
    await expect(page.getByRole("button", { name: "Check this spot" })).toBeDisabled();
    await page.getByTestId("map").click();
    await expect(page.getByRole("button", { name: "Check this spot" })).toBeEnabled();
    await page.getByRole("button", { name: "Check this spot" }).click();
    await expect(page).toHaveURL(/\/analyze\?lat=.*&lng=/);
  });
});

test.describe("analysis against real data", () => {
  test.skip(!eeReady, `Earth Engine credentials missing: ${missing.join(", ")}`);

  test("search an address, pick a result, and every section loads", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Address, locality or coordinates").fill("Dharampeth, Nagpur");
    await page.keyboard.press("Enter");
    // Several matches are listed; a single match opens straight away.
    const list = page.locator("ul button").first();
    await Promise.race([list.waitFor({ timeout: 30_000 }).then(() => list.click()), page.waitForURL(/\/analyze\?lat=/, { timeout: 30_000 })]).catch(() => {});
    await expect(page).toHaveURL(/\/analyze\?lat=.*&lng=/);
    for (const id of SECTIONS) await expect(page.locator(`#${id}`)).toBeVisible();
    await waitForAllSections(page);
    await expect(page.getByTestId("risk-band")).toContainText(/risk/);
    await expect(page.getByTestId("map")).toBeVisible();
  });

  test("the wait is explained while a new place is read", async ({ page }) => {
    await page.route("**/api/**", async (route) => {
      await new Promise((r) => setTimeout(r, 3500));
      await route.continue();
    });
    await open(page, control);
    await expect(page.getByTestId("wait-panel")).toContainText("Reading 40 years of satellite images");
    await expect(page.getByTestId("wait-panel")).toContainText(/15 to 45 seconds/, { timeout: 10_000 });
    await expect(page.getByTestId("wait-panel")).toContainText("Reading");
    await waitForAllSections(page);
    await expect(page.getByTestId("wait-panel")).toHaveCount(0);
  });

  test("control site scores Low, and the report page shows the same", async ({ page }) => {
    await open(page, control);
    await waitForAllSections(page);
    await expect(page.getByTestId("risk-band")).toContainText("Low");
    await expect(page.getByTestId("risk-score")).toContainText("0");
    await expect(page.getByTestId("water-headline")).toContainText("No water");
    await expect(page.getByTestId("next-steps")).toContainText("Title search");

    await page.getByTestId("open-report").click();
    await expect(page).toHaveURL(/\/report\?lat=21\.14&lng=79\.065/);
    await expect(page.getByTestId("zone-title")).toContainText(control.name);
    await waitForAllSections(page);
    await expect(page.getByTestId("risk-band")).toContainText("Low");
    await expect(page.getByTestId("disclaimer")).toBeVisible();
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();
  });

  test("demo site shows High risk and describes the change as what the images suggest", async ({ page }) => {
    await open(page, demo);
    await waitForAllSections(page);
    await expect(page.getByTestId("risk-band")).toContainText("High");
    await expect(page.getByTestId("transition")).toContainText(/The images suggest water until about \d{4}, bare or filled ground from about \d{4}, and buildings from about \d{4}/);
    await expect(page.getByTestId("transition")).toContainText(/off by a year or two/);
    await expect(page.getByTestId("summary-text")).toContainText(/water/i);
    await expect(page.getByTestId("summary-text")).not.toContainText(/lake was filled/i);
  });

  test("the report prints as a clean document (controls hidden, disclaimer shown, factors open)", async ({ page }) => {
    await open(page, demo, "/report");
    await waitForAllSections(page);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeHidden();
    await expect(page.getByTestId("disclaimer")).toBeVisible();
    await expect(page.getByTestId("risk-band")).toBeVisible();
    await expect(page.getByText("GroundTruth · Land history report")).toBeVisible();
    await expect(page.getByText("Permanent vs seasonal water")).toBeVisible();
  });

  test("a failing section shows its own plain error and Try again recovers it", async ({ page }) => {
    let fail = true;
    await page.route("**/api/elevation**", (route) =>
      fail
        ? route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "ee_quota", message: "x", retryable: true } }) })
        : route.continue(),
    );
    await open(page, control);
    const elevation = page.locator("#elevation");
    await expect(elevation.getByRole("alert")).toContainText("This part could not load", { timeout: LOAD_TIMEOUT });
    await expect(elevation.getByRole("alert")).toContainText("The service is busy right now");
    await expect(page.locator("#water")).toHaveAttribute("data-status", "ok", { timeout: LOAD_TIMEOUT });
    // the verdict says it is partial rather than silently guessing
    await expect(page.locator("#risk")).toContainText(/Some parts could not load/);
    fail = false;
    await elevation.getByRole("button", { name: "Try again" }).click();
    await expect(elevation).toHaveAttribute("data-status", "ok", { timeout: LOAD_TIMEOUT });
  });

  test("a dead network is reported in plain words, not left hanging", async ({ page }) => {
    await page.route("**/api/water-history**", (route) => route.abort("failed"));
    await open(page, control);
    await expect(page.locator("#water").getByRole("alert")).toContainText(/No connection/, { timeout: LOAD_TIMEOUT });
    await expect(page.locator("#water").getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("time-lapse does not autoplay under reduced motion, and the pin is keyboard reachable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, control);
    await expect(page.locator("#imagery")).toHaveAttribute("data-status", "ok", { timeout: LOAD_TIMEOUT });
    await page.getByRole("tab", { name: "Time-lapse" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: /Pin\. Drag it/ })).toBeVisible();
  });

  test("moving the pin re-runs the analysis and updates the shareable URL", async ({ page }) => {
    await open(page, control);
    await expect(page.getByRole("button", { name: /Pin\. Drag it/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Pin\. Drag it/ }).focus();
    await page.keyboard.press("ArrowUp");
    await expect(page).toHaveURL(/lat=21\.1403/, { timeout: 15_000 });
    await expect(page.getByTestId("zone-title")).toContainText("Pin at");
  });

  test("every control is at least 44 px to touch", async ({ page }) => {
    await open(page, control);
    await waitForAllSections(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("button, summary, input[type=range], [role=tab], a.btn, label.tap, .maplibregl-ctrl button")]
        .filter((e) => e.offsetParent !== null)
        .map((e) => ({ name: (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) }))
        .filter((r) => r.h < 43.5 || r.w < 43.5),
    );
    expect(small).toEqual([]);
  });

  test("no section grows past the space reserved for it (the page does not jump)", async ({ page }) => {
    await open(page, demo);
    await waitForAllSections(page);
    await page.getByTestId("risk-band").waitFor();
    const over = await page.evaluate(() =>
      ["risk", "imagery", "summary", "timeline", "water", "elevation"].map((id) => {
        const el = document.getElementById(id)!;
        const min = parseFloat(getComputedStyle(el).minHeight);
        const h = el.getBoundingClientRect().height;
        return { id, min: Math.round(min), h: Math.round(h), grewBy: Math.round(h - min) };
      }).filter((r) => r.grewBy > 24),
    );
    expect(over).toEqual([]);
  });
});
