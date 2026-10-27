# Credits

## Data

| Source | Publisher | Licence | Used for |
|---|---|---|---|
| [Daily Shelter & Overnight Service Occupancy & Capacity](https://open.toronto.ca/dataset/daily-shelter-overnight-service-occupancy-capacity/) | City of Toronto, Toronto Shelter & Support Services | [Open Government Licence – Toronto](https://open.toronto.ca/open-data-licence/) | every occupancy figure |
| [Central Intake calls — Service Queue Data](https://open.toronto.ca/dataset/central-intake-calls/) | City of Toronto, Toronto Shelter & Support Services | Open Government Licence – Toronto | unmatched callers |
| [Address Points (Municipal) — Toronto One Address Repository](https://open.toronto.ca/dataset/address-points-municipal-toronto-one-address-repository/) | City of Toronto | Open Government Licence – Toronto | map pin coordinates |
| [Nominatim](https://nominatim.openstreetmap.org/) search over OpenStreetMap data | OpenStreetMap Foundation; data © OpenStreetMap contributors | [ODbL](https://www.openstreetmap.org/copyright) | coordinates for addresses outside the City's data (1 of 95 on 2026-10-16) |

"Contains information licensed under the Open Government Licence – Toronto." CKAN reports the occupancy package's licence field as "not specified"; the portal's licence page covers the catalogue (docs/DATA.md §1). The Central Intake contact details on the map note come from [toronto.ca](https://www.toronto.ca/community-people/housing-shelter/homeless-help/central-intake/).

## Map tiles

[OpenStreetMap standard tiles](https://tile.openstreetmap.org/), © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), used under the [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/): visible attribution, a "Report a map issue" link, no prefetching or bulk download. The tiles are recoloured in the browser with CSS filters.

## Libraries and fonts (vendored, exact versions)

| Item | Version | Licence | Author | File and SHA-384 |
|---|---|---|---|---|
| [uPlot](https://github.com/leeoniya/uPlot) | 1.6.32 | MIT | Leon Sorokin | `vendor/uplot-1.6.32/uPlot.iife.min.js` sha384-Gx3t0zdBAuQOuvvmaLZj7HKEiSgWTAs+VdtNY7wt19QDPTDQjFIwAuXDj0zeN00c; `uPlot.min.css` sha384-IfV0B7MIOYuO95kO9G5ySKPz/85zqFNOAs8iy4tkK5zd9izhJAB8b7lHrwYqqmYE |
| [Leaflet](https://leafletjs.com/) | 1.9.4 | BSD-2-Clause | Volodymyr Agafonkin and contributors | `vendor/leaflet-1.9.4/leaflet.js` sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH; `leaflet.css` sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H |
| [Oswald](https://github.com/googlefonts/OswaldFont) via [Fontsource](https://fontsource.org/) `@fontsource-variable/oswald` | 5.3.0 | SIL Open Font License 1.1 | The Oswald Project Authors | `vendor/oswald-5.3.0/oswald-latin-wght-normal.woff2` sha384-j1WA9qYH//yWBCF5nk87By8LQA99VCmmJuf01JNeKvA+4C/O0Wxe6yqkiRfuh1DE |

Each vendor folder keeps the upstream `LICENSE` file. All were downloaded from cdn.jsdelivr.net on 2026-10-16.

## Images

- **Pre-generated pack:** 25 AI-generated illustrations made on 2026-10-15 by agent=claude (Cowork, linked to BANE-VICTUS-TOP) for TJ, through the laptop's image-gen skill with Grok Imagine (Grok 25, Gemini 0). One line per image, with the full prompt, in [`assets/pack/LEDGER.jsonl`](assets/pack/LEDGER.jsonl); notes in [`assets/pack/README.md`](assets/pack/README.md).
- **Laptop additions (17 Oct 2026):** 3 AI-generated illustrations made by agent=claude (Cowork, linked to BANE-VICTUS-TOP) for Aco through the laptop's image-gen skill with Codex (GPT Image): `sh-hero-islands-dusk-hd` (1672×941), `sh-hero-islands-sunset-hd` (1664×936) and `sh-sc-doorway-v2` (1536×1024). They answer the three requests in [`assets/REQUESTS.md`](assets/REQUESTS.md). Their ledger lines, with full prompts, are the last three in `assets/pack/LEDGER.jsonl`. The raw PNGs stay outside the repository; the pack holds same-size JPEG masters.
- **Shipped:** 16 images. 13 come from the original pack, including the share image's background and, new in shelter-02, the city-bokeh texture; the other 3 are the laptop additions. Each is listed with its source, ledger line and alt text in [`assets/img/MANIFEST.json`](assets/img/MANIFEST.json); `scripts/build_images.py` converts them to AVIF/WebP, never wider than the source, and `scripts/build_og.mjs` renders the share image. Not shipped: the two 1280 px pack heroes (replaced by the laptop's HD heroes), the original doorway and snowy-bench scenes (reasons in docs/DESIGN.md §6), and the other pack images.
- **Generated during the laptop check (shelter-02):** 0 of the 40 allowed.
- **Generated during the cloud build (shelter-01):** 0 of the 40 allowed, US$0.00 of the US$10 cap. No API key was set in the sandbox, so `scripts/imagegen.py` wrote three requests to [`assets/REQUESTS.md`](assets/REQUESTS.md) instead. Any future generated image gets a line in `assets/LEDGER.jsonl`.
- The illustrations are stylised atmosphere, not photographs and not data; none shows a person.

## Look

Palette, type and composition sampled from [Homeless in Toronto](https://bane.one/) (bane.one), the game this dashboard accompanies. See [`docs/DESIGN.md`](docs/DESIGN.md).

## Tools used to build and check (not shipped)

Python 3 standard library (pipeline), Pillow (image conversion), [Playwright](https://playwright.dev/) 1.56.1 with Chromium (tests, screenshots, share image), [actionlint](https://github.com/rhysd/actionlint) 1.7.12 with shellcheck (workflow lint), and the dataviz skill's palette validator (chart colours).
