#!/usr/bin/env python3
"""Fetch the City of Toronto's shelter occupancy open data and write slim JSON snapshots.

Writes data/latest.json, data/history.json and data/meta.json, and updates the
geocode cache data/geocodes.json. Standard library only.

Exit codes:
	0  success (warnings, if any, are in meta.json and in $REFRESH_WARN_FILE)
	1  hard failure: a fetch failed, the dataset is retired or not daily, a required
	   column is missing or a value is malformed. Nothing is written, so the last good
	   snapshot stays. The reason is printed and written to $REFRESH_ERROR_FILE.

Every number written comes from the City's records; the only arithmetic is sums
across programs and occupied ÷ capacity rates. See docs/DATA.md.
"""

import argparse
import csv
import datetime as dt
import hashlib
import http.client
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")

CKAN = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/"
DUMP = "https://ckan0.cf.opendata.inter.prod-toronto.ca/datastore/dump/"
PACKAGE = "daily-shelter-overnight-service-occupancy-capacity"
PACKAGE_URL = "https://open.toronto.ca/dataset/daily-shelter-overnight-service-occupancy-capacity/"
CI_PACKAGE = "central-intake-calls"
CI_PACKAGE_URL = "https://open.toronto.ca/dataset/central-intake-calls/"
CI_QUEUE_NAME = "Central Intake Service Queue Data"
ADDRESS_POINTS = "0b3756af-9caf-4f0f-ac28-9c6617adede4"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "shelter-occupancy/1.0 (+https://github.com/TJ-Hosting/shelter-occupancy; data.tj-hosting.ca)"

REFUGEE_AREA = "Temporary Refugee Response"
TEMPORARY_AREA = "Temporary Programs"	# undefined in the City's notes, so it has its own panel (Aco, 2026-10-17)
# The City relabelled its COVID-19 Response programs as Temporary Programs on 2024-01-01 (docs/DATA.md §3),
# so 2021–2023 COVID-19 Response rows count with Temporary Programs and the headline series stays continuous (Aco, 2026-10-18).
COVID_AREA = "COVID-19 Response"
TEMPORARY_AREAS = (TEMPORARY_AREA, COVID_AREA)
PANELS = ("headline", "temporary", "refugee")
KNOWN_AREAS = {
	"Base Shelter and Overnight Services System",
	"Base Program - Refugee",
	"Temporary Programs",
	"Winter Programs",
	"COVID-19 Response",
	"Temporary Refugee Response",
	"",
}
BEDS = "Bed Based Capacity"
ROOMS = "Room Based Capacity"
NEAR_FULL = 95.0	# percent; see docs/DATA.md "Near full"
MAX_AGE_DAYS = 5	# fail if the newest night is older than this
GEOCODE_RETRY_DAYS = 30	# re-try addresses that found no match after this many days

REQUIRED = [
	"OCCUPANCY_DATE", "ORGANIZATION_NAME", "SHELTER_GROUP", "LOCATION_ID", "LOCATION_NAME",
	"LOCATION_ADDRESS", "LOCATION_POSTAL_CODE", "LOCATION_CITY", "LOCATION_PROVINCE",
	"PROGRAM_ID", "PROGRAM_NAME", "SECTOR", "PROGRAM_MODEL", "OVERNIGHT_SERVICE_TYPE",
	"PROGRAM_AREA", "SERVICE_USER_COUNT", "CAPACITY_TYPE",
	"CAPACITY_ACTUAL_BED", "CAPACITY_FUNDING_BED", "OCCUPIED_BEDS", "UNOCCUPIED_BEDS", "UNAVAILABLE_BEDS",
	"CAPACITY_ACTUAL_ROOM", "CAPACITY_FUNDING_ROOM", "OCCUPIED_ROOMS", "UNOCCUPIED_ROOMS", "UNAVAILABLE_ROOMS",
	"OCCUPANCY_RATE_BEDS", "OCCUPANCY_RATE_ROOMS",
]
CI_REQUIRED = ["Date", "Unmatched callers", "Single call", "Repeat caller"]


class DataError(Exception):
	"""A failure that must stop the run and keep the last good snapshot."""


def log(msg):
	print(msg, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- HTTP

def http_get(url, *, accept="application/json", timeout=120, attempts=3):
	last = None
	for i in range(attempts):
		req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
		try:
			with urllib.request.urlopen(req, timeout=timeout) as resp:
				return resp.read()
		except (urllib.error.URLError, http.client.HTTPException, TimeoutError, ConnectionError) as e:
			last = e
			if isinstance(e, urllib.error.HTTPError) and 400 <= e.code < 500 and e.code != 429:
				break
			time.sleep(2 ** (i + 1))
	raise DataError(f"fetch failed after {attempts} attempt(s): {url} ({last})")


def ckan(action, **params):
	url = CKAN + action + "?" + urllib.parse.urlencode(params)
	try:
		body = json.loads(http_get(url))
	except json.JSONDecodeError as e:
		raise DataError(f"CKAN {action} returned non-JSON: {e}")
	if not body.get("success"):
		raise DataError(f"CKAN {action} did not succeed: {body.get('error')}")
	return body["result"]


def dump_csv(resource_id):
	raw = http_get(DUMP + resource_id, accept="text/csv")
	text = raw.decode("utf-8-sig")
	return list(csv.DictReader(io.StringIO(text)))


# ---------------------------------------------------------------- parsing

def parse_date(value):
	"""The City uses three formats across the years (see docs/DATA.md 1.1)."""
	s = (value or "").strip()
	m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})(?:T00:00:00)?", s)
	if m:
		iso = f"{m[1]}-{m[2]}-{m[3]}"
	else:
		m = re.fullmatch(r"(\d{2})-(\d{2})-(\d{2})", s)	# YY-MM-DD in 2021 and 2022
		if not m:
			raise DataError(f"unrecognised OCCUPANCY_DATE value {s!r}")
		iso = f"20{m[1]}-{m[2]}-{m[3]}"
	try:
		dt.date.fromisoformat(iso)
	except ValueError:
		raise DataError(f"invalid OCCUPANCY_DATE value {s!r}")
	return iso


def to_int(value, field, row_ref):
	s = (value or "").strip()
	if s == "":
		return None
	try:
		f = float(s)
	except ValueError:
		raise DataError(f"non-numeric {field} {s!r} ({row_ref})")
	if f != int(f):
		raise DataError(f"non-integer {field} {s!r} ({row_ref})")
	return int(f)


def to_float(value, field, row_ref):
	s = (value or "").strip()
	if s == "":
		return None
	try:
		return float(s)
	except ValueError:
		raise DataError(f"non-numeric {field} {s!r} ({row_ref})")


def rate(occupied, capacity):
	"""Occupied ÷ capacity as a percentage, one decimal, half-up, in integer arithmetic."""
	if not capacity:
		return None
	return ((occupied * 1000 * 2 + capacity) // (capacity * 2)) / 10


def clean(s):
	return re.sub(r"\s+", " ", (s or "").strip())


def parse_row(r, resource_id):
	ref = f"resource {resource_id} _id {r.get('_id')}"
	ctype = clean(r["CAPACITY_TYPE"])
	if ctype not in (BEDS, ROOMS):
		raise DataError(f"unexpected CAPACITY_TYPE {ctype!r} ({ref})")
	kind = "beds" if ctype == BEDS else "rooms"
	suffix = "BED" if kind == "beds" else "ROOM"
	plural = "BEDS" if kind == "beds" else "ROOMS"
	people = to_int(r["SERVICE_USER_COUNT"], "SERVICE_USER_COUNT", ref)
	cap_actual = to_int(r[f"CAPACITY_ACTUAL_{suffix}"], f"CAPACITY_ACTUAL_{suffix}", ref)
	occupied = to_int(r[f"OCCUPIED_{plural}"], f"OCCUPIED_{plural}", ref)
	if people is None or cap_actual is None or occupied is None:
		raise DataError(f"missing people, capacity or occupied value for a {kind} program ({ref})")
	city_rate = to_float(r[f"OCCUPANCY_RATE_{plural}"], f"OCCUPANCY_RATE_{plural}", ref)
	return {
		"date": parse_date(r["OCCUPANCY_DATE"]),
		"program_id": clean(r["PROGRAM_ID"]),
		"program": clean(r["PROGRAM_NAME"]),
		"organization": clean(r["ORGANIZATION_NAME"]),
		"shelter_group": clean(r["SHELTER_GROUP"]),
		"location_id": clean(r["LOCATION_ID"]),
		"location": clean(r["LOCATION_NAME"]),
		"address": clean(r["LOCATION_ADDRESS"]),
		"postal_code": clean(r["LOCATION_POSTAL_CODE"]),
		"city": clean(r["LOCATION_CITY"]),
		"province": clean(r["LOCATION_PROVINCE"]),
		"sector": clean(r["SECTOR"]),
		"model": clean(r["PROGRAM_MODEL"]),
		"service_type": clean(r["OVERNIGHT_SERVICE_TYPE"]),
		"area": clean(r["PROGRAM_AREA"]),
		"capacity_type": kind,
		"people": people,
		"capacity_actual": cap_actual,
		"capacity_funding": to_int(r[f"CAPACITY_FUNDING_{suffix}"], f"CAPACITY_FUNDING_{suffix}", ref),
		"occupied": occupied,
		"unoccupied": to_int(r[f"UNOCCUPIED_{plural}"], f"UNOCCUPIED_{plural}", ref),
		"unavailable": to_int(r[f"UNAVAILABLE_{plural}"], f"UNAVAILABLE_{plural}", ref),
		# The City's own per-program rate; recomputed only if the City left it blank.
		"rate": city_rate if city_rate is not None else rate(occupied, cap_actual),
	}


def panel_of(area):
	if area == REFUGEE_AREA:
		return "refugee"
	if area in TEMPORARY_AREAS:
		return "temporary"
	return "headline"


# ---------------------------------------------------------------- aggregation

def new_block():
	return {
		"programs": 0, "occupied": 0, "capacity_actual": 0, "capacity_funding": 0,
		"unoccupied": 0, "unavailable": 0, "rate": None, "near_full": 0, "full": 0,
	}


def new_totals():
	return {"programs": 0, "people": 0, "beds": new_block(), "rooms": new_block()}


def add(totals, p):
	totals["programs"] += 1
	totals["people"] += p["people"]
	b = totals[p["capacity_type"]]	# beds and rooms are never added together
	b["programs"] += 1
	for k in ("occupied", "capacity_actual", "capacity_funding", "unoccupied", "unavailable"):
		b[k] += p[k] or 0
	if p["rate"] is not None and p["rate"] >= NEAR_FULL:
		b["near_full"] += 1
	if p["rate"] is not None and p["rate"] >= 100:
		b["full"] += 1


def finish(totals):
	for kind in ("beds", "rooms"):
		b = totals[kind]
		b["rate"] = rate(b["occupied"], b["capacity_actual"])
	totals["near_full"] = totals["beds"]["near_full"] + totals["rooms"]["near_full"]
	return totals


# ---------------------------------------------------------------- geocoding

STREET_WORDS = [
	(r"\bStreet\b", "St"), (r"\bAvenue\b", "Ave"), (r"\bRoad\b", "Rd"), (r"\bBoulevard\b", "Blvd"),
	(r"\bDrive\b", "Dr"), (r"\bCourt\b", "Crt"), (r"\bCrescent\b", "Cres"), (r"\bPlace\b", "Pl"),
	(r"\bEast\b", "E"), (r"\bWest\b", "W"), (r"\bNorth\b", "N"), (r"\bSouth\b", "S"),
]


def address_variants(address):
	base = clean(address.replace(".", " ").replace(",", " "))
	out = [base]
	v = base
	for pat, rep in STREET_WORDS:
		v = re.sub(pat, rep, v)
	if v not in out:
		out.append(v)
	if re.search(r"\bCt\b", v):
		out.append(re.sub(r"\bCt\b", "Crt", v))
	if re.search(r"\bCrt\b", v):
		out.append(re.sub(r"\bCrt\b", "Ct", v))
	return out


def distance_m(a, b):
	from math import radians, sin, cos, asin, sqrt
	lat1, lon1, lat2, lon2 = map(radians, (a[0], a[1], b[0], b[1]))
	h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
	return 6371000 * 2 * asin(sqrt(h))


def address_points_lookup(address):
	for variant in address_variants(address):
		res = ckan("datastore_search", resource_id=ADDRESS_POINTS,
			filters=json.dumps({"ADDRESS_FULL": variant}),
			fields="ADDRESS_FULL,MUNICIPALITY_NAME,geometry", limit=20)
		points = []
		for rec in res.get("records", []):
			try:
				lon, lat = json.loads(rec["geometry"])["coordinates"][:2]
				points.append((lat, lon, rec.get("MUNICIPALITY_NAME")))
			except (KeyError, ValueError, TypeError):
				continue
		if points:
			return variant, points
	return None, []


_last_nominatim = [0.0]


def nominatim_lookup(address, city, postal_code):
	wait = 1.05 - (time.time() - _last_nominatim[0])	# at most 1 request per second
	if wait > 0:
		time.sleep(wait)
	params = {
		"street": address_variants(address)[0], "city": city or "Toronto", "state": "Ontario",
		"country": "Canada", "format": "jsonv2", "limit": 1, "addressdetails": 0,
	}
	if postal_code:
		params["postalcode"] = postal_code
	url = NOMINATIM + "?" + urllib.parse.urlencode(params)
	_last_nominatim[0] = time.time()
	try:
		body = json.loads(http_get(url, attempts=2))
	except (DataError, json.JSONDecodeError) as e:
		log(f"  nominatim error for {address!r}: {e}")
		return None
	if not body and postal_code:	# retry once without the postal code
		params.pop("postalcode")
		wait = 1.05 - (time.time() - _last_nominatim[0])
		if wait > 0:
			time.sleep(wait)
		_last_nominatim[0] = time.time()
		try:
			body = json.loads(http_get(NOMINATIM + "?" + urllib.parse.urlencode(params), attempts=2))
		except (DataError, json.JSONDecodeError):
			return None
	if not body:
		return None
	return float(body[0]["lat"]), float(body[0]["lon"]), body[0].get("display_name", "")


def geocode_key(p):
	return f"{address_variants(p['address'])[0]}|{p['postal_code']}"


def geocode(programs, cache, today, warnings, enabled=True):
	entries = cache.setdefault("entries", {})
	for p in programs:
		if not p["address"]:
			p["geo"] = None
			p["unplaced_reason"] = "no address published"
			continue
		key = geocode_key(p)
		hit = entries.get(key)
		stale_miss = (hit and hit.get("status") == "not-found" and
			(dt.date.fromisoformat(today) - dt.date.fromisoformat(hit["checked"])).days >= GEOCODE_RETRY_DAYS)
		if enabled and (hit is None or stale_miss):
			hit = geocode_one(p, warnings)
			hit["checked"] = today
			entries[key] = hit
			log(f"  geocoded {key!r}: {hit.get('source') or hit.get('status')}")
		if hit and hit.get("lat") is not None:
			p["geo"] = {"lat": hit["lat"], "lon": hit["lon"], "source": hit["source"]}
		else:
			p["geo"] = None
			p["unplaced_reason"] = "address not matched" if hit else "not geocoded yet"


def geocode_one(p, warnings):
	try:
		variant, points = address_points_lookup(p["address"])
	except DataError as e:
		warnings.append(f"Address Points lookup failed for {p['address']!r}: {e}")
		variant, points = None, []
	if points:
		first = (points[0][0], points[0][1])
		spread = max(distance_m(first, (q[0], q[1])) for q in points)
		if spread <= 250:	# several points for one building: take the first
			return {"lat": round(first[0], 6), "lon": round(first[1], 6), "source": "address-points", "match": variant}
		# Same street address in more than one former municipality: let Nominatim and the
		# postal code pick the nearest City point, if they agree within 1 km.
		nom = nominatim_lookup(p["address"], p["city"], p["postal_code"])
		if nom:
			best = min(points, key=lambda q: distance_m((nom[0], nom[1]), (q[0], q[1])))
			if distance_m((nom[0], nom[1]), (best[0], best[1])) <= 1000:
				return {"lat": round(best[0], 6), "lon": round(best[1], 6), "source": "address-points", "match": variant + " (disambiguated by postal code)"}
		return {"status": "not-found", "note": f"{len(points)} City address points match; ambiguous"}
	nom = nominatim_lookup(p["address"], p["city"], p["postal_code"])
	if nom:
		return {"lat": round(nom[0], 6), "lon": round(nom[1], 6), "source": "nominatim", "match": nom[2][:120]}
	return {"status": "not-found"}


# ---------------------------------------------------------------- main pipeline

def schema_hash(fields):
	spec = json.dumps([[f["id"], f["type"]] for f in fields], separators=(",", ":"))
	return hashlib.sha256(spec.encode()).hexdigest()


def load_json(path, default):
	try:
		with open(path, encoding="utf-8") as f:
			return json.load(f)
	except (FileNotFoundError, json.JSONDecodeError):
		return default


def write_json(path, obj, compact=False):
	tmp = path + ".tmp"
	with open(tmp, "w", encoding="utf-8") as f:
		if compact:
			json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
		else:
			json.dump(obj, f, ensure_ascii=False, indent="\t")
		f.write("\n")
	os.replace(tmp, path)


def fetch_occupancy(warnings):
	pkg = ckan("package_show", id=PACKAGE)
	if pkg.get("is_retired") in (True, "true", "True"):
		raise DataError(f"package {PACKAGE} is marked retired")
	if (pkg.get("refresh_rate") or "").lower() != "daily":
		raise DataError(f"package {PACKAGE} refresh_rate is {pkg.get('refresh_rate')!r}, not Daily")
	resources = [r for r in pkg["resources"] if r.get("datastore_active") in (True, "true", "True")]
	if not resources:
		raise DataError(f"package {PACKAGE} has no datastore resources")
	sources, by_key = [], {}
	for res in resources:
		info = ckan("datastore_search", resource_id=res["id"], limit=0)
		fields = info["fields"]
		names = {f["id"] for f in fields}
		missing = [c for c in REQUIRED if c not in names]
		if missing:
			raise DataError(f"resource {res['id']} ({res.get('name')}) is missing required column(s): {', '.join(missing)}")
		rows = dump_csv(res["id"])
		if len(rows) != info.get("total"):
			raise DataError(f"resource {res['id']}: dump has {len(rows)} rows, API reports {info.get('total')}")
		parsed = [parse_row(r, res["id"]) for r in rows]
		dates = sorted({p["date"] for p in parsed})
		sources.append({
			"resource_id": res["id"], "name": res.get("name"), "rows": len(rows),
			"first_date": dates[0] if dates else None, "last_date": dates[-1] if dates else None,
			"schema_hash": schema_hash(fields), "fields": len(fields),
		})
		for p in parsed:
			by_key[(p["date"], p["program_id"])] = p	# later resources (newer data) win
		log(f"  {res['id']} {res.get('name')!r}: {len(rows)} rows, {dates[0] if dates else '-'} → {dates[-1] if dates else '-'}")
	sources.sort(key=lambda s: s["first_date"] or "")
	unknown = sorted({p["area"] for p in by_key.values()} - KNOWN_AREAS)
	if unknown:
		warnings.append("New PROGRAM_AREA value(s) found and placed in the headline: " + ", ".join(repr(a) for a in unknown) + ". Check the split in docs/DATA.md §3.")
	return pkg, sources, list(by_key.values())


def fetch_turnaways(previous_history, warnings):
	try:
		pkg = ckan("package_show", id=CI_PACKAGE)
		res = next((r for r in pkg["resources"] if r.get("name") == CI_QUEUE_NAME and r.get("datastore_active") in (True, "true", "True")), None)
		if res is None:
			raise DataError(f"resource {CI_QUEUE_NAME!r} not found in {CI_PACKAGE}")
		info = ckan("datastore_search", resource_id=res["id"], limit=0)
		names = {f["id"] for f in info["fields"]}
		missing = [c for c in CI_REQUIRED if c not in names]
		if missing:
			raise DataError(f"{CI_QUEUE_NAME} is missing column(s): {', '.join(missing)}")
		rows = dump_csv(res["id"])
		series = []
		for r in rows:
			d = (r["Date"] or "").strip()[:10]
			dt.date.fromisoformat(d)
			series.append((d, to_int(r["Unmatched callers"], "Unmatched callers", d),
				to_int(r["Single call"], "Single call", d), to_int(r["Repeat caller"], "Repeat caller", d)))
		series.sort()
		return {
			"ok": True, "package": CI_PACKAGE, "resource_id": res["id"], "resource": CI_QUEUE_NAME,
			"last_refreshed": pkg.get("last_refreshed"), "refresh_rate": pkg.get("refresh_rate"),
			"series": series, "schema_hash": schema_hash(info["fields"]),
		}
	except (DataError, ValueError, KeyError) as e:
		warnings.append(f"Second source (Central Intake Service Queue Data) failed; kept the previous values: {e}")
		prev = (previous_history or {}).get("turnaways") or {}
		series = list(zip(prev.get("dates", []), prev.get("unmatched", []), prev.get("single_call", []), prev.get("repeat_caller", [])))
		return {"ok": False, "series": series, **{k: prev.get(k) for k in ("package", "resource_id", "resource", "last_refreshed", "refresh_rate")}}


def build(args):
	warnings = []
	now = dt.datetime.now(dt.timezone.utc)
	log("Fetching occupancy package…")
	pkg, sources, programs = fetch_occupancy(warnings)
	if not programs:
		raise DataError("no rows in any resource")
	dates = sorted({p["date"] for p in programs})
	latest = dates[-1]
	age = (now.date() - dt.date.fromisoformat(latest)).days
	if age > MAX_AGE_DAYS and not args.allow_stale:
		raise DataError(f"newest OCCUPANCY_DATE is {latest}, {age} days old (limit {MAX_AGE_DAYS}); the City may have stopped refreshing")

	previous_history = load_json(os.path.join(DATA_DIR, "history.json"), {})
	log("Fetching Central Intake service queue…")
	ta = fetch_turnaways(previous_history, warnings)

	# ---- history: one value per night per panel, columnar to keep the file slim
	per_day = {d: {panel: new_totals() for panel in PANELS} for d in dates}
	for p in programs:
		add(per_day[p["date"]][panel_of(p["area"])], p)
	series = {}
	for panel in PANELS:
		s = {k: [] for k in ("people", "programs", "beds_occupied", "beds_capacity", "rooms_occupied", "rooms_capacity")}
		for d in dates:
			t = per_day[d][panel]
			s["people"].append(t["people"])
			s["programs"].append(t["programs"])
			s["beds_occupied"].append(t["beds"]["occupied"])
			s["beds_capacity"].append(t["beds"]["capacity_actual"])
			s["rooms_occupied"].append(t["rooms"]["occupied"])
			s["rooms_capacity"].append(t["rooms"]["capacity_actual"])
		series[panel] = s
	history = {
		"about": "Nightly totals from the City of Toronto's Daily Shelter & Overnight Service Occupancy & Capacity data. "
			"headline = every PROGRAM_AREA except Temporary Programs, COVID-19 Response and Temporary Refugee Response; "
			"temporary = Temporary Programs and, before 2024, COVID-19 Response (relabelled Temporary Programs on 2024-01-01); "
			"refugee = Temporary Refugee Response. "
			"Capacity is actual capacity. Beds and rooms are separate and never added. See docs/DATA.md.",
		"source": PACKAGE_URL,
		"first_date": dates[0], "last_date": latest,
		"dates": dates,
		"series": series,
		"turnaways": {
			"about": "Central Intake Service Queue Data: 'Total individuals who were not able to be offered a space over the past 24 hours, at time of closeout at 4am.' Singles and couples only.",
			"source": CI_PACKAGE_URL,
			"dates": [r[0] for r in ta["series"]],
			"unmatched": [r[1] for r in ta["series"]],
			"single_call": [r[2] for r in ta["series"]],
			"repeat_caller": [r[3] for r in ta["series"]],
		},
	}

	# ---- latest night
	night = sorted((p for p in programs if p["date"] == latest), key=lambda p: (p["sector"], p["program"]))
	cache_path = os.path.join(DATA_DIR, "geocodes.json")
	cache = load_json(cache_path, {})
	cache["about"] = ("Coordinates for program addresses: City of Toronto Address Points first, OpenStreetMap Nominatim as fallback. "
		"Key = normalised address|postal code. Cached so the daily job only geocodes new addresses.")
	log(f"Geocoding {len(night)} programs (cache {len(cache.get('entries', {}))} entries)…")
	geocode(night, cache, now.date().isoformat(), warnings, enabled=not args.no_geocode)

	groups = {g: new_totals() for g in (*PANELS, "citywide")}
	by_sector = {g: {} for g in groups}
	by_area = {}
	for p in night:
		panel = panel_of(p["area"])
		for g in (panel, "citywide"):
			add(groups[g], p)
			add(by_sector[g].setdefault(p["sector"], new_totals()), p)
		add(by_area.setdefault(p["area"] or "(blank)", new_totals()), p)
	for g in groups:
		finish(groups[g])
		for t in by_sector[g].values():
			finish(t)
		groups[g]["by_sector"] = dict(sorted(by_sector[g].items()))
	for t in by_area.values():
		finish(t)
	# Arithmetic check: the three panels add up to the City-wide line, per measure.
	for k in ("people", "programs"):
		assert sum(groups[g][k] for g in PANELS) == groups["citywide"][k], k
	for kind in ("beds", "rooms"):
		for k in ("occupied", "capacity_actual"):
			assert sum(groups[g][kind][k] for g in PANELS) == groups["citywide"][kind][k], (kind, k)

	ta_latest = None
	if ta["series"]:
		d, u, s1, rep = ta["series"][-1]
		ta_latest = {"date": d, "unmatched_callers": u, "single_call": s1, "repeat_caller": rep,
			"last_refreshed": ta.get("last_refreshed"), "ok": ta["ok"]}

	program_rows = []
	for p in night:
		program_rows.append({
			"id": p["program_id"], "program": p["program"], "organization": p["organization"],
			"shelter_group": p["shelter_group"], "location_id": p["location_id"], "location": p["location"],
			"address": p["address"], "postal_code": p["postal_code"], "city": p["city"],
			"sector": p["sector"], "model": p["model"], "service_type": p["service_type"],
			"area": p["area"], "panel": panel_of(p["area"]), "capacity_type": p["capacity_type"],
			"people": p["people"], "occupied": p["occupied"], "capacity_actual": p["capacity_actual"],
			"capacity_funding": p["capacity_funding"], "unoccupied": p["unoccupied"], "unavailable": p["unavailable"],
			"rate": p["rate"], "near_full": p["rate"] is not None and p["rate"] >= NEAR_FULL,
			"geo": p["geo"], **({"unplaced_reason": p["unplaced_reason"]} if p["geo"] is None else {}),
		})

	latest_doc = {
		"about": "Last night's totals from the City of Toronto's Daily Shelter & Overnight Service Occupancy & Capacity data. See docs/DATA.md.",
		"occupancy_date": latest,
		"occupancy_date_meaning": "The evening of the overnight period; the City retrieves the data at 4:00 am the following morning.",
		"source": {
			"title": pkg.get("title"), "url": PACKAGE_URL, "package": PACKAGE,
			"last_refreshed": pkg.get("last_refreshed"), "limitations": pkg.get("limitations"),
			"licence": "Open Government Licence – Toronto", "licence_url": "https://open.toronto.ca/open-data-licence/",
		},
		"near_full_threshold": NEAR_FULL,
		"refugee_area": REFUGEE_AREA,
		"temporary_area": TEMPORARY_AREA,
		"temporary_areas": list(TEMPORARY_AREAS),
		"headline": groups["headline"],
		"temporary": groups["temporary"],
		"refugee": groups["refugee"],
		"citywide": groups["citywide"],
		"by_program_area": dict(sorted(by_area.items())),
		"turnaways": ta_latest,
		"programs": program_rows,
		"unplaced": sum(1 for r in program_rows if r["geo"] is None),
	}

	meta = {
		"generated_at": now.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
		"occupancy_date": latest,
		"package": PACKAGE, "package_url": PACKAGE_URL,
		"package_last_refreshed": pkg.get("last_refreshed"),
		"package_refresh_rate": pkg.get("refresh_rate"),
		"package_is_retired": pkg.get("is_retired"),
		"resources": sources,
		"schema_hash": hashlib.sha256("".join(s["schema_hash"] for s in sources).encode()).hexdigest(),
		"rows": sum(s["rows"] for s in sources),
		"nights": len(dates),
		"turnaways": {k: ta.get(k) for k in ("package", "resource_id", "resource", "last_refreshed", "refresh_rate", "schema_hash", "ok")},
		"geocoding": {
			"programs": len(program_rows), "placed": len(program_rows) - latest_doc["unplaced"],
			"unplaced": latest_doc["unplaced"],
			"by_source": {src: sum(1 for r in program_rows if r["geo"] and r["geo"]["source"] == src) for src in ("address-points", "nominatim")},
		},
		"near_full_threshold": NEAR_FULL,
		"warnings": warnings,
	}

	os.makedirs(DATA_DIR, exist_ok=True)
	write_json(os.path.join(DATA_DIR, "history.json"), history, compact=True)
	write_json(os.path.join(DATA_DIR, "latest.json"), latest_doc)
	write_json(os.path.join(DATA_DIR, "meta.json"), meta)
	write_json(cache_path, cache)
	log(f"Wrote data/ for night {latest}: headline {groups['headline']['people']} people, Temporary Programs {groups['temporary']['people']}, "
		f"refugee {groups['refugee']['people']}, City-wide {groups['citywide']['people']}.")
	if warnings:
		log("Warnings:\n- " + "\n- ".join(warnings))
		if os.environ.get("REFRESH_WARN_FILE"):
			with open(os.environ["REFRESH_WARN_FILE"], "w", encoding="utf-8") as f:
				f.write("\n".join(f"- {w}" for w in warnings) + "\n")


def main():
	ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
	ap.add_argument("--no-geocode", action="store_true", help="use the cache only; never call a geocoder")
	ap.add_argument("--allow-stale", action="store_true", help="do not fail when the newest night is old")
	args = ap.parse_args()
	try:
		build(args)
	except DataError as e:
		msg = f"Data refresh failed: {e}"
		log(msg)
		if os.environ.get("REFRESH_ERROR_FILE"):
			with open(os.environ["REFRESH_ERROR_FILE"], "w", encoding="utf-8") as f:
				f.write(msg + "\n")
		sys.exit(1)


if __name__ == "__main__":
	main()
