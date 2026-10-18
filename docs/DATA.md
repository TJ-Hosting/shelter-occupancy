# DATA — sources, schema and every transformation

Every figure on the dashboard comes from City of Toronto Open Data. This file records what the City publishes, exactly what the pipeline does to it, and which rules decide what goes where. Checked live from the sandbox on 2026-10-16 (00:08–00:15 UTC) unless a line says otherwise.

## 1. Primary source

**Daily Shelter & Overnight Service Occupancy & Capacity** — package `daily-shelter-overnight-service-occupancy-capacity` (CKAN id `21c83b32-d5a8-4106-a54f-010dbe49f6f2`), owner Toronto Shelter & Support Services (TSSS).

- API base: `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/`
- `package_show` (2026-10-16 00:09 UTC): `refresh_rate` **Daily**, `last_refreshed` **2026-10-15 13:36:59**, `is_retired` **false**, `num_resources` 24, `date_published` 2021-06-28.
- Licence: CKAN reports `license_id` `notspecified`. The City's portal publishes its data under the **Open Government Licence – Toronto** v1.0 (https://open.toronto.ca/open-data-licence/, checked 2026-10-16). Its default attribution statement, used on every page: "Contains information licensed under the Open Government Licence – Toronto."
- Limitations, verbatim from the package (`limitations`):
  > This is unaudited data compiled directly from an administrative database. Data reflect only the state of each program's records in the database and may not always accurately reflect the actual current situation in each program.

### 1.1 Resources used (datastore, queried through the CKAN API)

| Year | Resource id | Rows (2026-10-16) | Dates | `OCCUPANCY_DATE` type and format |
|---|---|---|---|---|
| 2026 (current) | `42714176-4f05-44e6-b157-2b57f29b856a` | 38,725 | 2026-01-01 → 2026-10-14 (287 days) | `date`, `YYYY-MM-DD` |
| 2025 | `5dc4fbfc-0951-45e8-ae30-962af9dcaf7c` | 51,543 | 2025-01-01 → 2025-12-31 | `date`, `YYYY-MM-DD` |
| 2024 | `fc409fd7-0348-49d7-bba9-70ac1a8c727c` | 48,794 | 2024-01-01 → 2024-12-31 | `date`, `YYYY-MM-DD` |
| 2023 | `62786156-b463-4c04-b286-c23f32c726ab` | 48,345 | 2023-01-01 → 2023-12-31 | **`text`**, `YYYY-MM-DDT00:00:00` |
| 2022 | `1cc46acb-c6d3-4537-93ef-3ebad039275c` | 49,478 | 2022-01-01 → 2022-12-31 | **`text`**, `YY-MM-DD` |
| 2021 | `da8854b8-e570-4de2-b051-a906b62fe7f8` | 50,944 | 2021-01-01 → 2021-12-31 | **`text`**, `YY-MM-DD` |

The pipeline pulls each resource as CSV from `…/datastore/dump/<id>` (the same rows the API serves; one request per year instead of hundreds of paged `datastore_search` calls) and reads field types from `datastore_search?limit=0`.

### 1.2 Schema (32 fields, identical names in all six resources)

Field definitions are the City's own "data features" (`datastore_search` → `fields[].info.notes`), quoted or closely paraphrased.

| Field | Type | City definition (short) | Used for |
|---|---|---|---|
| `_id` | int | row id | — |
| `OCCUPANCY_DATE` | date / text (see 1.1) | "This date refers to the evening of the overnight period being reported. The occupancy data is retrieved at 4:00 am the following morning, so an OCCUPANCY_DATE of January 1, 2021 would refer to data collected at 4:00 am on January 2, 2021." | the night shown |
| `ORGANIZATION_ID` | text | stable id of the operator | — |
| `ORGANIZATION_NAME` | text | operator name | table, map popup |
| `SHELTER_ID` | text | stable id of the shelter group | — |
| `SHELTER_GROUP` | text | shelter group (lead shelter + satellites + hotels) | table |
| `LOCATION_ID` | text | stable id of the location | geocode key |
| `LOCATION_NAME` | text | location name | table, map |
| `LOCATION_ADDRESS` | text | street address | geocoding |
| `LOCATION_POSTAL_CODE` | text | postal code | geocoding (Nominatim fallback) |
| `LOCATION_CITY` | text | city | geocoding |
| `LOCATION_PROVINCE` | text | province | geocoding |
| `PROGRAM_ID` | text | stable id of the program | table key |
| `PROGRAM_NAME` | text | program name | table, map |
| `SECTOR` | text | Families, Men, Mixed Adult, Women, Youth | sector chart, filters |
| `PROGRAM_MODEL` | text | Emergency or Transitional | table |
| `OVERNIGHT_SERVICE_TYPE` | text | Shelter, 24-Hour Respite Site, Motel/Hotel Shelter, … | table |
| `PROGRAM_AREA` | text | base system or a temporary response program | headline / refugee split (§3) |
| `SERVICE_USER_COUNT` | text (integer) | "Count of the number of service users staying in an overnight program as of the occupancy time and date. Programs with no service user occupancy will not be included in reporting for that day." | **people served** |
| `CAPACITY_TYPE` | text | `Bed Based Capacity` or `Room Based Capacity` | beds vs rooms blocks |
| `CAPACITY_ACTUAL_BED` | text (integer) | "beds showing as available for occupancy in SMIS" | bed capacity |
| `CAPACITY_FUNDING_BED` | text (integer) | "beds that a program has been approved to provide" | funded beds (secondary line) |
| `OCCUPIED_BEDS` | text (integer) | beds showing as occupied | occupied beds |
| `UNOCCUPIED_BEDS` | text (integer) | `CAPACITY_ACTUAL_BED − OCCUPIED_BEDS`; "Beds may be held for a service user or may be vacant." | unoccupied beds |
| `UNAVAILABLE_BEDS` | text (integer) | `CAPACITY_FUNDING_BED − CAPACITY_ACTUAL_BED` (out of service) | out-of-service beds |
| `CAPACITY_ACTUAL_ROOM` | text (integer) | rooms showing as available for occupancy | room capacity |
| `CAPACITY_FUNDING_ROOM` | text (integer) | rooms the program is approved to provide | funded rooms |
| `OCCUPIED_ROOMS` | text (integer) | rooms showing as occupied | occupied rooms |
| `UNOCCUPIED_ROOMS` | text (integer) | `CAPACITY_ACTUAL_ROOM − OCCUPIED_ROOMS`; "Rooms may be held for service users or may be vacant." | unoccupied rooms |
| `UNAVAILABLE_ROOMS` | text (integer) | `CAPACITY_FUNDING_ROOM − CAPACITY_ACTUAL_ROOM` | out-of-service rooms |
| `OCCUPANCY_RATE_BEDS` | text (decimal, %) | `OCCUPIED_BEDS ÷ CAPACITY_ACTUAL_BED` | per-program bed rate |
| `OCCUPANCY_RATE_ROOMS` | text (decimal, %) | `OCCUPIED_ROOMS ÷ CAPACITY_ACTUAL_ROOM` | per-program room rate |

### 1.3 Profile of the raw data (all six resources, 2026-10-16)

- 287,829 rows. Every numeric field parses as a number; no stray text values.
- Bed fields are filled **only** on `Bed Based Capacity` rows and room fields **only** on `Room Based Capacity` rows, in every year (2026 uses `null`, 2022 uses empty strings). So beds and rooms never overlap and are never added.
- The City's own rate fields reproduce exactly from `OCCUPIED_* ÷ CAPACITY_ACTUAL_*` (0 mismatches at 2-decimal rounding). No row has zero actual capacity.
- No duplicate (`OCCUPANCY_DATE`, `PROGRAM_ID`) pairs.
- 1,334–2,346 rows a year have an empty `LOCATION_ADDRESS` (mostly sites the City does not publish an address for); these programs are listed on the map as unplaced, never guessed.
- `LOCATION_CITY` has a trailing-space variant (`"North York "`) in 2021; the pipeline trims all text fields.

## 2. "Last night" — what the date means

The City's definition of `OCCUPANCY_DATE` (quoted in 1.2) says the date is **the evening of the overnight period**, counted at **4:00 am the next morning**. The dataset refreshes daily (≈ 13:37 UTC on 2026-10-15, which published the night of 2026-10-14).

So the page says **"Last night (<weekday, date>)"** when the newest `OCCUPANCY_DATE` is yesterday in Toronto time, and **"Latest count — night of <date>"** otherwise (for example, between midnight and the City's mid-morning refresh, or when the City skips a day). The rule runs in the browser against the viewer's clock in `America/Toronto`.

## 3. Program areas — what goes where

Every `PROGRAM_AREA` value found in 2021–2026, with row counts across all six years:

| `PROGRAM_AREA` | Rows | Years seen | City definition | Goes to |
|---|---|---|---|---|
| Base Shelter and Overnight Services System | 189,546 | 2021–2026 | "Programs that are intended to be regular, year-round programs." | **Headline** |
| Base Program - Refugee | 10,180 | 2023–2026 | "year-round programs that serve refugee and asylum claimant families and individuals" | **Headline** (it is part of the base, year-round system) |
| Temporary Programs | 21,639 | 2024–2026 | *not defined in the field notes* | **Temporary Programs panel** (own panel, never in the headline; since shelter-02) |
| Winter Programs | 9,535 | 2021–2026 | field notes define "Winter Response": "exclusively dedicated to the provision of additional spaces under winter services plans" | **Headline** |
| COVID-19 Response | 38,294 | 2021–2023 | "create spaces … to support improved physical distancing during the COVID-19 pandemic" | **Temporary Programs series** (history only; relabelled Temporary Programs on 2024-01-01) |
| *(blank)* | 2 | 2021 (Dec 30–31, one program) | — | **Headline** |
| Temporary Refugee Response | 18,633 | 2021–2026 | "Programs that are intended to create spaces in the overnight services system in order to support refugee and asylum claimant families and individuals." | **Refugee-response panel** (own panel, never in the headline) |

- **Headline** = every row whose `PROGRAM_AREA` is none of `Temporary Programs`, `COVID-19 Response` and `Temporary Refugee Response`.
- **Temporary Programs panel** = rows whose `PROGRAM_AREA` is `Temporary Programs` or, before 2024, `COVID-19 Response`.
- **Refugee-response panel** = rows whose `PROGRAM_AREA` is `Temporary Refugee Response`.
- **City-wide line** = all rows; shown once, small, so every headline figure can be traced (headline + Temporary Programs panel + refugee panel = City-wide, for people; beds and rooms separately).

**Why Temporary Programs has its own panel** (Aco's ruling, 17 Oct 2026, shelter-02): the City's field notes don't define it, so it shouldn't drive the headline. On 2026-10-16 it held 1,916 people in 20 programs.

**It is a relabel, checked 2026-10-18** against the City's datastore (`datastore_search` filtered by night): the 23 programs reported as "Temporary Programs" on 2024-01-01 (2,296 people) are the same `PROGRAM_ID`s that were reported on 2023-12-31 as "COVID-19 Response" (22 programs, 2,248 people) and "Winter Programs" (1 program, 50 people). "COVID-19 Response" has no rows after 2023.

**So COVID-19 Response counts with Temporary Programs** (Aco's answer to shelter-02 Q1, 18 Oct 2026). With only Temporary Programs out of the headline, the headline series dropped by 2,248 people at 2024-01-01 because of the relabel, not because of a change in the shelter system. Now the 2021–2023 COVID-19 Response rows go to the Temporary Programs series, and the headline is 5,425 on both 2023-12-31 and 2024-01-01. The one winter program that moved that night (50 people) leaves the headline on 2024-01-01; the data test checks the 2023-12-31 split against the raw 2023 file. The page explains the relabel above the trend charts and in the panel.

## 4. Second source — turn-aways

The toronto.ca page "Shelter System Requests for Referrals" states that its daily values "are available on Open Data". They are, as an open CKAN datastore:

- Package `central-intake-calls` ("Central Intake calls"), owner TSSS, `refresh_rate` **Monthly**, `last_refreshed` 2026-09-18 18:27:32, `is_retired` false.
- Resource **Central Intake Service Queue Data** `61191143-8143-4425-bf89-2c1523961227` (2,132 rows, 2020-11-01 → 2026-08-31): fields `Date` (date), `Unmatched callers`, `Single call`, `Repeat caller` (int4).
  - `Date`: "Operational date for the data, uses the date before midnight to refer to the evening of service."
  - `Unmatched callers`: "Total individuals who were not able to be offered a space over the past 24 hours, at time of closeout at 4am."
- Resource **Central Intake Call Wrap-Up Codes Data** `9da03ed6-cd19-4df7-9b0a-03f81bf4995c` (call counts by code). Not used: the City says the two data sets "cannot be combined", and calls are not people.

The turn-away card shows `Unmatched callers` for the latest operational date with **its own date** (it lags the occupancy data by about six weeks), plus the City's caveat from the referrals page: the unmatched count "only includes callers who are seeking space for a single or couple. People seeking space in family sector programs are supported through a different process".

## 5. Geocoding

1. **City Address Points** first: package `address-points-municipal-toronto-one-address-repository`, datastore resource `0b3756af-9caf-4f0f-ac28-9c6617adede4` (525,370 points, refreshed daily), exact match on `ADDRESS_FULL` after normalising the shelter address (trim, drop a trailing period, collapse spaces). Verified: `640 Dixon Rd.` → `640 Dixon Rd` → (−79.5765, 43.6921).
2. **Nominatim** fallback (addresses outside Toronto, or no exact match): `nominatim.openstreetmap.org/search`, structured query with street, city, postal code, country `ca`; at most 1 request per second, with a real User-Agent, per the OSM Nominatim usage policy.
3. Coordinates are cached in `data/geocodes.json` (key = normalised address + city), so the daily job only geocodes new addresses.
4. Programs with no address, or no confident match, are listed as unplaced on the map; nothing is guessed.

## 6. Transformations (`scripts/fetch_data.py`)

The pipeline is standard-library Python. In order:

1. **Package checks.** `package_show`: fail if `is_retired` is true or `refresh_rate` is not `Daily`. Every resource with an active datastore is used (so the January roll-over, when the City adds a new yearly file, needs no code change).
2. **Schema checks.** For each resource, `datastore_search?limit=0` must list all 29 required columns (every field in 1.2 except `_id`, `ORGANIZATION_ID`, `SHELTER_ID`); otherwise the run fails. The dump's row count must equal the API's `total`. A SHA-256 of each resource's `(field, type)` list goes into `meta.json`.
3. **Parsing.** Text fields are trimmed and inner whitespace collapsed. `OCCUPANCY_DATE` is normalised to `YYYY-MM-DD` from the three formats in 1.1 (`YY-MM-DD` is read as 20YY: the 2021 file's 365 values run `21-01-01` → `21-12-31`). Numbers must parse as integers (rates as decimals); any other value fails the run. `CAPACITY_TYPE` must be one of the two known values.
4. **Bed or room.** Each row is a bed program or a room program, from `CAPACITY_TYPE`. Only that type's fields are read. **Beds and rooms are never added together** anywhere in the pipeline or the page.
5. **De-duplication.** Rows are keyed by (`OCCUPANCY_DATE`, `PROGRAM_ID`); if two resources ever overlap, the newer resource's row wins. (No duplicates exist today.)
6. **Panels.** `PROGRAM_AREA` = `Temporary Refugee Response` → refugee panel; `Temporary Programs` or `COVID-19 Response` → Temporary Programs panel; anything else → headline (§3). An unknown new area value goes to the headline and raises a warning, which fails the workflow and opens the `data-refresh` issue so a person checks the split.
7. **Sums.** Per night and per panel: `people` = Σ `SERVICE_USER_COUNT`; for beds and for rooms separately: Σ occupied, Σ actual capacity, Σ funded capacity, Σ unoccupied, Σ unavailable, number of programs.
8. **Rates.** A panel's bed rate = Σ `OCCUPIED_BEDS` ÷ Σ `CAPACITY_ACTUAL_BED` × 100; room rate likewise. This is the City's own per-program formula (1.2) applied to the panel's totals. Rounded half-up to one decimal, in integer arithmetic. Per-program rates are the City's published `OCCUPANCY_RATE_*` values, unchanged.
9. **Check.** For last night the script asserts headline + Temporary Programs + refugee = City-wide for people, programs, and (separately) beds and rooms occupied and capacity.
10. **Staleness.** The run fails if the newest night is more than 5 days old.
11. **Second source.** Central Intake Service Queue Data is fetched the same way (schema check on `Date`, `Unmatched callers`, `Single call`, `Repeat caller`). If it fails, the previous values are kept, the run records a warning, and the workflow fails after committing the occupancy data, so the turn-away card keeps its own older date rather than blocking the main refresh.
12. **Geocoding** as in §5, for last night's programs only.

### Outputs

| File | Contents | Size (2026-10-16) |
|---|---|---|
| `data/latest.json` | Last night (`occupancy_date`): headline, Temporary Programs (`temporary`), refugee and City-wide totals (people; beds and rooms blocks with occupied, actual and funded capacity, unoccupied, unavailable, rate, programs, near-full and full counts); the same by sector inside each; totals by program area; the latest turn-away value with its date; one row per program (City fields + panel + geocode or unplaced reason). | ~106 KB |
| `data/history.json` | Every night since 2021-01-01, columnar: for headline, Temporary Programs (`temporary`) and refugee, people, programs, beds occupied and capacity, rooms occupied and capacity. Plus the Central Intake daily series. Compact JSON. | ~183 KB |
| `data/meta.json` | Source package and resource ids, row counts, date ranges, schema hashes, the City's `last_refreshed`, generation time, geocoding counts, near-full threshold, warnings. | ~3 KB |
| `data/geocodes.json` | Geocode cache: normalised address + postal code → coordinates, source, matched string, date checked. | ~16 KB |

The workflow commits only when `latest.json` or `history.json` change (two runs on the same City data produce byte-identical files; only `meta.json`'s timestamp differs).

## 7. "Near full" — the definition used here

A program is **at or near full** when the City's own occupancy rate for its capacity type (`OCCUPANCY_RATE_BEDS` or `OCCUPANCY_RATE_ROOMS`) is **95% or higher** — at most 1 in 20 of its in-service beds or rooms unoccupied. **Full** means 100%. The headline counts programs (bed programs and room programs together; counting programs adds no beds to rooms). Two caveats shown on the page:

- The City notes that unoccupied beds and rooms "may be held for a service user or may be vacant", so an unoccupied space is not necessarily open to a new person.
- Programs with nobody staying that night are not in the data at all ("Programs with no service user occupancy will not be included in reporting for that day"), so totals cover programs that reported at least one person.

This threshold is this project's choice, not a City definition. It lives in `scripts/fetch_data.py` (`NEAR_FULL`) and is echoed into `latest.json` and on the page.

## 8. What the data cannot say

- How many people are homeless in Toronto: the data covers City-funded overnight programs only, not people sleeping outside, in other systems, or in programs not tracked in SMIS. The page shows no such figure.
- Whether a bed is open right now: the count is taken at 4:00 am and published the next day.
- Anything about individuals: the data is program-level and is never joined with person-level data.
