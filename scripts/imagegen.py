#!/usr/bin/env python3
"""Generate images with OpenAI's or Google's image API, under hard caps enforced in code.

Caps (brief v2 §2), checked before every call against assets/LEDGER.jsonl:
	- at most 40 calls in total, counting redos, failures and moderation blocks;
	- at most US$10.00 of estimated spend, priced from PRICES (recorded 2026-10-16 from the
	  providers' pricing pages; the highest listed tier for each model is charged).
A call that would pass either cap is refused (exit 3): stop and ask, with the amount.

Every call appends one line to assets/LEDGER.jsonl (in a `finally`, so failed calls count too).
Keys are read from OPENAI_API_KEY / GEMINI_API_KEY only; they are never printed or logged.
With no key set, the requests are written to assets/REQUESTS.md for a laptop follow-up instead.
A moderation block ends that image: the script refuses to retry the same name.

Usage:
	python3 scripts/imagegen.py requests.json            # generate (or write REQUESTS.md if no key)
	python3 scripts/imagegen.py --status                 # show calls and spend so far
requests.json: [{"name": "...", "prompt": "...", "size": "1536x1024", "provider": "openai|gemini", "why": "..."}]
"""

import argparse
import base64
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEDGER = os.path.join(ROOT, "assets", "LEDGER.jsonl")
REQUESTS_MD = os.path.join(ROOT, "assets", "REQUESTS.md")
OUT_DIR = os.path.join(ROOT, "assets", "generated")

MAX_CALLS = 40
MAX_SPEND_USD = 10.00

# Per-call price ceilings in US$, highest listed tier per model (checked 2026-10-16):
# - OpenAI gpt-image-2, quality "high": $0.211 per image at 1024x1024, $0.165 at 1536x1024 or 1024x1536
#   (developers.openai.com/api/docs/guides/image-generation, "Cost and latency"); plus text input
#   at $5.00 per 1M tokens (developers.openai.com/api/docs/pricing). Charged: $0.211 + $0.005 allowance.
# - Google gemini-3.1-flash-image: $0.067 (1K), $0.101 (2K), $0.151 (4K) per image, input $0.50 per 1M
#   tokens (ai.google.dev/gemini-api/docs/pricing). Charged: $0.151 + $0.005 allowance.
PRICES = {
	"openai": {"model": "gpt-image-2", "usd_per_call": 0.216},
	"gemini": {"model": "gemini-3.1-flash-image", "usd_per_call": 0.156},
}
KEYS = {"openai": "OPENAI_API_KEY", "gemini": "GEMINI_API_KEY"}
# OpenAI's cost table lists only these sizes; any other size has no recorded price, so it is refused.
# Gemini is charged its 4K price whatever the size, so every size is covered.
OPENAI_SIZES = {"1024x1024", "1536x1024", "1024x1536"}

# Appended to every prompt, whatever the request says (brief v2 §2: no people, ever).
GUARD = (" No people anywhere in the scene: no figures, faces, silhouettes, hands, crowds, portraits,"
	" photographs or paintings of people. No text, letters, numbers, logos, signs or watermarks.")


class CapError(Exception):
	pass


def read_ledger():
	rows = []
	if os.path.exists(LEDGER):
		with open(LEDGER, encoding="utf-8") as f:
			rows = [json.loads(line) for line in f if line.strip()]
	return rows


def totals(rows):
	calls = [r for r in rows if r.get("kind") == "api_call"]
	return len(calls), round(sum(r.get("charged_usd", 0) for r in calls), 3)


def check_caps(provider, rows, size=None):
	if provider == "openai" and size is not None and size not in OPENAI_SIZES:
		raise CapError(f"no recorded OpenAI price for size {size}; use {sorted(OPENAI_SIZES)} or the gemini provider")
	calls, spent = totals(rows)
	price = PRICES[provider]["usd_per_call"]
	if calls + 1 > MAX_CALLS:
		raise CapError(f"call cap reached: {calls} of {MAX_CALLS} calls used. Stop and ask TJ before any more.")
	if spent + price > MAX_SPEND_USD + 1e-9:
		raise CapError(f"spend cap: US${spent:.3f} used, the next call would add US${price:.3f}, over US${MAX_SPEND_USD:.2f}. Stop and ask TJ.")
	return calls, spent, price


def call_openai(key, prompt, size):
	body = json.dumps({"model": PRICES["openai"]["model"], "prompt": prompt, "size": size, "quality": "high", "n": 1}).encode()
	req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=body,
		headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
	with urllib.request.urlopen(req, timeout=300) as r:
		data = json.loads(r.read())
	return base64.b64decode(data["data"][0]["b64_json"]), "png"


def call_gemini(key, prompt, size):
	model = PRICES["gemini"]["model"]
	body = json.dumps({"contents": [{"parts": [{"text": f"{prompt} Image size about {size} pixels."}]}],
		"generationConfig": {"responseModalities": ["IMAGE"]}}).encode()
	req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", data=body,
		headers={"x-goog-api-key": key, "Content-Type": "application/json"})
	with urllib.request.urlopen(req, timeout=300) as r:
		data = json.loads(r.read())
	cand = (data.get("candidates") or [{}])[0]
	if cand.get("finishReason") in ("SAFETY", "PROHIBITED_CONTENT", "IMAGE_SAFETY"):
		raise PermissionError(f"moderation: {cand.get('finishReason')}")
	for part in cand.get("content", {}).get("parts", []):
		if "inlineData" in part:
			return base64.b64decode(part["inlineData"]["data"]), "png"
	raise RuntimeError("no image in the response")


def generate(reqs):
	os.makedirs(OUT_DIR, exist_ok=True)
	for rq in reqs:
		provider = rq.get("provider", "openai")
		key = os.environ.get(KEYS[provider])
		rows = read_ledger()
		blocked = {r["name"] for r in rows if r.get("status") == "moderation_blocked"}
		if rq["name"] in blocked:
			print(f"{rq['name']}: refused, a moderation block already ended this image")
			continue
		calls, spent, price = check_caps(provider, rows, rq.get("size", "1536x1024"))
		prompt = rq["prompt"].rstrip() + GUARD
		line = {"kind": "api_call", "name": rq["name"], "provider": provider, "model": PRICES[provider]["model"],
			"size": rq.get("size"), "prompt": prompt, "charged_usd": price, "call_number": calls + 1,
			"date": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "made_by": "scripts/imagegen.py"}
		try:
			img, ext = (call_openai if provider == "openai" else call_gemini)(key, prompt, rq.get("size", "1536x1024"))
			path = os.path.join(OUT_DIR, f"{rq['name']}.{ext}")
			with open(path, "wb") as f:
				f.write(img)
			line.update(status="ok", file=os.path.relpath(path, ROOT))
			print(f"{rq['name']}: ok → {line['file']} (call {calls + 1}/{MAX_CALLS}, US${spent + price:.3f}/{MAX_SPEND_USD:.2f})")
		except PermissionError as e:
			line.update(status="moderation_blocked", error=str(e))
			print(f"{rq['name']}: moderation block; this image is ended")
		except urllib.error.HTTPError as e:
			detail = e.read().decode("utf-8", "replace")[:300]
			status = "moderation_blocked" if e.code == 400 and ("moderation" in detail or "safety" in detail) else "error"
			line.update(status=status, error=f"HTTP {e.code}: {detail}")
			print(f"{rq['name']}: {status} (HTTP {e.code})")
		except Exception as e:	# noqa: BLE001 — every failure is still a counted call
			line.update(status="error", error=type(e).__name__ + ": " + str(e)[:300])
			print(f"{rq['name']}: error ({type(e).__name__})")
		finally:
			with open(LEDGER, "a", encoding="utf-8") as f:
				f.write(json.dumps(line, ensure_ascii=False) + "\n")


def write_requests(reqs):
	existing = open(REQUESTS_MD, encoding="utf-8").read() if os.path.exists(REQUESTS_MD) else ""
	count = existing.count("\n### ")
	if count + len(reqs) > MAX_CALLS:
		raise CapError(f"REQUESTS.md would hold {count + len(reqs)} requests, over the {MAX_CALLS} cap")
	out = existing or (
		"# Image requests for a laptop follow-up\n\n"
		"No `OPENAI_API_KEY` or `GEMINI_API_KEY` was set in the build sandbox, so `scripts/imagegen.py` wrote these requests "
		"instead of calling an API (brief v2 §2). Each prompt already carries the no-people, no-text clause. "
		"Generate them with the laptop's image-gen skill, add a line per image to `assets/pack/LEDGER.jsonl` "
		"(or run `scripts/imagegen.py` with a key, which ledgers to `assets/LEDGER.jsonl`), then re-run "
		"`scripts/build_images.py`.\n\n"
		f"Cap: at most {MAX_CALLS} images or US${MAX_SPEND_USD:.2f}, whichever comes first.\n")
	for i, rq in enumerate(reqs, count + 1):
		out += (f"\n### {i}. `{rq['name']}` — {rq.get('size', '')}\n\n"
			f"- **Why:** {rq.get('why', '')}\n"
			f"- **Suggested provider:** {rq.get('provider', 'any')}\n"
			f"- **Prompt:** {rq['prompt'].rstrip()}{GUARD}\n")
	with open(REQUESTS_MD, "w", encoding="utf-8") as f:
		f.write(out)
	print(f"No API key set: wrote {len(reqs)} request(s) to {os.path.relpath(REQUESTS_MD, ROOT)} ({count + len(reqs)} in total).")


def main():
	ap = argparse.ArgumentParser(description="Capped image generation (see module docstring).")
	ap.add_argument("requests", nargs="?", help="JSON file with a list of requests")
	ap.add_argument("--status", action="store_true", help="print calls and spend so far")
	args = ap.parse_args()
	calls, spent = totals(read_ledger())
	if args.status or not args.requests:
		print(f"Calls: {calls}/{MAX_CALLS} · estimated spend: US${spent:.3f}/{MAX_SPEND_USD:.2f}")
		return
	with open(args.requests, encoding="utf-8") as f:
		reqs = json.load(f)
	try:
		with_key = [r for r in reqs if os.environ.get(KEYS[r.get("provider", "openai")])]
		without = [r for r in reqs if r not in with_key]
		if with_key:
			generate(with_key)
		if without:
			write_requests(without)
	except CapError as e:
		print(f"REFUSED: {e}", file=sys.stderr)
		sys.exit(3)


if __name__ == "__main__":
	main()
