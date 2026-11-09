// Programs: one search box and one beds / rooms / both control drive both the map (Leaflet,
// vendor/leaflet-1.9.4) and the table, which sits behind a disclosure.
// Pins sit exactly at the coordinates in data/latest.json (City Address Points first,
// Nominatim fallback). Programs without coordinates are listed, never guessed.

import { n, pct, el, css } from "./format.js";

// OpenStreetMap's standard tiles, used within the OSMF tile usage policy: visible attribution,
// no prefetching, the browser's own User-Agent and Referer. Kept in one place so it can be
// switched without touching the rest (the policy's recommendation).
const TILES = {
	url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
	options: {
		maxZoom: 19,
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://www.openstreetmap.org/fixthemap">Report a map issue</a>',
	},
};
const TORONTO = [43.7, -79.4];

const state = { q: "", type: "", sort: "program", dir: 1 };
let programs = [];
let map, layer;

export function initPrograms(latest) {
	programs = latest.programs;
	const form = document.getElementById("filters");
	form.q.addEventListener("input", () => {
		state.q = form.q.value.trim().toLowerCase();
		update(true);
	});
	const seg = form.querySelector("[data-type]");
	seg.addEventListener("click", (e) => {
		const b = e.target.closest("button");
		if (!b) return;
		state.type = b.dataset.value;
		seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
		update(true);
	});
	// The skip link lands in the table even though it sits in a closed disclosure: open it first.
	const all = document.getElementById("all-programs");
	const reveal = () => { if (location.hash === "#all-programs") all.open = true; };
	document.querySelector(".skip-map").addEventListener("click", () => { all.open = true; });
	window.addEventListener("hashchange", reveal);
	reveal();
	document.querySelectorAll("#programs-table th button").forEach((b) => b.addEventListener("click", () => {
		const key = b.dataset.sort;
		state.dir = state.sort === key ? -state.dir : (["people", "occupied", "rate"].includes(key) ? -1 : 1);
		state.sort = key;
		update(false);
	}));
	initMap();
	update(true);
}

function filtered() {
	return programs.filter((p) =>
		(!state.type || p.capacity_type === state.type) &&
		(!state.q || `${p.program} ${p.organization} ${p.location} ${p.address} ${p.shelter_group}`.toLowerCase().includes(state.q)));
}

function update(refit) {
	const rows = filtered();
	const placed = rows.filter((p) => p.geo);
	const addresses = new Set(placed.map((p) => `${p.geo.lat},${p.geo.lon}`));
	const people = rows.reduce((s, p) => s + p.people, 0);
	document.getElementById("filter-count").textContent =
		`${n(rows.length)} of ${n(programs.length)} programs · ${n(people)} people`;
	document.getElementById("map-count").textContent =
		`${n(placed.length)} of ${n(rows.length)} programs shown are mapped, at ${n(addresses.size)} addresses. ` +
		`${n(rows.length - placed.length)} ${rows.length - placed.length === 1 ? "has" : "have"} no published address and ${rows.length - placed.length === 1 ? "is" : "are"} listed below the map.`;
	renderUnplaced(rows.filter((p) => !p.geo));
	renderTable(rows);
	drawMarkers(rows, refit);
}

// ---------------------------------------------------------------- table
function renderTable(rows) {
	const key = state.sort;
	const sorted = [...rows].sort((a, b) => {
		const av = a[key], bv = b[key];
		if (typeof av === "number" || typeof bv === "number") return ((av ?? -1) - (bv ?? -1)) * state.dir;
		return String(av).localeCompare(String(bv)) * state.dir;
	});
	document.querySelectorAll("#programs-table th").forEach((th) => {
		const b = th.querySelector("button");
		th.setAttribute("aria-sort", b.dataset.sort === key ? (state.dir === 1 ? "ascending" : "descending") : "none");
	});
	const tbody = document.querySelector("#programs-table tbody");
	tbody.replaceChildren(...sorted.map((p) => {
		const unit = p.capacity_type === "beds" ? "beds" : "rooms";
		return el("tr", {},
			el("td", {},
				el("div", { class: "p-name", text: p.program }),
				el("div", { class: "p-org", text: `${p.organization}${p.address ? " · " + p.address : ""}` })),
			el("td", { text: p.sector }),
			el("td", { text: p.area || "(blank)" }),
			el("td", { text: unit === "beds" ? "Beds" : "Rooms" }),
			el("td", { class: "r", text: n(p.people) }),
			el("td", { class: "r", text: `${n(p.occupied)} / ${n(p.capacity_actual)} ${unit}` }),
			el("td", { class: "r" }, pct(p.rate), p.near_full ? el("span", { class: "full-tag", title: "At or near full: 95% or more occupied" }, el("i", { class: "warn-mark", "aria-hidden": "true" }), "≥ 95") : null));
	}));
	if (!sorted.length) tbody.append(el("tr", {}, el("td", { colspan: "7", text: "No program matches this search." })));
}

function renderUnplaced(rows) {
	const box = document.getElementById("unplaced");
	if (!rows.length) {
		box.replaceChildren();
		return;
	}
	box.replaceChildren(
		el("p", { style: "margin:0" }, el("strong", { text: `Not on the map (${rows.length}): ` }), "the City publishes no street address for these programs, so they are listed rather than placed."),
		el("ul", {}, ...rows.map((p) => el("li", {}, `${p.program} — ${p.sector}, ${p.capacity_type}, ${n(p.occupied)} of ${n(p.capacity_actual)} occupied (${pct(p.rate)})`))));
}

// ---------------------------------------------------------------- map
function initMap() {
	if (typeof L === "undefined") return;
	// No initial setView: the first drawMarkers() fits the pins, so no tiles are fetched for a throwaway view.
	map = L.map("map", { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
	L.tileLayer(TILES.url, TILES.options).addTo(map);
	layer = L.layerGroup().addTo(map);
	map.on("focus", () => map.scrollWheelZoom.enable());
	map.on("blur", () => map.scrollWheelZoom.disable());
}

function drawMarkers(rows, refit) {
	if (!map) return;
	layer.clearLayers();
	const groups = new Map();
	for (const p of rows) {
		if (!p.geo) continue;
		const k = `${p.geo.lat},${p.geo.lon}`;
		if (!groups.has(k)) groups.set(k, []);
		groups.get(k).push(p);
	}
	// One pin colour: the type is chosen with the beds / rooms / both control, and each popup names it.
	const surface = css("--surface");
	const pin = css("--key");
	const bounds = [...groups.values()].map((g) => [g[0].geo.lat, g[0].geo.lon]);
	// Set the view before adding markers: Leaflet only creates marker elements once the map has a view.
	if (refit && bounds.length) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15, animate: false });
	else if (refit) map.setView(TORONTO, 11, { animate: false });
	for (const group of groups.values()) {
		const { lat, lon } = group[0].geo;
		const several = group.length > 1;
		const m = L.circleMarker([lat, lon], {
			radius: several ? 9 : 6, color: several ? css("--text") : surface, weight: 2, fillColor: pin, fillOpacity: 1,
		});
		m.bindPopup(() => popup(group), { maxWidth: 320 });
		// A DOM node, not a string: Leaflet sets string content as HTML, and this text is the City's.
		m.bindTooltip(el("span", { text: group.length > 1 ? `${group.length} programs · ${group[0].address}` : group[0].program }), { direction: "top", offset: [0, -6] });
		m.addTo(layer);
		m.getElement()?.setAttribute("data-ll", `${lat},${lon}`);	// lets tests/map-check.mjs find a pin
	}
}

function popup(group) {
	const box = el("div", {}, el("div", { class: "pop-addr", text: `${group[0].address}${group[0].city ? ", " + group[0].city : ""}` }));
	for (const p of group) {
		const unit = p.capacity_type === "beds" ? "beds" : "rooms";
		box.append(el("div", { class: "pop-prog" },
			el("strong", { text: p.program }),
			el("div", { text: `${p.sector} · ${unit === "beds" ? "bed-based" : "room-based"} · ${p.area}` }),
			el("div", {}, el("span", { class: "pop-occ", text: `${n(p.occupied)} of ${n(p.capacity_actual)} ${unit} occupied (${pct(p.rate)})` }), ` · ${n(p.people)} ${p.people === 1 ? "person" : "people"}`)));
	}
	return box;
}
