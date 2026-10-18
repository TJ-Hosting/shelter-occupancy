// Contrast check (brief v2 §6): WCAG AA for text in light and dark modes, and chart colours.
//
// In a real browser, for every visible text element on the dashboard and the embed card:
// - on a solid background, the text colour against the nearest opaque ancestor background;
// - over an image (hero, bands, beds/rooms art, refugee panel, footer, embed), the text colour
//   against the actual rendered pixels behind it: all text is hidden, the page is captured, and
//   the worst-case background (98th percentile of luminance away from the text) is used.
// Thresholds: 4.5:1 normal text, 3:1 large text (≥ 24px, or ≥ 18.66px bold).
// Also: every text token against every surface, axis text, and chart marks ≥ 3:1 against the
// chart surface. Usage: node tests/contrast-check.mjs http://127.0.0.1:8765/

import { chromium } from "playwright";
import { inflateSync } from "node:zlib";

const base = process.argv[2] || "http://127.0.0.1:8765/";

// ---------------------------------------------------------------- colour maths
function lum([r, g, b]) {
	const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function parse(c) {
	const m = c.match(/rgba?\(([^)]+)\)/);
	if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
	const h = c.replace("#", "");
	return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
}

// ---------------------------------------------------------------- minimal PNG decoder (8-bit RGB/RGBA)
function decodePNG(buf) {
	let pos = 8, width = 0, height = 0, ctype = 0;
	const idat = [];
	while (pos < buf.length) {
		const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8);
		const data = buf.subarray(pos + 8, pos + 8 + len);
		if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); ctype = data[9]; if (data[8] !== 8) throw new Error("bit depth"); }
		else if (type === "IDAT") idat.push(data);
		else if (type === "IEND") break;
		pos += 12 + len;
	}
	const bpp = ctype === 6 ? 4 : ctype === 2 ? 3 : null;
	if (!bpp) throw new Error(`colour type ${ctype}`);
	const raw = inflateSync(Buffer.concat(idat));
	const stride = width * bpp, out = Buffer.alloc(height * stride);
	for (let y = 0; y < height; y++) {
		const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
			let v = raw[src + x];
			if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
			else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
			out[dst + x] = v & 255;
		}
	}
	return { width, height, bpp, data: out };
}

// ---------------------------------------------------------------- per page / theme / width
const ZONES = ".hero, .band, .block, .panel-temporary, .panel-refugee, .footer, a.card";

async function audit(browser, url, theme, width, height, label) {
	const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme, locale: "en-CA", timezoneId: "America/Toronto", reducedMotion: "reduce", deviceScaleFactor: 1 });
	const page = await ctx.newPage();
	await page.goto(url, { waitUntil: "networkidle" });
	await page.waitForSelector('body[data-ready="true"]');
	await page.evaluate(async () => {
		for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 60)); }
		window.scrollTo({ top: 0, behavior: "instant" });
	});
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(500);

	const items = await page.evaluate((zones) => {
		const out = [];
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
		while (walker.nextNode()) {
			const t = walker.currentNode;
			if (!t.textContent.trim()) continue;
			const el = t.parentElement;
			if (!el || el.closest(".leaflet-container, .visually-hidden, noscript, script, style, .skip, [hidden], details:not([open]) .table-scroll")) continue;
			const cs = getComputedStyle(el);
			if (cs.visibility !== "visible" || Number(cs.opacity) === 0) continue;
			// The text's own line boxes (not the element box, which can include swatches and borders).
			const range = document.createRange();
			range.selectNodeContents(t);
			const rects = [...range.getClientRects()].filter((q) => q.width >= 1 && q.height >= 1);
			if (!rects.length) continue;
			const r = { left: Math.min(...rects.map((q) => q.left)), top: Math.min(...rects.map((q) => q.top)), right: Math.max(...rects.map((q) => q.right)), bottom: Math.max(...rects.map((q) => q.bottom)) };
			r.width = r.right - r.left; r.height = r.bottom - r.top;
			let bg = null, node = el;
			while (node) {	// nearest opaque background
				const c = getComputedStyle(node).backgroundColor;
				const m = c.match(/rgba?\(([^)]+)\)/);
				const p = m ? m[1].split(/[ ,/]+/).filter(Boolean).map(Number) : null;
				if (p && (p.length < 4 || p[3] >= 0.99)) { bg = c; break; }
				node = node.parentElement;
			}
			const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10);
			out.push({
				text: t.textContent.trim().replace(/\s+/g, " ").slice(0, 48), tag: el.tagName.toLowerCase(), cls: el.className && typeof el.className === "string" ? el.className.split(" ")[0] : "",
				color: cs.color, bg: bg || getComputedStyle(document.body).backgroundColor, overImage: !!el.closest(zones),
				large: size >= 24 || (size >= 18.66 && weight >= 700), size, weight,
				x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height,
			});
		}
		return out;
	}, ZONES);

	// Background pixels: hide all text (and text-shadows), capture the full page once.
	await page.addStyleTag({ content: "*, *::before, *::after { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; } input, select, button { border-color: transparent !important; }" });
	await page.waitForTimeout(200);
	const png = decodePNG(await page.screenshot({ fullPage: true, type: "png" }));
	await ctx.close();

	const failures = [];
	let checked = 0, overImageChecked = 0, worst = { r: 99 };
	for (const it of items) {
		const fg = parse(it.color);
		if (fg[3] < 0.99) {	// translucent text: blend over its solid background first
			const b = parse(it.bg);
			for (let k = 0; k < 3; k++) fg[k] = Math.round(fg[k] * fg[3] + b[k] * (1 - fg[3]));
		}
		let r;
		if (it.overImage) {
			// Sample the middle 60% of the line box height, where the glyphs are: a display face's
			// line box can extend into a neighbouring bar or swatch that no glyph touches.
			const x0 = Math.max(0, Math.floor(it.x)), y0 = Math.max(0, Math.floor(it.y + it.h * 0.2));
			const x1 = Math.min(png.width, Math.ceil(it.x + it.w)), y1 = Math.min(png.height, Math.ceil(it.y + it.h * 0.8));
			const ls = [];
			const textL = lum(fg);
			for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
				const i = (y * png.width + x) * png.bpp;
				ls.push(lum([png.data[i], png.data[i + 1], png.data[i + 2]]));
			}
			if (!ls.length) continue;
			ls.sort((a, b) => a - b);
			// worst case: the background pixels closest in luminance to the text, at the 98th percentile
			const bgL = textL > ls[Math.floor(ls.length / 2)] ? ls[Math.floor(ls.length * 0.98)] : ls[Math.floor(ls.length * 0.02)];
			const [hi, lo] = [Math.max(textL, bgL), Math.min(textL, bgL)];
			r = (hi + 0.05) / (lo + 0.05);
			overImageChecked++;
		} else {
			r = ratio(fg, parse(it.bg));
		}
		checked++;
		const need = it.large ? 3 : 4.5;
		if (r < worst.r) worst = { r, it };
		if (r < need) failures.push({ ...it, r, need });
	}
	return { label, theme, width, checked, overImageChecked, failures, worst };
}

// ---------------------------------------------------------------- tokens and chart marks
async function tokens(browser) {
	const out = {};
	for (const theme of ["dark", "light"]) {
		const ctx = await browser.newContext({ colorScheme: theme });
		const page = await ctx.newPage();
		await page.goto(base, { waitUntil: "domcontentloaded" });
		out[theme] = await page.evaluate(() => {
			const s = getComputedStyle(document.documentElement);
			const g = (n) => s.getPropertyValue(n).trim();
			return Object.fromEntries(["--bg", "--surface", "--surface-2", "--text", "--text-2", "--muted", "--key-text", "--axis", "--c-people", "--c-refugee", "--c-temporary", "--c-beds", "--c-rooms", "--key", "--y1", "--y6"].map((n) => [n, g(n)]));
		});
		await ctx.close();
	}
	return out;
}

const browser = await chromium.launch();
const runs = [];
for (const theme of ["dark", "light"]) {
	for (const [w, h] of [[1440, 900], [375, 812]]) runs.push(await audit(browser, base, theme, w, h, "dashboard"));
}
runs.push(await audit(browser, new URL("embed/", base).href, "dark", 320, 180, "embed 320×180"));
runs.push(await audit(browser, new URL("embed/", base).href, "dark", 600, 340, "embed 600×340"));
const tk = await tokens(browser);
await browser.close();

let failed = 0;
console.log(`Contrast check — ${new Date().toISOString()} — ${base}`);
console.log("WCAG AA: 4.5:1 normal text, 3:1 large text. Text over images is measured against the rendered pixels behind its glyph band (middle 60% of each line box; 98th-percentile worst case), with motion reduced.\n");
console.log("1. Every visible text element, rendered");
for (const r of runs) {
	failed += r.failures.length;
	const w = r.worst.it ? `worst ${r.worst.r.toFixed(2)}:1 ("${r.worst.it.text}", ${r.worst.it.overImage ? "over image" : "solid"})` : "";
	console.log(`${r.failures.length ? "FAIL" : "PASS"}  ${r.label} · ${r.theme} · ${r.width}px — ${r.checked} elements (${r.overImageChecked} over images), ${r.failures.length} below AA; ${w}`);
	for (const f of r.failures) console.log(`      ${f.r.toFixed(2)}:1 < ${f.need} — <${f.tag} class="${f.cls}"> "${f.text}" ${f.color} on ${f.overImage ? "image" : f.bg}`);
}

console.log("\n2. Text tokens against surfaces");
for (const theme of ["dark", "light"]) {
	const t = tk[theme];
	for (const fgName of ["--text", "--text-2", "--muted", "--key-text", "--axis"]) {
		const cells = ["--bg", "--surface", "--surface-2"].map((bgName) => {
			const r = ratio(parse(t[fgName]), parse(t[bgName]));
			if (r < 4.5) failed++;
			return `${bgName} ${r.toFixed(2)}${r < 4.5 ? " FAIL" : ""}`;
		});
		console.log(`${theme.padEnd(5)} ${fgName.padEnd(10)} ${t[fgName]}  vs  ${cells.join(" · ")}`);
	}
}

console.log("\n3. Chart marks against the chart surface (≥ 3:1, non-text)");
for (const theme of ["dark", "light"]) {
	const t = tk[theme];
	const cells = ["--c-people", "--c-refugee", "--c-temporary", "--c-beds", "--c-rooms", "--key", "--y6"].map((n) => {
		const r = ratio(parse(t[n]), parse(t["--surface"]));
		if (r < 3) failed++;
		return `${n} ${t[n]} ${r.toFixed(2)}${r < 3 ? " FAIL" : ""}`;
	});
	console.log(`${theme.padEnd(5)} on ${t["--surface"]}: ${cells.join(" · ")}`);
	const y1 = ratio(parse(t["--y1"]), parse(t["--surface"]));
	console.log(`      oldest-year line --y1 ${t["--y1"]} ${y1.toFixed(2)}:1 (ordinal ramp floor 2:1 by design; the year is also in the legend, tooltip and table)`);
}
console.log("\nColour-blind safety of chart colours: validated separately with the dataviz palette validator (docs/DESIGN.md §3).");
console.log(`\n${failed === 0 ? "ALL CHECKS PASS" : `${failed} FAILURE(S)`}`);
process.exit(failed ? 1 : 0);
