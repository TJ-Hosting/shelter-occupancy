# TASKS — shelter-01 (brief v2)

Executor: Claude Code on the web. Branch `feat/dashboard-mvp-2026-10-15`, cut from `main` at `a82fc688a922a75bacefe7a3806f23767c9fcde7` (brief v2 + image pack commit; the brief named `546f23af` as the pre-pack SHA).
Start: 2026-10-16 00:07 UTC. Budget 8 h · re-plan line 7.5 h (≈ 07:37 UTC).

| # | Step | Status | Start (UTC) | End (UTC) | Wall-clock |
|---|---|---|---|---|---|
| 0 | Phase 0: branch, tools, CKAN, schema → docs/DATA.md, keys, hosts | done | 00:07 | 00:20 | 13 min |
| 1 | P1 data pipeline + second source + failure issue | done | 00:20 | 00:34 | 14 min |
| 2 | P2 dashboard page | in progress | 00:34 | | |
| 3 | P3 map | todo | | | |
| 4 | P4 embed card | todo | | | |
| 5 | P5 context, link-back, images | todo | | | |
| 6 | P6 deploy config + README | todo | | | |
| 7 | Evidence: screenshots, data test, contrast check | todo | | | |
| 8 | Result file, PR | todo | | | |

## Phase 0 log

- Tools: Node 22.22.0, npm 10.9.4, Python 3.13.16, Playwright 1.56.1 with Chromium 1194 (headless), Pillow 12.3 (AVIF + WebP), ImageMagick, ffmpeg. `actionlint` not installed (see step 1).
- Keys: `OPENAI_API_KEY` not set, `GEMINI_API_KEY` not set → image requests go to `assets/REQUESTS.md`.
- CKAN `package_show` HTTP 200 (00:09 UTC): `refresh_rate` Daily, `last_refreshed` 2026-10-15 13:36:59, `is_retired` false, 24 resources. All six datastore resources answer `datastore_search`, 32 fields each.
- Hosts reachable: bane.one, open.toronto.ca, www.toronto.ca, nominatim.openstreetmap.org, tile.openstreetmap.org, cdn.jsdelivr.net, unpkg.com, ai.google.dev, basemaps.cartocdn.com. openai.com/api/pricing → 403.
- `OCCUPANCY_DATE` meaning (City field note): the evening of the overnight period, counted at 4:00 am next morning → "Last night (<date>)" is supportable; see docs/DATA.md §2.
- Second source: open CKAN datastore `central-intake-calls` → "Central Intake Service Queue Data" (`Unmatched callers`, monthly, latest 2026-08-31) → turn-away card allowed.
- Geocoding: City Address Points datastore answers exact `ADDRESS_FULL` filters; Nominatim reachable.
- Look: bane.one tokens sampled (dark game page + light about page) → docs/DESIGN.md in P2.
- Image price table (provider pages, 2026-10-16): OpenAI `gpt-image-2` high quality US$0.211/image at 1024², US$0.165 at 1536×1024 (developers.openai.com image-generation guide); Gemini `gemini-3.1-flash-image` US$0.067 (1K) / 0.101 (2K) / 0.151 (4K) per image (ai.google.dev/gemini-api/docs/pricing). Cap script charges the highest listed tier.
- Licence: CKAN says "License not specified"; portal licence page is OGL – Toronto v1.0 (open.toronto.ca/open-data-licence/).

## P1 log

- `scripts/fetch_data.py` ran in the sandbox against live CKAN (00:22 UTC): 6 resources, 287,829 rows, 2,113 consecutive nights (2021-01-01 → 2026-10-14). Night 2026-10-14: headline 6,238 people, refugee 733, City-wide 6,971.
- Geocoding: 95 addresses → 94 City Address Points, 1 Nominatim (Vaughan); 6 programs have no address and are listed as unplaced. First run 3 min 37 s, cached run 18 s.
- Failure path: a simulated missing column exits 1, writes the error file, leaves data/ byte-identical.
- Determinism: two runs on the same City data give identical latest/history/geocodes; only meta.json's timestamp changes.
- Workflow: actionlint 1.7.12 with shellcheck and pyflakes → 0 errors (installed via pip `actionlint-py`, `shellcheck-py`).
