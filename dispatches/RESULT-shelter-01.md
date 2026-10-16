# RESULT — shelter-01 (brief v2) · Claude Code on the web · 2026-10-16 00:07–01:00 UTC

## Outcome
Done, not merged. Branch `feat/dashboard-mvp-2026-10-15` from `main` at `a82fc688`. All six packages built and checked in headless Chromium against live City data (night of 2026-10-14: 6,238 people served in headline programs; beds 97.2%, rooms 99.2%; refugee response 733; City-wide 6,971). **"Last night" finding:** the City's field note says `OCCUPANCY_DATE` is "the evening of the overnight period", counted at 4:00 am next morning, so the page says "Last night (date)" when that evening was yesterday in Toronto, else "Latest count — night of (date)". **Second source:** open CKAN datastore "Central Intake Service Queue Data" (`central-intake-calls`, monthly), so an unmatched-callers card is in, in the City's words, with its own date (Aug 31, 2026). **Images:** generated 0 / 40, spend US$0.00 / US$10 (no API key set; 3 requests in `assets/REQUESTS.md`); 14 pack images shipped.

## PR
PR_LINK

## Evidence paths
`evidence/README.md` · `evidence/data-test.txt` (29/29) · `evidence/map-check.txt` (7/7) · `evidence/contrast-check.txt` (all pass) · `evidence/imagegen-caps.txt` (7/7) · `evidence/screenshots/` (16) · `docs/DATA.md` · `docs/DESIGN.md` · `TASKS.md`

## Not tested
The schedule firing and the `data-refresh` issue on GitHub; Pages build, DNS and HTTPS on data.tj-hosting.ca (post-merge); browsers other than Chromium; whether bot data commits count as activity for GitHub's 60-day rule [unverified].

## Deviations
OSM standard tiles, not CARTO (CARTO now wants a registered key). Labels say "unoccupied" (the City's term; may be held), not "available". The doorway and snowy-bench pack images are not shipped (text and a photo showing people; implied rough sleeping). The 1280 px heroes are stretched on wide screens (stated; a 2560 px regeneration is requested). Line charts with a non-zero axis say so. CKAN lists the licence as "not specified"; OGL – Toronto is credited from the portal's licence page. Test contexts pin locale `en-CA` because headless Chromium's `en-US@posix` breaks uPlot. The PR is a draft.

## Open questions
1. `PROGRAM_AREA` "Temporary Programs" (1,917 people last night) is undefined in the City's notes; it is in the headline. 2. "Near full" = ≥ 95% occupied is this build's definition; confirm. 3. Does a push by the workflow's token trigger a Pages build? (The workflow also calls the build API.)

## Estimate
Estimate: raw 10.25 h · p80 6.8 h (cal v2, 174) · actual 0.9 h (0.13×) · tokens actual not visible · model claude-opus-5-5 Extra High · questions 0, wait 0 · tests 4/4 suites (data 29/29, map 7/7, contrast pass, caps 7/7) · reopened 0 · variance: easier-than-thought

## Variance
Clean, well-documented source (no malformed values, rates reproduce exactly); geocoding hit the City's Address Points for 115 of 116 placed programs; no keys, so no image generation work.

## Follow-ups
Generate the 3 requested images; a CARTO key for a dark basemap; refetch only the current-year resource daily (~85 MB today); a CI job running `tests/run-all.sh` on PRs; consider the Central Intake wrap-up codes as a second, call-based measure.
