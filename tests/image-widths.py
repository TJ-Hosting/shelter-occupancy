#!/usr/bin/env python3
"""Image check (shelter-02 P3): no image ships wider than its source, and every shipped image is ledgered.

- every output listed in assets/img/MANIFEST.json is no wider than its source in assets/pack/;
- every file in assets/img/ is measured (Pillow) and matched to its pack source by name, so files
  outside the manifest are checked too;
- every manifest image has a line in assets/pack/LEDGER.jsonl or assets/LEDGER.jsonl;
- every assets/img file the pages reference is in the manifest.
Needs Pillow. Usage: python3 tests/image-widths.py
"""

import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
PACK = os.path.join(ROOT, "assets", "pack")

results = []


def check(name, ok, detail=""):
	results.append((name, bool(ok), detail))


manifest = json.load(open(os.path.join(IMG, "MANIFEST.json"), encoding="utf-8"))
ledgered = set()
for path in (os.path.join(PACK, "LEDGER.jsonl"), os.path.join(ROOT, "assets", "LEDGER.jsonl")):
	if os.path.exists(path):
		for line in open(path, encoding="utf-8"):
			if line.strip():
				ledgered.add(json.loads(line)["name"])

listed = set()
for im in manifest["images"]:
	sw = int(im["source_size"].split("x")[0])
	wide = [o["file"] for o in im["outputs"] if o["width"] > sw]
	check(f"{im['name']}: outputs ≤ source width {sw}px", not wide, ", ".join(wide) or f"{len(im['outputs'])} outputs")
	check(f"{im['name']}: ledger line", im["name"] in ledgered, f"{im.get('ledger')} line {im.get('line')}")
	listed.update(os.path.basename(o["file"]) for o in im["outputs"])

pattern = re.compile(r"^(?P<name>.+)-(?P<w>\d+)\.(avif|webp)$")
unlisted = []
for f in sorted(os.listdir(IMG)):
	m = pattern.match(f)
	if not m:
		continue
	src = os.path.join(PACK, m["name"] + ".jpg")
	with Image.open(os.path.join(IMG, f)) as out:
		ow = out.width
	if not os.path.exists(src):
		check(f"{f}: has a pack source", False, f"no {m['name']}.jpg in assets/pack/")
		continue
	with Image.open(src) as s:
		check(f"{f}: {ow}px ≤ source {s.width}px", ow <= s.width)
	if f not in listed:
		unlisted.append(f)

referenced = set()
for page in ("index.html", "embed/index.html", "404.html"):
	referenced.update(re.findall(r"assets/img/([\w.-]+\.(?:avif|webp|jpg))", open(os.path.join(ROOT, page), encoding="utf-8").read()))
referenced.discard("og-share-1200x630.jpg")	# rendered by scripts/build_og.mjs, not by build_images.py
missing = sorted(referenced - listed)
check("every image file the pages use is in the manifest", not missing, ", ".join(missing) or f"{len(referenced)} files referenced")

for name, ok, detail in results:
	print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))
if unlisted:
	print(f"\nNote: {len(unlisted)} file(s) in assets/img are not in the manifest and no page uses them (checked for width above): {', '.join(unlisted)}")
passed = sum(ok for _, ok, _ in results)
print(f"\n{passed}/{len(results)} checks passed.")
sys.exit(0 if passed == len(results) else 1)
