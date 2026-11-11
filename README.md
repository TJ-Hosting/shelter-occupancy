# shelter-occupancy

**Toronto shelter occupancy**: a static dashboard of the City of Toronto's daily shelter and overnight-service occupancy data, served at **https://data.tj-hosting.ca** (after the post-merge steps below). It is a data companion to [Homeless in Toronto](https://torontohomeless.com/), the board game, and matches its night-city noir look (dark only).

One screen first (shelter-03, Nov 2026): the Central Intake help line, then last night's people served, bed and room occupancy (each with its own rate, never added), programs at or near full and Central Intake's unmatched callers, each with its date; one line for Temporary Programs, the Temporary Refugee Response and the City-wide total; one trend chart of people served each night (12 months or since 2021); a map with a pin at every program address, a search box and a beds / rooms / both control, with every program in a sortable table behind a disclosure; and a short About. Every figure comes from the City's open data and carries its date.

- Data sources, schema, every transformation, the program-area split and the "near full" definition: [`docs/DATA.md`](docs/DATA.md)
- Look, palette validation, type, images: [`docs/DESIGN.md`](docs/DESIGN.md)
- Credits and licences: [`CREDITS.md`](CREDITS.md)

## Run it locally

No build step. Any static server works:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/
```

Refresh the data snapshot from the City's API (Python 3, standard library only; ~20 s with a warm geocode cache):

```sh
python3 scripts/fetch_data.py              # writes data/latest.json, history.json, meta.json, geocodes.json
python3 scripts/fetch_data.py --no-geocode # use cached coordinates only
```

Tests (Node 18+ and Playwright's Chromium; they need the City's API for the data test):

```sh
npm install          # Playwright 1.56.1, the only dev dependency
npm test             # starts a local server, runs every check, writes evidence/
node tests/measure.mjs http://127.0.0.1:8765/   # page height, controls, what fits the first screen
```

Images: `python3 scripts/build_images.py` converts the shipped images in `assets/pack/` (since shelter-03 only the game's noir hero, wide and tall) to AVIF/WebP; `node scripts/build_og.mjs` renders the share image from the same hero.

## How the daily refresh works

`.github/workflows/refresh-data.yml` runs `scripts/fetch_data.py` every day at 14:17 UTC (about 40 minutes after the City's usual refresh at ~13:37 UTC) and again at 18:17 UTC as a catch-up, and on demand from the Actions tab.

- It commits `data/` only when `latest.json` or `history.json` changed, then asks GitHub Pages to rebuild.
- It **fails loudly** when a fetch fails, the dataset is retired or no longer daily, a required column is missing, a value is malformed, or the newest night is more than 5 days old. On failure nothing is committed, so the site keeps the last good snapshot and keeps showing its date.
- On failure it opens one issue labelled `data-refresh` (or comments on the open one) with the error and a link to the run. The next clean run closes it.
- If only the second source (Central Intake) fails, the occupancy data is still committed, the turn-away card keeps its previous date, and the job then fails and opens the issue.

**Scheduled workflows can switch themselves off.** GitHub's documentation: "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days." Whether the workflow's own data commits count as activity is **[unverified]**. If the schedule stops, re-enable it in **Actions → Refresh shelter data → Enable workflow** (or `gh workflow enable refresh-data.yml`), then use **Run workflow** once to catch up.

## Accuracy rules

1. Only the City's numbers, each with its date. No projections, no outside "homeless population" figures, no person-level data.
2. People served is the sum of `SERVICE_USER_COUNT`. Beds and rooms are separate blocks, each with occupied, actual capacity, unoccupied and its own rate; **beds and rooms are never added together**.
3. The headline excludes the `Temporary Programs` and `Temporary Refugee Response` program areas; one line under the headline gives each of them and the City-wide total including both, so every figure can be traced (headline + both = City-wide). `COVID-19 Response` (2021–2023), which the City relabelled as Temporary Programs on 2024-01-01, is counted with Temporary Programs, so the headline series has no break at the relabel.
4. "Last night (date)" is used only when the City's `OCCUPANCY_DATE` (the evening counted at 4:00 am the next morning) was yesterday in Toronto; otherwise the page says "Latest count — night of (date)".
5. The City's limitation is shown verbatim, and the Open Government Licence – Toronto is credited.
6. Turn-aways come only from an open machine-readable City feed (Central Intake Service Queue Data), described in the City's words and dated separately.
7. The map is not a bed-finder and says so, with Central Intake's contact details from toronto.ca. Programs without an address are listed, never guessed.
8. One image, the game's noir skyline, as atmosphere: never data, and no people.

## Embed card for Homeless in Toronto

`/embed/` is a small self-contained card (people served last night, bed and room rates, the date, a link to the dashboard). Paste into Homeless in Toronto (https://torontohomeless.com/) or anywhere else:

```html
<iframe src="https://data.tj-hosting.ca/embed/" title="Toronto shelter occupancy, last night" width="600" height="340" style="border:0;max-width:100%;aspect-ratio:600/340;height:auto" loading="lazy"></iframe>
```

It is designed for 16:9-ish frames from 320 × 180 to 600 × 340.

## After merge (TJ or Barney)

1. Enable GitHub Pages: **Settings → Pages → Deploy from a branch → `main`, `/ (root)`**.
2. Set the custom domain to `data.tj-hosting.ca` (the `CNAME` file already holds it).
3. Add a DNS record: `CNAME data → tj-hosting.github.io`.
4. Tick **Enforce HTTPS** once the certificate is issued.
5. **Settings → Actions → General → Workflow permissions:** "Read and write permissions" (the job commits data and opens issues).
6. Run **Actions → Refresh shelter data → Run workflow** once and check that it commits or reports "No new data".

Whether a push made by the workflow's own token triggers a Pages rebuild by itself is **[unverified]**; the workflow therefore also calls the Pages build API after committing (it needs the `pages: write` permission it declares).

## Repository layout

| Path | What |
|---|---|
| `index.html`, `css/`, `js/` | the dashboard (vanilla HTML/CSS/JS, ES modules) |
| `embed/` | the embed card |
| `data/` | the daily snapshot and geocode cache, written by the workflow |
| `scripts/fetch_data.py` | the data pipeline |
| `scripts/build_images.py`, `scripts/build_og.mjs` | image conversion and share image |
| `scripts/imagegen.py` | capped image generation (40 calls, US$10), ledgered |
| `vendor/` | uPlot 1.6.32, Leaflet 1.9.4 (Oswald 5.3.0 is kept but no longer used), pinned |
| `assets/pack/`, `assets/img/` | image masters and the converted images (only `sh-hero-noir*` and the share image are served; the rest wait on a delete ruling) |
| `tests/` | data test, map check, contrast check, screenshots, image checks, browser check, simplify measurements |
| `evidence/` | outputs and screenshots from the last test run |
| `dispatches/` | the build brief and the result report |
