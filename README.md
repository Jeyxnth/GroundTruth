# GroundTruth

*Know what your land was before you buy it.* Screening tool for homebuyers in India: water history, land-cover timeline, fill-and-build detection, elevation context and an explainable risk score for a ~150 m zone, from satellite data (Google Earth Engine).

> Screening tool based on satellite data. Not a legal or survey determination. Verify with official land records.

## Stack

Next.js (App Router) + TypeScript strict, pnpm, Earth Engine via `@google/earthengine` (server-side route handlers only), zod, Vitest, Playwright, MapLibre GL.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on http://localhost:3000 |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | Must all pass before every commit |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm ee:check` | Verifies Earth Engine credentials with a real query |

`pnpm sample` runs every route against one demo and one control site and saves the real JSON to `docs/sample-output/`.

## API

All routes return `{ ok: true, data, meta: { lat, lng, radiusM, notes[], generatedAt } }` or `{ ok: false, error: { code, message, retryable } }`. Inputs are validated with zod; coordinates are rounded to 4 decimals, which is also the cache key. `radius` is optional, 50 to 500 m (default 150).

| Route | Returns | `maxDuration` | Typical cold time |
| --- | --- | --- | --- |
| `GET /api/geocode?q=&country=in\|all` | Nominatim results (India only by default; 1 request/second per instance; a `lat, lng` string skips Nominatim) | 20 s | about 1 s |
| `GET /api/water-history?lat=&lng=` | JRC GSW v1.4: per-year water share (1984 to 2021), occurrence stats, summary, distance to current water | 60 s | 6 to 9 s |
| `GET /api/landcover?lat=&lng=` | Per-year class shares (water, vegetation, bare, built), Landsat 1985 to 2016, Sentinel-2 from 2017, gaps flagged | 120 s | 15 s |
| `GET /api/elevation?lat=&lng=` | Copernicus GLO-30 (SRTM fallback): zone vs surroundings within 1 km | 60 s | 10 s |
| `GET /api/imagery?lat=&lng=` | Per-year thumbnail URLs, before/after, GIF URL, water-occurrence tile URL | 120 s | 35 to 45 s |
| `POST /api/summary` `{ facts }` | Grounded summary: LLM text if every year and number validates against the facts, else a template | 45 s | about 1 to 5 s |

Risk score, transition detection and facts assembly are pure functions in `src/lib/analysis/` (`risk.ts` holds all weights in one `RISK_CONFIG`). Results are cached in-process and in the Next.js data cache; errors are never cached.

Land cover currently uses interim threshold rules until the trained Random Forest asset is configured (`GEE_CLASSIFIER_ASSET`); the response says which method produced it.

## Earth Engine credentials

1. **Google Cloud project**: create (or pick) one at https://console.cloud.google.com.
2. **Register it for Earth Engine** (choose *Noncommercial*): https://code.earthengine.google.com/register
3. **Enable the API**: APIs & Services → Library → *Earth Engine API* → Enable.
4. **Service account**: IAM & Admin → Service Accounts → Create. Grant roles *Earth Engine Resource Writer* (needed later to save the classifier asset) and *Service Usage Consumer*.
5. **Register the service account for Earth Engine**: https://signup.earthengine.google.com/#!/service_accounts and add its email.
6. **Key**: service account → Keys → Add key → JSON. Save it outside the repo.
7. **Base64-encode it** and put it in `.env.local`:
   - PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\key.json"))`
   - bash: `base64 -w0 key.json`
8. Copy `.env.example` to `.env.local`, set `GEE_SERVICE_ACCOUNT_KEY_B64` and `GEE_PROJECT_ID`, then run `pnpm ee:check`.

Never commit `.env.local` or the key file.
