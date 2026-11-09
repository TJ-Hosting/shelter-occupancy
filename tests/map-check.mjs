// Map check (P3): run in a real headless browser against the built site.
// - every geocoded program is on the map (one pin per distinct coordinate);
// - the unplaced count is shown and each unplaced program is listed;
// - a pin's popup names the program, sector, capacity type and last night's occupancy;
// - the search and the beds / rooms / both control drive the map and the table together;
// - the skip link opens the programs table, which sits behind a disclosure (shelter-03).
// Usage: node tests/map-check.mjs http://127.0.0.1:8765/

import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const base = process.argv[2] || "http://127.0.0.1:8765/";
const latest = JSON.parse(readFileSync(new URL("../data/latest.json", import.meta.url)));
const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

const placed = latest.programs.filter((p) => p.geo);
const unplaced = latest.programs.filter((p) => !p.geo);
const coords = new Set(placed.map((p) => `${p.geo.lat},${p.geo.lon}`));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "en-CA", timezoneId: "America/Toronto" });
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForSelector('body[data-ready="true"]');

const pins = await page.locator("#map path.leaflet-interactive").count();
check("one pin per geocoded address", pins === coords.size, `${pins} pins drawn; ${coords.size} distinct coordinates for ${placed.length} geocoded programs`);

const mapCount = await page.locator("#map-count").innerText();
check("mapped and unplaced counts shown", mapCount.includes(`${placed.length} of ${latest.programs.length}`) && mapCount.includes(`${unplaced.length} have no published address`), mapCount);

const listed = await page.locator("#unplaced li").allInnerTexts();
check("every unplaced program listed", unplaced.every((p) => listed.some((t) => t.startsWith(p.program))) && listed.length === unplaced.length, `${listed.length} listed: ${unplaced.map((p) => p.program).join("; ")}`);

const note = await page.locator("#programs .section-head .sub").innerText();
check("not-a-bed-finder note visible", (await page.locator("#programs .section-head .sub").isVisible()) && note.includes("Not a bed-finder") && note.includes("416-338-4766"), note.replace(/\s+/g, " ").slice(0, 160));

// Click a single-program pin: the popup must carry the four facts from latest.json.
const single = placed.find((p) => placed.filter((q) => q.geo.lat === p.geo.lat && q.geo.lon === p.geo.lon).length === 1);
await page.locator("#map").scrollIntoViewIfNeeded();
const pin = page.locator(`#map path[data-ll="${single.geo.lat},${single.geo.lon}"]`);
let popupText = "";
if (await pin.count()) {
	await pin.click({ force: true });
	await page.waitForSelector(".leaflet-popup-content", { timeout: 5000 }).catch(() => {});
	popupText = await page.locator(".leaflet-popup-content").innerText().catch(() => "");
}
const unit = single.capacity_type;
const expectOcc = `${single.occupied.toLocaleString("en-CA")} of ${single.capacity_actual.toLocaleString("en-CA")} ${unit} occupied (${single.rate.toFixed(1)}%)`;
check("pin popup shows name, sector, type, occupancy",
	popupText.includes(single.program) && popupText.includes(single.sector) && popupText.includes(unit === "beds" ? "bed-based" : "room-based") && popupText.includes(expectOcc),
	popupText.replace(/\s+/g, " ") || "popup did not open");

// The search and the type control drive both the map and the table.
const term = "youth";
const hit = (p) => `${p.program} ${p.organization} ${p.location} ${p.address} ${p.shelter_group}`.toLowerCase().includes(term);
await page.fill('#filters input[name="q"]', term);
await page.waitForTimeout(300);
const found = latest.programs.filter(hit);
const foundCoords = new Set(found.filter((p) => p.geo).map((p) => `${p.geo.lat},${p.geo.lon}`));
const foundPins = await page.locator("#map path.leaflet-interactive").count();
const foundRows = await page.locator("#programs-table tbody tr").count();
check("search updates map and table", found.length > 0 && foundPins === foundCoords.size && foundRows === found.length,
	`"${term}": ${foundPins} pins (expected ${foundCoords.size}), ${foundRows} rows (expected ${found.length})`);

await page.fill('#filters input[name="q"]', "");
await page.click('#filters [data-type] button[data-value="rooms"]');
await page.waitForTimeout(300);
const rooms = placed.filter((p) => p.capacity_type === "rooms");
const roomPins = await page.locator("#map path.leaflet-interactive").count();
const roomRows = await page.locator("#programs-table tbody tr").count();
check("beds / rooms / both control updates map and table", roomPins === new Set(rooms.map((p) => `${p.geo.lat},${p.geo.lon}`)).size && roomRows === latest.programs.filter((p) => p.capacity_type === "rooms").length,
	`${roomPins} pins and ${roomRows} rows for room programs`);
await page.click('#filters [data-type] button[data-value=""]');

// Keyboard and screen-reader users: the skip link past the pins opens the table.
await page.focus(".skip-map");
await page.keyboard.press("Enter");
await page.waitForTimeout(300);
const open = await page.evaluate(() => document.getElementById("all-programs").open);
const rowsAll = await page.locator("#programs-table tbody tr").count();
check("skip link opens the programs table", open && rowsAll === latest.programs.length, `table ${open ? "open" : "closed"}, ${rowsAll} rows`);

// City text is text: a program name carrying markup must reach the pin tooltip as text, never as HTML
// (Leaflet sets string tooltip content with innerHTML; QA finding M2, 9 Nov 2026).
{
	const evil = '<img src=x onerror="window.__xss=1">Markup test';
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-CA", timezoneId: "America/Toronto" });
	const p2 = await ctx.newPage();
	const target = single;
	await p2.route("**/data/latest.json", async (route) => {
		const body = JSON.parse(JSON.stringify(latest));
		body.programs.find((p) => p.id === target.id).program = evil;
		await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
	});
	await p2.goto(base, { waitUntil: "networkidle" });
	await p2.waitForSelector('body[data-ready="true"]');
	const pin2 = p2.locator(`#map path[data-ll="${target.geo.lat},${target.geo.lon}"]`);
	await p2.locator("#map").scrollIntoViewIfNeeded();
	await pin2.hover({ force: true });
	await p2.waitForSelector(".leaflet-tooltip", { timeout: 5000 }).catch(() => {});
	const r = await p2.evaluate(() => ({
		xss: window.__xss === 1,
		injected: document.querySelectorAll(".leaflet-tooltip img, #programs-table img, #unplaced img").length,
		tip: document.querySelector(".leaflet-tooltip")?.textContent || "",
	}));
	check("City text stays text in the pin tooltip", !r.xss && r.injected === 0 && r.tip.includes("<img"), `script ran: ${r.xss}; injected elements: ${r.injected}; tooltip text: ${r.tip.slice(0, 60)}`);
	await ctx.close();
}

await browser.close();

const pass = results.filter((r) => r.ok).length;
console.log(`Map check — ${new Date().toISOString()} — ${base}`);
console.log(`Snapshot night: ${latest.occupancy_date}; ${latest.programs.length} programs, ${placed.length} geocoded, ${unplaced.length} unplaced.`);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}\n      ${r.detail}`);
console.log(`\n${pass}/${results.length} checks passed.`);
process.exit(pass === results.length ? 0 : 1);
