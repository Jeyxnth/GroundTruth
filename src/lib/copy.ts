/**
 * User-facing strings that depend on data or system state. The wording is specified in copy-groundtruth.md.
 * Keep strings here, not scattered through components.
 */
import type { RiskBand } from "@/lib/analysis/risk";
import type { TransitionResult } from "@/lib/analysis/transitions";
import type { SectionError } from "@/lib/client/fetch";

export const DISCLAIMER =
  "GroundTruth is a screening tool based on satellite data. It is not a legal or survey determination. Always verify with official land records.";

export const VERDICT_REASON: Record<RiskBand, string> = {
  Low: "We found little sign of water on this land in the satellite record.",
  Moderate: "The satellite record shows some sign of water or low ground here. Check the records below.",
  High: "The satellite record suggests this land held water in the past and may have been filled. Check the records below.",
};

export const PARTIAL_RESULT = "Some parts could not load, so this result may be too low.";

export const NEXT_STEPS = {
  heading: "What to check next",
  items: [
    { title: "Land and revenue records.", text: "Ask the local revenue office whether this plot, or the survey numbers next to it, are recorded as a lake, tank or wetland." },
    { title: "Water-body boundary map.", text: "Ask the city or state lake or water-body authority for the boundary map and the protected strip around it." },
    { title: "Title search.", text: "Ask a lawyer to run a registered title search on the plot." },
  ],
  closing: "This page cannot confirm any of these. It is a first check from satellite images.",
} as const;

export const WAIT = {
  heading: "Reading 40 years of satellite images",
  slow: "This takes 15 to 45 seconds for a new place. Results appear as each part finishes.",
  parts: {
    water: "Water record",
    landcover: "What was on the land each year",
    elevation: "Ground height",
    imagery: "Satellite pictures",
  },
  status: { waiting: "Waiting", reading: "Reading", done: "Done", failed: "Could not load" },
  ready: (part: string) => `${part} is ready.`,
} as const;

export const GAP_NOTE = (n: number) =>
  `${n} year${n === 1 ? " has" : "s have"} no clear image, mostly because of cloud. ${n === 1 ? "It is" : "They are"} striped and left empty, not guessed.`;

export const DATING_NOTE = "Each year comes from one January to March set of images, so dates can be off by a year or two.";

/** Hedged wording for what the transition detector found. Slots take the first year of each stage. */
export function describeTransition(t: TransitionResult): string {
  const y = (n: number | null) => (n === null ? "" : String(n));
  switch (t.kind) {
    case "fill-and-build":
      return `The images suggest water until about ${y(t.waterUntilYear)}, bare or filled ground from about ${y(t.filledFromYear)}, and buildings from about ${y(t.builtFromYear)}.`;
    case "water-to-built":
      return `The images suggest water until about ${y(t.waterUntilYear)}, and buildings from about ${y(t.builtFromYear)}.`;
    case "water-to-bare":
      return `The images suggest water until about ${y(t.waterUntilYear)}, and bare or filled ground from about ${y(t.filledFromYear)}.`;
    case "water-to-vegetation": {
      const veg = t.runs.find((r) => r.stage === "vegetation" && r.startYear > (t.waterUntilYear ?? 0))?.startYear ?? null;
      const base = `The images suggest water until about ${y(t.waterUntilYear)}, then plants growing over it from about ${y(veg)}. This looks like a natural change, not filling.`;
      return t.builtFromYear ? `${base} Buildings appear from about ${y(t.builtFromYear)}.` : base;
    }
    case "none":
      return t.waterFromYear ? "The images show water here in recent years. No filling is visible." : "The images show no lasting water here in any year.";
    case "insufficient-data":
      return "Too few clear images to date any change.";
  }
}

/** Plain wording for a failed section, chosen by cause. */
export function friendlyError(e: Pick<SectionError, "code">): string {
  switch (e.code) {
    case "ee_quota":
    case "rate_limited":
      return "The service is busy right now. Try again in a minute. The rest of the page is not affected.";
    case "ee_timeout":
    case "timeout":
      return "This is taking longer than usual. Try again. Places checked before load faster.";
    case "network":
      return "No connection. Check your internet and try again.";
    case "ee_unavailable":
    case "ee_not_configured":
      return "The satellite service is not available right now. Try again in a few minutes.";
    case "invalid_input":
      return "That location is not valid. Search again or tap the map.";
    default:
      return "This part could not be worked out. The rest of the page is not affected.";
  }
}

export const SECTION_ERROR_HEADING = "This part could not load.";

export const SEARCH_ERRORS = {
  short: "Type at least 3 letters, or enter latitude and longitude.",
  notFound: "We could not find that place in India. Add the city or area, or enter latitude and longitude.",
  busy: "Search is busy. Try again in a few seconds.",
  network: "No connection. Check your internet and try again.",
} as const;

export const ENTRY = {
  useLocation: "Use my current location",
  locationExplain:
    "Your phone will ask to share your location. We send it to our server to check this spot. We do not keep a record that links it to you.",
  locationDenied: "Location is off for this site. Search for an address or drop a pin on the map instead.",
  locationFailed: "We could not find your location. Move to open sky, or search instead.",
  locationAccuracy: "Phone locations can be off by tens of meters. Check that the pin is on the plot.",
  dropPin: "Drop a pin on the map",
  mapHelperHome: "Tap the map where the plot is.",
  mapHelperAnalysis: "Tap the map or drag the pin to check another spot.",
  pinLabel: "Pin. Drag it, or use the arrow keys, to check another spot.",
  analysePin: "Check this spot",
} as const;

export const MY_LOCATION_LABEL = "My current location";
