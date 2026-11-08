// Build the 1200×630 share image in the game's noir: the hero master sh-hero-noir (1664×936,
// scaled down and cropped, never up), a dark scrim, and the title in the game's display stack.
// It carries no figures, so it can't go stale between daily refreshes. Records itself in
// assets/img/MANIFEST.json. Usage: node scripts/build_og.mjs
// The display stack starts with Bahnschrift SemiBold Condensed (Windows); elsewhere the title falls
// back down the same stack, as it does on the page.

import { chromium } from "playwright";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const SOURCE = "sh-hero-noir";
const src = new URL(`assets/pack/${SOURCE}.jpg`, root);
const out = new URL("assets/img/og-share-1200x630.jpg", root);
const bg = readFileSync(src).toString("base64");
const ALT = "The words TORONTO SHELTER OCCUPANCY over a painted Toronto skyline at night, from the game Homeless in Toronto.";

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #0b0e13; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.bg { position: absolute; inset: 0; background: url(data:image/jpeg;base64,${bg}) 60% 58% / cover no-repeat; }
.scrim { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(11,14,19,0.94) 0%, rgba(11,14,19,0.8) 46%, rgba(11,14,19,0.2) 85%), linear-gradient(0deg, rgba(11,14,19,0.65), transparent 45%); }
.txt { position: absolute; left: 72px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; width: 760px; color: #e6edf5; }
.k { font: 600 20px/1.3 ui-monospace, Consolas, monospace; letter-spacing: 0.16em; text-transform: uppercase; color: #9cc4f0; margin-bottom: 24px; }
h1 { font: 600 86px/1.02 "Bahnschrift SemiBold Condensed", "Arial Narrow", "Segoe UI", system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.1em; }
p { font: 400 28px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; color: #c9d6e6; margin-top: 26px; max-width: 640px; }
.u { position: absolute; left: 72px; bottom: 48px; font: 600 22px/1 ui-monospace, Consolas, monospace; letter-spacing: 0.08em; color: #9cc4f0; }
.rule { position: absolute; left: 0; right: 0; top: 0; height: 6px; background: #7fb0e0; }
</style></head><body><div class="bg"></div><div class="scrim"></div><div class="rule"></div>
<div class="txt"><div class="k">City of Toronto open data · every night</div><h1>Toronto shelter occupancy</h1>
<p>How full Toronto's shelters were last night, from the City's 4 am count.</p></div>
<div class="u">data.tj-hosting.ca</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const face = await page.evaluate(() => getComputedStyle(document.querySelector("h1")).fontFamily);
await page.screenshot({ path: out.pathname, type: "jpeg", quality: 88 });
await browser.close();

const manifestUrl = new URL("assets/img/MANIFEST.json", root);
const manifest = JSON.parse(readFileSync(manifestUrl));
const ledgerLines = readFileSync(new URL("assets/pack/LEDGER.jsonl", root), "utf8").split("\n");
const line = ledgerLines.findIndex((l) => l.trim() && JSON.parse(l).name === SOURCE) + 1;
const rec = JSON.parse(ledgerLines[line - 1]);
manifest.images = manifest.images.filter((i) => i.name !== "sh-og-share");
manifest.images.push({
	name: "sh-og-share", source: `assets/pack/${SOURCE}.jpg`,
	source_sha256: createHash("sha256").update(readFileSync(src)).digest("hex"), source_size: rec.dims,
	use: "share image (og:image), title rendered by scripts/build_og.mjs", alt: ALT,
	ledger: "assets/pack/LEDGER.jsonl", line, provider: rec.provider, date: rec.date,
	outputs: [{ file: "assets/img/og-share-1200x630.jpg", width: 1200, height: 630, bytes: statSync(out).size }],
});
writeFileSync(manifestUrl, JSON.stringify(manifest, null, "\t") + "\n");
console.log(`wrote ${out.pathname} (${statSync(out).size} bytes) from ${SOURCE}, ledger line ${line}; title face stack: ${face}`);
