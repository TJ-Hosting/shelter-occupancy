# DESIGN — the Homeless in Toronto look, applied to the City's numbers

The dashboard borrows its look from *Homeless in Toronto* (https://torontohomeless.com), the board game it accompanies. Since shelter-03 (8 Nov 2026) it follows the game's night-city noir and is dark only, like the game: no light mode and no theme toggle. Tokens were read on 2026-11-08 from the live game's CSS (`https://torontohomeless.com/_app/base-dzZPECeO.css` and its inline splash style) and from the game's token file, `src/styles/tokens.css` in `TJ-Hosting/homeless` at `2414eae`. TJ's bar is "visually stunning, never at the cost of a number"; the rules below are how this page keeps both.

## 1. Tokens, from the game

| Game token | Value | Used here as |
|---|---|---|
| `--bg` | `#0b0e13` | page background (`--bg`), `theme-color` |
| `--panel` (`--hit-paper`) | `#121821` | card and chart surface (`--surface`) |
| `--hit-surface-raised` | `#182130` | raised surface: tooltips, table heads (`--surface-2`) |
| `--line` (`--hit-accent-muted`) | `#284058` | hairlines and card borders (`--hair`) |
| `--hit-rule` | `rgb(160 190 230 / 0.22)` | masthead rule (`--hair-soft`) |
| `--ink` (`--hit-ink`) | `#e6edf5` | headings and figures (`--text`) |
| `--hit-cost` | `#c9d6e6` | body text (`--text-2`), the game's quiet neutral |
| `--muted` | `#9fb0c4` | small labels, axis text (`--muted`, `--axis`) |
| `--accent` (`--hit-accent`) | `#7fb0e0` | accent: rules, the active control, the skip link (`--key`) |
| `--hit-link` | `#9cc4f0` | link text (`--key-text`) |
| `--focus` (`--hit-focus-ring`) | `#bfe0ff` | 2 px focus ring (`--focus`) |
| `--hit-warning` | `#e5343f` | **the one warning red** (`--warn`): marks "at or near full" and nothing else |
| `--hit-scrim` | `rgb(4 6 10 / 0.7)` | image scrims (`--scrim`) |
| `color-scheme` | `dark` | `color-scheme: dark`, `<meta name="color-scheme" content="dark">` |

The game's own rule for the red is "the notice row and the lost home only; never for a cost, a button or a figure". Here it is a mark beside the "at or near full" count and on the table's ≥ 95 tag; it never colours text or a number, and nothing else on the page is red. The public CSS does not carry the red; it was read from the token file named above.

Composition borrowed with the tokens: square corners, thin blue-grey rules instead of shadows, uppercase condensed headings with wide tracking, small mono labels, a film-grain overlay on the hero, generous dark space.

## 2. Type

- **Display:** the game's stack, `"Bahnschrift SemiBold Condensed", "Arial Narrow", "Segoe UI", system-ui, sans-serif`, weight 600, uppercase, `letter-spacing: 0.1em` for headings. Nothing is downloaded: Windows shows Bahnschrift, other systems a narrow or system sans, exactly as the game does. Oswald is no longer used or preloaded; its vendored files stay in `vendor/oswald-5.3.0/` (unreferenced).
- **Body:** `system-ui, -apple-system, "Segoe UI", sans-serif`, as in the game.
- **Mono:** `ui-monospace, Consolas, monospace`, for letter-spaced uppercase labels.
- **Numbers:** headline figures in the display face; table columns and axis ticks use `tabular-nums`.

## 3. Colour for data

Every chart colour does one job and was run through the dataviz validator (`validate_palette.js`: OKLCH lightness band 0.48–0.67, chroma floor 0.10, protan/deutan separation ≥ 8, normal-vision floor ≥ 15, contrast ≥ 3:1 against the chart surface) for the colours that actually share a chart, on the dark surface `#121821` only. The colours are steps from the game's blue family; the validator's band rules out the game's own `#7fb0e0` as a data colour (L 0.74, chroma 0.087 reads grey next to the others), so it stays the UI accent.

| Entity | Colour | OKLCH (L, C, h) | Where |
|---|---|---|---|
| People, headline programs | `#136b94` | 0.50, 0.10, 235° | people chart, bottom band |
| Temporary Programs (COVID-19 Response before 2024) | `#33a3b4` | 0.66, 0.10, 210° | people chart, middle band |
| Temporary Refugee Response | `#7577e3` | 0.62, 0.14, 280° | people chart, top band; its top edge is the City-wide total |
| At or near full (≥ 95 %) | `#e5343f` | the game's warning red | a mark only: the headline count and the table tag |

Validator results (2026-11-08, dark, surface `#121821`):

| Pair or set | Pairs tested | Lightness band | Chroma | CVD ΔE (worst) | Normal-vision ΔE (worst) | Contrast ≥ 3:1 |
|---|---|---|---|---|---|---|
| headline / Temporary Programs / refugee (stacked people chart) | all three pairs | pass | pass | 11.9 deutan (refugee ↔ Temporary Programs); tritan 8.3 | 16.3 (refugee ↔ Temporary Programs) | pass (3.02, 5.97, 4.67) |
| same, adjacent bands only | headline ↔ Temporary, Temporary ↔ refugee | pass | pass | 11.9 deutan | 16.3 | pass |

All three pairs pass, not only the touching bands, because the three share one chart. The headline blue is the darkest step (3.02:1 against the surface, just over the floor); its band also carries a 24 % wash, a legend swatch and a tooltip row, and every value is in the table. The warning red is 4.15:1 against `#121821` and 4.51:1 against `#0b0e13` (≥ 3:1 for a mark); it shares no chart with the blues.

**Text never wears a data colour.** Values, labels and legends use the text tokens; a swatch, line key or mark beside them carries identity. Text contrast for every token pair is checked by `tests/contrast-check.mjs` (output in `evidence/`).

## 4. The page, in order (shelter-03)

One screen first. Someone who arrives from the game's **Check Shelter Availability** button needs two answers: where to get a bed tonight, and how full the shelters were last night.

1. **Help bar**, first on the page: Central Intake's two numbers and 311 as `tel:` links, with the toronto.ca source.
2. **Headline** over the hero: the title, one sentence on what the page can and can't show, then five figures, each with its date: people served, bed occupancy, room occupancy, programs at or near full (of the total), unmatched callers (Central Intake's monthly figure, with its own date).
3. **One line for the rest:** Temporary Programs, Temporary Refugee Response and the City-wide total; "What are these?" holds the two definitions, the COVID-19 Response note and the unmatched-callers definition.
4. **One trend chart:** people served each night, stacked; 12 months by default, or since 2021; its table behind "Show as a table".
5. **Map** with a search box and a beds / rooms / both control; the programs table behind "Show every program as a table", reachable from the skip link past the pins.
6. **About:** three points, the City's limitation behind a disclosure, the link to `docs/DATA.md`, sources, the Open Government Licence – Toronto line and the OpenStreetMap attribution.
7. **Footer:** the game link and the help line again.

Removed in shelter-03: the year-over-year overlay and its table, the occupancy-by-sector table, the occupancy-rate chart, the 3-year range, the separate Temporary Programs, Temporary Refugee Response and unmatched-callers panels (and the unmatched-callers sparkline), the sector and program-area filters, the sticky masthead and filter bar, the light theme and its toggle, and every illustration except the hero. At 390 × 844 the help bar and the five figures fit the first screen; at 1440 × 900 the chart starts on it too (`evidence/simplify/`).

## 5. Chart and map

- **Chart:** uPlot 1.6.32 (MIT), vendored. 2 px lines, area washes at 24 %, hairline grid one step off the surface, no dashed rules, no dual axes. The stacked area starts at zero. One crosshair tooltip lists every band and the City-wide total at the cursor; values lead, labels follow. Arrow keys move the crosshair (Shift = 30 days, Home/End). The table twin (every night, built on first open) means no value is hover-only. The range control (12 months / since 2021) sits beside the legend, above the chart it scopes.
- **Map:** Leaflet 1.9.4 (BSD-2), vendored. Tiles: OpenStreetMap's standard tile server, used within the OSMF tile policy (visible attribution, a "Report a map issue" link, no prefetching, the browser's own User-Agent and Referer, the URL kept in one constant), restyled in CSS only (inverted, nearly desaturated, so the night map reads blue-grey). Pins are code-drawn circles at the exact coordinates, all in the accent blue: a small pin for one program, a larger pin with a light ring where several programs share an address. The type is chosen with the beds / rooms / both control and named in each popup, so colour carries no type. Pins are **not** coloured by how full a program is: a "not red" pin would read as "a bed is free here", which the data can't say.

## 6. Images

One image, from the game: its noir title backdrop, a painted Toronto skyline at night across the lake, the CN Tower lit in thin stripes, no people (TJ-Hosting's own art, GPT Image, 28 Oct 2026; provenance in `CREDITS.md` and `assets/pack/LEDGER.jsonl`). The brief named the game's 1280 px title poster; the same still exists on the game at 1664 px (wide) and 941 px (tall), so those are the masters.

| Image | Where | Treatment |
|---|---|---|
| `sh-hero-noir` (1664×936) at 640, 960, 1280, 1664 | hero above 600 px, embed card, 404 page, share image | a dark scrim, lighter behind the title and heavier behind the figures; film grain; alt text on the hero |
| `sh-hero-noir-tall` (941×1672) at 480, 720, 941 | hero up to 600 px | the art box stops at 34 rem and sits on its foot, so the lit skyline shows behind the title and the first figures |

The figure tiles are 84 % surface over a 6 px blur, so the skyline's lights glow through without touching text contrast (checked against the rendered pixels).

**Resolution: never upscaled, in the files or on the page** (Aco, 17 Oct 2026). `scripts/build_images.py` never writes a width larger than the source, and `tests/image-widths.py` checks every file. The wide art box is never taller than 16:9 at the page's width (`min(100%, 56.25vw)`), so `cover` never scales the file up when the headline wraps into a tall block, and its foot fades into the page; above 1664 CSS px the hero stops at its source width with soft dark edges. The 404 page's background is sized `min(1664px, max(100vw, 177.78vh))`, so it covers the screen up to the file's width and leaves dark edges beyond. `tests/browser-check.mjs` checks `<img>` elements at 375–1920 px; CSS backgrounds were checked by hand (QA, 9 Nov 2026). The earlier pack images (sunset and dusk heroes, scenes, spots, textures) are no longer referenced; their files stay in `assets/img/` until Barney rules on deleting them (shelter-02 Q2).

## 7. Accessibility and motion

- Text contrast meets WCAG AA on the dark set; checked in a real browser, including text over the hero measured against the rendered pixels behind it, with the text disclosures and the programs table opened (`evidence/contrast-check.txt`).
- Keyboard: a skip link to the figures, a skip link past the map's pins that opens the programs table, a visible 2 px focus ring in `--focus`, sortable table headers as buttons with `aria-sort`, the chart focusable with an arrow-key readout.
- `prefers-reduced-motion` turns off smooth scrolling and any animation; `prefers-contrast: more` raises muted text and hairlines; print hides the map and the controls.
- Mobile-first: two figure columns at 390 px, five across from 960 px; the programs table scrolls inside its frame.
