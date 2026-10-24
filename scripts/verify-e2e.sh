#!/bin/bash
# The whole broadcast, end to end, with no window of the user's involved: the
# real mod in a real headless Claude Code session on the bundled engine, and the
# real station binary from plugin/station. /pipcast tunes in (a record, a
# station that heartbeats, its window where the window server says it is),
# tunes out (the station quits), and tunes in once more, after which the
# window's close button is imitated and the mod has to tune itself out. No
# model call is made and permissions are left as they are. Everything lives in
# a temporary folder that is removed on every exit, and the station is stopped.
# Run it from a terminal; the terminal keeps the keyboard throughout, and
# station-inspect fails the run if the station ever takes it.
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

claude="$("$root/scripts/claude-bin.sh")"
station="$root/plugin/station/pipcast-station"
[[ -x "$station" ]] || { echo "FAIL $station is missing: run scripts/build.sh" >&2; exit 1; }

swift build -c release --package-path station --product station-inspect >/dev/null || { echo "FAIL station-inspect did not build" >&2; exit 1; }
inspect="$(swift build -c release --package-path station --show-bin-path)/station-inspect"

locked=false
[[ "$("$inspect" locked)" == "locked" ]] && locked=true

tmp="$(mktemp -d "${TMPDIR:-/tmp}/pipcast-verify-e2e.XXXXXX")"
home="$tmp/home"
notes="$tmp/notes.log"
out="$tmp/engine-out.jsonl"
mkdir -p "$home"
: >"$notes"

cleaned=false
cleanup() {
  $cleaned && return 0
  cleaned=true
  "$station" stop --home "$home" >/dev/null 2>&1 || true
  # Anything still running with the temporary folder in its command line: the
  # engine and a station
  pkill -f "$tmp" 2>/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT

words() { # prints one of the command's replies, from the contract
  node -e "import('$root/packages/contract/src/copy.ts').then((m) => process.stdout.write(m.REPLY[process.argv[1]]))" "$1"
}
tuned_in="$(words tunedIn)"
tuned_out="$(words tunedOut)"

record_count() { # how many sessions/*.json there are
  local count=0 file
  for file in "$home"/sessions/*.json; do
    [[ -e "$file" ]] && count=$(( count + 1 ))
  done
  echo "$count"
}

# The station's pid when station.json parses and its heartbeat is live (20 s), else nothing
live_station_pid() {
  [[ -f "$home/station.json" ]] || return 1
  node -e '
    const status = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))
    if (typeof status.pid !== "number" || Date.now() - status.heartbeatAt > 20000) process.exit(1)
    process.stdout.write(String(status.pid))
  ' "$home/station.json"
}

# --- the feeder: the commands the session is sent, and what is checked between them ---

command='{"type":"user","message":{"role":"user","content":"/pipcast"}}'

note() { echo "$*" >>"$notes"; }

wait_for() { # <seconds> <command...>: polls every 0.1 s
  local end=$(( SECONDS + $1 ))
  shift
  while (( SECONDS < end )); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 0.1
  done
  return 1
}

have_record() { [[ "$(record_count)" == "1" ]]; }
no_record() { [[ "$(record_count)" == "0" ]]; }
station_gone() { # the process is gone and station.json has gone with it
  ! kill -0 "$1" 2>/dev/null && [[ ! -e "$home/station.json" ]]
}

feed() {
  local pid

  # 1. tune in: the record and a live station
  echo "$command"
  if wait_for 15 have_record; then note "ok   the first /pipcast wrote the session's record"; else note "FAIL no record after the first /pipcast"; return; fi
  if wait_for 5 live_station_pid; then
    pid="$(live_station_pid)"
    note "ok   station.json appeared with a live heartbeat (pid $pid)"
  else
    note "FAIL station.json did not appear with a live heartbeat within 5 s"
    return
  fi

  # 2. the window is where the window server says
  if "$inspect" expect "$pid" shown bottom-right 1 >>"$notes" 2>&1; then
    note "ok   the window is shown in the bottom-right corner"
  else
    note "FAIL the window is not shown in the bottom-right corner"
  fi

  # 3. a still of the board
  if "$station" snapshot --assets "$root/plugin/station" --input "$root/packages/renderer/fixtures/board.json" --out "$tmp/board.png" >>"$notes" 2>&1 \
    && [[ "$(sips -g pixelWidth "$tmp/board.png" | awk '/pixelWidth/ {print $2}')x$(sips -g pixelHeight "$tmp/board.png" | awk '/pixelHeight/ {print $2}')" == "1432x806" ]]; then
    note "ok   board.png is 1432x806"
  else
    note "FAIL the board snapshot is missing or not 1432x806"
  fi

  # 4. tune out: the record goes and the station quits
  echo "$command"
  if wait_for 8 no_record; then note "ok   the second /pipcast removed the record"; else note "FAIL the record is still there after the second /pipcast"; fi
  if wait_for 8 station_gone "$pid"; then note "ok   the station quit and station.json is gone"; else note "FAIL the station is still running or station.json is still there 8 s after tuning out"; fi

  # 5. tune in a third time, then close the window as its button does
  echo "$command"
  if wait_for 15 have_record && wait_for 5 live_station_pid; then
    pid="$(live_station_pid)"
    note "ok   a third /pipcast wrote the record and started a station (pid $pid)"
  else
    note "FAIL the third /pipcast did not write the record and start a station"
    return
  fi
  # In milliseconds, as the station writes it: a session tuned in during the
  # same second would not count as tuned in before the close
  printf '{"v":1,"closedAt":%s}\n' "$(node -e 'process.stdout.write(String(Date.now()))')" >"$home/control.json.tmp"
  mv "$home/control.json.tmp" "$home/control.json"
  "$station" stop --home "$home" >>"$notes" 2>&1
  if station_gone "$pid"; then note "ok   stop ended the station and removed station.json"; else note "FAIL the station is still running or station.json is still there after stop"; fi
  if wait_for 15 no_record; then note "ok   the mod tuned itself out after the window was closed"; else note "FAIL the record is still there 15 s after the window was closed"; fi
  # Give the mod time to start a station again if it wrongly meant to
  sleep 2
  if station_gone "$pid" && [[ ! -e "$home/station.json" ]]; then note "ok   no station was started again"; else note "FAIL a station is running again"; fi
}

# 6. the session ends when the feeder does
feed | CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 \
  PIPCAST_HOME="$home" \
  PIPCAST_TARGET_BUNDLE_ID=com.example.pipcast.never-frontmost \
  "$claude" -p \
  --input-format stream-json --output-format stream-json --verbose \
  --model haiku --no-session-persistence --plugin-dir "$root/plugin" >"$out" 2>&1

sleep 1

failed=0

echo "info the screen is locked: $locked"

while IFS= read -r line; do
  echo "$line"
  [[ "$line" == FAIL* ]] && failed=1
done <"$notes"
grep -q '^FAIL\|^ok' "$notes" || { echo "FAIL the session never ran its checks"; failed=1; }

check() { # fixed text to find in the engine's output, and what it shows
  if grep -qF -- "$1" "$out"; then
    echo "ok   $2"
  else
    echo "FAIL $2"
    failed=1
  fi
}
check "$tuned_in" "the first /pipcast answered that it tuned in"
check "$tuned_out" "the second /pipcast answered that it tuned out"

if [[ "$failed" -ne 0 ]]; then
  echo "-- the engine's last output"
  tail -c 2000 "$out"
  echo "-- the station's log"
  tail -n 20 "$home/station.log" 2>/dev/null || true
fi

left="$(pgrep -f "$tmp" | wc -l | tr -d ' ')"
if [[ "$left" == "0" ]]; then
  echo "ok   nothing it started is left running"
else
  echo "FAIL $left processes it started are left running"
  failed=1
fi

cleanup
if [[ ! -e "$tmp" ]]; then
  echo "ok   the temporary folder is deleted"
else
  echo "FAIL the temporary folder is still there"
  failed=1
fi

if [[ "$failed" -eq 0 ]]; then
  echo "verify-e2e: all checks passed"
else
  echo "verify-e2e: failed"
fi

exit "$failed"
