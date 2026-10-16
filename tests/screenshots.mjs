// Evidence screenshots (brief v2 §6): the dashboard at 1440 and 375 px in light and dark, with real
// figures and the "as of" date, the map with its pins, and the embed card at both sizes.
// Usage: node tests/screenshots.mjs http://127.0.0.1:8765/ evidence/screenshots

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] || "http://127.0.0.1:8765/";
const out = process.argv[3] || "evidence/screenshots";
mkdirSync(out, { recursive: true });

async function settle(page) {
	await page.waitForSelector('body[data-ready="true"]');
	await page.evaluate(async () => {	// visit every section so lazy images load, as a reader scrolling would
		for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 120)); }
		window.scrollTo({ top: 0, behavior: "instant" });
	});
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(1500);
}

const browser = await chromium.launch();
const shots = [];
for (const theme of ["dark", "light"]) {
	for (const [w, h] of [[1440, 900], [375, 812]]) {
		const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, locale: "en-CA", timezoneId: "America/Toronto", deviceScaleFactor: w === 375 ? 2 : 1 });
		const page = await ctx.newPage();
		const errors = [];
		page.on("pageerror", (e) => errors.push(e.message));
		page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
		await page.goto(base, { waitUntil: "networkidle" });
		await settle(page);
		const name = `dashboard-${w}-${theme}`;
		await page.screenshot({ path: `${out}/${name}-top.png` });
		await page.screenshot({ path: `${out}/${name}-full.jpg`, fullPage: true, type: "jpeg", quality: 82 });
		shots.push(`${name}-top.png`, `${name}-full.jpg`);
		// Element captures scroll the element into view; unstick the masthead and filter bar so they
		// don't float over it (capture only; the full-page shots above show the page as served).
		await page.addStyleTag({ content: ".masthead, .filters { position: static !important; }" });
		const map = page.locator(".map-wrap");
		await map.scrollIntoViewIfNeeded();
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(800);
		await map.screenshot({ path: `${out}/map-${w}-${theme}.png` });
		shots.push(`map-${w}-${theme}.png`);
		if (w === 1440) {
			await page.locator("#trends").screenshot({ path: `${out}/trends-${w}-${theme}.png` });
			shots.push(`trends-${w}-${theme}.png`);
		}
		const label = await page.locator('[data-figure="night-label"]').innerText();
		console.log(`${name}: ${label} · people ${await page.locator('[data-figure="headline-people"]').innerText()} · ${errors.length ? "ERRORS: " + errors.join("; ") : "no console errors"}`);
		await ctx.close();
	}
}
for (const [w, h] of [[320, 180], [600, 340]]) {
	const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: "en-CA", timezoneId: "America/Toronto", deviceScaleFactor: 2 });
	const page = await ctx.newPage();
	await page.goto(new URL("embed/", base).href, { waitUntil: "networkidle" });
	await page.waitForSelector('body[data-ready="true"]');
	await page.waitForTimeout(400);
	const fit = await page.evaluate(() => { const a = document.querySelector("a.card"); return a.scrollWidth <= a.clientWidth && a.scrollHeight <= a.clientHeight; });
	await page.screenshot({ path: `${out}/embed-${w}x${h}.png` });
	shots.push(`embed-${w}x${h}.png`);
	console.log(`embed ${w}×${h}: ${await page.locator("#night").innerText()} · ${fit ? "fits without overflow" : "OVERFLOWS"}`);
	await ctx.close();
}
await browser.close();
console.log(`\n${shots.length} files in ${out}/:\n${shots.join("\n")}`);
