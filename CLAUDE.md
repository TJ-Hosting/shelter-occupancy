# CLAUDE.md — shelter-occupancy

Toronto shelter occupancy, live at https://data.tj-hosting.ca: a static dashboard of the City of Toronto's nightly shelter count, the data companion to the board game Homeless in Toronto (https://torontohomeless.com/). CMHS team project; Barney or TJ merges.

## Stack
- Static site, no build step: `index.html`, `css/site.css`, `js/*.js` (ES modules), `embed/index.html`, `404.html`.
- Vendored, pinned: uPlot 1.6.32 (the one chart), Leaflet 1.9.4 (the map, OSM tiles). `vendor/oswald-5.3.0/` is kept but unused.
- Data: `scripts/fetch_data.py` (Python 3, standard library) reads the City's CKAN API and writes `data/latest.json`, `data/history.json`, `data/meta.json`, `data/geocodes.json`.
- Images: `scripts/build_images.py` (Pillow) and `scripts/build_og.mjs` (Playwright) build `assets/img/` from `assets/pack/`; every served file is in `assets/img/MANIFEST.json` with its ledger line.
- Docs: `docs/DATA.md` (every data rule), `docs/DESIGN.md` (tokens, palette validation, page order), `CREDITS.md`.

## Run and test
- Serve: `npm run serve` (or `python3 -m http.server 8765 --bind 127.0.0.1`), open http://127.0.0.1:8765/.
- `npm test` = `bash tests/run-all.sh`: data test (every figure on the page against raw CKAN; needs network), map check, contrast check, image caps, image widths, screenshots, simplify measurements. Writes `evidence/`.
- Headed browser check, not in `npm test`: `node tests/browser-check.mjs http://127.0.0.1:8765/ chrome evidence/<dir>` (and `msedge`). On Linux without a display: `xvfb-run -a`, and `BROWSER_PATH=<chrome binary>` if the channel isn't installed.
- Playwright 1.56.1 is the pinned dev dependency (`npm install`).

## Rules
- **Data is presentation-only for page work.** Don't change `scripts/fetch_data.py`, `.github/workflows/`, or anything under `data/` in a design or page task. If running the tests rewrites `data/`, discard it (`git checkout -- data/`) before committing.
- **The other writer:** `.github/workflows/refresh-data.yml` (cron 14:17 and 18:17 UTC) commits `data/*.json` to `main` twice a day. Pull before you branch; on a conflict in `data/`, take `main`'s.
- Every figure comes from the City's data with its date; no outside estimates. Beds and rooms are never added together. Temporary Programs (with COVID-19 Response, 2021–2023) and Temporary Refugee Response stay out of the headline; "at or near full" = City rate ≥ 95 %. Details: `docs/DATA.md`.
- Merging to `main` deploys (GitHub Pages). Open a PR; don't merge your own page work. Never force-push.
- Images are never upscaled, in the files or on the page (`tests/image-widths.py`, `tests/browser-check.mjs`). Don't delete unreferenced files in `assets/img/` without Barney's ruling (shelter-02 Q2, open).
- Don't edit the Homeless repo or torontohomeless.com from here; read only.

## Look: the game's noir tokens (dark only)
- Source: the live game's CSS (`https://torontohomeless.com/_app/base-*.css`) and `src/styles/tokens.css` in `TJ-Hosting/homeless` (read at `2414eae`, 8 Nov 2026).
- `--bg #0b0e13`, `--surface #121821`, `--surface-2 #182130`, `--hair #284058`, `--text #e6edf5`, `--text-2 #c9d6e6`, `--muted #9fb0c4`, `--key #7fb0e0`, `--key-text #9cc4f0`, `--focus #bfe0ff`.
- `--warn #e5343f` is the game's one warning red: it marks "at or near full" and nothing else, never text or a figure.
- Chart colours (stack: `#136b94`, `#33a3b4`, `#7577e3`) passed the dataviz validator on `#121821`; re-run it for any new pair that shares a chart (`docs/DESIGN.md` §3).
- Display type: `"Bahnschrift SemiBold Condensed", "Arial Narrow", "Segoe UI", system-ui, sans-serif`, 600, uppercase, `letter-spacing: .1em`. No light mode, no theme toggle.

## Page order (one screen first)
Help bar (Central Intake 416-338-4766 / 1-877-338-3398 / 311) → title and headline figures → one line for the rest → one trend chart → map and programs table → short About → footer. Keep the help bar and the headline figures on the first screen at 390 × 844 (`node tests/measure.mjs`).
