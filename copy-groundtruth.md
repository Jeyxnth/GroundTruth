# GroundTruth result, wait and error copy

## Voice and Tone Framework

**Calm and exact.** States what the satellite record shows, with no alarm and no reassurance beyond the evidence.
- Do: "We found little sign of water on this land in the satellite record."
- Don't: "Great news! This land is safe." / "Warning: this land is dangerous."

**Plain.** Short sentences, everyday words, one idea each. A number appears when the reader needs it.
- Do: "The zone sits 2.3 m below the land around it."
- Don't: "Relative elevation is -2.3 m versus the 1 km annulus mean."

**Honest about what an image can show.** Dated changes are estimates from one set of images a year.
- Do: "The images suggest water until about 2005."
- Don't: "The lake was filled in 2006."

**No urgency, no verdicts on the purchase.** The page reports and points to records. It never says buy, don't buy, illegal or safe.
- Do: "Check these records before you decide."
- Don't: "Act now." / "Do not buy this plot."

Tone by context:
- Verdict: steady and short.
- Wait: reassuring and specific about what is happening.
- Error: practical; says what still works and what to do.
- Next steps: instructive, one action per line.

## Terminology

| Term | Means to the reader | Not used |
| --- | --- | --- |
| zone | The circle around the pin that is analysed, 150 m in radius by default | area, AOI, buffer |
| clear image | A satellite image of the zone with no cloud over it | valid observation, scene |
| water record | What the satellite images show about water at the zone over the years | occurrence, JRC layer |
| risk | The screening result for the zone: Low, Moderate or High | score alone, grade, rating |
| lower than the land around it | The zone sits below the ground within 1 km of it | local depression, relative elevation |
| square | One patch of a satellite image, 10 to 30 m across | pixel |

## Copy Deck

### Verdict

One sentence beside the score. It depends on the band.

| State | String |
| --- | --- |
| Low | We found little sign of water on this land in the satellite record. |
| Moderate | The satellite record shows some sign of water or low ground here. Check the records below. |
| High | The satellite record suggests this land held water in the past and may have been filled. Check the records below. |
| Partial result | Some parts could not load, so this result may be too low. |

Heading above the score: "Land history check". The word "risk" follows the band: "Low risk", "Moderate risk", "High risk".

### What to check next

Shown under the verdict for every band. Static text.

Heading: What to check next

- **Land and revenue records.** Ask the local revenue office whether this plot, or the survey numbers next to it, are recorded as a lake, tank or wetland.
- **Water-body boundary map.** Ask the city or state lake or water-body authority for the boundary map and the protected strip around it.
- **Title search.** Ask a lawyer to run a registered title search on the plot.

Closing line: This page cannot confirm any of these. It is a first check from satellite images.

### Wait state

Shown while a new place is analysed. Depends on the system state of each section.

| Element | String |
| --- | --- |
| Heading | Reading 40 years of satellite images |
| Time expectation, new place | This takes 15 to 45 seconds for a new place. Results appear as each part finishes. |
| Time expectation, place checked before | This place was checked before, so it should open in a few seconds. |
| Part: water record | Water record |
| Part: land cover | What was on the land each year |
| Part: ground height | Ground height |
| Part: pictures | Satellite pictures |
| Part status, waiting | Waiting |
| Part status, reading | Reading |
| Part status, done | Done |
| Part status, failed | Could not load |
| Screen reader announcement, each part done | {part} is ready. |

### Plain words for the main surface

The source and method names move to a details area under each section.

| Was | Main surface | Details area |
| --- | --- | --- |
| JRC water map | Satellite water record | Source: JRC Global Surface Water, 1984 to 2021. |
| Landsat and Sentinel-2 | satellite images | Images before {year} are from Landsat and are coarser. Images from {year} are from Sentinel-2. |
| Max occurrence {n}% of valid observations | How often it was water: up to {n}% of clear images | Occurrence is the share of clear observations in which a square held water. |
| Nearest current water, last 5 JRC years | Nearest water today: {m} m | Water seen in any of the last five years of the water record. |
| Local depression | Lower than the land around it | The zone is lower than the land around it and among the lowest spots within 1 km. |
| Pixels | Each square in the images covers 10 to 30 m, so results describe the whole zone, not single buildings. | None. |
| Method: Random Forest classifier | (not shown) | Land type is decided by a computer model trained on Google Dynamic World land maps. |
| Control sites that were never water | Land that was never water | None. |
| Built on former water (reported in the news) | Built on former water, reported in the news | Sources are listed with each example. |

Timeline caption: Each year uses images from January to March, when skies are clearest. Older images are coarser.

### Missing years

One note, placed with the chart it explains. Depends on the count.

{n} years have no clear image, mostly because of cloud. They are striped and left empty, not guessed.

### Dated changes

Templates for the transition detector's output. {year} slots take the first year of each stage. The line after the template appears under any dated change.

| Kind | String |
| --- | --- |
| fill-and-build | The images suggest water until about {waterUntil}, bare or filled ground from about {filledFrom}, and buildings from about {builtFrom}. |
| water-to-built | The images suggest water until about {waterUntil}, and buildings from about {builtFrom}. |
| water-to-bare | The images suggest water until about {waterUntil}, and bare or filled ground from about {filledFrom}. |
| water-to-vegetation | The images suggest water until about {waterUntil}, then plants growing over it from about {vegFrom}. This looks like a natural change, not filling. |
| water-to-vegetation, then built | Buildings appear from about {builtFrom}. |
| none, water still present | The images show water here in recent years. No filling is visible. |
| none, never water | The images show no lasting water here in any year. |
| insufficient data | Too few clear images to date any change. |

Line under any dated change: Each year comes from one January to March set of images, so dates can be off by a year or two.

### Section errors

Each section shows its own error and a Retry button. The rest of the page keeps working.

| Cause | String |
| --- | --- |
| Heading, all errors | This part could not load. |
| Computation failed | This part could not be worked out. The rest of the page is not affected. |
| Service busy | The service is busy right now. Try again in a minute. The rest of the page is not affected. |
| Timeout | This is taking longer than usual. Try again. Places checked before load faster. |
| No connection | No connection. Check your internet and try again. |
| Satellite service unavailable | The satellite service is not available right now. Try again in a few minutes. |
| Invalid location | That location is not valid. Search again or tap the map. |
| Button | Try again |

Search errors:

| Cause | String |
| --- | --- |
| Too short | Type at least 3 letters, or enter latitude and longitude. |
| Not found | We could not find that place in India. Add the city or area, or enter latitude and longitude. |
| Search busy | Search is busy. Try again in a few seconds. |
| No connection | No connection. Check your internet and try again. |

### Starting from where you stand

| Element | String |
| --- | --- |
| Button, location | Use my current location |
| Explanation, shown under the button before the phone asks | Your phone will ask to share your location. We send it to our server to check this spot. We do not keep a record that links it to you. |
| Location off | Location is off for this site. Search for an address or drop a pin on the map instead. |
| Location not found | We could not find your location. Move to open sky, or search instead. |
| After a location is found | Phone locations can be off by tens of meters. Check that the pin is on the plot. |
| Button, map | Drop a pin on the map |
| Map helper, home | Tap the map where the plot is. |
| Map helper, analysis | Tap the map or drag the pin to check another spot. |
| Pin, screen reader | Pin. Drag it, or use the arrow keys, to check another spot. |

## Open Questions

Should the next-steps lines name the specific lake authority and record office for each city once verified sources exist?
