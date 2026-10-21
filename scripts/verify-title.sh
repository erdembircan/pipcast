#!/bin/bash
# A rename has to reach the board. A real headless Claude Code session on the
# engine bundled with the desktop app tunes in with /pipcast and is renamed the
# way the desktop app renames a session, with a rename_session request: once
# while on air, once while tuned out, and once after the window's close took it
# off the air. Each time, the session's record has to carry the new title. The
# engine runs with a throwaway configuration, so it keeps a transcript and the
# title's file without touching yours. No model call is made and no station is
# started: PIPCAST_STATION_BIN is a stand-in. Everything lives in a temporary
# folder that is removed on exit.
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
claude="$("$root/scripts/claude-bin.sh")"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/pipcast-verify-title.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

config="$tmp/config"
home="$tmp/home"
work="$tmp/work"
notes="$tmp/notes.log"
out="$tmp/engine-out.jsonl"
station="$tmp/stand-in-station"
mkdir -p "$config" "$home" "$work"

cat >"$station" <<'EOF'
#!/bin/sh
echo "started 4242"
EOF
chmod +x "$station"

id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
# A session with no title goes by its folder and the start of its id
untitled="work-${id:0:2}"

# The title on the session's record, or "none" when there is no record
title() {
  node -e '
    const fs = require("node:fs")
    const file = process.argv[1]
    process.stdout.write(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).title : "none")
  ' "$home/sessions/$id.json"
}

# The request the desktop app sends to rename a session
rename() {
  node -e '
    const [title, id] = process.argv.slice(1)
    const request = { subtype: "rename_session", title, source: "host", session_id: id }
    process.stdout.write(JSON.stringify({ type: "control_request", request_id: `rename-${Date.now()}`, request }) + "\n")
  ' "$1" "$id"
}

# What the window's close button does: every session on air before now tunes out
close_window() {
  node -e 'require("node:fs").writeFileSync(process.argv[1], JSON.stringify({ v: 1, closedAt: Date.now() }))' "$home/control.json"
}

command='{"type":"user","message":{"role":"user","content":"/pipcast"}}'

(
  echo "$command"
  sleep 3
  echo "start $(title)" >>"$notes"
  rename "Renamed on air"
  sleep 4
  echo "on-air $(title)" >>"$notes"
  echo "$command"
  sleep 2
  rename "Renamed off air"
  sleep 1
  echo "$command"
  sleep 1
  echo "back $(title)" >>"$notes"
  close_window
  sleep 12
  echo "closed $(title)" >>"$notes"
  rename "Renamed after the close"
  sleep 1
  echo "$command"
  sleep 1
  echo "after-close $(title)" >>"$notes"
) | (
  cd "$work" &&
    CLAUDE_CONFIG_DIR="$config" \
      PIPCAST_HOME="$home" \
      PIPCAST_STATION_BIN="$station" \
      PIPCAST_TARGET_BUNDLE_ID=com.example.pipcast.never-frontmost \
      CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 \
      "$claude" -p \
      --input-format stream-json --output-format stream-json --verbose \
      --model haiku --session-id "$id" --plugin-dir "$root/plugin"
) >"$out" 2>&1

sleep 1
echo "running $(pgrep -f "$tmp" | wc -l | tr -d ' ')" >>"$notes"

failed=0

check() { # fixed text to find, in a file, and what it shows
  if grep -qxF -- "$1" "$2"; then
    echo "ok   $3"
  else
    echo "FAIL $3"
    failed=1
  fi
}

check "start $untitled" "$notes" "tuned in with no title yet, the session goes by its default name"
check "on-air Renamed on air" "$notes" "a rename while on air reached the record"
check "back Renamed off air" "$notes" "tuning in again carried the rename made while tuned out"
check "closed none" "$notes" "the window's close took the session off the air"
check "after-close Renamed after the close" "$notes" "tuning in after the close carried the newest title"
check "running 0" "$notes" "nothing is left running"

if [[ "$failed" -eq 0 ]]; then
  echo "title verified"
else
  echo "title check failed"
  cat "$notes"
  tail -c 2000 "$out"
fi

exit "$failed"
