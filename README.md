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
