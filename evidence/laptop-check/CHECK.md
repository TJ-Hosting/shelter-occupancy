# Laptop check — shelter-02 P1 · BANE-VICTUS-TOP · 2026-10-18 00:20–00:48 UTC

Executor: Claude Code (Opus 5.5, Extra High), fresh clone `C:\localhost\shelter-check`, branch `feat/dashboard-mvp-2026-10-15` from `6c5012c`. Node 24.21.0, Python 3.13.13 (venv outside the repo, Pillow 13.0.0 with AVIF), Playwright 1.56.1 with its Chromium 141 headless shell (downloaded into the user cache), Chrome 155.0.8059.82 and Edge 155.0.4283.45 (installed, headed). Static server: `python -m http.server` on 127.0.0.1.

## 1. `npm test` (tests/run-all.sh) on the committed snapshot (night 2026-10-14), next to the cloud's

| Suite | Cloud (shelter-01, headless Chromium, 16 Oct) | Laptop (18 Oct 00:20 UTC) | Note |
|---|---|---|---|
| Data test | 29/29 | **fail: no result** | The City's CKAN answered `502 Bad Gateway` (HTML) mid-run; `baseline/data-test-1-city-502.txt` |
| Map check | 7/7 | 7/7 | `baseline/map-check.txt` |
| Contrast check | all pass | all pass | `baseline/contrast-check.txt` |
| Image caps | 7/7 | 7/7 | `baseline/imagegen-caps.txt` |
| Screenshots | 16 | 16 | headless; overwritten by the P4 run |

The data test was then run alone:

- Run 2 failed the same way. A probe showed why: filtered `datastore_search` calls on the five older yearly resources took 90 s and ended in `504`, while the current-year resource answered in 0.1 s. The test filtered every resource even after it had found the night's rows. **Fixed (small defect):** it stops filtering once the night is found, treats a non-2xx answer as a retryable error, and backs off 5 s and 10 s (`tests/data-test.mjs`).
- Run 3, after the fix: **27/29** (`baseline/data-test-3-after-fix.txt`). The two failures are the unmatched-callers card: since the snapshot, the City has published September (operational date 2026-09-30: 109), and the snapshot still showed 2026-08-31 (73). It was stale, not wrong; the refresh below clears it.

## 2. `scripts/fetch_data.py` against today's City data (00:33–00:36 UTC)

- Guards: `is_retired` false, `refresh_rate` Daily, all 6 datastore resources have the 29 required columns, dump row counts equal the API totals (288,073 rows; 2,115 nights 2021-01-01 → **2026-10-16**). The newest night is 1 day old (limit 5). Central Intake fetched OK. **0 warnings**, exit 0. Geocoding needed no new lookups (122 programs, cache of 95 addresses; 116 placed, 6 unplaced).
- Night 2026-10-16: headline 6,227 people · refugee response 732 · City-wide 6,959. Package `last_refreshed` 2026-10-17 13:36:57.
- **"Last night" rule:** run at 2026-10-17 ~20:37 in Toronto, so the newest night (Oct 16) was yesterday. The page says "Last night (Friday, October 16, 2026)" and the embed says "Last night (Oct 16)". Correct per README rule 4.
- On the refreshed snapshot: data test **29/29**, map check **7/7** (`refresh-2026-10-16/`). The refresh is committed with P1, as the workflow would.

## 3. Real browsers, headed: Chrome 155 and Edge 155 (`tests/browser-check.mjs`)

Final run: **Chrome 42/42 · Edge 42/42** (`browser-chrome.txt`, `browser-msedge.txt`). The first run was 38/41 in each (`browser-*-run1-before-fixes.txt`).

| Item | Chrome | Edge | Shots (`shots/`) |
|---|---|---|---|
| 375 px, light and dark: no horizontal scroll, figures filled | pass | pass | `<browser>-375-{light,dark}-{top,full}.jpg` |
| 768 px, light and dark | pass | pass | `<browser>-768-…` |
| 1440 px, light and dark | pass | pass | `<browser>-1440-…` |
| Reduced motion: hero drift, reveals, meter fills finish at once (1e-06 s) | pass | pass | `<browser>-1440-dark-reduced-motion.jpg` |
| Keyboard through the programs table: skip link → sort buttons, focus ring (1.6 px amber), Enter sorts and toggles | pass, **after fix 1** | pass, after fix 1 | `<browser>-1440-dark-skip-map-focus.jpg`, `…-table-keyboard.jpg` |
| Map: 95 pins, a popup with name, sector, type, area and occupancy | pass | pass | `<browser>-map-1440-{light,dark}.jpg` |
| Embed card 320×180 and 600×340: fits, filled, dated | pass, **after fix 2** | pass, after fix 2 | `<browser>-embed-*.jpg` |
| `404.html`: background and helpline render (loaded directly; the local server has no 404 fallback) | pass | pass | `<browser>-404-375.jpg` |
| Console: no errors, warnings, failed requests or HTTP ≥ 400, on every page above | pass | pass | — |

Fixes made in this run:

1. **Keyboard users had to Tab through every map pin** to reach the programs table. Run 1's Tab path from the capacity filter: the map, then 39 pins in a row before the check gave up (`browser-chrome-run1-before-fixes.txt`). The map has 95 pins. Added a skip link at the top of the map, shown on focus: "Skip the map: every program is in the table below" (`index.html`, `css/site.css`). Pins stay focusable for anyone who wants them.
2. **The embed card logged a 404** for `/favicon.ico` when opened on its own (it had no icon link; on Pages that request would get the 404 page). Added `<link rel="icon" href="../favicon.svg">` (`embed/index.html`).

Not a defect: the first skip-link screenshot was taken mid-scroll (the page scrolls smoothly). The check now waits 1.2 s before that shot. The final run's detail line for the skip link also printed "0 pins that are tab stops". That figure is wrong (the pins take focus without a `tabindex` attribute), so the measurement was removed after the run.

## Not checked here

Firefox and Safari (not installed), real phones, high-contrast and forced-colours modes, the scheduled workflow and the `data-refresh` issue on GitHub, and Pages, DNS and HTTPS on data.tj-hosting.ca.

## 4. Final run (P4, 18 Oct 01:22–01:30 UTC, on the finished branch)

- **`npm test`, once:** data test **40/40** (now including the Temporary Programs checks), map **7/7**, contrast **all pass** (dashboard: 146 text elements over images, 0 below AA, worst 4.79:1), image caps **7/7**, image widths **111/111**, screenshots **16**. Exit 0. Outputs: `evidence/*.txt`, `evidence/screenshots/`.
- **Headed Chrome 155 and Edge 155:** first pass **48/50** in each (`final-browser-*-run1-panel-wash.txt`). At 375 px the two panel washes were drawn slightly wider than their pixels (×1.13 and ×1.045): the panels are taller than 720 px there. Fixed by capping the wash box at the source's 720 px height (`css/site.css`). After the fix, the contrast check was re-run (**all pass**) and the browser check re-run: **Chrome 50/50, Edge 50/50** (`final-browser-chrome.txt`, `final-browser-msedge.txt`; shots in `shots/`, overwritten by this run).
## 5. After Q1 (18 Oct 01:42–01:46 UTC): COVID-19 Response counts with Temporary Programs

`npm test` once more: data **43/43** (3 new history checks for 2023-12-31 against the raw 2023 file), map **7/7**, contrast **all pass**, image caps **7/7**, image widths **111/111**, screenshots **16**. Headed browser check: **Chrome 50/50, Edge 50/50** (`final-browser-*.txt` and `shots/`, overwritten). Details: `evidence/temporary-programs/README.md`.