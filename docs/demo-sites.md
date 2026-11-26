# Demo and control sites

Fixtures for the end-to-end tests and the "Try an example" chips. They live in `src/lib/sites.ts`.

**How they were chosen.** Not from memory. I scanned JRC Global Surface Water (yearly history) across Bengaluru, Chennai, Hyderabad, Kolkata, Mumbai/Navi Mumbai, Guwahati, Pune, Ahmedabad, Kochi, Delhi and Bhubaneswar for connected patches that had water in at least 6 of the 16 years 1985 to 2000 and at most 1 year from 2010 to 2021, and that Dynamic World (2022 to 2024) labels as built-up today. I then looked up each place and the published reporting on it.

**Honest limits.**
- The sources below document wetland and lake loss in the *area*. None of them pins the exact coordinate, so the per-site claim rests on the satellite record (JRC and the land-cover timeline), not on the article. The article is context, not proof for that pixel.
- JRC and Landsat start in 1984. Lakes filled before that cannot be shown.
- Land-cover stages come from the trained Random Forest (see docs/ml-results.md for its accuracy, which is measured against Dynamic World, not the ground). Other candidate sites were removed after review as unreliable examples.

## Demo sites (built on former water)

Results below are from the app's own pipeline with the trained Random Forest (method `random-forest`), checked on 2026-11-24 (Kolkata additions on 2026-11-26).

| Site | Coordinates | What the pipeline reports | Risk |
| --- | --- | --- | --- |
| Kottur Sitaiah Nagar, Allapur (Kukatpally), Hyderabad | 17.4612, 78.4149 | Water 1988 to 2008, then vegetation from 2009, then built-up from 2013. **A deliberate edge case:** the detector calls the vegetation stage natural-looking succession, so it does not flag it as filling, but it reports the later build-up. | 73 High |

### Sources

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
