import type { Facts } from "@/lib/analysis/facts";

/** Phrases a screening tool must never say. */
const BANNED = [/\bguarantee/i, /\bsafe to buy\b/i, /\bdo not buy\b/i, /\bdon't buy\b/i, /\blegal(ly)? (title|dispute|status)\b/i, /\billegal\b/i, /\bencroach/i];

/** Collect every year (1900..2100) and every number that appears anywhere in the facts. */
export function collectAllowed(facts: unknown): { numbers: number[]; years: Set<number> } {
  const numbers: number[] = [];
  const years = new Set<number>();
  const visit = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      numbers.push(v);
      if (Number.isInteger(v) && v >= 1900 && v <= 2100) years.add(v);
    } else if (typeof v === "string") {
      for (const m of v.matchAll(/\b(19|20)\d{2}\b/g)) years.add(Number(m[0]));
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(facts);
  return { numbers, years };
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

export interface Validation {
  ok: boolean;
  problems: string[];
}

/**
 * Every year and number in the text must come from the facts JSON.
 * Sentence count must be 3..5; banned phrases are rejected.
 */
export function validateSummary(text: string, facts: Facts): Validation {
  const problems: string[] = [];
  const { numbers, years } = collectAllowed(facts);

  const trimmed = text.trim();
  if (!trimmed) return { ok: false, problems: ["empty summary"] };

  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);
  if (sentences.length < 3 || sentences.length > 5) problems.push(`expected 3 to 5 sentences, got ${sentences.length}`);

  for (const re of BANNED) if (re.test(trimmed)) problems.push(`contains disallowed phrase (${re.source})`);

  // Years
  const seenYears = new Set<number>();
  for (const m of trimmed.matchAll(/\b(19|20)\d{2}\b/g)) {
    const y = Number(m[0]);
    seenYears.add(y);
    if (!years.has(y)) problems.push(`year ${y} is not in the facts`);
  }

  // Other numbers (strip years first). Percent and metre values may be rounded versions of facts.
  const withoutYears = trimmed.replace(/\b(19|20)\d{2}\b/g, " ");
  for (const m of withoutYears.matchAll(/(?<![\w.])(\d+(?:[.,]\d+)?)(?![\w])/g)) {
    const token = (m[1] as string).replace(",", "");
    const n = Number(token);
    const decimals = token.includes(".") ? (token.split(".")[1] as string).length : 0;
    const tol = decimals === 0 ? 0.5 : 0.5 * 10 ** -decimals;
    const matches = numbers.some((a) => Math.abs(Math.abs(a) - n) <= tol || Math.abs(a * 100 - n) <= tol);
    if (!matches) problems.push(`number ${token} is not in the facts`);
  }
  // Spelled-out small numbers can smuggle in counts ("three lakes"); reject those not in the facts.
  for (const m of trimmed.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi)) {
    const w = (m[1] as string).toLowerCase();
    const n = WORD_NUMBERS[w] as number;
    // "one" is ubiquitous in prose ("one of the"); only flag the others.
    if (w !== "one" && !numbers.some((a) => Math.abs(a - n) < 0.5)) problems.push(`number word "${w}" is not in the facts`);
  }
  return { ok: problems.length === 0, problems };
}

const span = (a: number | null, b: number | null) => (a !== null && b !== null && a !== b ? `${a} and ${b}` : `${a ?? b}`);

/** Deterministic fallback summary using only values from the facts. */
export function templateSummary(f: Facts): string {
  const out: string[] = [];
  const w = f.water;
  const t = f.transition;

  if (!w) {
    out.push("Water history could not be computed for this location, so no conclusion about past water is possible.");
  } else if (!w.everWater) {
    out.push(`No water was detected in this zone in any of the ${w.yearsObserved} observed years of satellite record.`);
  } else {
    const kind = w.classification === "permanent" ? "mostly permanent" : w.classification === "seasonal" ? "mostly seasonal" : "a mix of permanent and seasonal";
    out.push(
      `Satellite records show water in this zone in ${w.yearsWithWater} of ${w.yearsObserved} observed years, between ${span(w.firstWaterYear, w.lastWaterYear)}, and it was ${kind} water at a peak of ${w.peakWaterSharePercent}% of the zone.`,
    );
  }

  if (t && t.kind !== "insufficient-data") {
    switch (t.kind) {
      case "fill-and-build":
        out.push(`The images suggest water until about ${t.waterUntilYear}, bare or filled ground from about ${t.filledFromYear}, and buildings from about ${t.builtFromYear}.`);
        break;
      case "water-to-built":
        out.push(`The images suggest water until about ${t.waterUntilYear}, and buildings from about ${t.builtFromYear}.`);
        break;
      case "water-to-bare":
        out.push(`The images suggest water until about ${t.waterUntilYear}, and bare or filled ground from about ${t.filledFromYear}.`);
        break;
      case "water-to-vegetation":
        out.push(`The images suggest water gave way to plants after about ${t.waterUntilYear}, which looks like a natural change, not filling.`);
        break;
      case "none":
        out.push(w?.currentlyWater ? "The zone still shows water in recent years." : "No water-to-land change was detected in the land-cover record.");
        break;
    }
  } else if (t) {
    out.push("Too few cloud-free years were available to date any land-use change.");
  } else {
    out.push("Land-cover change could not be computed for this location.");
  }

  const km = f.analysis.surroundingsRadiusKm;
  if (f.elevation && f.elevation.relativeElevationM !== null) {
    const rel = f.elevation.relativeElevationM;
    out.push(
      rel < 0
        ? `The zone sits about ${Math.abs(rel)} m below its surroundings within ${km} km${f.elevation.isLocalDepression ? ", which is consistent with a local depression" : ""}.`
        : `The zone is not lower than its surroundings within ${km} km.`,
    );
  } else {
    out.push("Elevation context could not be computed for this location.");
  }

  if (f.risk) {
    const note = f.risk.unavailableFactors.length ? `, and these factors could not be computed: ${f.risk.unavailableFactors.join(", ")}` : "";
    out.push(`The screening risk score is ${f.risk.score} out of ${f.risk.maxScore}, which is ${f.risk.band}${note}.`);
  } else {
    out.push("No risk score could be calculated.");
  }
  // Always keep the closing reminder; trim the body, not the disclaimer, to stay within 5 sentences.
  return [...out.slice(0, 4), "This is a screening result from satellite data, so verify it against official land records before deciding."].join(" ");
}

export const SUMMARY_SYSTEM_PROMPT = [
  "You write a short plain-language summary of a land screening result for a home buyer in India.",
  "You receive one JSON object of computed facts. Write 3 to 5 sentences.",
  "Rules:",
  "- Use only facts present in the JSON. Do not add, infer or estimate anything else.",
  "- Every year and every number you write must appear in the JSON (percent values may be written as they appear). Do not write any other numbers, including counts, and do not include coordinates.",
  "- If a value is null or a section is null, say it could not be determined; do not guess.",
  "- Describe dated changes as what the images suggest, and write each year with the word about (for example: the images suggest water until about 2005). Never state as a fact that a lake was filled.",
  "- Natural-looking water-to-vegetation change must not be described as filling.",
  "- Do not give legal conclusions, accuse anyone, or tell the reader whether to buy.",
  "- End by reminding the reader to verify with official land records.",
  "- Plain sentences only: no lists, headings, markdown or emoji.",
].join("\n");
