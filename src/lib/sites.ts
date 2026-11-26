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
    id: "perungudi-chennai",
    kind: "demo",
    name: "Perungudi, near Pallikaranai Marsh",
    city: "Chennai",
    lat: 12.9413,
    lng: 80.2179,
    blurb: "Marsh edge where IT-corridor and housing growth took over wetland after the 1990s.",
    sources: [
      { title: "Citizen Matters: Pallikaranai wetland tour highlights impact of shrinking lakes", url: "https://citizenmatters.in/wetland-tour-pallikaranai-watershed-area-chennai-cmda-gcc/" },
      { title: "DT Next: Pallikaranai wetland has shrunk", url: "https://www.dtnext.in/news/chennai/pallikaranai-wetland-has-shrunk" },
    ],
  },
  {
    id: "rajarhat-kolkata",
    kind: "demo",
    name: "Rajarhat (New Town)",
    city: "Kolkata",
    lat: 22.606,
    lng: 88.5297,
    blurb: "New Town was assembled partly from filled ponds and wetland on the edge of the East Kolkata Wetlands.",
    sources: [
      { title: "Springer chapter on Rajarhat New Town (filled-in ponds and water bodies)", url: "https://rd.springer.com/chapter/10.1007/978-981-15-3951-0_6" },
      { title: "Dialogue Earth: Realty chokes Kolkata wetlands", url: "https://dialogue.earth/2017/02/01/realty-chokes-kolkata-wetlands-almost/" },
    ],
  },
  {
    id: "chowbaga-kolkata",
    kind: "demo",
    name: "West Chowbaga Road, Makaltala",
    city: "Kolkata",
    lat: 22.53,
    lng: 88.4058,
    blurb: "Ponds on the eastern fringe of Kolkata that are dense housing now.",
    sources: [
      { title: "Lokmat Times: Calcutta HC pulls up state over illegal constructions in East Kolkata Wetlands", url: "https://www.lokmattimes.com/national/calcutta-hc-pulls-up-state-over-illegal-constructions-in-east-kolkata-wetlands/amp/" },
      { title: "The Statesman: HC displeased over inaction on East Kolkata Wetlands", url: "https://www.thestatesman.com/bengal/hc-displeased-over-inaction-on-east-kolkata-wetlands-warns-of-paramilitary-deployment-1503561743.html" },
    ],
  },
  {
    id: "bhagabanpur-kolkata",
    kind: "demo",
    name: "Bhagabanpur, Sonarpur",
    city: "Kolkata",
    lat: 22.4955,
    lng: 88.429,
    blurb: "Wetland and pond country south-east of Kolkata that has filled up with houses.",
    sources: [
      { title: "Lokmat Times: Calcutta HC pulls up state over illegal constructions in East Kolkata Wetlands", url: "https://www.lokmattimes.com/national/calcutta-hc-pulls-up-state-over-illegal-constructions-in-east-kolkata-wetlands/amp/" },
      { title: "The Statesman: HC displeased over inaction on East Kolkata Wetlands", url: "https://www.thestatesman.com/bengal/hc-displeased-over-inaction-on-east-kolkata-wetlands-warns-of-paramilitary-deployment-1503561743.html" },
    ],
  },
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
