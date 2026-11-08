// Toronto shelter occupancy — page script. Reads data/latest.json, data/history.json and
// data/meta.json (built daily by scripts/fetch_data.py) and fills every figure. Nothing on the
// page is computed beyond what docs/DATA.md describes.

import { n, pct, dateLong, dateMedium, nightLabel, el } from "./format.js";
import { drawPeople } from "./charts.js";
import { initPrograms } from "./programs.js";

const ui = { range: "1y" };
let latest, history, meta;

function setFigure(name, text) {
	document.querySelectorAll(`[data-figure="${name}"]`).forEach((node) => { node.textContent = text; });
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
	setFigure("night-short", label.lastNight ? `last night, ${dateMedium(night)}` : `night of ${dateMedium(night)}`);
	document.body.dataset.lastNight = String(label.lastNight);

	const h = latest.headline;
	setFigure("headline-people", n(h.people));
	setFigure("headline-programs", n(h.programs));
	setFigure("headline-near-full", n(h.near_full));
	for (const kind of ["beds", "rooms"]) {
		setFigure(`headline-${kind}-rate`, pct(h[kind].rate));
		setFigure(`headline-${kind}-occupied`, n(h[kind].occupied));
		setFigure(`headline-${kind}-capacity`, n(h[kind].capacity_actual));
	}

	// One line for the rest: the two areas kept out of the headline, and the City-wide total.
	document.querySelector('[data-figure="rest-line"]').replaceChildren(
		"Also that night, shown apart from the headline: ",
		el("strong", { "data-figure": "temporary-people", text: n(latest.temporary.people) }), " people in Temporary Programs and ",
		el("strong", { "data-figure": "refugee-people", text: n(latest.refugee.people) }), " in the Temporary Refugee Response. City-wide: ",
		el("strong", { "data-figure": "citywide-people", text: n(latest.citywide.people) }), " people served.");

	setFigure("programs-night", dateMedium(night));
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
}

function renderSources() {
	const night = latest.occupancy_date;
	const occLink = el("a", { href: latest.source.url, text: "Daily Shelter & Overnight Service Occupancy & Capacity" });
	const refreshed = latest.source.last_refreshed ? dateMedium(latest.source.last_refreshed.slice(0, 10)) : null;
	setSource("occupancy", [`Source: City of Toronto Open Data, as of ${dateMedium(night)} — `, occLink, refreshed ? `, refreshed by the City ${refreshed}.` : "."]);
	setSource("occupancy-short", [`Night of ${dateMedium(night)}${refreshed ? `, refreshed ${refreshed}` : ""}.`]);
	setSource("history", [`Source: City of Toronto Open Data, as of ${dateMedium(night)} — `, occLink, `, every night from ${dateMedium(history.first_date)}.`]);
	const t = latest.turnaways;
	if (t) setSource("turnaways-short", [`Latest operational date ${dateMedium(t.date)}, published monthly.`]);
	setSource("generated", [meta.generated_at ? `${meta.generated_at.replace("T", " ").replace("Z", " UTC")}` : "—"]);
}

// ---------------------------------------------------------------- the chart's table (built on first open)
function wireTable() {
	const d = document.querySelector('details[data-table="history"]');
	d.addEventListener("toggle", () => {
		const box = d.querySelector(".table-scroll");
		if (!d.open || box.childElementCount) return;
		const s = history.series;
		const head = ["Night", "People, headline", "People, Temporary Programs (COVID-19 Response before 2024)", "People, Temporary Refugee Response", "People, City-wide"];
		const rows = history.dates.map((day, i) => [day, n(s.headline.people[i]), n(s.temporary.people[i]), n(s.refugee.people[i]),
			n(s.headline.people[i] + s.temporary.people[i] + s.refugee.people[i])]).reverse();
		box.append(el("table", { class: "simple" },
			el("thead", {}, el("tr", {}, ...head.map((h) => el("th", { scope: "col", text: h })))),
			el("tbody", {}, ...rows.map((r) => el("tr", {}, ...r.map((v) => el("td", { text: v })))))));
	});
}

function wireRange() {
	const seg = document.querySelector("[data-range]");
	seg.addEventListener("click", (e) => {
		const b = e.target.closest("button");
		if (!b) return;
		ui.range = b.dataset.value;
		seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
		drawPeople(history, ui.range);
	});
}

// ---------------------------------------------------------------- boot
async function main() {
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
	renderSources();
	wireTable();
	drawPeople(history, ui.range);
	wireRange();
	initPrograms(latest);
	document.body.dataset.ready = "true";
}

main();
