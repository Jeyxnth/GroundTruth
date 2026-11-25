# Decisions

## 2026-11-24 · The interface language is English only
- Decided by: default, until the owner answers
- Why: the demo is judged in English and regional-language work is a separate body of effort; short plain sentences carry most second-language readers
- Rejected: Hindi and other regional languages in this phase
- Rests on: [context-groundtruth.md](context-groundtruth.md) Users

## 2026-11-24 · No behavioural analytics or accounts
- Decided by: default, until the owner answers
- Why: the product asks people to trust a result about a major purchase; collecting behaviour data it does not need would contradict that
- Rejected: page analytics, saved searches behind an account
- Rests on: [context-groundtruth.md](context-groundtruth.md) Ethical stance

## 2026-11-24 · Next-step guidance names official records generically
- Decided by: default, until the owner answers
- Why: city-specific record names need verified sources for every city; a wrong record name is worse than a generic one
- Rejected: per-city lists of authorities and maps
- Rests on: [context-groundtruth.md](context-groundtruth.md) Open questions

## 2026-11-24 · Artifacts this project makes
- Decided by: default, until the owner answers
- Why: an existing UI is being redesigned, so the work starts from an evaluation of it rather than from strategy or research; wording, failure states and accessibility each change what gets built
- Rejected: `/strategize`, `/investigate` and `/blueprint` (the problem, users and system are already fixed by the build), `/localize` (English only), `/measure` (no analytics), `/present` and `/specify` (no stakeholder deck or handoff in this phase)
- Rests on: [context-groundtruth.md](context-groundtruth.md) Product

Artifacts, each tied to the answer that calls for it:
- `evaluate-groundtruth-ui.md`: the existing UI exists and is being redesigned
- `copy-groundtruth.md` (`/articulate`): the result and error states carry the stance, and every message is written for second-language readers
- `states-groundtruth.md` (`/fortify`): sections load independently over 7 to 45 seconds and can fail alone
- `access-groundtruth.md` (`/include`): phone use outdoors, keyboard operation, reduced motion, and band-by-word-shape-colour

## 2026-11-24 · The evaluation reviews the existing screens by measurement at 390 px and spot checks on desktop
- Decided by: default, until the owner answers
- Why: the live app can be measured directly (section heights, target sizes, contrast, page length), and the project has no users to test with yet
- Rejected: a screen reader session, a session with real buyers, a print preview in a browser other than Chromium
- Rests on: [evaluate-groundtruth-ui.md](evaluate-groundtruth-ui.md)

## 2026-11-24 · States and accessibility were built and tested in code, not written as separate documents
- Decided by: default, until the owner answers
- Why: the loading, partial and failure states and the touch, keyboard and contrast requirements are enforced by end-to-end tests (wait panel, per-section errors with Try again, 44 px targets, reserved heights, reduced motion), which is a stricter record than a document
- Rejected: `states-groundtruth.md` and `access-groundtruth.md` from `/fortify` and `/include`
- Rests on: [tests/e2e/app.spec.ts](tests/e2e/app.spec.ts)

## 2026-11-24 · The next-steps block names kinds of record, not city offices
- Decided by: default, after the owner did not answer the question
- Why: per-city office names need verified sources for each city
- Rejected: per-city authority names for the four demo cities
- Rests on: [copy-groundtruth.md](copy-groundtruth.md)

## 2026-11-24 · Geist Sans stays as the interface face
- Decided by: the owner approved the Newsreader and Geist pairing at the design checkpoint
- Why: it is already in the project and reads well at small sizes; Impeccable's detector flags Geist as a common face
- Rejected: swapping to a less common sans
- Rests on: [DESIGN.md](DESIGN.md)

## 2026-11-25 · Design round 2 approved: map-first hero, scroll story, dark default
- Decided by: the designer (approved the rendered screenshots)
- Why: round 1 looked flat and the images were blurry; the designer asked for imagery-led and story-style with clean scroll animation
- Rejected: keeping the two-column paper/ink layout; stretching small thumbnails (now 720x480 with Esri imagery for "Today")
- Rests on: docs/design-review/round2

## 2026-11-25 · Map and pictures: separate hero columns, place names, 1999 start, archive photos
- Decided by: the designer asked for no overlap, place names, a 1999 start and buildings that can be identified
- Why: pictures from 1999 to 2013 resolve 15 to 30 m, so building-level detail comes from the Esri archive (2014, 2018, 2022); names come from OpenFreeMap because CARTO now requires a key; the water layer is off by default so it does not hide buildings
- Rejected: sharpening or pixel-squares for old Landsat frames (noise, blocks)
- Rests on: rendered screenshots of the Ulwe demo site
