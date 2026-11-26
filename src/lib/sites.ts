/**
 * Demo and control sites. Used by the home-page "Try an example" chips and as test fixtures.
 * Full rationale and sources: docs/demo-sites.md.
 */
export interface SiteSource {
  title: string;
  url: string;
}

export interface Site {
  id: string;
  kind: "demo" | "control";
  name: string;
  city: string;
  lat: number;
  lng: number;
  /** One line on what this site demonstrates. */
  blurb: string;
  sources: SiteSource[];
}

export const DEMO_SITES: Site[] = [
  {
    id: "allapur-hyderabad",
    kind: "demo",
    name: "Kottur Sitaiah Nagar, Allapur (Kukatpally)",
    city: "Hyderabad",
    lat: 17.4612,
    lng: 78.4149,
    blurb: "Kukatpally-area tank bed that held water until the late 2000s and is dense housing now.",
    sources: [
      { title: "The News Minute: 134 lakes, 14,061 encroachments, the state of Hyderabad lakes", url: "https://www.thenewsminute.com/telangana/134-lakes-14061-encroachments-state-hyderabad-lakes-170335" },
      { title: "Down To Earth: Lakes do the disappearing act", url: "https://www.downtoearth.org.in/news/lakes-do-the-disappearing-act-39215" },
    ],
  },
];

export const CONTROL_SITES: Site[] = [
  {
    id: "dharampeth-nagpur",
    kind: "control",
    name: "Dharampeth",
    city: "Nagpur",
    lat: 21.14,
    lng: 79.065,
    blurb: "Established inner-city locality; no water in 38 years of JRC records.",
    sources: [{ title: "JRC Global Surface Water v1.4: occurrence is 0 in the zone (checked by GroundTruth)", url: "https://global-surface-water.appspot.com/" }],
  },
  {
    id: "sodala-jaipur",
    kind: "control",
    name: "Sodala",
    city: "Jaipur",
    lat: 26.9124,
    lng: 75.7873,
    blurb: "Dry upland in a semi-arid city; no water in 38 years of JRC records.",
    sources: [{ title: "JRC Global Surface Water v1.4: occurrence is 0 in the zone (checked by GroundTruth)", url: "https://global-surface-water.appspot.com/" }],
  },
];

export const ALL_SITES: Site[] = [...DEMO_SITES, ...CONTROL_SITES];
