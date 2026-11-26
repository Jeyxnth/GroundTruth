# Demo and control sites

Fixtures for the end-to-end tests and the "Try an example" chips. They live in `src/lib/sites.ts`.

**How they were chosen.** Not from memory. I scanned JRC Global Surface Water (yearly history) across Bengaluru, Chennai, Hyderabad, Kolkata, Mumbai/Navi Mumbai, Guwahati, Pune, Ahmedabad, Kochi, Delhi and Bhubaneswar for connected patches that had water in at least 6 of the 16 years 1985 to 2000 and at most 1 year from 2010 to 2021, and that Dynamic World (2022 to 2024) labels as built-up today. I then looked up each place and the published reporting on it.

**Honest limits.**
- The sources below document wetland and lake loss in the *area*. None of them pins the exact coordinate, so the per-site claim rests on the satellite record (JRC and the land-cover timeline), not on the article. The article is context, not proof for that pixel.
- JRC and Landsat start in 1984. Lakes filled before that cannot be shown.
- Land-cover stages come from the trained Random Forest (see docs/ml-results.md for its accuracy, which is measured against Dynamic World, not the ground). The sites still show the water-to-land change after switching from the interim threshold rules, so none was replaced.
- Bengaluru is missing: the scan found no clean Bengaluru patch that is both water-then-gone and built-up today at 30 m. A fifth demo site can be added if one turns up.

## Demo sites (built on former water)

Results below are from the app's own pipeline with the trained Random Forest (method `random-forest`), checked on 2026-11-24 (Kolkata additions on 2026-11-26).

| Site | Coordinates | What the pipeline reports | Risk |
| --- | --- | --- | --- |
| West Chowbaga Road, Makaltala, Kolkata | 22.5300, 88.4058 | Water 1988 to 2011, then built-up from 2012 (no separate bare stage visible). Ponds are clear in the 1999 picture; dense buildings today. | 73 High |
| Bhagabanpur, Sonarpur, Kolkata | 22.4955, 88.4290 | Water 1988 to 2010, then built-up from 2011 (no separate bare stage visible). | 63 High |
| Perungudi, near Pallikaranai Marsh, Chennai | 12.9413, 80.2179 | Water 1988 to 1994, then built-up from 1995 (no separate bare stage visible). Seasonal marsh water again in the 2021 flood year. | 58 High |
| Rajarhat (New Town), Kolkata | 22.6060, 88.5297 | Water 1988 to 2003, then built-up from 2004 (no separate bare stage visible). | 53 Moderate |
| Kottur Sitaiah Nagar, Allapur (Kukatpally), Hyderabad | 17.4612, 78.4149 | Water 1988 to 2008, then vegetation from 2009, then built-up from 2013. **A deliberate edge case:** the detector calls the vegetation stage natural-looking succession, so it does not flag it as filling, but it reports the later build-up. | 73 High |

### Sources

**Perungudi / Pallikaranai, Chennai**
- Citizen Matters, "Flooded lands, disappearing birds: Pallikaranai wetland tour highlights impact of shrinking lakes": https://citizenmatters.in/wetland-tour-pallikaranai-watershed-area-chennai-cmda-gcc/
- DT Next, "Pallikaranai wetland has shrunk": https://www.dtnext.in/news/chennai/pallikaranai-wetland-has-shrunk
- Reported figures for the marsh's size differ by source and survey (about 5,500 ha in the 1960s to roughly 500 to 700 ha recently), so treat any single number as approximate. The IT corridor on Old Mahabalipuram Road and the Perungudi dump yard are named as causes.

**Rajarhat (New Town), Kolkata**
- Springer chapter (Rajarhat New Town as land assembled from wasteland, filled-in ponds and water bodies): https://rd.springer.com/chapter/10.1007/978-981-15-3951-0_6
- Dialogue Earth, "Realty chokes Kolkata wetlands, almost": https://dialogue.earth/2017/02/01/realty-chokes-kolkata-wetlands-almost/
- The Statesman (2011) headline, cited in the Springer chapter, alleges HIDCO illegally filled 33 water bodies. I only have the headline as cited, not the article.

**West Chowbaga Road and Bhagabanpur, Kolkata**
- Lokmat Times, Calcutta High Court on illegal constructions in the East Kolkata Wetlands: https://www.lokmattimes.com/national/calcutta-hc-pulls-up-state-over-illegal-constructions-in-east-kolkata-wetlands/amp/
- The Statesman, High Court on inaction over the East Kolkata Wetlands: https://www.thestatesman.com/bengal/hc-displeased-over-inaction-on-east-kolkata-wetlands-warns-of-paramilitary-deployment-1503561743.html
- Both are about the wetland area. Neither was checked against these exact coordinates, so the per-site claim rests on the satellite record and pictures.

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
