// Serve MapLibre's worker as a static file. Bundlers (Turbopack) break its inline worker URL, and a copy from
// node_modules keeps it in lockstep with the installed version. Runs before `dev` and `build`.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/vendor/maplibre", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre/worker.mjs");
console.log("copied maplibre worker to public/vendor/maplibre/worker.mjs");
