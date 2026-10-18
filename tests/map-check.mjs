// Map check (P3): run in a real headless browser against the built site.
// - every geocoded program is on the map (one pin per distinct coordinate);
// - the unplaced count is shown and each unplaced program is listed;
// - a pin's popup names the program, sector, capacity type and last night's occupancy;
// - the filters drive the map and the table together.
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

const note = await page.locator(".notice").innerText();
check("not-a-bed-finder note visible", (await page.locator(".notice").isVisible()) && note.includes("This map is not a bed-finder") && note.includes("416-338-4766"), note.replace(/\s+/g, " ").slice(0, 160));

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

// Filters drive both the map and the table.
await page.selectOption('#filters select[name="sector"]', "Youth");
await page.waitForTimeout(300);
const youth = placed.filter((p) => p.sector === "Youth");
const youthCoords = new Set(youth.map((p) => `${p.geo.lat},${p.geo.lon}`));
const youthPins = await page.locator("#map path.leaflet-interactive").count();
const youthRows = await page.locator("#programs-table tbody tr").count();
check("sector filter updates map and table", youthPins === youthCoords.size && youthRows === latest.programs.filter((p) => p.sector === "Youth").length,
	`${youthPins} pins (expected ${youthCoords.size}), ${youthRows} rows (expected ${latest.programs.filter((p) => p.sector === "Youth").length})`);

await page.selectOption('#filters select[name="sector"]', "");
await page.selectOption('#filters select[name="type"]', "rooms");
await page.waitForTimeout(300);
const rooms = placed.filter((p) => p.capacity_type === "rooms");
const roomPins = await page.locator("#map path.leaflet-interactive").count();
check("capacity-type filter updates map", roomPins === new Set(rooms.map((p) => `${p.geo.lat},${p.geo.lon}`)).size, `${roomPins} pins for room programs`);

await browser.close();

const pass = results.filter((r) => r.ok).length;
console.log(`Map check — ${new Date().toISOString()} — ${base}`);
console.log(`Snapshot night: ${latest.occupancy_date}; ${latest.programs.length} programs, ${placed.length} geocoded, ${unplaced.length} unplaced.`);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}\n      ${r.detail}`);
console.log(`\n${pass}/${results.length} checks passed.`);
process.exit(pass === results.length ? 0 : 1);
