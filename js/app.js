// Toronto shelter occupancy — page script. Reads data/latest.json, data/history.json and
// data/meta.json (built daily by scripts/fetch_data.py) and fills every figure. Nothing on the
// page is computed beyond what docs/DATA.md describes.

import { n, pct, dateLong, dateMedium, nightLabel, el } from "./format.js";
import { drawPeople, drawRates, drawYoy, drawTurnaways, rate } from "./charts.js";
import { initPrograms, refreshMapTheme } from "./programs.js";

const ui = { range: "all", yoy: "people" };
let latest, history, meta;

function setFigure(name, text) {
	document.querySelectorAll(`[data-figure="${name}"]`).forEach((node) => { node.textContent = text; });
}

function setMeter(name, value) {
	document.querySelectorAll(`[data-meter="${name}"]`).forEach((node) => {
		node.style.width = `${Math.max(0, Math.min(100, value ?? 0))}%`;
	});
}

function setSource(name, nodes) {
	document.querySelectorAll(`[data-source="${name}"]`).forEach((target) => {
		target.replaceChildren(...nodes.map((x) => (typeof x === "string" ? document.createTextNode(x) : x.cloneNode(true))));
	});
}

async function load(path) {
	const res = await fetch(path, { cache: "no-cache" });
	if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
	return res.json();
}

// ---------------------------------------------------------------- figures
function renderHeadline() {
	const night = latest.occupancy_date;
	const label = nightLabel(night);
	setFigure("night-label", label.text);
	document.body.dataset.lastNight = String(label.lastNight);

	const h = latest.headline;
	setFigure("headline-people", n(h.people));
	setFigure("headline-programs", n(h.programs));
	setFigure("headline-near-full", n(h.near_full));
	setFigure("headline-full", n(h.beds.full + h.rooms.full));
	for (const kind of ["beds", "rooms"]) {
		const b = h[kind];
		setFigure(`headline-${kind}-rate`, pct(b.rate));
		setFigure(`headline-${kind}-occupied`, n(b.occupied));
		setFigure(`headline-${kind}-capacity`, n(b.capacity_actual));
		setFigure(`headline-${kind}-unoccupied`, n(b.unoccupied));
		setFigure(`headline-${kind}-funded`, n(b.capacity_funding));
		setFigure(`headline-${kind}-unavailable`, n(b.unavailable));
		setFigure(`headline-${kind}-programs`, n(b.programs));
		setMeter(`headline-${kind}`, b.rate);
	}

	const c = latest.citywide;
	const line = document.querySelector('[data-figure="citywide-line"]');
	line.replaceChildren(
		"City-wide, including Temporary Refugee Response: ",
		el("strong", { "data-figure": "citywide-people", text: n(c.people) }), " people served · beds ",
		el("strong", { text: `${n(c.beds.occupied)} of ${n(c.beds.capacity_actual)}` }), " occupied (",
		el("strong", { "data-figure": "citywide-beds-rate", text: pct(c.beds.rate) }), ") · rooms ",
		el("strong", { text: `${n(c.rooms.occupied)} of ${n(c.rooms.capacity_actual)}` }), " occupied (",
		el("strong", { "data-figure": "citywide-rooms-rate", text: pct(c.rooms.rate) }), ").");

	const r = latest.refugee;
	setFigure("refugee-night", dateMedium(night));
	setFigure("refugee-people", n(r.people));
	setFigure("refugee-programs", n(r.programs));
	for (const kind of ["beds", "rooms"]) {
		setFigure(`refugee-${kind}-rate`, pct(r[kind].rate));
		setFigure(`refugee-${kind}-occupied`, n(r[kind].occupied));
		setFigure(`refugee-${kind}-capacity`, n(r[kind].capacity_actual));
		setMeter(`refugee-${kind}`, r[kind].rate);
	}

	const rs = document.getElementById("refugee-sectors");
	rs.replaceChildren(...Object.entries(r.by_sector).map(([name, t]) =>
		el("li", {}, el("b", { text: n(t.people) }), `${name} · ${t.programs} program${t.programs === 1 ? "" : "s"}`)));

	setFigure("sector-night", label.lastNight ? `Last night · ${dateMedium(night)}` : `Night of ${dateMedium(night)}`);
	setFigure("programs-night", label.lastNight ? `Last night · ${dateMedium(night)}` : `Night of ${dateMedium(night)}`);
	if (latest.source && latest.source.limitations) setFigure("limitation", latest.source.limitations);
}

function renderTurnaways() {
	const t = latest.turnaways;
	if (!t) {
		document.getElementById("turnaways").hidden = true;
		return;
	}
	setFigure("ta-unmatched", n(t.unmatched_callers));
	setFigure("ta-date", dateLong(t.date));
	setFigure("ta-date-short", dateMedium(t.date));
	setFigure("ta-single", n(t.single_call));
	setFigure("ta-repeat", n(t.repeat_caller));
}

function renderSectors() {
	const box = document.getElementById("sectors");
	const sectors = Object.entries(latest.headline.by_sector);
	const max = Math.max(...sectors.map(([, t]) => t.people));
	for (const [name, t] of sectors) {
		const cell = (kind) => {
			const b = t[kind];
			if (!b.programs) return el("div", { class: "sector-cell na" }, el("span", { class: "v", text: "—" }), `no ${kind === "beds" ? "bed" : "room"}-based programs`);
			return el("div", { class: "sector-cell" },
				el("span", { class: "v" }, pct(b.rate), el("small", { text: `${n(b.occupied)} of ${n(b.capacity_actual)}` })),
				el("div", { class: `hbar ${kind}`, role: "img", "aria-label": `${name}, ${kind}: ${pct(b.rate)} occupied, ${n(b.occupied)} of ${n(b.capacity_actual)}` },
					el("span", { style: `width:${Math.min(100, b.rate)}%` })));
		};
		box.append(el("div", { class: "sector" },
			el("div", { class: "sector-name", text: name }),
			el("div", { class: "sector-cell" },
				el("span", { class: "v", text: n(t.people) }),
				el("div", { class: "hbar people", role: "img", "aria-label": `${name}: ${n(t.people)} people served` },
					el("span", { style: `width:${(t.people / max) * 100}%` }))),
			cell("beds"),
			cell("rooms")));
	}
}

function renderSources() {
	const night = latest.occupancy_date;
	const occLink = el("a", { href: latest.source.url, text: "Daily Shelter & Overnight Service Occupancy & Capacity" });
	const refreshed = latest.source.last_refreshed ? dateMedium(latest.source.last_refreshed.slice(0, 10)) : null;
	setSource("occupancy", [`Source: City of Toronto Open Data, as of ${dateMedium(night)} — `, occLink, refreshed ? `, refreshed by the City ${refreshed}.` : "."]);
	setSource("occupancy-short", [`Night of ${dateMedium(night)}${refreshed ? `, refreshed ${refreshed}` : ""}.`]);
	setSource("history", [`Source: City of Toronto Open Data, as of ${dateMedium(night)} — `, occLink, `, every night from ${dateMedium(history.first_date)}.`]);
	const t = latest.turnaways;
	if (t) {
		const ciLink = el("a", { href: history.turnaways.source, text: "Central Intake calls, Service Queue Data" });
		const ciRef = t.last_refreshed ? dateMedium(t.last_refreshed.slice(0, 10)) : null;
		setSource("turnaways", [`Source: City of Toronto Open Data, as of ${dateMedium(t.date)} — `, ciLink, ciRef ? `, published monthly; refreshed by the City ${ciRef}.` : ", published monthly."]);
		setSource("turnaways-short", [`Latest operational date ${dateMedium(t.date)}.`]);
	}
	setSource("generated", [meta.generated_at ? `${meta.generated_at.replace("T", " ").replace("Z", " UTC")}` : "—"]);
}

// ---------------------------------------------------------------- table views (lazy)
function tableFor(kind) {
	if (kind === "history") {
		const s = history.series;
		const head = ["Night", "People, headline", "People, refugee response", "People, City-wide", "Bed rate, headline", "Room rate, headline"];
		const rows = history.dates.map((d, i) => [d, n(s.headline.people[i]), n(s.refugee.people[i]), n(s.headline.people[i] + s.refugee.people[i]),
			pct(rate(s.headline.beds_occupied[i], s.headline.beds_capacity[i])), pct(rate(s.headline.rooms_occupied[i], s.headline.rooms_capacity[i]))]).reverse();
		return [head, rows];
	}
	const t = history.turnaways;
	const head = ["Operational date", "Unmatched callers", "Single call", "Repeat caller"];
	const rows = t.dates.map((d, i) => [d, n(t.unmatched[i]), n(t.single_call[i]), n(t.repeat_caller[i])]).reverse();
	return [head, rows];
}

function wireTables() {
	document.querySelectorAll("details.data-table").forEach((d) => {
		d.addEventListener("toggle", () => {
			const box = d.querySelector(".table-scroll");
			if (!d.open || box.childElementCount) return;
			const [head, rows] = tableFor(d.dataset.table);
			box.append(el("table", { class: "simple" },
				el("thead", {}, el("tr", {}, ...head.map((h) => el("th", { scope: "col", text: h })))),
				el("tbody", {}, ...rows.map((r) => el("tr", {}, ...r.map((v) => el("td", { text: v })))))));
		});
	});
}

// ---------------------------------------------------------------- charts and controls
function drawAll() {
	drawPeople(history, ui.range);
	drawRates(history, ui.range);
	drawYoy(history, ui.yoy);
	if (history.turnaways.dates.length) drawTurnaways(history.turnaways);
}

function wireSegments(selector, key, redraw) {
	const seg = document.querySelector(selector);
	seg.addEventListener("click", (e) => {
		const b = e.target.closest("button");
		if (!b) return;
		ui[key] = b.dataset.value;
		seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
		redraw();
	});
}

// ---------------------------------------------------------------- theme
function effectiveTheme() {
	const set = document.documentElement.getAttribute("data-theme");
	if (set) return set;
	return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme, persist) {
	document.documentElement.setAttribute("data-theme", theme);
	if (persist) {
		try { localStorage.setItem("theme", theme); } catch (e) { /* storage blocked: theme lasts for this visit */ }
	}
	document.querySelectorAll("[data-theme-source]").forEach((s) => s.setAttribute("media", theme === "light" ? "all" : "not all"));
	const other = theme === "light" ? "dark" : "light";
	document.getElementById("theme-label").textContent = other === "light" ? "Light" : "Dark";
	document.getElementById("theme-toggle").setAttribute("aria-label", `Switch to ${other} mode`);
	document.querySelector('meta[name="theme-color"]').setAttribute("content", theme === "light" ? "#f3efe6" : "#08090a");
}

function wireTheme() {
	applyTheme(effectiveTheme(), false);
	document.getElementById("theme-toggle").addEventListener("click", () => {
		applyTheme(effectiveTheme() === "light" ? "dark" : "light", true);
		if (history) drawAll();
		refreshMapTheme();
	});
	window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
		let saved = null;
		try { saved = localStorage.getItem("theme"); } catch (e) { /* ignore */ }
		if (saved) return;
		document.documentElement.removeAttribute("data-theme");
		applyTheme(effectiveTheme(), false);
		if (history) drawAll();
		refreshMapTheme();
	});
}

// ---------------------------------------------------------------- boot
async function main() {
	wireTheme();
	try {
		[latest, history, meta] = await Promise.all([load("data/latest.json"), load("data/history.json"), load("data/meta.json")]);
	} catch (err) {
		const banner = document.getElementById("error");
		banner.textContent = `The data snapshot could not be loaded (${err.message}). Please try again later.`;
		banner.hidden = false;
		return;
	}
	renderHeadline();
	renderTurnaways();
	renderSectors();
	renderSources();
	wireTables();
	drawAll();
	wireSegments("[data-range]", "range", () => { drawPeople(history, ui.range); drawRates(history, ui.range); });
	wireSegments("[data-yoy]", "yoy", () => drawYoy(history, ui.yoy));
	initPrograms(latest);
	document.body.dataset.ready = "true";
}

main();
