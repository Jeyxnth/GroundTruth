# GroundTruth home, analysis and report screens

## Anti-Pattern Verdict

Minor issues. No manipulative pattern is present: no urgency, no loss framing, no prechecked or hidden choice, and the AI summary is labelled. Three common failures are present and are findings below: missing feedback during the wait, a dead end after the verdict, and jargon overload.

## Priority Issues

### Major

**The page jumps by about 1,670 px as sections fill in**
- **What happens:** At 390 px each section reserves far less height than it ends up using: risk 420 reserved, 1,056 actual; summary 150, 494; imagery 560, 1,037; water 380, 506; elevation 280, 369. The risk section is first, so everything below moves down when it fills.
- **Why it matters:** A reader who has scrolled to the imagery while it loads has the content move under their thumb, and the brief requires no layout shift as sections arrive.
- **Breaks:** visibility of system status.
- **Change:** Reserve each section at the height it will take on a phone and on a desktop, so a section fills in place.

**The wait on a new location is silent**
- **What happens:** A location not yet analysed takes 7 to 45 seconds. Every section shows grey bars, and the only explanation is text hidden from sighted users. The verdict waits for the slowest of water, land cover and elevation.
- **Why it matters:** Someone standing at a plot cannot tell whether the page is working, stuck, or about to fail, and the demo audience sees an empty page.
- **Breaks:** visibility of system status, and the Missing Feedback pattern.
- **Change:** Say what is being read and roughly how long it takes, show which sections are done, and show each section's result as soon as it exists instead of holding the verdict.

**The reason for the verdict and the satellite imagery sit 1,300 to 2,600 px below the score**
- **What happens:** The score starts 324 px down. The six-factor breakdown is 738 px tall and always open, so the summary starts at 1,340 px, the map at 2,026 px and the before-and-after comparison at 2,584 px. The page is 6.9 phone screens long.
- **Why it matters:** The product promises a verdict readable in 3 seconds with satellite imagery as the evidence, and on a phone the evidence is three screens away from the verdict.
- **Breaks:** aesthetic and minimalist design.
- **Change:** Put one plain sentence of why beside the score, show the before-and-after next, and collapse the factor breakdown behind a control.

**Nothing says what to do after the verdict**
- **What happens:** The result ends at a generic disclaimer. High and Moderate results say to check records without saying which records or who holds them.
- **Why it matters:** The buyer's success is leaving with the next step, and a High result with no next step is a dead end at the moment of highest concern.
- **Breaks:** the Dead Ends pattern, and help and documentation.
- **Change:** Add a short next-steps block under the verdict that names the kinds of official record to check and who to ask, written to cover every city.

**The filling of a lake is stated as fact**
- **What happens:** The factor reads "The water was filled or built over from about 2005, 21 years ago" and the timeline reads "Water 1992 to 2005, filled 2006 to 2008, built by 2009". Both come from a classifier that agrees with its reference labels on 92.5% of test pixels and dates a change to the nearest yearly image.
- **Why it matters:** A buyer can treat an estimate as a record, and the ethical stance says the result reports what the satellite shows, not a legal or physical certainty.
- **Breaks:** the Simulated Understanding pattern, and match between system and real world.
- **Change:** Word dated changes as what the imagery suggests, give the dates as a range, and keep the confident wording for the facts the data states directly.

**A buyer at the plot cannot start from where they stand**
- **What happens:** The home page accepts only typed text. The product promise includes dropping a pin, but the map exists only after a search, and no control reads the phone's location.
- **Why it matters:** The primary user is standing at the site on a phone, where typing an address is slow and the address is often wrong or missing for plots.
- **Breaks:** flexibility and efficiency of use.
- **Change:** Offer a use-my-location action that asks for permission only when tapped, and a route to drop a pin on a map from the home page.

**Interactive controls fall below the minimum touch size**
- **What happens:** Measured at 390 px, 11 controls are under 44 px: the back link (102 by 20), Open report (102 by 32), the map pin (22 by 22), map zoom buttons (29 by 29), the overlay checkbox (16 by 16), both sliders (16 tall), Play (96 by 32), the GIF link (121 by 15) and the data-table toggle (310 by 20). The pin, the checkbox and the GIF link are under the 24 px minimum in WCAG 2.2.
- **Why it matters:** The main controls are used with one thumb, outdoors, and the pin is the way to correct a mislocated result.
- **Breaks:** touch target size.
- **Change:** Give every control a target of at least the recommended touch size on phones, with spacing between neighbours.

### Minor

**Technical terms appear on the main surface**
- **What happens:** JRC, Landsat, Sentinel-2, "occurrence", "valid observations", "local depression", "pixels", "Method: Random Forest classifier" and the example group named "Control sites" appear in stats, captions and chips.
- **Why it matters:** Many readers use English as a second language and know no remote-sensing terms, so the headline stats read as noise.
- **Breaks:** match between system and real world, and the Jargon Overload pattern.
- **Change:** Say each fact in everyday words on the main surface and move the source and method names to a details area.

**Three notes say the same thing about missing years**
- **What happens:** The notes list reads "5 year(s) have too little valid JRC data", "5 year(s) have no cloud-free imagery" and "5 year(s) were skipped for lack of clear imagery" for the same gap.
- **Why it matters:** Repetition makes the page look more broken than it is and adds three lines to an already long page.
- **Breaks:** aesthetic and minimalist design.
- **Change:** State the gap once, in plain words, where the gap appears in the chart.

**Search needs a second tap when there is one match**
- **What happens:** Search always lists the matches and waits for a tap, including when there is exactly one.
- **Why it matters:** On a phone each extra step costs time on a slow connection.
- **Breaks:** flexibility and efficiency of use.
- **Change:** When one result is returned, go straight to the analysis and let the user correct it with the pin.

**A rate-limit error names the data provider**
- **What happens:** The section error for a capacity failure says "Earth Engine is rate limited right now".
- **Why it matters:** The provider name means nothing to the reader and does not say what to do.
- **Breaks:** help users recognize, diagnose and recover from errors.
- **Change:** Say the service is busy, that the section can be tried again, and that other sections are unaffected.

**The Moderate band colour is too light on the light theme for body-size text**
- **What happens:** Moderate on white is 4.24 to 1, which passes only for large text. Low is 5.32 and High is 6.54. In the dark theme all three are above 8 to 1.
- **Why it matters:** The band is also used in smaller text and bars, where 4.24 to 1 is below the 4.5 to 1 needed.
- **Breaks:** colour contrast.
- **Change:** Darken the Moderate colour on the light theme until it meets the body-text ratio.

**Chart and legend text is smaller than comfortable**
- **What happens:** Text renders at 10 and 11 px in chart axes, the transition labels and the map legend.
- **Why it matters:** Small text is hard to read outdoors in sunlight.
- **Breaks:** recognition rather than recall.
- **Change:** Raise the smallest text to a readable size and thin the axis labels instead of shrinking them.

### Cosmetic

**The zone outline is heavy on the satellite thumbnails**
- **What happens:** The 2 px outline is drawn at low resolution and enlarged, so it renders thick and uneven.
- **Why it matters:** It covers the ground the zone is meant to show.
- **Breaks:** aesthetic and minimalist design.
- **Change:** Draw the outline as an overlay at display resolution with a lighter weight.

## Positive Findings

- A failing section shows its own error with a Retry and leaves the others working; a partial score says it is partial.
- The risk band is a word, a shape and a colour together, and the score scale marks the band thresholds.
- Gap years are hatched, never interpolated, and every chart has a data table beside it.
- Every input has a label, focus is visible, there is one level-one heading and one level-two heading per section, and the pin moves with the arrow keys.
- Contrast in the dark theme is above 8 to 1 for all text and band colours, and muted text is above 5.7 to 1 in the light theme.
- The AI summary says where it came from, and the location is a stable shareable URL.
- Motion respects the reduced-motion setting, and the disclaimer appears on every screen and in print.
