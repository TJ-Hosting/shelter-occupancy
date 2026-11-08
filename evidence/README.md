# Evidence — latest run: shelter-03 (noir restyle and one-screen simplify)

`tests/run-all.sh` on 2026-11-08 at 21:06 UTC against the site served locally, with the live City of Toronto CKAN API (details in `run-info.txt`; the P4 commit holds exactly the tree that was tested). Snapshot: the night of 2026-11-06. Run in a cloud Linux container (Claude Code on the web), Playwright 1.63.0 with Chromium 153.

| File | What it shows | Result |
|---|---|---|
| `data-test.txt` | Every figure the page still shows, recomputed from the raw CKAN resource (filtered `datastore_search`, independent of the pipeline): headline people, bed and room rates with occupied and capacity, programs, programs at or near full, Temporary Programs, refugee response, City-wide, the 2023-12-31 history night, the embed card, every date, unmatched callers | 28/28 pass |
| `map-check.txt` | Pins vs geocoded addresses, unplaced count and list, popup content, the not-a-bed-finder line, search and the beds / rooms / both control driving map and table, the skip link opening the table | 8/8 pass |
| `contrast-check.txt` | WCAG AA for every visible text element at 1440 and 375 px (dark only; text over the hero measured against rendered pixels; text disclosures and the programs table opened), the embed card, text tokens, chart marks and the warning red | all pass |
| `imagegen-caps.txt` | The 40-call and US$10 caps enforced in code, with no API call | 7/7 pass |
| `image-widths.txt` | Every file in `assets/img` no wider than its source; manifest images ledgered; every image the pages use is in the manifest | 101/101 pass |
| `screenshots.txt`, `screenshots/` | Dashboard at 1440 and 390 px (viewport `-top.png` and `-full.jpg`), the map, the trend chart, the embed card at 320×180 and 600×340 | 9 files, no console errors |
| `simplify/measure.txt` | Page height, visible controls, tab stops, and what fits the first screen at 390×844 and 1440×900 | help line and figures on the first screen at both; chart starts at 786 px on desktop |

The suite ran twice: the first run was green, then the headed browser check found the hero image drawn ×1.36 at 768 px; after the fix (the art box capped at 16:9) the whole suite was run again and is what is recorded here.

## `simplify/` (shelter-03)

- `baseline.txt`: the suite and the measurements on `main` before the work (image widths 110/111 on Linux: a Windows path separator in the manifest, fixed in `tests/image-widths.py`).
- `measure-p2.txt`: before and after. At 390 px the page went from 14,158 to 4,326 px tall; visible controls from 20 to 10.
- `browser-chrome.txt`, `shots/`: `tests/browser-check.mjs`, headed, in Chrome for Testing 153 under Xvfb (the only Chrome on the Linux runner): 375, 390, 768 and 1440 px, a light system preference (the page stays dark), reduced motion, the keyboard path through the skip link into the table, the map, no image upscaled at 375–1920 px, the embed card and the 404 page. 44/44 pass. Microsoft Edge was not available on the runner, so it is untested here.
- `embed-*.png`, `404-*.jpg`: the restyled embed card and 404 page.

## Older runs

`laptop-check/` (shelter-02, 18 Oct 2026: headed Chrome and Edge on Windows), `temporary-programs/` and `images/` (shelter-02) are kept as they were; they show the earlier design.

Not tested here: the schedule firing on GitHub, GitHub Pages, DNS and HTTPS on data.tj-hosting.ca, Firefox, Safari, Edge, real phones.
