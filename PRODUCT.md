# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

An individual homebuyer in an Indian city checking a plot or flat they are considering. They stand at the site, on a phone, on mobile data of uneven quality, often with a broker or seller arguing for the purchase. They are not remote-sensing literate and read English as a first or second language. The decision is the largest financial commitment of their life, and they worry about being misled.

Secondary audience: the people the buyer forwards the result to (family, a lawyer, a bank officer), who read the report on a phone or as a PDF without the buyer present.

## Product Purpose

GroundTruth screens a 150 m zone around a point for its satellite history: whether it was ever a lake or wetland, when it appears to have been filled and built over, and how low it sits compared with the land around it. It returns an explainable Low, Moderate or High risk built from separately shown factors, with before and after imagery, a land-cover timeline, a short written summary, and a printable report at a stable URL.

Success: within 3 seconds of the result appearing the buyer can say which band it is and one reason; within a minute they can explain the evidence to family; they leave knowing which official records to check next and do not read the result as legal clearance.

## Positioning

A due-diligence screen that shows its evidence: forty years of real satellite images of the exact plot, a risk score whose every factor is shown with its reason, and honest gaps where no clear image exists. Brokers' claims cannot be checked against it, and it does not ask the buyer to trust a number.

## Operating Context

Used on a phone at the plot, and later at a desk or in a shared PDF. New locations take 15 to 45 seconds to analyse (results arrive section by section); locations analysed before open in seconds. Built on Google Earth Engine (Landsat, Sentinel-2, JRC Global Surface Water, Copernicus DEM), OpenStreetMap Nominatim for address search, and a Random Forest land-cover model trained on Dynamic World labels. Demo sites and never-water control sites are listed in docs/demo-sites.md.

## Capabilities and Constraints

- Screening only. Never states a legal, title or survey status, never says buy or don't buy, never accuses a seller or builder. The statement "Screening tool based on satellite data, not a legal or survey determination; verify with official land records" appears on every screen and in print.
- Satellite squares are 10 to 30 m, so results describe shares of a zone, not buildings. Dated changes come from one January to March image set per year and can be off by a year or two. JRC water history ends in 2021. Years without clear images are shown as gaps, never filled in.
- Model accuracy (docs/ml-results.md) is measured against Dynamic World labels, not field truth; independent evidence exists only for the water class before 2015.
- English only. No accounts, no advertising, no behavioural analytics. Results are cached by coordinates rounded to 4 decimals; no user identifier is stored.
- The next-steps guidance names kinds of official record generically; per-city office names are undecided and need verified sources.
- Terminology: zone, clear image, water record, risk (see copy-groundtruth.md).

## Evidence on Hand

Real analysis output for a filled-lake demo site and never-water control sites (docs/sample-output), measured model results (docs/ml-results.md), and news and research sources per demo site (docs/demo-sites.md). No user testing has been done and none is claimed.

## Product Principles

- Show the evidence next to the verdict: the reason and the imagery are part of the answer, not a drill-down.
- Say what the images suggest, never more: dated changes are estimates, missing data is shown as missing.
- Never create urgency: no countdowns, no loss framing, no purchase advice.
- Every state is designed: the 15 to 45 second wait, a section failing alone, a partial result.
- Work on a phone outdoors first: one thumb, bright light, uneven network.

## Accessibility & Inclusion

WCAG 2.2 AA as the floor. Band conveyed by word, shape and colour together. Keyboard operation of every control including the map pin. Reduced-motion setting honoured. Touch targets at or above the recommended size on phones. Plain, short English for second-language readers.
