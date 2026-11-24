/** `pnpm ml:report` — re-render docs/ml-results.md from docs/ml-results.json without touching Earth Engine. */
import { readFileSync, writeFileSync } from "node:fs";
import { renderReport } from "./report";
writeFileSync("docs/ml-results.md", renderReport(JSON.parse(readFileSync("docs/ml-results.json", "utf8"))));
console.log("wrote docs/ml-results.md");
