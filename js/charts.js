// The one trend chart, drawn with uPlot (vendor/uplot-1.6.32). Colours come from the CSS tokens,
// validated against the dark chart surface (docs/DESIGN.md §3). The chart has a table twin
// (see app.js), so the tooltip never gates a value.

import { n, css, el, isoToSeconds, dateMedium } from "./format.js";

const DAY = 86400;
const charts = new Map();	// id → { u, ro }

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
	if (range === "1y") {	// the last 12 months; "all" is every night since 2021
		const from = isoToSeconds(dates[dates.length - 1]) - 365 * DAY;
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

function chartHeight(base) {
	return window.matchMedia("(max-width: 37.5rem)").matches ? Math.round(base * 0.82) : base;
}
