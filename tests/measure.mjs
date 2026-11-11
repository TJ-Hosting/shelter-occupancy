// Simplify measurements (shelter-03 P2): document height and interactive controls, before and after,
// plus what a phone and a desktop visitor see without scrolling.
// - height: document.documentElement.scrollHeight once the figures are filled, at 390×844 and 1440×900;
// - controls: buttons, inputs, selects and disclosure summaries a visitor sees without opening anything
//   (each changes what the page shows);
//   links and map pins are counted on their own; tab stops = a Tab-key walk from the top of the page;
// - above the fold: the help line, the headline figures and the start of the trend chart, where they exist.
// Usage: node tests/measure.mjs http://127.0.0.1:8765/

import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8765/";
const browser = await chromium.launch();
const lines = [];

for (const [w, h] of [[390, 844], [1440, 900]]) {
	const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: "dark", locale: "en-CA", timezoneId: "America/Toronto", reducedMotion: "reduce" });
	const page = await ctx.newPage();
	await page.goto(base, { waitUntil: "networkidle" });
	await page.waitForSelector('body[data-ready="true"]');
	await page.waitForTimeout(400);
	const m = await page.evaluate(() => {
		// Shown = drawn and not inside a closed disclosure (a closed <details> still lays out its content in Chromium).
		const shown = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !e.closest("[hidden]") && !e.closest("details:not([open]) > :not(summary)"); };
		const all = (sel) => [...document.querySelectorAll(sel)].filter(shown);
		const controls = {
			buttons: all("button").length,
			inputs: all("input").length,
			selects: all("select").length,
			disclosures: all("details > summary").length,
		};
		const total = Object.values(controls).reduce((s, v) => s + v, 0);
		const inDom = document.querySelectorAll("button, input, select, details > summary").length;
		// Fully inside the first screen (top ≥ 0 and bottom ≤ the viewport's height), at scroll 0.
		const inFold = (sel) => {
			const nodes = [...document.querySelectorAll(sel)].filter(shown);
			if (!nodes.length) return "absent";
			return nodes.every((n) => { const r = n.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; }) ? "yes" : "no";
		};
		const chartTop = (() => { const c = document.querySelector("#chart-people"); if (!c) return "absent"; const r = c.getBoundingClientRect(); return r.top < window.innerHeight ? `yes (top at ${Math.round(r.top)} px)` : `no (top at ${Math.round(r.top)} px)`; })();
		return {
			height: document.documentElement.scrollHeight,
			controls, total, inDom,
			links: all("a[href]").length,
			pins: document.querySelectorAll("#map path.leaflet-interactive").length,
			help: inFold("#help"),
			headline: inFold(".headline [data-figure]"),
			chartTop,
		};
	});
	// Tab stops, counted the way a keyboard user meets them: Tab from the top until focus leaves the page or repeats.
	await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
	let tabs = 0;
	for (let i = 0; i < 600; i++) {
		await page.keyboard.press("Tab");
		const id = await page.evaluate(() => {
			const e = document.activeElement;
			if (!e || e === document.body) return null;
			if (!e.dataset.measureTab) e.dataset.measureTab = String(Math.random());
			else return "repeat";
			return "new";
		});
		if (id !== "new") break;
		tabs++;
	}
	m.tabStops = tabs;
	lines.push(`${w}×${h}: document height ${m.height} px · controls ${m.total} (buttons ${m.controls.buttons}, inputs ${m.controls.inputs}, selects ${m.controls.selects}, disclosures ${m.controls.disclosures}; ${m.inDom} in the page counting those inside closed disclosures) · links ${m.links} · map pins ${m.pins} · tab stops ${m.tabStops} (Tab key walk)`);
	lines.push(`   above the fold: help line ${m.help} · headline figures ${m.headline} · trend chart starts ${m.chartTop}`);
	await ctx.close();
}
await browser.close();
console.log(`Measure — ${new Date().toISOString()} — ${base}`);
console.log(lines.join("\n"));
