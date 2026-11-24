# Design

The visual system as built, derived from `src/app/globals.css` and `src/components`. Product truth lives in `PRODUCT.md`; the reasoning behind decisions lives in `decisions.md`.

## World

A land-survey office: warm paper and ink by day, a cool near-black by night, one deep-teal accent for water. Satellite imagery is the hero; the interface stays out of its way. Light is the primary theme because the product is read outdoors in sunlight; dark follows the system setting.

## Colour

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | `#f6f4ee` | `#0e151b` | page |
| `--surface` | `#fbfaf6` | `#131c24` | inputs, chips, secondary buttons |
| `--foreground` | `#1a232c` | `#e7edf1` | text |
| `--muted` | `#5b6670` | `#9daeba` | secondary text (at least 5.7:1) |
| `--line` | `#d9d4c7` | `#26343f` | rules between sections |
| `--panel` | `#ece9df` | `#1a252e` | tracks, notes, table rows |
| `--accent` | `#0f5b66` | `#5fc1cf` | primary action, links |

Risk bands, always paired with a word and a shape (circle, triangle, square): `--band-low` `#1f6f4a` / `#5cc795`, `--band-moderate` `#8f5400` / `#f0a845`, `--band-high` `#a82a22` / `#ff8f85`.

Land cover, always labelled directly on the chart: water `#2b6cb0`, plants `#3f9a55`, bare or filled ground `#b8923f`, buildings `#6b4f7a` (lighter in dark mode). Missing data is a diagonal hatch, never a colour.

## Type

- Display and headings: Newsreader (500), balanced wrapping, tight tracking. Verdict word at 48 to 60 px; page title 36 to 48 px; section titles 24 px.
- Interface: Geist Sans at 16 px minimum for body, 14 px only for captions and legends.
- Coordinates, years and data labels: Geist Mono, tabular numerals everywhere.
- Prose measure capped at 54ch (about 70 characters).

## Layout

- Phone first (390 px). Order: verdict, satellite pictures, what to check next, summary, map, timeline, water record, ground height, score breakdown (collapsed), about.
- Desktop (1024 px and up): two columns. Left, sticky: verdict and map. Right: the evidence.
- Sections are ruled blocks with a top border, not boxed cards. Each reserves the height of its loaded content at phone and desktop widths, so nothing moves as results arrive (checked by an end-to-end test).
- Report page: single column, print stylesheet, controls hidden, score breakdown open.

## Components

- Buttons: 44 px minimum, one primary (teal) per view, ghost for the rest.
- Every control, including the map pin hit area, the zoom buttons and sliders, is at least 44 px.
- Charts draw at the container's real pixel width so 12 px text is 12 px; labels move below the chart on narrow screens.
- Details disclosures use a drawn chevron; no glyph characters stand in for icons.

## Motion

One authored moment: the verdict arrives with a short rise, the score counts up once, and the bar fills. Elsewhere motion is functional: the before/after clip follows the finger with no easing; time-lapse frames dissolve into each other; the map eases to a new pin over 700 ms. Under reduced motion, movement, shimmer and the count-up stop; short opacity fades remain so state changes stay visible.

## Rules this system keeps

- No eyebrow labels above headings, no section numbers, no hero metric block.
- No gradient text, glass, emoji or glyphs as icons, coloured side borders.
- Colour is never the only signal.
- Plain words on the main surface; source and method names live in "Sources" disclosures.

## Round 2 update (supersedes the paper/ink look above)
Dark is the default theme (near-black `#0a1015`, teal accent `#5fc9d8`), light theme behind a toggle. The analyze page opens on a full-screen interactive map with the verdict as a sheet over it, followed by scroll-revealed chapters. Motion: reveal on scroll, bars grow, counts rise, one slider sweep; all off under reduced motion. Tokens live in `src/app/globals.css`.
