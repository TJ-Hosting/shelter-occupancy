#!/usr/bin/env bash
# Run every check once against the built site and write the outputs to evidence/.
# Needs: python3, node with Playwright (npm install), network access to the City's CKAN API.
set -u
cd "$(dirname "$0")/.."
PORT="${PORT:-8765}"
BASE="http://127.0.0.1:${PORT}/"
mkdir -p evidence/screenshots

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for _ in $(seq 1 30); do curl -sf -o /dev/null "$BASE" && break; sleep 0.2; done

status=0
run() {	# run <name> <output file> <command...>
	local name="$1" outfile="$2"; shift 2
	echo "== ${name}"
	if "$@" > "$outfile" 2>&1; then echo "   pass → ${outfile}"; else echo "   FAIL → ${outfile}"; status=1; fi
	tail -n 1 "$outfile" | sed 's/^/   /'
}

{
	echo "Test run: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
	echo "Commit: $(git rev-parse --short HEAD 2>/dev/null) ($(git status --porcelain | wc -l | tr -d ' ') uncommitted paths)"
	echo "Node $(node --version) · Python $(python3 --version | cut -d' ' -f2) · Playwright $(node -e 'console.log(require("playwright/package.json").version)' 2>/dev/null)"
	echo "Snapshot: night $(python3 -c 'import json;print(json.load(open("data/latest.json"))["occupancy_date"])'), built $(python3 -c 'import json;print(json.load(open("data/meta.json"))["generated_at"])')"
} > evidence/run-info.txt

run "data test (raw CKAN vs page)" evidence/data-test.txt node tests/data-test.mjs "$BASE"
run "map check" evidence/map-check.txt node tests/map-check.mjs "$BASE"
run "contrast check" evidence/contrast-check.txt node tests/contrast-check.mjs "$BASE"
run "image caps" evidence/imagegen-caps.txt python3 tests/imagegen-caps.py
run "screenshots" evidence/screenshots.txt node tests/screenshots.mjs "$BASE" evidence/screenshots
exit $status
