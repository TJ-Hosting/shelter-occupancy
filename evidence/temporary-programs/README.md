# Temporary Programs panel — shelter-02 P2 · 2026-10-18

Ruling (Aco, 17 Oct 2026): "Temporary Programs" leaves the headline and gets its own panel, built like the Temporary Refugee Response panel. The City-wide line still adds up everything.

- **Test first.** `tests/data-test.mjs` gained the Temporary Programs figures, a check that no headline program is in either temporary area, and two sums: headline + Temporary Programs + refugee = City-wide people, from the raw rows and from the page.
  - Before the change: **18/40** (`data-test-before-change.txt`). The headline showed 6,227 against 4,311 raw, the panel figures were missing, and the shown sum failed.
  - After: **40/40** (`after-change-data-test.txt`); map check 7/7 (`after-change-map-check.txt`).
- **Night 2026-10-16:** headline **4,311** + Temporary Programs **1,916** (20 programs: beds 50 of 50, rooms 1,407 of 1,409) + Temporary Refugee Response **732** = City-wide **6,959**.
- **Shots** (Chrome 155, `shots/`): headline and the Temporary Programs panel at 375 and 1440, light and dark; the two panels side by side at 1440; the three-band people chart with its tooltip; the embed at 320×180 and 600×340 (both fit). `shots.txt` has the figures read from each page. One transient `ERR_CONNECTION_REFUSED` at 1440-light (no failed figure); the P4 browser run re-checks the console.
- **Finding, verified against the City's datastore 2026-10-18:** Temporary Programs is a relabel. The 23 programs it held on 2024-01-01 had the same `PROGRAM_ID`s on 2023-12-31 as 22 "COVID-19 Response" programs (2,248 people) and 1 "Winter Programs" program (50 people). With only Temporary Programs out of the headline, the headline series drops by 2,248 people at 2024-01-01; yearly headline means are 6,214–7,333 for 2021–2023 against 4,817–5,153 for 2024–2026. The page captions the step. Whether COVID-19 Response history should also leave the headline is open (run log Q1).

## Follow-up, 18 Oct 2026: COVID-19 Response counts with Temporary Programs (Aco's answer to Q1)

- **Test first.** `tests/data-test.mjs` checks history.json's 2023-12-31 split against the raw 2023 file. Before the change: **41/43** (`data-test-q1-before-change.txt`). History showed 7,673 headline and 0 Temporary Programs; the raw rows give 5,425 headline and 2,248 COVID-19 Response.
- **Pipeline:** `scripts/fetch_data.py` puts `COVID-19 Response` in the temporary series (it only exists 2021–2023). After a re-fetch the headline is 5,425 on both 2023-12-31 and 2024-01-01, so there is no break at the relabel. Yearly headline means are now 3,240 (2021), 4,068, 4,877, 5,153, 5,096 and 4,817 (2026, to Oct 16). Last night's figures are unchanged.
- **Page:** the caption above the trend charts, the panel note, the legend ("COVID-19 Response before 2024"), the tooltip label before 2024, the table column, and the year-over-year note. README rule 3 and `docs/DATA.md` §3 and §6 are updated.