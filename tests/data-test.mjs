// Data test (brief v2 §6): recompute last night's figures straight from the City's raw CKAN
// resources and assert they equal what the rendered page and the embed card show.
//
// Independent of scripts/fetch_data.py on purpose: different language, different access path
// (filtered datastore_search JSON instead of CSV dumps), its own panel split and arithmetic.
// Usage: node tests/data-test.mjs http://127.0.0.1:8765/

import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8765/";
const API = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/";
const PACKAGE = "daily-shelter-overnight-service-occupancy-capacity";
const REFUGEE = "Temporary Refugee Response";
const TEMPORARY = "Temporary Programs";	// own panel since shelter-02 (Aco, 17 Oct 2026): the City doesn't define it

const results = [];
const check = (name, expected, shown) => results.push({ name, expected, shown, ok: expected === shown });

async function ckan(action, params) {
	const url = API + action + "?" + new URLSearchParams(params);
	for (let i = 0; i < 3; i++) {
		try {
			const res = await fetch(url, { headers: { "User-Agent": "shelter-occupancy data-test (+https://github.com/TJ-Hosting/shelter-occupancy)" } });
			if (!res.ok) throw new Error(`HTTP ${res.status} from CKAN ${action}`);	// the City's gateway answers 502/504 in HTML when busy
			const body = await res.json();
			if (!body.success) throw new Error(JSON.stringify(body.error));
			return body.result;
		} catch (e) {
			if (i === 2) throw e;
			await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
		}
	}
}

const NUM = new Intl.NumberFormat("en-CA");
const fmtN = (v) => NUM.format(v);
// Occupied ÷ capacity to one decimal, half-up, in integers (no float rounding at .x5).
const rate = (occ, cap) => (cap ? Math.floor((occ * 2000 + cap) / (cap * 2)) / 10 : null);
const fmtRate = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

// ---------------------------------------------------------------- 1. what the page shows
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "en-CA", timezoneId: "America/Toronto" });
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForSelector('body[data-ready="true"]');
const shown = await page.evaluate(() => {
	const out = {};
	document.querySelectorAll("[data-figure]").forEach((n) => { if (!(n.dataset.figure in out)) out[n.dataset.figure] = n.textContent.trim(); });
	out.sources = [...document.querySelectorAll('[data-source="occupancy"]')].map((n) => n.textContent.trim());
	return out;
});
const snapshot = await page.evaluate(async () => {
	const d = await (await fetch("data/latest.json")).json();
	return { date: d.occupancy_date, headlineAreas: [...new Set(d.programs.filter((p) => p.panel === "headline").map((p) => p.area))] };
});
const snapshotDate = snapshot.date;
const headlineAreas = snapshot.headlineAreas;

const embed = await browser.newPage({ viewport: { width: 600, height: 340 }, locale: "en-CA", timezoneId: "America/Toronto" });
await embed.goto(new URL("embed/", base).href, { waitUntil: "networkidle" });
await embed.waitForSelector('body[data-ready="true"]');
const card = await embed.evaluate(() => ({
	people: document.getElementById("people").textContent.trim(),
	beds: document.getElementById("beds").textContent.trim(),
	rooms: document.getElementById("rooms").textContent.trim(),
	night: document.getElementById("night").textContent.trim(),
	source: document.getElementById("source").textContent.trim(),
}));
await browser.close();

// ---------------------------------------------------------------- 2. the raw City data for that night
const pkg = await ckan("package_show", { id: PACKAGE });
let rows = [];
let resourceId = null;
let newestRaw = null;
for (const res of pkg.resources.filter((r) => r.datastore_active === true || r.datastore_active === "true")) {
	// Stop filtering once the night is found: a filter on the older yearly resources can take
	// 90 s and end in a gateway timeout when the City's API is busy (seen 2026-10-18).
	const r = resourceId ? { records: [] } : await ckan("datastore_search", { resource_id: res.id, filters: JSON.stringify({ OCCUPANCY_DATE: snapshotDate }), limit: 5000 });
	if (r.records.length) {
		rows = r.records;
		resourceId = res.id;
		if (r.total !== r.records.length) throw new Error(`paging needed: ${r.total} rows`);
	}
	if (res.name === "Daily shelter overnight occupancy") {
		const top = await ckan("datastore_search", { resource_id: res.id, sort: "OCCUPANCY_DATE desc", limit: 1, fields: "OCCUPANCY_DATE" });
		newestRaw = String(top.records[0].OCCUPANCY_DATE).slice(0, 10);
	}
}
if (!rows.length) throw new Error(`no raw rows for ${snapshotDate}`);

function totals(filter) {
	const t = { people: 0, programs: 0, beds: { occ: 0, cap: 0 }, rooms: { occ: 0, cap: 0 } };
	for (const r of rows.filter(filter)) {
		t.people += Number(r.SERVICE_USER_COUNT);
		t.programs += 1;
		if (r.CAPACITY_TYPE === "Bed Based Capacity") {
			t.beds.occ += Number(r.OCCUPIED_BEDS);
			t.beds.cap += Number(r.CAPACITY_ACTUAL_BED);
		} else if (r.CAPACITY_TYPE === "Room Based Capacity") {
			t.rooms.occ += Number(r.OCCUPIED_ROOMS);
			t.rooms.cap += Number(r.CAPACITY_ACTUAL_ROOM);
		} else {
			throw new Error(`unknown CAPACITY_TYPE ${r.CAPACITY_TYPE}`);
		}
	}
	return t;
}
const area = (r) => (r.PROGRAM_AREA || "").trim();
const headline = totals((r) => area(r) !== REFUGEE && area(r) !== TEMPORARY);
const temporary = totals((r) => area(r) === TEMPORARY);
const refugee = totals((r) => area(r) === REFUGEE);
const citywide = totals(() => true);
const num = (s) => { const d = String(s ?? "").replace(/[^\d]/g, ""); return d ? Number(d) : NaN; };	// a missing figure fails the sum

// ---------------------------------------------------------------- 3. compare
check("headline people served", fmtN(headline.people), shown["headline-people"]);
check("headline bed rate", fmtRate(rate(headline.beds.occ, headline.beds.cap)), shown["headline-beds-rate"]);
check("headline room rate", fmtRate(rate(headline.rooms.occ, headline.rooms.cap)), shown["headline-rooms-rate"]);
check("headline beds occupied", fmtN(headline.beds.occ), shown["headline-beds-occupied"]);
check("headline beds capacity", fmtN(headline.beds.cap), shown["headline-beds-capacity"]);
check("headline beds unoccupied", fmtN(headline.beds.cap - headline.beds.occ), shown["headline-beds-unoccupied"]);
check("headline rooms occupied", fmtN(headline.rooms.occ), shown["headline-rooms-occupied"]);
check("headline rooms capacity", fmtN(headline.rooms.cap), shown["headline-rooms-capacity"]);
check("headline rooms unoccupied", fmtN(headline.rooms.cap - headline.rooms.occ), shown["headline-rooms-unoccupied"]);
check("headline programs", fmtN(headline.programs), shown["headline-programs"]);
check("Temporary Programs people served", fmtN(temporary.people), shown["temporary-people"]);
check("Temporary Programs bed rate", fmtRate(rate(temporary.beds.occ, temporary.beds.cap)), shown["temporary-beds-rate"]);
check("Temporary Programs room rate", fmtRate(rate(temporary.rooms.occ, temporary.rooms.cap)), shown["temporary-rooms-rate"]);
check("Temporary Programs beds occupied", fmtN(temporary.beds.occ), shown["temporary-beds-occupied"]);
check("Temporary Programs beds capacity", fmtN(temporary.beds.cap), shown["temporary-beds-capacity"]);
check("Temporary Programs rooms occupied", fmtN(temporary.rooms.occ), shown["temporary-rooms-occupied"]);
check("Temporary Programs rooms capacity", fmtN(temporary.rooms.cap), shown["temporary-rooms-capacity"]);
check("Temporary Programs programs", fmtN(temporary.programs), shown["temporary-programs"]);
check("refugee people served", fmtN(refugee.people), shown["refugee-people"]);
check("refugee bed rate", fmtRate(rate(refugee.beds.occ, refugee.beds.cap)), shown["refugee-beds-rate"]);
check("refugee room rate", fmtRate(rate(refugee.rooms.occ, refugee.rooms.cap)), shown["refugee-rooms-rate"]);
check("refugee beds occupied", fmtN(refugee.beds.occ), shown["refugee-beds-occupied"]);
check("refugee beds capacity", fmtN(refugee.beds.cap), shown["refugee-beds-capacity"]);
check("refugee rooms occupied", fmtN(refugee.rooms.occ), shown["refugee-rooms-occupied"]);
check("refugee rooms capacity", fmtN(refugee.rooms.cap), shown["refugee-rooms-capacity"]);
check("refugee programs", fmtN(refugee.programs), shown["refugee-programs"]);
check("City-wide people served", fmtN(citywide.people), shown["citywide-people"]);
check("City-wide bed rate", fmtRate(rate(citywide.beds.occ, citywide.beds.cap)), shown["citywide-beds-rate"]);
check("City-wide room rate", fmtRate(rate(citywide.rooms.occ, citywide.rooms.cap)), shown["citywide-rooms-rate"]);
// The headline leaves out both temporary areas, and the three panels add up to the City-wide line.
check("snapshot: no headline program is in either temporary area", "none", headlineAreas.filter((a) => a === REFUGEE || a === TEMPORARY).join(", ") || "none");
check("raw: headline + Temporary Programs + refugee = City-wide people", citywide.people, headline.people + temporary.people + refugee.people);
check("shown: headline + Temporary Programs + refugee = City-wide people", num(shown["citywide-people"]),
	num(shown["headline-people"]) + num(shown["temporary-people"]) + num(shown["refugee-people"]));
check("embed: people served", fmtN(headline.people), card.people);
check("embed: bed rate", fmtRate(rate(headline.beds.occ, headline.beds.cap)), card.beds);
check("embed: room rate", fmtRate(rate(headline.rooms.occ, headline.rooms.cap)), card.rooms);

// Dates: the "as of" lines and the night label name the snapshot's night.
const d = new Date(`${snapshotDate}T00:00:00Z`);
const medium = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }).format(d);
const long = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(d);
check("night label names the snapshot's night", true, shown["night-label"].includes(long));
check("every occupancy source line says 'as of' that night", true, shown.sources.length > 0 && shown.sources.every((s) => s.startsWith(`Source: City of Toronto Open Data, as of ${medium}`)));
check("embed source line says 'as of' that night", `Source: City of Toronto Open Data, as of ${medium}`, card.source);

// Turn-aways: the latest Central Intake record equals the card.
const ci = await ckan("package_show", { id: "central-intake-calls" });
const queue = ci.resources.find((r) => r.name === "Central Intake Service Queue Data");
const lastQ = (await ckan("datastore_search", { resource_id: queue.id, sort: "Date desc", limit: 1 })).records[0];
check("unmatched callers (latest operational date)", fmtN(lastQ["Unmatched callers"]), shown["ta-unmatched"]);
check("unmatched callers date", new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${String(lastQ.Date).slice(0, 10)}T00:00:00Z`)), shown["ta-date"]);

// ---------------------------------------------------------------- report
const pass = results.filter((r) => r.ok).length;
console.log(`Data test — ${new Date().toISOString()}`);
console.log(`Page: ${base} · snapshot night ${snapshotDate} · night label shown: "${shown["night-label"]}"`);
console.log(`Raw: CKAN ${PACKAGE}, resource ${resourceId}, ${rows.length} rows for ${snapshotDate} (datastore_search, filtered). Newest night in the current resource: ${newestRaw}.`);
console.log(`Package last_refreshed ${pkg.last_refreshed}. Panels: headline = PROGRAM_AREA not "${TEMPORARY}" or "${REFUGEE}" (${headline.programs} programs), Temporary Programs (${temporary.programs}), refugee = "${REFUGEE}" (${refugee.programs}).`);
if (newestRaw && newestRaw !== snapshotDate) console.log(`NOTE: the City has published a newer night (${newestRaw}) since the snapshot; the test checks the night the page shows.`);
console.log("");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(48)} raw → ${String(r.expected).padEnd(14)} shown → ${r.shown}`);
console.log(`\n${pass}/${results.length} checks passed.`);
process.exit(pass === results.length ? 0 : 1);
