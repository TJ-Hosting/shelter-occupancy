# Evidence — shelter-01 (brief v2 §6)

One run of `tests/run-all.sh` on 2026-10-16 at 00:54 UTC against the built site served locally, with the live City of Toronto CKAN API (details in `run-info.txt`). Snapshot: the night of 2026-10-14.

| File | What it shows | Result |
|---|---|---|
| `data-test.txt` | Last night's figures recomputed from the raw CKAN resource (filtered `datastore_search`, independent of the pipeline) against what the page and embed card show: headline, refugee panel, City-wide, dates, unmatched callers | 29/29 pass |
| `map-check.txt` | Pins vs geocoded addresses, unplaced count and list, popup content, the not-a-bed-finder note, filters driving map and table | 7/7 pass |
| `contrast-check.txt` | WCAG AA for every visible text element in light and dark at 1440 and 375 px (text over images measured against rendered pixels), the embed card, text tokens, chart marks | all pass |
| `imagegen-caps.txt` | The 40-call and US$10 caps enforced in code, with no API call | 7/7 pass |
| `screenshots.txt`, `screenshots/` | Dashboard at 1440 and 375 px, light and dark (viewport `-top.png` and `-full.jpg`), the map, the trend charts, the embed card at 320×180 and 600×340 | 16 files, no console errors |

The screenshot step was re-captured once at 00:56 UTC after hiding the sticky header in element captures (it floated over the chart); the tests were not re-run.

Not tested here: the schedule firing on GitHub, the failure issue being opened on GitHub, GitHub Pages, DNS and HTTPS on data.tj-hosting.ca (all only after merge).
