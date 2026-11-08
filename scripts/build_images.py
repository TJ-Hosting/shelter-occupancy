#!/usr/bin/env python3
"""Convert the images the site ships from assets/pack/ to AVIF and WebP at responsive widths.

Never upscales: a width larger than the source is skipped. Every output is listed in
assets/img/MANIFEST.json with its source file and that file's ledger line, so each
shipped image traces to assets/pack/LEDGER.jsonl (or assets/LEDGER.jsonl for images
generated during the build).

Usage: python3 scripts/build_images.py
"""

import hashlib
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, "assets", "pack")
OUT = os.path.join(ROOT, "assets", "img")
LEDGERS = [os.path.join(ROOT, "assets", "pack", "LEDGER.jsonl"), os.path.join(ROOT, "assets", "LEDGER.jsonl")]

# name in pack → (widths, use on the site, alt text or "" for decorative)
# Since shelter-03 (8 Nov 2026) the site ships one image: the game's noir title backdrop, wide and
# tall (from TJ-Hosting/homeless; ledger lines in assets/pack/LEDGER.jsonl). The earlier pack
# images are no longer referenced; their files stay in assets/img until Barney rules on deleting
# them (shelter-02 Q2), and they are listed here no more, so a rebuild leaves them untouched.
HERO_ALT = "A painted Toronto skyline at night across the lake, the CN Tower lit in thin stripes under low dark clouds."
SHIP = {
	"sh-hero-noir": ([640, 960, 1280, 1664], "hero background on wider screens, embed card, 404 page", HERO_ALT),
	"sh-hero-noir-tall": ([480, 720, 941], "hero background on narrow screens", HERO_ALT),
}
QUALITY = {"avif": 52, "webp": 76}


def ledger_lines():
	lines = {}
	for path in LEDGERS:
		if not os.path.exists(path):
			continue
		with open(path, encoding="utf-8") as f:
			for n, line in enumerate(f, 1):
				line = line.strip()
				if not line:
					continue
				rec = json.loads(line)
				lines[rec["name"]] = {"ledger": os.path.relpath(path, ROOT), "line": n, "provider": rec.get("provider"), "date": rec.get("date")}
	return lines


def main():
	os.makedirs(OUT, exist_ok=True)
	ledger = ledger_lines()
	manifest = {"about": "Every image the site ships, its source in assets/pack/ and the ledger line that records how it was made.", "images": []}
	for name, (widths, use, alt) in SHIP.items():
		if name not in ledger:
			raise SystemExit(f"{name}: no ledger line; refusing to ship it")
		src_path = os.path.join(PACK, name + ".jpg")
		src = Image.open(src_path).convert("RGB")
		sha = hashlib.sha256(open(src_path, "rb").read()).hexdigest()
		outputs = []
		for w in widths:
			if w > src.width:
				print(f"skip {name} at {w}px: source is {src.width}px (no upscaling)")
				continue
			h = round(src.height * w / src.width)
			img = src if w == src.width else src.resize((w, h), Image.LANCZOS)
			for fmt in ("avif", "webp"):
				out = os.path.join(OUT, f"{name}-{w}.{fmt}")
				img.save(out, fmt.upper(), quality=QUALITY[fmt])
				outputs.append({"file": os.path.relpath(out, ROOT), "width": w, "height": h, "bytes": os.path.getsize(out)})
		manifest["images"].append({
			"name": name, "source": os.path.relpath(src_path, ROOT), "source_sha256": sha,
			"source_size": f"{src.width}x{src.height}", "use": use,
			"alt": alt or "decorative (alt=\"\")", **ledger[name], "outputs": outputs,
		})
		print(f"{name}: {len(outputs)} files")
	with open(os.path.join(OUT, "MANIFEST.json"), "w", encoding="utf-8") as f:
		json.dump(manifest, f, ensure_ascii=False, indent="\t")
		f.write("\n")


if __name__ == "__main__":
	main()
