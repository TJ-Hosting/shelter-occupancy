#!/usr/bin/env python3
"""Checks that scripts/imagegen.py enforces its caps in code, without calling any API.

Points the ledger at a temporary file, fills it with synthetic call lines, and asserts that:
1. the 41st call is refused;
2. a call that would push estimated spend past US$10.00 is refused;
3. failed and moderation-blocked calls count toward both caps;
4. a moderation-blocked name is never retried;
5. with no key in the environment, requests go to REQUESTS.md and no call is made.
Usage: python3 tests/imagegen-caps.py
"""

import importlib.util
import json
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("imagegen", os.path.join(ROOT, "scripts", "imagegen.py"))
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

results = []


def check(name, ok, detail=""):
	results.append(ok)
	print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"\n      {detail}" if detail else ""))


def ledger_with(rows):
	fd, path = tempfile.mkstemp(suffix=".jsonl")
	with os.fdopen(fd, "w") as f:
		for r in rows:
			f.write(json.dumps(r) + "\n")
	ig.LEDGER = path
	return path


for k in ig.KEYS.values():
	os.environ.pop(k, None)

# 1. call cap: 40 cheap calls recorded → the next one is refused.
ledger_with([{"kind": "api_call", "name": f"x{i}", "status": "ok", "charged_usd": 0.01} for i in range(40)])
try:
	ig.check_caps("gemini", ig.read_ledger())
	check("41st call refused", False, "check_caps allowed call 41")
except ig.CapError as e:
	check("41st call refused", True, str(e))

# 2. spend cap: US$9.90 recorded, an OpenAI call costs US$0.216 → refused.
ledger_with([{"kind": "api_call", "name": "big", "status": "ok", "charged_usd": 9.90}])
try:
	ig.check_caps("openai", ig.read_ledger())
	check("spend past US$10 refused", False, "check_caps allowed it")
except ig.CapError as e:
	check("spend past US$10 refused", True, str(e))

# 2b. just under the cap is allowed.
ledger_with([{"kind": "api_call", "name": "big", "status": "ok", "charged_usd": 9.70}])
try:
	calls, spent, price = ig.check_caps("openai", ig.read_ledger())
	check("call within both caps allowed", True, f"{calls} call(s), US${spent:.2f} spent, next US${price:.3f}")
except ig.CapError as e:
	check("call within both caps allowed", False, str(e))

# 2c. an OpenAI size with no recorded price is refused.
ledger_with([])
try:
	ig.check_caps("openai", ig.read_ledger(), "2560x1440")
	check("unpriced OpenAI size refused", False, "allowed")
except ig.CapError as e:
	check("unpriced OpenAI size refused", True, str(e))

# 3. failures and moderation blocks count.
rows = [{"kind": "api_call", "name": f"e{i}", "status": "error", "charged_usd": 0.216} for i in range(20)]
rows += [{"kind": "api_call", "name": f"m{i}", "status": "moderation_blocked", "charged_usd": 0.216} for i in range(20)]
ledger_with(rows)
calls, spent = ig.totals(ig.read_ledger())
try:
	ig.check_caps("gemini", ig.read_ledger())
	refused = False
except ig.CapError:
	refused = True
check("failed and blocked calls count toward the caps", calls == 40 and refused, f"{calls} calls counted, US${spent:.2f}")

# 4. a moderation-blocked name is not retried (no API call is attempted; ledger unchanged).
path = ledger_with([{"kind": "api_call", "name": "blocked-one", "status": "moderation_blocked", "charged_usd": 0.216}])
os.environ["OPENAI_API_KEY"] = "test-key-not-real"
called = []
ig.call_openai = lambda *a, **k: called.append(1) or (b"", "png")
ig.generate([{"name": "blocked-one", "prompt": "a lake", "provider": "openai"}])
os.environ.pop("OPENAI_API_KEY")
check("moderation-blocked image not retried", not called and len(ig.read_ledger()) == 1)

# 5. no key → REQUESTS.md, no call.
tmpdir = tempfile.mkdtemp()
ig.REQUESTS_MD = os.path.join(tmpdir, "REQUESTS.md")
ledger_with([])
reqs = os.path.join(tmpdir, "r.json")
with open(reqs, "w") as f:
	json.dump([{"name": "t", "prompt": "a calm lake at dusk", "provider": "openai", "why": "test"}], f)
sys.argv = ["imagegen.py", reqs]
ig.main()
text = open(ig.REQUESTS_MD).read()
check("no key: request written, no call made", "### 1. `t`" in text and "No people anywhere" in text and ig.read_ledger() == [])

print(f"\n{sum(results)}/{len(results)} checks passed.")
sys.exit(0 if all(results) else 1)
