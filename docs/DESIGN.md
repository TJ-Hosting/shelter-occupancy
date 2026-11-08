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

## 4. Charts

- uPlot 1.6.32 (MIT, 51 KB), vendored. 2px lines, area washes at 24% (stacked) or 10% (sparkline), hairline grid one step off the surface, no dashed rules, no dual axes.
- People charts that encode magnitude as area start at zero. Rate lines and the year-over-year lines use a non-zero floor, and the chart says so in text ("The vertical axis starts at 90%, not zero").
- One crosshair tooltip lists every series at the cursor; values lead, labels follow. Arrow keys move the crosshair (Shift = 30 days, Home/End).
- Every chart has a table twin (`<details>` with every night, built on first open), so no value is hover-only.
- The occupancy-by-sector chart is HTML: rows with bars and meters, values printed beside each bar.
- One range control (since 2021 / 3 years / 12 months) sits above the two charts it scopes; the year-over-year measure switch sits above its chart.

## 5. Map

Leaflet 1.9.4 (BSD-2), vendored. Tiles: OpenStreetMap's standard tile server, used within the OSMF tile policy (visible attribution, a "Report a map issue" link, no prefetching, the browser's own User-Agent and Referer, the URL kept in one constant). The tiles are restyled in CSS only: inverted and desaturated in dark mode, desaturated warm in light mode. Pins are code-drawn circles at the exact coordinates: coral for a bed program, violet for a room program, amber where several programs share an address, each with a 2px ring in the surface colour. CARTO's dark basemap would match bane.one more closely but now needs a registered key; see Follow-ups.

## 6. Images

Atmosphere only, never data, never people. From the pre-generated pack (`assets/pack/`), converted by `scripts/build_images.py` to AVIF and WebP at responsive widths, never upscaled in the files; each shipped file is listed in `assets/img/MANIFEST.json` with its ledger line.

| Image | Where | Treatment |
|---|---|---|
| `sh-hero-islands-dusk-hd` (1672 px, Codex, 17 Oct) | hero, dark mode | dark scrim gradients + grain; slow 40 s settle (off with reduced motion) |
| `sh-hero-islands-sunset-hd` (1664 px, Codex, 17 Oct) | hero, light mode | a scrim dark on the text column and open on the right, so the sunset glows; the hero stays an "evening" zone in both modes |
| `sh-tex-city-bokeh` | Temporary Programs panel | the same wash as the refugee panel |
| `sh-sc-doorway-v2` (Codex, 17 Oct) | "What this shows", under the spots | with alt text; covered by the section's AI-generated caption |
| `sh-hero-portrait` | hero below 600 px | a deeper scrim from a third of the way down, because the portrait plate puts bright sky behind the text |
| `sh-sc-cot`, `sh-sc-hotel-corridor` | beds and rooms blocks | 20% (dark) / 10% (light), masked into the card's right side |
| `sh-hero-winter-night` | band above the year-over-year chart | dark gradient under the heading |
| `sh-tex-dusk-sky` | refugee-response panel, 404 | 14% (dark) / 7% (light) wash |
| `sh-sc-windows`, three spots (tea, key, coat) | "What this shows" | with alt text and a caption saying they are AI-generated atmosphere |
| `sh-sc-streetcar` | footer | heavy dark scrim |
| `sh-embed-band` | embed card | dark scrim |
| `sh-og-share` | share image 1200×630 | rendered with the title by `scripts/build_og.mjs` |

**Not shipped:** `sh-sc-doorway` (a house number "142", lettering on the doormat, and a framed photo in the hallway that appears to show people; replaced by `sh-sc-doorway-v2`) and `sh-sc-bench-snow` (an empty bench in snow beside a turn-away figure would suggest that unmatched callers sleep outside, which the data does not say). The pack's 1280 px `sh-hero-islands-dusk` and `-sunset` were replaced by the HD versions (shelter-02): side by side in the page at 1440 and 1920 px (`evidence/images/compare/`), the HD skylines are clearly sharper. The scrims keep their mood calm, though the HD sunset is more saturated and photographic than the pack's painterly plates.

**Resolution: never upscaled, in the files or on the page** (Aco, 17 Oct 2026). `scripts/build_images.py` never writes a width larger than the source, and `tests/image-widths.py` checks every file. On the page no image is drawn wider than its pixels at 375, 768, 1440 or 1920 CSS px (`tests/browser-check.mjs`). To get there:
- the hero's `sizes` accounts for its height (`max(100vw, min(88vh, 46rem) × 1.78)`), and above 1664 px the hero stops at its source width with soft dark edges;
- the footer art keeps its 3:2 shape at no more than 1,248 px wide;
- the two panel washes use their 1,280 px files, in a box no taller than the source's 720 px.

High-density screens still get fewer device pixels than they could use: the laptop's models stop at about 1,672 px, and the 2560 px request was not met.

## 7. Accessibility and motion

- Text contrast meets WCAG AA in both modes; checked in a real browser, including text over images measured against the rendered pixels behind it (`evidence/contrast-check.txt`). The first run of that check failed the light-mode hero, the beds/rooms art, the year-over-year band, the footer fade and the embed labels; the scrims and image opacities above are the result of fixing those, not of loosening the check.
- Keyboard: skip link, visible 2px amber focus ring, sortable table headers are buttons with `aria-sort`, charts focusable with arrow-key readout.
- `prefers-reduced-motion` stops the hero drift, reveals and meter fills; `prefers-contrast: more` raises muted text and hairlines; print hides the map and controls.
- Mobile-first: one column at 375 px, the programs table scrolls inside its frame, the filter bar stays sticky.
