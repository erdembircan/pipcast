#!/bin/bash
# Checks the real station binary against the window server, with no window of
# the user's involved: a temporary home, a temporary assets folder holding the
# test page, and a target bundle id that is either never frontmost or is the
# frontmost app itself. Run it from a terminal; the terminal keeps the keyboard
# throughout, and station-inspect fails the run if the station ever takes it.
# Transparent window is checked by the opacity the window server shows, which
# has to match wherever the pointer happens to be: nothing here moves it.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

bash scripts/build.d/10-station.sh
swift build -c release --package-path station --product station-inspect
bin="$(swift build -c release --package-path station --show-bin-path)"
station="$root/plugin/station/pipcast-station"
inspect="$bin/station-inspect"

# A locked session has no frontmost app worth trying and a page that never counts as
# visible: the steps that need an unlocked screen print "skipped: screen locked".
locked=false
[[ "$("$inspect" locked)" == "locked" ]] && locked=true

work="$(mktemp -d "${TMPDIR:-/tmp}/pipcast-verify.XXXXXX")"
home="$work/home"
assets="$work/assets"
mkdir -p "$home/sessions" "$assets"
cp -R "$root/station/Tests/Fixtures/web" "$assets/web"

keeper=""
pids=()

cleanup() {
  [[ -n "$keeper" ]] && kill "$keeper" 2>/dev/null || true
  "$station" stop --home "$home" >/dev/null 2>&1 || true
  for pid in "${pids[@]:-}"; do
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  done
  rm -rf "$work"
}
trap cleanup EXIT

step() { echo "== $*"; }
die() { echo "FAIL $*" >&2; exit 1; }

now_ms() { echo $(( $(date +%s) * 1000 )); }

# A live session record, written whole to a temporary name and renamed into place.
write_record() {
  local now tuned="$1"
  now="$(now_ms)"
  printf '{"v":1,"id":"verify","title":"Verify","project":"pipcast","state":"working","stateAt":%s,"tunedInAt":%s,"checkedInAt":%s,"stories":[],"activity":[],"hours":[]}\n' \
    "$now" "$tuned" "$now" > "$home/sessions/verify.json.tmp"
  mv "$home/sessions/verify.json.tmp" "$home/sessions/verify.json"
}

# Transparent window, as the mods write it for the station.
write_options() { # <true|false>
  printf '{"v":1,"transparent":%s}\n' "$1" > "$home/options.json.tmp"
  mv "$home/options.json.tmp" "$home/options.json"
}

wait_for() { # <seconds> <description> <command...>
  local seconds="$1" what="$2"
  shift 2
  local end=$(( SECONDS + seconds ))
  while (( SECONDS < end )); do
    if "$@" 2>/dev/null; then return 0; fi
    sleep 0.1
  done
  die "timed out waiting for $what"
}

status_has_pid() { grep -q "\"pid\":$1" "$home/station.json"; }
log_lines() { wc -l < "$home/station.log" 2>/dev/null | tr -d ' ' || echo 0; }

step "a live session"
tuned="$(now_ms)"
write_record "$tuned"
( while true; do sleep 5; write_record "$tuned"; done ) &
keeper=$!

step "launch twice"
out="$("$station" launch --home "$home" --assets "$assets" --target-bundle-id com.example.pipcast.never-frontmost)"
[[ "$out" =~ ^started\ ([0-9]+)$ ]] || die "first launch printed: $out"
pid="${BASH_REMATCH[1]}"
pids+=("$pid")
wait_for 5 "the station to write station.json" status_has_pid "$pid"
out="$("$station" launch --home "$home" --assets "$assets" --target-bundle-id com.example.pipcast.never-frontmost)"
[[ "$out" == "running $pid" ]] || die "second launch printed: $out (expected: running $pid)"
echo "ok   started $pid, then running $pid"

step "the window is shown"
"$inspect" expect "$pid" shown bottom-right 1
# Informational: what the page counts as while its window is on screen.
if wait_for 5 "the page to report its visibility" grep -q 'visibilityState' "$home/station.log"; then
  echo "info the page's document.visibilityState while the window is on screen (screen $("$inspect" locked)): $(grep 'visibilityState' "$home/station.log" | tail -n 1 | sed 's/.*visibilityState //')"
fi

step "Transparent window"
write_options true
"$inspect" expect "$pid" alpha on
grep -q ' transparent on$' "$home/station.log" || die "the station never logged Transparent window on"

step "the window hides at once"
# With nothing on air the station hides the window, then quits 5 s later. The window has to leave the screen as
# the station logs that it hid it, not at the end of a fade a quarter of a second later.
"$inspect" expect "$pid" gone-within 100 "$home/station.log" &
watcher=$!
sleep 0.3
kill "$keeper" 2>/dev/null || true
wait "$keeper" 2>/dev/null || true
keeper=""
rm -f "$home/sessions/verify.json"
wait "$watcher" || die "the window lingered after the station hid it"
# Back on air before the station's 5 s are up.
tuned="$(now_ms)"
write_record "$tuned"
( while true; do sleep 5; write_record "$tuned"; done ) &
keeper=$!
"$inspect" expect "$pid" shown bottom-right 1
# It comes back with Transparent window still on: faded, unless the pointer is on it.
"$inspect" expect "$pid" alpha on
write_options false
"$inspect" expect "$pid" alpha off
grep -q ' spaces: off the target' "$home/station.log" || die "the station cannot reach the window server's Spaces"
echo "ok   the station can keep its window off the target's own full-screen Spaces"

step "stop, then launch again"
out="$("$station" stop --home "$home")"
[[ "$out" == "stopped $pid" ]] || die "stop printed: $out"
[[ ! -e "$home/station.json" ]] || die "station.json is still there after stop"
echo "ok   stopped $pid, and station.json is gone"
before="$(log_lines)"
if $locked; then
  target="com.example.pipcast.never-frontmost"
else
  target="$("$inspect" frontmost | cut -d' ' -f1)"
  [[ -n "$target" && "$target" != "none" ]] || die "no frontmost app to use as the target"
fi
out="$("$station" launch --home "$home" --assets "$assets" --target-bundle-id "$target")"
[[ "$out" =~ ^started\ ([0-9]+)$ ]] || die "launch after stop printed: $out"
pid2="${BASH_REMATCH[1]}"
pids+=("$pid2")
wait_for 5 "the station to write station.json" status_has_pid "$pid2"
if $locked; then
  echo "skipped: screen locked (the hidden-behind-the-frontmost-app trial)"
else
  # The station says so in its log once it has decided; only then is "hidden" more than a window not yet made.
  wait_for 5 "the station to decide to hide" bash -c "tail -n +$(( before + 1 )) '$home/station.log' | grep -q ' hidden\$'"
  "$inspect" expect "$pid2" hidden
fi

step "the station quits when nothing is on air"
kill "$keeper" 2>/dev/null || true
wait "$keeper" 2>/dev/null || true
keeper=""
rm -f "$home/sessions/verify.json"
gone() { ! kill -0 "$pid2" 2>/dev/null && [[ ! -e "$home/station.json" ]]; }
wait_for 8 "the station to quit and station.json to go" gone
echo "ok   the station quit and station.json is gone"

step "a snapshot"
echo '{"scene": {}}' > "$work/input.json"
"$station" snapshot --assets "$assets" --input "$work/input.json" --out "$work/still.png"
width="$(sips -g pixelWidth "$work/still.png" | awk '/pixelWidth/ {print $2}')"
height="$(sips -g pixelHeight "$work/still.png" | awk '/pixelHeight/ {print $2}')"
[[ "$width" == "1432" && "$height" == "806" ]] || die "snapshot is ${width}x${height}, expected 1432x806"
echo "ok   still.png is ${width}x${height}"

step "minimized to the side"
# A station that starts minimized shows only the tab. A story that lands brings the window out, with the real
# page, and the window goes back into the side when the story ends.
"$station" stop --home "$home" >/dev/null 2>&1 || true
printf '{"v":1,"sound":false,"quadrant":"bottom-right","scale":1,"lastReportAt":null,"minimized":true}\n' > "$home/prefs.json"
tuned="$(now_ms)"
write_record "$tuned"
( while true; do sleep 5; write_record "$tuned"; done ) &
keeper=$!
out="$("$station" launch --home "$home" --assets "$root/plugin/station" --target-bundle-id com.example.pipcast.never-frontmost)"
[[ "$out" =~ ^started\ ([0-9]+)$ ]] || die "launch for the minimized step printed: $out"
pid3="${BASH_REMATCH[1]}"
pids+=("$pid3")
wait_for 5 "the station to write station.json" status_has_pid "$pid3"
"$inspect" expect "$pid3" minimized bottom-right 1
# A fresh needs-input story, kept fresh so the desk runs its whole length.
story_at="$(now_ms)"
write_story_record() {
  local now
  now="$(now_ms)"
  printf '{"v":1,"id":"verify","title":"Verify","project":"pipcast","state":"needs-input","stateAt":%s,"tunedInAt":%s,"checkedInAt":%s,"stories":[{"id":"verify:1","kind":"needs-input","at":%s,"command":"npm install"}],"activity":[],"hours":[]}\n' \
    "$story_at" "$tuned" "$now" "$story_at" > "$home/sessions/verify.json.tmp"
  mv "$home/sessions/verify.json.tmp" "$home/sessions/verify.json"
}
kill "$keeper" 2>/dev/null || true
wait "$keeper" 2>/dev/null || true
write_story_record
( while true; do sleep 5; write_story_record; done ) &
keeper=$!
"$inspect" expect "$pid3" shown bottom-right 1
wait_for 25 "the window to go back into the side" "$inspect" expect "$pid3" minimized bottom-right 1 >/dev/null
grep -q ' out for a segment$' "$home/station.log" || die "the station never logged the window coming out for a segment"
grep -q ' back to the side$' "$home/station.log" || die "the station never logged the window going back to the side"
echo "ok   the window came out for a story and went back into the side"

echo "verify-station: all checks passed"
