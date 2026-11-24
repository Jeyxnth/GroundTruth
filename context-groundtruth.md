# GroundTruth: satellite land-history screening for plot buyers in India

## Users

Primary: an individual homebuyer in an Indian city, checking a plot or flat they are considering. They stand at the site, on a phone, on mobile data of uneven quality, often with a broker or seller present who is arguing for the purchase. They are not remote-sensing literate and cannot judge a satellite image or a score without a plain reason. The decision is large, usually the biggest financial commitment of their life, and they are anxious about being misled.

Secondary: the people the buyer forwards the result to: family members, a lawyer, a bank officer. They read the report on a phone or as a PDF, without the live map, and need the verdict, the evidence and the next step without the buyer present to explain.

Conditions that change a design decision:
- Phone first, one thumb, outdoors in sunlight: contrast and tap-target size matter more than on a desktop.
- Analysis takes 7 to 45 seconds on first load of a location: sections arrive one at a time and the page must stay readable while they do.
- English is the interface language; many users read it as a second language: short sentences, no remote-sensing jargon.
- A false alarm on dry land damages trust as much as a miss: the control result must read as clearly "Low" as a filled lake reads "High".

## Product

A web app on Vercel (Next.js). The user gives an address or drops a pin. The app analyses a 150 m radius zone from Landsat and Sentinel-2 imagery (1985 onward), JRC Global Surface Water (1984 to 2021) and Copernicus elevation, and returns: a Low, Moderate or High screening risk built from six separately explained factors; a land-cover timeline with a detected water-to-bare-to-built change; water history; elevation relative to the surroundings; before and after imagery with a time-lapse; a short written summary; and a printable report at a stable URL.

Exists today: a complete functional UI (home, `/analyze`, `/report`) with plain styling. The work in scope is the visual and interaction design of those three screens, and the wording of what they say.

Free to use; no accounts; no revenue model.

## Constraints

- Delivery: hackathon demo judged live; the demo must work end to end on real addresses.
- Data: satellite pixels are 10 to 30 m, so results are shares of a zone, never statements about a building. JRC ends in 2021. Years without cloud-free imagery stay as gaps and are never filled in.
- Technical: Earth Engine (noncommercial use) with a cold response of up to about 45 seconds; address search by Nominatim at 1 request per second; hosting limits to be confirmed at deployment.
- Regulatory: the product makes no legal, title or survey determination. The statement "Screening tool based on satellite data, not a legal or survey determination; verify with official land records" appears on every screen and in the printed report.
- Platform: mobile first at 390 px; light and dark; keyboard operable; respects reduced motion.
- Approval: the repository owner approves direction and visuals.

## Ethical stance

- The result never tells a user to buy or not to buy, never states a legal status, and never accuses a seller or builder. It reports what the satellite record shows and what to verify.
- No manufactured urgency: no countdowns, no limited-availability wording, no loss framing in the verdict copy. A High result states facts and the next step.
- The AI summary is labelled as AI-written, uses only values from the computed facts, and falls back to a labelled template when it fails validation. The origin is always visible.
- Missing data is shown as missing, with the reason, in the same place the value would be. A partial risk score says it is partial and that it may be too low.
- The band is conveyed by word, shape and colour together, never colour alone.
- Minimum data: no accounts, no advertising, no behavioural analytics. A location is sent to the geocoder and to Earth Engine to answer the request, and results are cached by coordinates rounded to 4 decimals, with no user identifier stored.

## Success

For a buyer: within 3 seconds of the result appearing they can say which band it is and one reason; within a minute they can explain the evidence to a family member; they leave knowing which official records to check next, and they do not read the result as a legal clearance.

For the project: a judge opening the demo sees a never-water control site read Low and a filled-lake site read High and can see why from the page alone; no section shows a blank, a jump, or an unexplained error while the others load.

Metrics for these belong to `/measure`.

## Open questions

Should the result name the specific official records to check next for each city (for example the lake boundary map and the revenue record), or stay generic?
