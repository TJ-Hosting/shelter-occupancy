// Charts, drawn with uPlot (vendor/uplot-1.6.32). Colours come from CSS tokens so light and
// dark mode each use their own validated steps (docs/DESIGN.md §3). Every chart has a table
// twin (see app.js), so the tooltip never gates a value.

import { n, pct, css, el, isoToSeconds, dateMedium, dateMonthDay } from "./format.js";

const DAY = 86400;
const charts = new Map();	// id → { u, ro }

// Same rounding as scripts/fetch_data.py: occupied ÷ capacity, one decimal, half-up, integers only.
export function rate(occupied, capacity) {
	if (!capacity) return null;
	return Math.floor((occupied * 2000 + capacity) / (capacity * 2)) / 10;
}

function alpha(hex, a) {
	const h = hex.replace("#", "");
	const v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
	return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`;
}

function compact(v) {
	if (Math.abs(v) >= 1000) {
		const k = v / 1000;
		return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
	}
	return String(v);
}

function axes(yFormat, xOpts = {}) {
	const axis = css("--axis");
	const grid = css("--grid");
	const font = `12px ${css("--body")}`;
	return [
		{ stroke: axis, font, grid: { show: false }, ticks: { stroke: grid, width: 1, size: 4 }, ...xOpts },
		{ stroke: axis, font, size: 52, gap: 6, grid: { stroke: grid, width: 1 }, ticks: { show: false }, values: (u, vals) => vals.map(yFormat) },
	];
}

// One tooltip for every series at the cursor's x; values lead, labels follow.
function tooltipPlugin(rowsFor) {
	let tip;
	return {
		hooks: {
			init: (u) => {
				tip = el("div", { class: "tip", "aria-hidden": "true" });
				u.root.querySelector(".u-over").appendChild(tip);
			},
			setCursor: (u) => {
				const { idx, left, top } = u.cursor;
				if (idx == null || left == null || left < 0) {
					tip.style.display = "none";
					return;
				}
				const spec = rowsFor(idx);
				if (!spec) {
					tip.style.display = "none";
					return;
				}
				tip.replaceChildren(el("div", { class: "t-date", text: spec.title }));
				for (const r of spec.rows) {
					tip.append(el("div", { class: "t-row" },
						el("i", { class: "t-key", style: `background:${r.color}` }),
						el("b", { text: r.value }),
						el("span", { text: r.label })));
				}
				tip.style.display = "block";
				const w = tip.offsetWidth;
				const overW = u.over.clientWidth;
				const x = left + 14 + w > overW ? left - w - 14 : left + 14;
				tip.style.left = `${Math.max(0, x)}px`;
				tip.style.top = `${Math.max(0, Math.min(top ?? 0, u.over.clientHeight - tip.offsetHeight) - 10)}px`;
			},
		},
	};
}

// Arrow keys move the crosshair, so keyboard users get the same readout as pointer users.
function keyboardPlugin() {
	return {
		hooks: {
			ready: (u) => {
				const root = u.root.parentElement;
				root.tabIndex = 0;
				root.addEventListener("keydown", (e) => {
					if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
					e.preventDefault();
					const xs = u.data[0];
					let idx = u.cursor.idx ?? xs.length - 1;
					const step = e.shiftKey ? 30 : 1;
					if (e.key === "ArrowLeft") idx = Math.max(0, idx - step);
					if (e.key === "ArrowRight") idx = Math.min(xs.length - 1, idx + step);
					if (e.key === "Home") idx = 0;
					if (e.key === "End") idx = xs.length - 1;
					const left = u.valToPos(xs[idx], "x");
					u.setCursor({ left, top: u.over.clientHeight / 3 });
				});
				root.addEventListener("blur", () => u.setCursor({ left: -10, top: -10 }));
			},
		},
	};
}

function mount(id, opts, data, height) {
	const box = document.getElementById(id);
	if (!box) return;
	const prev = charts.get(id);
	if (prev) {
		prev.ro.disconnect();
		prev.u.destroy();
	}
	box.replaceChildren();
	const width = Math.max(260, box.clientWidth);
	const u = new uPlot({ ...opts, width, height }, data, box);
	const ro = new ResizeObserver(() => {
		const w = Math.max(260, box.clientWidth);
		if (Math.abs(w - u.width) > 1) u.setSize({ width: w, height });
	});
	ro.observe(box);
	charts.set(id, { u, ro });
}

function baseOpts() {
	return {
		tzDate: (ts) => uPlot.tzDate(new Date(ts * 1e3), "Etc/UTC"),
		legend: { show: false },
		cursor: {
			drag: { x: false, y: false },
			points: { size: 9, width: 2, stroke: css("--surface"), fill: (u, si) => u.series[si]._stroke },
			y: false,
		},
		padding: [12, 12, 0, 0],
	};
}

function sliceRange(history, range) {
	const dates = history.dates;
	let start = 0;
	if (range !== "all") {
		const years = range === "3y" ? 3 : 1;
		const last = isoToSeconds(dates[dates.length - 1]);
		const from = last - years * 365 * DAY;
		start = dates.findIndex((d) => isoToSeconds(d) > from);
	}
	return { start, end: dates.length };
}

// ---------------------------------------------------------------- people served, stacked
export function drawPeople(history, range) {
	const { start, end } = sliceRange(history, range);
	const xs = history.dates.slice(start, end).map(isoToSeconds);
	// Stacked bottom to top: headline, Temporary Programs, Temporary Refugee Response. Each line is a running total.
	const h = history.series.headline.people.slice(start, end);
	const t = history.series.temporary.people.slice(start, end);
	const r = history.series.refugee.people.slice(start, end);
	const ht = h.map((v, i) => v + t[i]);
	const total = ht.map((v, i) => v + r[i]);
	const cPeople = css("--c-people");
	const cTemporary = css("--c-temporary");
	const cRefugee = css("--c-refugee");
	const max = Math.max(...total);
	const opts = {
		...baseOpts(),
		scales: { x: { time: true }, y: { range: [0, Math.ceil((max * 1.08) / 1000) * 1000] } },
		axes: axes(compact),
		series: [
			{},
			{ label: "Headline programs", stroke: cPeople, width: 2, fill: alpha(cPeople, 0.24), points: { show: false } },
			{ label: "Headline + Temporary Programs", stroke: cTemporary, width: 2, points: { show: false } },
			{ label: "City-wide", stroke: cRefugee, width: 2, points: { show: false } },
		],
		bands: [
			{ series: [2, 1], fill: alpha(cTemporary, 0.24) },
			{ series: [3, 2], fill: alpha(cRefugee, 0.24) },
		],
		plugins: [
			tooltipPlugin((i) => ({
				title: dateMedium(history.dates[start + i]),
				rows: [
					{ color: cPeople, value: n(h[i]), label: "headline programs" },
					{ color: cTemporary, value: n(t[i]), label: history.dates[start + i] < "2024-01-01" ? "COVID-19 Response (became Temporary Programs)" : "Temporary Programs" },
					{ color: cRefugee, value: n(r[i]), label: "Temporary Refugee Response" },
					{ color: css("--muted"), value: n(total[i]), label: "City-wide" },
				],
			})),
			keyboardPlugin(),
		],
	};
	mount("chart-people", opts, [xs, h, ht, total], chartHeight(280));
}

// ---------------------------------------------------------------- bed and room rates
export function drawRates(history, range) {
	const { start, end } = sliceRange(history, range);
	const s = history.series.headline;
	const xs = history.dates.slice(start, end).map(isoToSeconds);
	const beds = [];
	const rooms = [];
	for (let i = start; i < end; i++) {
		beds.push(rate(s.beds_occupied[i], s.beds_capacity[i]));
		rooms.push(rate(s.rooms_occupied[i], s.rooms_capacity[i]));
	}
	const vals = [...beds, ...rooms].filter((v) => v != null);
	const lo = Math.floor(Math.min(...vals) / 5) * 5;
	const hi = Math.max(100, Math.ceil(Math.max(...vals)));
	const note = document.querySelector('[data-figure="rates-axis-note"]');
	if (note) note.textContent = `The vertical axis starts at ${lo}%, not zero.`;
	const cBeds = css("--c-beds");
	const cRooms = css("--c-rooms");
	const opts = {
		...baseOpts(),
		scales: { x: { time: true }, y: { range: [lo, hi] } },
		axes: axes((v) => `${v}%`),
		series: [
			{},
			{ label: "Beds", stroke: cBeds, width: 2, points: { show: false } },
			{ label: "Rooms", stroke: cRooms, width: 2, points: { show: false } },
		],
		plugins: [
			tooltipPlugin((i) => ({
				title: dateMedium(history.dates[start + i]),
				rows: [
					{ color: cBeds, value: pct(beds[i]), label: `beds (${n(s.beds_occupied[start + i])} of ${n(s.beds_capacity[start + i])})` },
					{ color: cRooms, value: pct(rooms[i]), label: `rooms (${n(s.rooms_occupied[start + i])} of ${n(s.rooms_capacity[start + i])})` },
				],
			})),
			keyboardPlugin(),
		],
	};
	mount("chart-rates", opts, [xs, beds, rooms], chartHeight(280));
}

// ---------------------------------------------------------------- year over year
const REF_YEAR = 2024;	// a leap year, so 29 February has a slot
const REF0 = Date.UTC(REF_YEAR, 0, 1) / 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function drawYoy(history, measure) {
	const s = history.series.headline;
	const value = (i) => measure === "people" ? s.people[i]
		: measure === "beds" ? rate(s.beds_occupied[i], s.beds_capacity[i])
		: rate(s.rooms_occupied[i], s.rooms_capacity[i]);
	const years = [...new Set(history.dates.map((d) => d.slice(0, 4)))].slice(-6);	// six ramp steps
	const xs = Array.from({ length: 366 }, (_, i) => REF0 + i * DAY);
	const byYear = years.map(() => new Array(366).fill(null));
	history.dates.forEach((d, i) => {
		const yi = years.indexOf(d.slice(0, 4));
		if (yi < 0) return;
		const [, m, day] = d.split("-").map(Number);
		const slot = (Date.UTC(REF_YEAR, m - 1, day) / 1000 - REF0) / DAY;
		byYear[yi][slot] = value(i);
	});
	const colours = years.map((_, i) => css(`--y${6 - years.length + i + 1}`));
	const current = years.length - 1;
	const vals = byYear.flat().filter((v) => v != null);
	let range;
	const note = document.querySelector('[data-figure="yoy-axis-note"]');
	if (measure === "people") {
		const lo = Math.floor((Math.min(...vals) * 0.95) / 1000) * 1000;
		range = [lo, Math.ceil((Math.max(...vals) * 1.03) / 1000) * 1000];
		if (note) note.textContent = `People served each night. The vertical axis starts at ${n(lo)}, not zero, so the seasonal pattern is visible; the stacked chart above shows the full scale.`;
	} else {
		const lo = Math.floor(Math.min(...vals) / 5) * 5;
		range = [lo, Math.max(100, Math.ceil(Math.max(...vals)))];
		if (note) note.textContent = `Occupied ÷ actual capacity (${measure === "beds" ? "beds" : "rooms"}). The vertical axis starts at ${lo}%, not zero.`;
	}
	const fmtV = measure === "people" ? n : pct;
	const legend = document.getElementById("yoy-legend");
	legend.replaceChildren(...years.map((y, i) => el("li", {},
		el("span", { class: "key-line", style: `background:${colours[i]};height:${i === current ? 3 : 2}px` }),
		i === current ? `${y} (to ${dateMonthDay(history.dates[history.dates.length - 1])})` : y)));
	const monthStarts = MONTHS.map((_, m) => Date.UTC(REF_YEAR, m, 1) / 1000);
	const text = css("--text");
	const surface = css("--surface");
	const opts = {
		...baseOpts(),
		scales: { x: { time: true, range: [REF0, REF0 + 365 * DAY] }, y: { range } },
		axes: axes(measure === "people" ? compact : (v) => `${v}%`, {
			splits: () => monthStarts,
			// On narrow charts label every third month so the names never collide.
			values: (u, splits) => splits.map((v, i) => (u.width < 560 && i % 3 ? "" : MONTHS[new Date(v * 1000).getUTCMonth()])),
		}),
		series: [
			{},
			...years.map((y, i) => ({ label: y, stroke: colours[i], width: i === current ? 3 : 1.75, spanGaps: true, points: { show: false } })),
		],
		hooks: {
			draw: [(u) => {	// end dot and direct label for the current year only
				const arr = byYear[current];
				let last = arr.length - 1;
				while (last >= 0 && arr[last] == null) last--;
				if (last < 0) return;
				const ctx = u.ctx;
				const x = u.valToPos(xs[last], "x", true);
				const y = u.valToPos(arr[last], "y", true);
				const dpr = devicePixelRatio || 1;
				ctx.save();
				ctx.beginPath();
				ctx.arc(x, y, 5 * dpr, 0, Math.PI * 2);
				ctx.fillStyle = surface;
				ctx.fill();
				ctx.beginPath();
				ctx.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
				ctx.fillStyle = colours[current];
				ctx.fill();
				ctx.font = `600 ${13 * dpr}px ${css("--body")}`;
				ctx.fillStyle = text;
				ctx.textBaseline = "middle";
				const label = `${years[current]} · ${fmtV(arr[last])}`;
				const w = ctx.measureText(label).width;
				const right = u.bbox.left + u.bbox.width;
				ctx.fillText(label, x + 10 * dpr + w > right ? x - 10 * dpr - w : x + 10 * dpr, y - 14 * dpr);
				ctx.restore();
			}],
		},
		plugins: [
			tooltipPlugin((i) => {
				const rows = years.map((y, yi) => ({ color: colours[yi], value: fmtV(byYear[yi][i]), label: y })).filter((r, yi) => byYear[yi][i] != null).reverse();
				if (!rows.length) return null;
				return { title: dateMonthDay(new Date(xs[i] * 1000).toISOString()), rows };
			}),
			keyboardPlugin(),
		],
	};
	mount("chart-yoy", opts, [xs, ...byYear], chartHeight(340));
}

// ---------------------------------------------------------------- unmatched callers, last 12 months
export function drawTurnaways(ta) {
	const count = Math.min(365, ta.dates.length);
	const dates = ta.dates.slice(-count);
	const xs = dates.map(isoToSeconds);
	const ys = ta.unmatched.slice(-count);
	const c = css("--key");
	const opts = {
		...baseOpts(),
		scales: { x: { time: true }, y: { range: [0, Math.ceil((Math.max(...ys) * 1.1) / 50) * 50] } },
		axes: axes(compact),
		series: [{}, { label: "Unmatched callers", stroke: c, width: 2, fill: alpha(c, 0.1), points: { show: false } }],
		plugins: [
			tooltipPlugin((i) => ({ title: dateMedium(dates[i]), rows: [{ color: c, value: n(ys[i]), label: "unmatched callers" }] })),
			keyboardPlugin(),
		],
	};
	mount("chart-turnaways", opts, [xs, ys], 150);
}

function chartHeight(base) {
	return window.matchMedia("(max-width: 37.5rem)").matches ? Math.round(base * 0.82) : base;
}
