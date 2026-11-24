# Demo and control sites

Fixtures for the end-to-end tests and the "Try an example" chips. They live in `src/lib/sites.ts`.

**How they were chosen.** Not from memory. I scanned JRC Global Surface Water (yearly history) across Bengaluru, Chennai, Hyderabad, Kolkata, Mumbai/Navi Mumbai, Guwahati, Pune, Ahmedabad, Kochi, Delhi and Bhubaneswar for connected patches that had water in at least 6 of the 16 years 1985 to 2000 and at most 1 year from 2010 to 2021, and that Dynamic World (2022 to 2024) labels as built-up today. I then looked up each place and the published reporting on it.

**Honest limits.**
- The sources below document wetland and lake loss in the *area*. None of them pins the exact coordinate, so the per-site claim rests on the satellite record (JRC and the land-cover timeline), not on the article. The article is context, not proof for that pixel.
- JRC and Landsat start in 1984. Lakes filled before that cannot be shown.
- Land-cover stages currently come from the interim threshold classifier. They will be re-checked after the Random Forest lands (phase 3); a site that no longer shows the expected signature will be replaced, not forced.
- Bengaluru is missing: the scan found no clean Bengaluru patch that is both water-then-gone and built-up today at 30 m. A fifth demo site will be added if one turns up after the Random Forest is in.

## Demo sites (built on former water)

| Site | Coordinates | What the satellite record shows (JRC water years) |
| --- | --- | --- |
| Perungudi, near Pallikaranai Marsh, Chennai | 12.9413, 80.2179 | Seasonal marsh water, wet years 1988 to 1996 and again in the 2021 flood year. Edge of a marsh, so a messier story than the others. |
| Rajarhat (New Town), Kolkata | 22.6060, 88.5297 | 16 water years between 1987 and 2004, none since. |
| Ulwe, Navi Mumbai | 18.9777, 73.0260 | Water 1993 to 2004, built-up from 2005 (Landsat timeline). Clearest example. |
| Kottur Sitaiah Nagar, Allapur (Kukatpally), Hyderabad | 17.4612, 78.4149 | 23 water years from 1988 to 2019, mostly gone by 2007, dense built-up land (91% built) in the latest year. |

### Sources

**Perungudi / Pallikaranai, Chennai**
- Citizen Matters, "Flooded lands, disappearing birds: Pallikaranai wetland tour highlights impact of shrinking lakes": https://citizenmatters.in/wetland-tour-pallikaranai-watershed-area-chennai-cmda-gcc/
- DT Next, "Pallikaranai wetland has shrunk": https://www.dtnext.in/news/chennai/pallikaranai-wetland-has-shrunk
- Reported figures for the marsh's size differ by source and survey (about 5,500 ha in the 1960s to roughly 500 to 700 ha recently), so treat any single number as approximate. The IT corridor on Old Mahabalipuram Road and the Perungudi dump yard are named as causes.

**Rajarhat (New Town), Kolkata**
- Springer chapter (Rajarhat New Town as land assembled from wasteland, filled-in ponds and water bodies): https://rd.springer.com/chapter/10.1007/978-981-15-3951-0_6
- Dialogue Earth, "Realty chokes Kolkata wetlands, almost": https://dialogue.earth/2017/02/01/realty-chokes-kolkata-wetlands-almost/
- The Statesman (2011) headline, cited in the Springer chapter, alleges HIDCO illegally filled 33 water bodies. I only have the headline as cited, not the article.

**Ulwe, Navi Mumbai**
- Free Press Journal, environmental groups secure a seven-hectare wetland from landfill (Navi Mumbai, Sector 36): https://www.freepressjournal.in/amp/mumbai/navi-mumbai-environmental-groups-secure-seven-hectare-wetland-from-extinction-due-to-landfill
- SANDRP, "Mumbai civil society efforts to protect mangroves and wetlands": https://sandrp.in/2025/03/07/mumbai-civil-society-efforts-to-protect-mangroves-wetlands/
- Those reports cover Navi Mumbai wetlands (Nerul, Sector 36). They do not name the Ulwe coordinate, so this is area-level context.

**Allapur / Kukatpally, Hyderabad**
- The News Minute, "134 lakes, 14,061 encroachments: the state of Hyderabad lakes": https://www.thenewsminute.com/telangana/134-lakes-14061-encroachments-state-hyderabad-lakes-170335
- Down To Earth, "Lakes do the disappearing act" (HMDA data; Saciwaters study of 3,245 ha of lake area lost 1989 to 2001): https://www.downtoearth.org.in/news/lakes-do-the-disappearing-act-39215
- Kukatpally lakes are named in these (for example Nalla Cheruvu and Mysamma Cheruvu). I found nothing on Allapur cheruvu specifically.

## Control sites (never water)

Both have JRC occurrence of 0 in the whole zone for all 38 years of record (1984 to 2021) and must score **Low**.

| Site | Coordinates | Note |
| --- | --- | --- |
| Dharampeth, Nagpur | 21.1400, 79.0650 | Established inner-city locality. |
| Sodala, Jaipur | 26.9124, 75.7873 | Dry upland in a semi-arid city. |

Source for both: JRC Global Surface Water v1.4 (Pekel et al. 2016), https://global-surface-water.appspot.com/, checked by GroundTruth with the same code the app uses. Real saved output: `docs/sample-output/dharampeth-nagpur.*.json`.

A third check, Banjara Hills (Hyderabad), showed a single stray water pixel in one zone (under 1% of the zone, 2015 to 2021), which the 10% rule correctly ignores. It was dropped as a control because it is not strictly zero.
