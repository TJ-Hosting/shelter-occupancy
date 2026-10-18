// Build the 1200×630 share image: the pack's sh-og-share background (1280×720, scaled down and
// cropped, never up), a dark scrim, and the title set in the vendored Oswald. It carries no figures,
// so it can't go stale between daily refreshes. Records itself in assets/img/MANIFEST.json.
// Usage: node scripts/build_og.mjs

import { chromium } from "playwright";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const src = new URL("assets/pack/sh-og-share.jpg", root);
const out = new URL("assets/img/og-share-1200x630.jpg", root);
const bg = readFileSync(src).toString("base64");
const font = readFileSync(new URL("vendor/oswald-5.3.0/oswald-latin-wght-normal.woff2", root)).toString("base64");

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Oswald; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 200 700; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #08090a; font-family: system-ui, sans-serif; }
.bg { position: absolute; inset: 0; background: url(data:image/jpeg;base64,${bg}) center 60% / cover no-repeat; }
.scrim { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(8,9,10,0.92) 0%, rgba(8,9,10,0.78) 45%, rgba(8,9,10,0.15) 85%), linear-gradient(0deg, rgba(8,9,10,0.6), transparent 40%); }
.txt { position: absolute; left: 72px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; width: 720px; color: #ece7dc; }
.k { font: 600 20px/1.3 ui-monospace, "DejaVu Sans Mono", monospace; letter-spacing: 0.18em; text-transform: uppercase; color: #e0a44f; margin-bottom: 22px; }
h1 { font: 600 104px/0.95 Oswald; text-transform: uppercase; letter-spacing: 0.01em; }
p { font: 400 28px/1.35 system-ui, sans-serif; color: #d9d3c6; margin-top: 26px; max-width: 620px; }
.u { position: absolute; left: 72px; bottom: 48px; font: 600 22px/1 ui-monospace, "DejaVu Sans Mono", monospace; letter-spacing: 0.08em; color: #e0a44f; }
</style></head><body><div class="bg"></div><div class="scrim"></div>
<div class="txt"><div class="k">City of Toronto open data · every night</div><h1>Toronto shelter occupancy</h1>
<p>People served, beds and rooms, last night and every night since 2021.</p></div>
<div class="u">data.tj-hosting.ca</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out.pathname, type: "jpeg", quality: 88 });
await browser.close();

const manifestUrl = new URL("assets/img/MANIFEST.json", root);
const manifest = JSON.parse(readFileSync(manifestUrl));
const ledgerLines = readFileSync(new URL("assets/pack/LEDGER.jsonl", root), "utf8").split("\n");
const line = ledgerLines.findIndex((l) => l.includes('"name":"sh-og-share"')) + 1;
manifest.images = manifest.images.filter((i) => i.name !== "sh-og-share");
manifest.images.push({
	name: "sh-og-share", source: "assets/pack/sh-og-share.jpg",
	source_sha256: createHash("sha256").update(readFileSync(src)).digest("hex"), source_size: "1280x720",
	use: "share image (og:image), title rendered by scripts/build_og.mjs", alt: "The words TORONTO SHELTER OCCUPANCY over a painted Toronto skyline at dusk.",
	ledger: "assets/pack/LEDGER.jsonl", line, provider: "grok", date: "2026-10-15T19:41:11",
	outputs: [{ file: "assets/img/og-share-1200x630.jpg", width: 1200, height: 630, bytes: statSync(out).size }],
});
writeFileSync(manifestUrl, JSON.stringify(manifest, null, "\t") + "\n");
console.log(`wrote ${out.pathname} (${statSync(out).size} bytes); ledger line ${line}`);
