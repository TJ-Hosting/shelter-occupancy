// Real-browser check (shelter-02 P1; dark only since shelter-03): the dashboard in an installed, headed browser.
// - widths 375, 390, 768 and 1440: no horizontal scroll, dark only, figures filled, screenshot;
// - the first screen: help line and headline figures at 390 × 844, and the chart's start at 1440 × 900;
// - reduced motion: no animation runs and smooth scrolling is off;
// - keyboard: Tab from the beds / rooms / both control to the skip link, which opens the programs
//   table; sort with Enter, focus ring visible;
// - map: pins drawn, a pin's popup opens;
// - the embed card at 320×180 and 600×340, and 404.html;
// - console: errors, failed requests and HTTP ≥ 400 responses, per page.
// Not part of tests/run-all.sh (it opens browser windows).
// Usage: node tests/browser-check.mjs <base url> <chrome|msedge> <shots dir>

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] || "http://127.0.0.1:8765/";
const channel = process.argv[3] || "chrome";
const out = process.argv[4] || "evidence/laptop-check/shots";
mkdirSync(out, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });

// BROWSER_PATH overrides the channel's install path (e.g. a Linux box with only Chrome for Testing).
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH, headless: false } : { channel, headless: false });
const version = browser.version();

async function open(url, opts) {
	const ctx = await browser.newContext({ locale: "en-CA", timezoneId: "America/Toronto", deviceScaleFactor: 1, ...opts });
	const page = await ctx.newPage();
	const problems = [];
	page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
	page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(`console ${m.type()}: ${m.text()}`); });
	page.on("requestfailed", (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
	page.on("response", (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
	await page.goto(url, { waitUntil: "networkidle" });
	return { ctx, page, problems };
}

async function settle(page) {
	await page.waitForSelector('body[data-ready="true"]', { timeout: 30000 });
	await page.evaluate(async () => {	// visit every section so lazy images and tiles load
		for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 100)); }
		window.scrollTo({ top: 0, behavior: "instant" });
	});
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(1200);
}

// ---------------------------------------------------------------- widths (dark only, whatever the system asks for)
for (const scheme of ["dark", "light"]) {
	for (const [w, h] of [[375, 812], [390, 844], [768, 1024], [1440, 900]]) {
		if (scheme === "light" && w !== 1440) continue;	// one light-preference run proves the page stays dark
		const { ctx, page, problems } = await open(base, { viewport: { width: w, height: h }, colorScheme: scheme });
		await settle(page);
		const m = await page.evaluate(() => {
			const inView = (sel) => [...document.querySelectorAll(sel)].every((n) => { const r = n.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
			return {
				overflow: document.documentElement.scrollWidth - window.innerWidth,
				bg: getComputedStyle(document.body).backgroundColor,
				scheme: getComputedStyle(document.documentElement).colorScheme,
				label: document.querySelector('[data-figure="night-label"]').textContent.trim(),
				people: document.querySelector('[data-figure="headline-people"]').textContent.trim(),
				dashes: [...document.querySelectorAll("[data-figure]")].filter((n) => n.textContent.trim() === "—" && n.offsetParent && !n.closest("details:not([open])")).map((n) => n.dataset.figure),
				hero: document.querySelector(".hero-art img").currentSrc.split("/").pop(),
				help: inView("#help"),
				figures: inView(".headline dd"),
				chartTop: Math.round(document.getElementById("chart-people").getBoundingClientRect().top),
			};
		});
		const name = `${channel}-${w}${scheme === "light" ? "-light-preference" : ""}`;
		await page.screenshot({ path: `${out}/${name}-top.jpg`, type: "jpeg", quality: 80 });
		if (scheme === "dark") await page.screenshot({ path: `${out}/${name}-full.jpg`, fullPage: true, type: "jpeg", quality: 60 });
		const tag = `${w}px${scheme === "light" ? " (light system setting)" : ""}`;
		check(`${tag}: no horizontal scroll`, m.overflow <= 0, `scrollWidth − innerWidth = ${m.overflow}px`);
		check(`${tag}: dark only`, m.bg === "rgb(11, 14, 19)" && m.scheme === "dark", `body ${m.bg}, color-scheme ${m.scheme}`);
		check(`${tag}: figures filled`, m.people !== "—" && m.dashes.length === 0, `people ${m.people}; label "${m.label}"; hero ${m.hero}; unfilled: ${m.dashes.join(", ") || "none"}`);
		if (w === 390) check("390 × 844: help line and headline figures on the first screen", m.help && m.figures, `help ${m.help}, figures ${m.figures}`);
		if (w === 1440 && scheme === "dark") check("1440 × 900: help line, figures and the chart's start on the first screen", m.help && m.figures && m.chartTop < h, `help ${m.help}, figures ${m.figures}, chart top at ${m.chartTop}px`);
		check(`${tag}: console clean`, problems.length === 0, problems.join(" | ") || "no errors, warnings or failed requests");
		await ctx.close();
	}
}

// ---------------------------------------------------------------- reduced motion
{
	const { ctx, page, problems } = await open(base, { viewport: { width: 1440, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" });
	await page.waitForSelector('body[data-ready="true"]');
	const anim = await page.evaluate(() => ({
		running: document.getAnimations().filter((a) => a.playState === "running").length,
		scroll: getComputedStyle(document.documentElement).scrollBehavior,
	}));
	check("reduced motion: no animation runs, smooth scrolling off", anim.running === 0 && anim.scroll === "auto", JSON.stringify(anim));
	check("reduced motion: console clean", problems.length === 0, problems.join(" | ") || "clean");
	await page.screenshot({ path: `${out}/${channel}-1440-dark-reduced-motion.jpg`, type: "jpeg", quality: 80 });
	await ctx.close();
}

// ---------------------------------------------------------------- keyboard through the programs table
{
	const { ctx, page, problems } = await open(base, { viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
	await settle(page);
	await page.focus('#filters [data-type] button[data-value=""]');
	await page.keyboard.press("Tab");
	const first = await page.evaluate(() => ({ cls: document.activeElement.className, text: document.activeElement.textContent.trim() }));
	check("keyboard: the first stop after the map's controls skips the map", first.cls.includes("skip-map"), `"${first.text}" (${first.cls})`);
	await page.waitForTimeout(1200);	// the page scrolls smoothly to the focused link
	await page.screenshot({ path: `${out}/${channel}-1440-dark-skip-map-focus.jpg`, type: "jpeg", quality: 80 });
	await page.keyboard.press("Enter");
	const opened = await page.evaluate(() => document.getElementById("all-programs").open);
	check("keyboard: the skip link opens the programs table", opened, `details#all-programs open = ${opened}`);
	const path = [];
	let onHeader = false;
	for (let i = 0; i < 40 && !onHeader; i++) {
		await page.keyboard.press("Tab");
		const a = await page.evaluate(() => {
			const e = document.activeElement;
			return { tag: e.tagName.toLowerCase(), sort: e.dataset?.sort || null, id: e.id || null, cls: e.className && typeof e.className === "string" ? e.className.split(" ")[0] : null, inTable: Boolean(e.closest("#programs-table")) };
		});
		path.push(a.sort ? `th:${a.sort}` : `${a.tag}${a.id ? "#" + a.id : a.cls ? "." + a.cls : ""}`);
		onHeader = a.inTable && a.sort;
	}
	check("keyboard: after the skip link, Tab reaches the table's sort buttons", onHeader, `Tab path after Enter on the skip link: ${path.join(" → ")}`);
	const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`; });
	check("keyboard: focus ring visible on the sort button", !ring.startsWith("none") && !ring.includes(" 0px"), ring);
	// Walk the remaining header buttons, then sort by People with Enter (twice: ascending, descending).
	const heads = [];
	for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); heads.push(await page.evaluate(() => document.activeElement.dataset?.sort || document.activeElement.tagName)); }
	check("keyboard: every column header is a reachable button", heads.join(",") === "sector,area,capacity_type,people,occupied,rate", heads.join(", "));
	await page.focus('#programs-table button[data-sort="people"]');
	await page.keyboard.press("Enter");
	const s1 = await page.getAttribute('#programs-table th:has(button[data-sort="people"])', "aria-sort");
	const first1 = await page.locator("#programs-table tbody tr td:nth-child(5)").first().innerText();
	await page.keyboard.press("Enter");
	const s2 = await page.getAttribute('#programs-table th:has(button[data-sort="people"])', "aria-sort");
	const first2 = await page.locator("#programs-table tbody tr td:nth-child(5)").first().innerText();
	check("keyboard: Enter sorts by People and toggles direction", s1 !== "none" && s2 !== "none" && s1 !== s2, `aria-sort ${s1} (first row ${first1}) → ${s2} (first row ${first2})`);
	await page.locator(".table-wrap").scrollIntoViewIfNeeded();
	await page.locator(".table-wrap").screenshot({ path: `${out}/${channel}-1440-dark-table-keyboard.jpg`, type: "jpeg", quality: 80 });
	check("keyboard: console clean", problems.length === 0, problems.join(" | ") || "clean");
	await ctx.close();
}

// ---------------------------------------------------------------- map pins and a popup
for (const theme of ["dark"]) {
	const { ctx, page, problems } = await open(base, { viewport: { width: 1440, height: 900 }, colorScheme: theme });
	await settle(page);
	await page.locator("#map").scrollIntoViewIfNeeded();
	const pins = await page.locator("#map path.leaflet-interactive").count();
	const pin = page.locator("#map path.leaflet-interactive").nth(Math.floor(pins / 2));
	await pin.click({ force: true });
	await page.waitForSelector(".leaflet-popup-content", { timeout: 5000 }).catch(() => {});
	const popup = (await page.locator(".leaflet-popup-content").innerText().catch(() => "")).replace(/\s+/g, " ");
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(600);
	await page.locator(".map-wrap").screenshot({ path: `${out}/${channel}-map-1440-${theme}.jpg`, type: "jpeg", quality: 80 });
	check(`map ${theme}: pins drawn and a popup opens`, pins > 0 && popup.length > 20, `${pins} pins; popup: ${popup.slice(0, 140)}`);
	check(`map ${theme}: console clean`, problems.length === 0, problems.join(" | ") || "clean");
	await ctx.close();
}

// ---------------------------------------------------------------- no image drawn wider than its pixels (Aco, 17 Oct 2026)
for (const theme of ["dark"]) {
	for (const [w, h] of [[375, 812], [390, 844], [768, 1024], [1440, 900], [1920, 1080]]) {
		const { ctx, page } = await open(base, { viewport: { width: w, height: h }, colorScheme: theme, reducedMotion: "reduce" });
		await settle(page);
		const over = (await page.evaluate(async () => Promise.all([...document.images].map(async (i) => {
			const r = i.getBoundingClientRect();
			if (!r.width || !i.currentSrc || i.closest("#map")) return null;
			const raw = new Image();	// the file's own pixels (naturalWidth on a srcset image is density-corrected)
			raw.src = i.currentSrc;
			await raw.decode().catch(() => {});
			const s = getComputedStyle(i).objectFit === "cover" ? Math.max(r.width / raw.naturalWidth, r.height / raw.naturalHeight) : r.width / raw.naturalWidth;
			return { src: i.currentSrc.split("/").pop(), s: Math.round(s * 1000) / 1000 };
		})))).filter((x) => x && x.s > 1.005);
		check(`${w}px ${theme}: no image drawn wider than its source (CSS px)`, over.length === 0, over.map((o) => `${o.src} ×${o.s}`).join(", ") || "none upscaled");
		await ctx.close();
	}
}

// ---------------------------------------------------------------- embed card and 404
for (const [w, h] of [[320, 180], [600, 340]]) {
	const { ctx, page, problems } = await open(new URL("embed/", base).href, { viewport: { width: w, height: h }, deviceScaleFactor: 2 });
	await page.waitForSelector('body[data-ready="true"]');
	await page.waitForTimeout(300);
	const e = await page.evaluate(() => { const a = document.querySelector("a.card"); return { fit: a.scrollWidth <= a.clientWidth && a.scrollHeight <= a.clientHeight, night: document.getElementById("night").textContent, people: document.getElementById("people").textContent }; });
	await page.screenshot({ path: `${out}/${channel}-embed-${w}x${h}.jpg`, type: "jpeg", quality: 85 });
	check(`embed ${w}×${h}: fits, filled`, e.fit && e.people !== "—", `${e.night} · ${e.people} people`);
	check(`embed ${w}×${h}: console clean`, problems.length === 0, problems.join(" | ") || "clean");
	await ctx.close();
}
{
	const { ctx, page, problems } = await open(new URL("404.html", base).href, { viewport: { width: 375, height: 812 } });
	await page.waitForTimeout(500);
	const t = await page.locator("h1").innerText();
	const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
	await page.screenshot({ path: `${out}/${channel}-404-375.jpg`, type: "jpeg", quality: 80 });
	check("404.html renders with its background and helpline", t.toLowerCase().includes("isn't here") && bg.includes("sh-hero-noir"), `h1 "${t}"; background ${bg.slice(0, 80)}`);
	check("404.html: console clean", problems.length === 0, problems.join(" | ") || "clean");
	await ctx.close();
}

await browser.close();
const pass = results.filter((r) => r.ok).length;
console.log(`Browser check — ${new Date().toISOString()} — ${channel} ${version}, headed — ${base}`);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}\n      ${r.detail}`);
console.log(`\n${pass}/${results.length} checks passed.`);
process.exit(pass === results.length ? 0 : 1);
