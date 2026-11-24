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

  test("search is keyboard operable and handles an address that is not found", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Address, locality or coordinates").fill("zzqxjv nonexistent place 9981");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: /No matching address/i })).toBeVisible({ timeout: 30_000 });
  });

  test("rejects too-short input without calling the server", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Address, locality or coordinates").fill("ab");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "at least 3 characters" })).toBeVisible();
  });

  test("a coordinate pair opens the analysis page for that point", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Address, locality or coordinates").fill("21.14, 79.065");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /21\.1400, 79\.0650/ }).click();
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
});

test.describe("analysis against real data", () => {
  test.skip(!eeReady, `Earth Engine credentials missing: ${missing.join(", ")}`);

  test("search an address, pick a result, and every section loads", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Address, locality or coordinates").fill("Dharampeth, Nagpur");
    await page.keyboard.press("Enter");
    const first = page.locator("ul button").first();
    await expect(first).toBeVisible({ timeout: 30_000 });
    await first.click();
    await expect(page).toHaveURL(/\/analyze\?lat=.*&lng=/);
    // sections are present as skeletons straight away, then fill in
    for (const id of SECTIONS) await expect(page.locator(`#${id}`)).toBeVisible();
    await waitForAllSections(page);
    await expect(page.getByTestId("risk-band")).toContainText(/risk/);
    await expect(page.getByTestId("map")).toBeVisible();
  });

  test("control site scores Low, and the report page shows the same", async ({ page }) => {
    await open(page, control);
    await waitForAllSections(page);
    await expect(page.getByTestId("risk-band")).toContainText("Low");
    await expect(page.getByTestId("risk-score")).toContainText("0");
    await expect(page.getByTestId("water-headline")).toContainText("No water");

    await page.getByTestId("open-report").click();
    await expect(page).toHaveURL(/\/report\?lat=21\.14&lng=79\.065/);
    await expect(page.getByTestId("zone-title")).toContainText(control.name);
    await waitForAllSections(page);
    await expect(page.getByTestId("risk-band")).toContainText("Low");
    await expect(page.getByTestId("disclaimer")).toBeVisible();
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();
  });

  test("demo site shows High risk and the fill-and-build story", async ({ page }) => {
    await open(page, demo);
    await waitForAllSections(page);
    await expect(page.getByTestId("risk-band")).toContainText("High");
    await expect(page.getByTestId("transition")).toContainText(/Water \d{4} to \d{4}, filled \d{4} to \d{4}, built by \d{4}/);
    await expect(page.getByTestId("summary-text")).toContainText(/water/i);
  });

  test("the report prints as a clean document (controls hidden, disclaimer shown)", async ({ page }) => {
    await open(page, control, "/report");
    await waitForAllSections(page);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeHidden();
    await expect(page.getByTestId("disclaimer")).toBeVisible();
    await expect(page.getByTestId("risk-band")).toBeVisible();
    await expect(page.getByText("GroundTruth · Land history report")).toBeVisible();
  });

  test("a failing section shows its own error and Retry recovers it", async ({ page }) => {
    let fail = true;
    await page.route("**/api/elevation**", (route) =>
      fail
        ? route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "ee_compute_failed", message: "Earth Engine could not compute this analysis.", retryable: true } }) })
        : route.continue(),
    );
    await open(page, control);
    const elevation = page.locator("#elevation");
    await expect(elevation.getByRole("alert")).toContainText("could not be loaded", { timeout: LOAD_TIMEOUT });
    // other sections are unaffected
    await expect(page.locator("#water")).toHaveAttribute("data-status", "ok", { timeout: LOAD_TIMEOUT });
    // the score says it is partial rather than silently guessing
    await expect(page.locator("#risk")).toContainText(/could not be computed|Unavailable/);
    fail = false;
    await elevation.getByRole("button", { name: "Retry" }).click();
    await expect(elevation).toHaveAttribute("data-status", "ok", { timeout: LOAD_TIMEOUT });
  });

  test("a slow or dead network is reported, not hung", async ({ page }) => {
    await page.route("**/api/water-history**", (route) => route.abort("failed"));
    await open(page, control);
    await expect(page.locator("#water").getByRole("alert")).toContainText(/Could not reach the server/, { timeout: LOAD_TIMEOUT });
    await expect(page.locator("#water").getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("time-lapse does not autoplay and the map is keyboard reachable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, control);
    await expect(page.locator("#imagery")).toHaveAttribute("data-status", "ok", { timeout: LOAD_TIMEOUT });
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
});
