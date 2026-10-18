# TASKS — shelter-01 (brief v2)

Executor: Claude Code on the web. Branch `feat/dashboard-mvp-2026-10-15`, cut from `main` at `a82fc688a922a75bacefe7a3806f23767c9fcde7` (brief v2 + image pack commit; the brief named `546f23af` as the pre-pack SHA).
Start: 2026-10-16 00:07 UTC. Times are the sandbox clock (`date -u`) and commit timestamps. Budget 8 h · re-plan line 7.5 h (≈ 07:37 UTC).

| # | Step | Status | Start (UTC) | End (UTC) | Wall-clock |
|---|---|---|---|---|---|
| 0 | Phase 0: branch, tools, CKAN, schema → docs/DATA.md, keys, hosts | done | 00:07 | 00:14 | 7 min |
| 1 | P1 data pipeline + second source + failure issue | done | 00:14 | 00:25 | 11 min |
| 2 | P2 dashboard page (map code included, see P3) | done | 00:25 | 00:39 | 14 min |
| 3 | P3 map | done | 00:39 | 00:41 | 2 min |
| 4 | P4 embed card | done | 00:41 | 00:43 | 2 min |
| 5 | P5 context, link-back, images | done | 00:43 | 00:45 | 2 min |
| 6 | P6 deploy config + README | done | 00:45 | 00:47 | 2 min |
| 7 | Evidence: screenshots, data test, contrast check | done | 00:47 | 00:57 | 10 min |
| 8 | Result file, PR | done | 00:57 | 00:58 | 1 min |

## Phase 0 log

- Tools: Node 22.22.0, npm 10.9.4, Python 3.13.16, Playwright 1.56.1 with Chromium 1194 (headless), Pillow 12.3 (AVIF + WebP), ImageMagick, ffmpeg. `actionlint` not installed (see step 1).
- Keys: `OPENAI_API_KEY` not set, `GEMINI_API_KEY` not set → image requests go to `assets/REQUESTS.md`.
- CKAN `package_show` HTTP 200 (00:08 UTC): `refresh_rate` Daily, `last_refreshed` 2026-10-15 13:36:59, `is_retired` false, 24 resources. All six datastore resources answer `datastore_search`, 32 fields each.
- Hosts reachable: bane.one, open.toronto.ca, www.toronto.ca, nominatim.openstreetmap.org, tile.openstreetmap.org, cdn.jsdelivr.net, unpkg.com, ai.google.dev, basemaps.cartocdn.com. openai.com/api/pricing → 403.
- `OCCUPANCY_DATE` meaning (City field note): the evening of the overnight period, counted at 4:00 am next morning → "Last night (<date>)" is supportable; see docs/DATA.md §2.
- Second source: open CKAN datastore `central-intake-calls` → "Central Intake Service Queue Data" (`Unmatched callers`, monthly, latest 2026-08-31) → turn-away card allowed.
- Geocoding: City Address Points datastore answers exact `ADDRESS_FULL` filters; Nominatim reachable.
- Look: bane.one tokens sampled (dark game page + light about page) → docs/DESIGN.md in P2.
- Image price table (provider pages, 2026-10-16): OpenAI `gpt-image-2` high quality US$0.211/image at 1024², US$0.165 at 1536×1024 (developers.openai.com image-generation guide); Gemini `gemini-3.1-flash-image` US$0.067 (1K) / 0.101 (2K) / 0.151 (4K) per image (ai.google.dev/gemini-api/docs/pricing). Cap script charges the highest listed tier.
- Licence: CKAN says "License not specified"; portal licence page is OGL – Toronto v1.0 (open.toronto.ca/open-data-licence/).

## P1 log

- `scripts/fetch_data.py` ran in the sandbox against live CKAN (00:18–00:22 UTC): 6 resources, 287,829 rows, 2,113 consecutive nights (2021-01-01 → 2026-10-14). Night 2026-10-14: headline 6,238 people, refugee 733, City-wide 6,971.
- Geocoding: 95 addresses → 94 City Address Points, 1 Nominatim (Vaughan); 6 programs have no address and are listed as unplaced. First run 3 min 37 s, cached run 18 s.
- Failure path: a simulated missing column exits 1, writes the error file, leaves data/ byte-identical.
- Determinism: two runs on the same City data give identical latest/history/geocodes; only meta.json's timestamp changes.
- Workflow: actionlint 1.7.12 with shellcheck and pyflakes → 0 errors (installed via pip `actionlint-py`, `shellcheck-py`).

## P2 log

- Page: hero (people served), beds and rooms blocks (never added), near-full count, City-wide line, refugee panel, unmatched-callers card, people (stacked) and rate charts with a range control, year-over-year overlay, sector rows, programs table, context section, footer.
- Palette: four entity colours validated per chart pair in both modes, ordinal year ramp validated (docs/DESIGN.md §3).
- Checked in headless Chromium at 1440 dark and 375 light: no console errors; fixed month-label collision, nested-span sizing, spot-image stretch, refugee-panel dead space, table length (now scrolls in a frame).
- Headless Chromium reports locale `en-US@posix`, which makes uPlot's init throw; test contexts set `locale: 'en-CA'`. Real browsers send valid tags [unverified for every browser].

## P3 log

- `tests/map-check.mjs` in headless Chromium: 95 pins = 95 distinct coordinates for 116 geocoded programs; 6 unplaced shown and listed; popup carries name, sector, capacity type and occupancy; sector and capacity-type filters update map and table. 7/7 (dev run; the evidence run is at the end).
- Fixed: markers had no DOM element on first draw because the map had no view yet; the view is now set before markers are added (also avoids fetching tiles for a throwaway view, per the OSM tile policy).

## P4 log

- `/embed/`: self-contained dark card (people served, bed and room rates, night, source with date, link to the dashboard). Checked in headless Chromium at 320×180 and 600×340: content box equals the viewport (no overflow) at both sizes. Fixed a 4 px overflow from the inline image baseline.

## P5 log

- Context section with the City's limitation verbatim, OGL – Toronto credit and the Homeless in Toronto link (built in P2).
- Images: 14 of 25 pack images shipped, each traced in `assets/img/MANIFEST.json` to its ledger line; doorway (text + a framed photo that appears to show people) and snowy bench (implies rough sleeping) not shipped.
- `scripts/imagegen.py`: 40-call and US$10 caps in code, ledger line per call in a `finally`, keys from env only, guard clause (no people, no text) on every prompt, moderation block ends an image, unpriced OpenAI sizes refused. `tests/imagegen-caps.py` 7/7 without any API call.
- No key → 3 requests in `assets/REQUESTS.md` (2560 px heroes, clean doorway). Generated 0/40, spend US$0.00/10.
- Share image 1200×630 rendered from `sh-og-share` (downscaled, not upscaled) with no figures, so it never goes stale.
- `CREDITS.md`: data, tiles, libraries with SHA-384, font, pack, generated images, tools.

## P6 log

- `CNAME` (data.tj-hosting.ca), `.nojekyll`, self-contained `404.html` (absolute paths, rendered locally without errors).
- README: local run, daily refresh and the `data-refresh` issue, the 60-day scheduled-workflow rule (quoted from GitHub's docs; whether bot commits count is [unverified]) and how to re-enable, accuracy rules, iframe snippet, post-merge steps.
- Site runs locally from `python3 -m http.server`.

## Evidence log

- Dev runs while building the checks: the contrast check failed the light hero, block art, year-over-year band, footer fade and embed labels; fixed in CSS (not by loosening the check). The data test passed 29/29 on its first run.
- Final run, once: `tests/run-all.sh` at 00:54:45 UTC → data 29/29, map 7/7, contrast all pass, image caps 7/7, 16 screenshots. Screenshots re-captured at 00:56 after unsticking the header in element captures.
- Snapshot refreshed from live CKAN at 00:54 before the run (same night, 2026-10-14).

## Close

- PR: https://github.com/TJ-Hosting/shelter-occupancy/pull/1 (draft). End 00:58 UTC; total ≈ 0.9 h of the 8 h budget.

# TASKS — shelter-02 (laptop check, Temporary Programs panel, images)

Executor: Claude Code (Opus 5.5, Extra High) on BANE-VICTUS-TOP, fresh clone `C:\localhost\shelter-check`, on top of `6c5012c`. Brief: `C:\localhost\projects\shelter-occupancy\dispatches\BRIEF-v1-shelter-02-laptop-check-2026-10-17.md`. Start 2026-10-18 00:16 UTC (system clock). Budget 2h06m · re-plan line 1h39m (≈ 01:55 UTC).

| # | Step | Status | Start (UTC) | End (UTC) |
|---|---|---|---|---|
| 0 | Clone, npm ci, Playwright Chromium 1194, venv with Pillow, image-gen check, baseline | done | 00:16 | 00:21 |
| 1 | P1 laptop check (evidence/laptop-check/CHECK.md) | done | 00:16 | 00:50 |
| 2 | P2 Temporary Programs panel | pending | | |
| 3 | P3 images | pending | | |
| 4 | P4 gates, PR, records | pending | | |
