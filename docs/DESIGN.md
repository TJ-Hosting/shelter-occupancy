# DESIGN — the Homeless in Toronto look, applied to the City's numbers

The dashboard borrows its look from *Homeless in Toronto* (https://bane.one). Tokens were sampled from the live site on 2026-10-16: `https://bane.one/css/main.css` (`:root`) for the dark game page, and the inline `<style>` in `https://bane.one/about.html` for the light text page. TJ's bar is "visually stunning, never at the cost of a number"; the rules below are how this page keeps both.

## 1. What was sampled from bane.one

| bane.one token | Value | Used here as |
|---|---|---|
| `--ink` | `#08090a` | dark page background (`--bg`) |
| `--ink-2` | `#101113` | dark card surface (`--surface`) |
| `--ink-3` | `#191a1d` | dark raised surface (`--surface-2`) |
| `--hair` | `#2b2d31` | dark hairlines |
| `--hair-soft` | `rgba(214,206,190,0.14)` | masthead rule |
| `--paper` | `#ece7dc` | dark text (`--text`) |
| `--paper-2` | `#d9d3c6` | dark body text (`--text-2`) |
| `--muted` | `#8e8b85` | raised to `#a19d95` here so small labels clear WCAG AA on `#101113` |
| `--key` | `#e0a44f` (sodium amber) | accent, links, focus ring in dark mode |
| `--cold` | `#8fb0c4` | kept as a token; the chart blue is a validated step (§3) |
| `--loss` | `#c4543f` | the bed coral is a validated sibling (§3) |
| `--display` | `"Oswald", "Arial Narrow", …` (about page) | display face; **Oswald 5.3.0 is vendored** so it renders the same everywhere |
| `--body` | `system-ui, -apple-system, "Segoe UI", …` | body text |
| `--mono` | `ui-monospace, "Cascadia Mono", …` | letter-spaced uppercase labels and kickers |
| about page, light mode | bg `#f3efe6`, surface `#e6e0d3`, text `#1b1a18`, text-2 `#33312c`, muted `#6a675f`, hair `#cdc6b6` | light mode (`--muted` darkened to `#625f58`, card surface lightened to `#faf7f0`) |

Composition borrowed with the tokens: square corners, 1px hairline grids instead of shadows, bold uppercase condensed headings with wide tracking, small mono kickers, a film-grain overlay on the hero, a "need help now" panel in amber, generous dark space. bane.one is dark-first; this page follows the visitor's system setting and offers a toggle (stored in `localStorage` when allowed).

Sunset light over Toronto comes from the image pack (amber, coral, rose, violet into navy) and from the chart colours below, which are drawn from the same family.

## 2. Type

- **Display:** Oswald (variable, 200–700), SIL OFL 1.1, from `@fontsource-variable/oswald@5.3.0`, vendored as `vendor/oswald-5.3.0/oswald-latin-wght-normal.woff2` (28 KB, preloaded, `font-display: swap`). Headings and the big figures. bane.one names Oswald first in its about-page stack but does not ship it, so most visitors there see Arial Narrow or a system fallback; vendoring makes the condensed look reliable.
- **Body:** the system UI stack, as on bane.one.
- **Numbers:** hero and tile figures use Oswald's proportional figures; table columns and axis ticks use `tabular-nums`.
- Deviation from the dataviz skill's default (hero figure in the body sans): the brief's ruling is to match bane.one, whose identity is the condensed display face, so the hero figure is set in Oswald.

## 3. Colour for data

Every chart colour does one job and was run through the dataviz validator (`validate_palette.js`: OKLCH lightness band, chroma floor, protan/deutan separation, normal-vision floor, contrast against the chart surface) for the pair it actually appears in, in both modes.

| Entity | Light | Dark | Where |
|---|---|---|---|
| People, headline programs | `#b7791f` | `#bd7f24` | people chart, sector people bars |
| Temporary Refugee Response | `#2f7dbb` | `#4a8fd0` | stacked band, panel rule |
| Beds | `#d0573f` | `#d9604a` | beds block, rate chart, map pins, meters |
| Rooms | `#7b5ea7` | `#9479cf` | rooms block, rate chart, map pins, meters |

Validator results (2026-10-16), surfaces `#faf7f0` light and `#101113` dark:

| Pair | Mode | Lightness band | Chroma | CVD ΔE (worst) | Normal-vision ΔE | Contrast ≥ 3:1 |
|---|---|---|---|---|---|---|
| people / refugee | light | pass | pass | 21.9 (protan) | 25.2 | pass |
| beds / rooms | light | pass | pass | 17.3 (protan) | 20.9 | pass |
| people / refugee | dark | pass | pass | 22.9 (protan) | 24.7 | pass |
| beds / rooms | dark | pass | pass | 19.7 (protan) | 21.1 | pass |

All four entities together fail the *all-pairs* test (amber ↔ coral in light, violet ↔ blue in dark). Those pairs never share a chart, every chart has a legend, and every block names its type in text, so colour is never the only identity channel.

**Year-over-year overlay** is ordinal (years have an order), so it uses one amber ramp, oldest faintest, current year strongest and thickest, validated with `--ordinal`:

- light (on `#faf7f0`): `#cfa66a #bf9047 #ab792c #93631b #784d10 #5a3707` — monotone, ΔL ≥ 0.06, lightest step 2.11:1, hue spread 8° → pass
- dark (on `#101113`): `#6d5532 #8a6b3a #a78342 #c49b4a #e0b352 #f6cd6a` — monotone, ΔL ≥ 0.06, faintest step 2.69:1, hue spread 11° → pass

The ramp has six slots, assigned by recency (`--y1` oldest … `--y6` current), so 2027 needs no CSS change; the chart shows the latest six years.

**Text never wears a data colour.** Values, labels and legends use the text tokens; a swatch, line key or meter beside them carries identity. Text contrast for every token pair is checked by `tests/contrast-check.mjs` (output in `evidence/`).

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
| `sh-hero-islands-dusk` | hero, dark mode | dark scrim gradients + grain; slow 40 s settle (off with reduced motion) |
| `sh-hero-islands-sunset` | hero, light mode | a scrim dark on the text column and open on the right, so the sunset glows; the hero stays an "evening" zone in both modes |
| `sh-hero-portrait` | hero below 600 px | a deeper scrim from a third of the way down, because the portrait plate puts bright sky behind the text |
| `sh-sc-cot`, `sh-sc-hotel-corridor` | beds and rooms blocks | 20% (dark) / 10% (light), masked into the card's right side |
| `sh-hero-winter-night` | band above the year-over-year chart | dark gradient under the heading |
| `sh-tex-dusk-sky` | refugee-response panel, 404 | 14% (dark) / 7% (light) wash |
| `sh-sc-windows`, three spots (tea, key, coat) | "What this shows" | with alt text and a caption saying they are AI-generated atmosphere |
| `sh-sc-streetcar` | footer | heavy dark scrim |
| `sh-embed-band` | embed card | dark scrim |
| `sh-og-share` | share image 1200×630 | rendered with the title by `scripts/build_og.mjs` |

**Not shipped:** `sh-sc-doorway` (a house number "142", lettering on the doormat, and a framed photo in the hallway that appears to show people) and `sh-sc-bench-snow` (an empty bench in snow beside a turn-away figure would suggest that unmatched callers sleep outside, which the data does not say). Requests to regenerate are in `assets/REQUESTS.md`.

**Resolution, stated rather than silent:** the pack's heroes are 1280 px wide. On screens wider than that, and on high-density screens, the browser stretches them. The dark scrim and grain hide most of the softness; a 2560 px regeneration is requested in `assets/REQUESTS.md`.

## 7. Accessibility and motion

- Text contrast meets WCAG AA in both modes; checked in a real browser, including text over images measured against the rendered pixels behind it (`evidence/contrast-check.txt`). The first run of that check failed the light-mode hero, the beds/rooms art, the year-over-year band, the footer fade and the embed labels; the scrims and image opacities above are the result of fixing those, not of loosening the check.
- Keyboard: skip link, visible 2px amber focus ring, sortable table headers are buttons with `aria-sort`, charts focusable with arrow-key readout.
- `prefers-reduced-motion` stops the hero drift, reveals and meter fills; `prefers-contrast: more` raises muted text and hairlines; print hides the map and controls.
- Mobile-first: one column at 375 px, the programs table scrolls inside its frame, the filter bar stays sticky.
