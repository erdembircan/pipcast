#!/bin/bash
# Runs the mod in a real, headless Claude Code session on the engine bundled
# with the desktop app: /pipcast has to tune in (a record in the store, the
# station launched), a second /pipcast has to tune out (the record gone), and a
# session that ends while tuned in has to take its record with it. No model call
# is made and no station is started: PIPCAST_STATION_BIN is a stand-in that logs
# its arguments. Everything lives in a temporary folder that is removed on exit.
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
claude="$("$root/scripts/claude-bin.sh")"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/pipcast-verify-mod.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

home="$tmp/home"
calls="$tmp/station-calls.log"
notes="$tmp/notes.log"
out="$tmp/engine-out.jsonl"
station="$tmp/stand-in-station"
mkdir -p "$home"

cat >"$station" <<EOF
#!/bin/sh
echo "\$@" >> "$calls"
echo "started 4242"
EOF
chmod +x "$station"

words() { # prints one of the command's replies, from the contract
  node -e "import('$root/plugin/src/contract/copy.ts').then((m) => process.stdout.write(m.REPLY[process.argv[1]]))" "$1"
}
tuned_in="$(words tunedIn)"
tuned_out="$(words tunedOut)"

# "ok" when the session's one record exists and parses, with v 1 and an id
record_state() {
  node -e '
    const fs = require("node:fs")
    const dir = process.argv[1]
    const names = fs.existsSync(dir) ? fs.readdirSync(dir) : []
    const json = names.filter((name) => name.endsWith(".json"))
    if (json.length === 0) { process.stdout.write(names.length === 0 ? "none" : "tmp-only"); process.exit(0) }
    const record = JSON.parse(fs.readFileSync(dir + "/" + json[0], "utf8"))
    process.stdout.write(json.length === 1 && record.v === 1 && typeof record.id === "string" && record.id !== "" ? "ok" : "bad")
  ' "$home/sessions"
}

command='{"type":"user","message":{"role":"user","content":"/pipcast"}}'

(
  echo "$command"
  sleep 3
  echo "after-in $(record_state)" >>"$notes"
  echo "$command"
  sleep 3
  echo "after-out $(record_state)" >>"$notes"
  echo "$command"
  sleep 3
  echo "after-in-again $(record_state)" >>"$notes"
) | PIPCAST_HOME="$home" \
  PIPCAST_STATION_BIN="$station" \
  PIPCAST_TARGET_BUNDLE_ID=com.example.pipcast.never-frontmost \
  CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 \
  "$claude" -p \
  --input-format stream-json --output-format stream-json --verbose \
  --model haiku --no-session-persistence --plugin-dir "$root/plugin" >"$out" 2>&1

sleep 1
echo "after-end $(record_state)" >>"$notes"
echo "running $(pgrep -f "$tmp" | wc -l | tr -d ' ')" >>"$notes"

failed=0

check() { # fixed text to find, in a file, and what it shows
  if grep -qF -- "$1" "$2"; then
    echo "ok   $3"
  else
    echo "FAIL $3"
    failed=1
  fi
}

check "after-in ok" "$notes" "the first /pipcast wrote the session's record"
check "$tuned_in" "$out" "the first /pipcast answered that it tuned in"
check "launch --home $home --assets $root/plugin/station --target-bundle-id com.example.pipcast.never-frontmost" "$calls" "the station was launched with the store, the assets and the target"
check "after-out none" "$notes" "the second /pipcast removed the record"
check "$tuned_out" "$out" "the second /pipcast answered that it tuned out"
check "after-in-again ok" "$notes" "a third /pipcast wrote the record again"
check "after-end none" "$notes" "the session ending took the record with it"
check "running 0" "$notes" "nothing is left running"

if [[ "$failed" -eq 0 ]]; then
  echo "mod verified"
else
  echo "mod check failed"
  tail -c 2000 "$out"
fi

exit "$failed"
