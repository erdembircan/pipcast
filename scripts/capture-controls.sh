#!/bin/bash
# Shows the real broadcast in a station of its own (a temporary home, one live session, a target app that is never
# frontmost), with the window's controls on, and saves the station's own picture of its window to
# artifacts/station/controls.png, for checking the glass by eye. Needs an unlocked screen.
# With PIPCAST_CAPTURE_LOG=1 it also prints the station's log.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

bash scripts/build.d/10-station.sh
swift build -c release --package-path station --product station-inspect
bin="$(swift build -c release --package-path station --show-bin-path)"
station="$root/plugin/station/pipcast-station"
inspect="$bin/station-inspect"

if [[ "$("$inspect" locked)" == "locked" ]]; then
  echo "skipped: screen locked (the controls' picture)"
  exit 0
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/pipcast-capture.XXXXXX")"
home="$work/home"
mkdir -p "$home/sessions"

keeper=""
cleanup() {
  [[ -n "$keeper" ]] && kill "$keeper" 2>/dev/null || true
  "$station" stop --home "$home" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

now_ms() { echo $(( $(date +%s) * 1000 )); }

# A live session record, written whole to a temporary name and renamed into place.
write_record() {
  local now tuned="$1"
  now="$(now_ms)"
  printf '{"v":1,"id":"capture","title":"Write release notes for 2.4","project":"docs-site","state":"working","stateAt":%s,"tunedInAt":%s,"checkedInAt":%s,"stories":[],"activity":[],"hours":[]}\n' \
    "$now" "$tuned" "$now" > "$home/sessions/capture.json.tmp"
  mv "$home/sessions/capture.json.tmp" "$home/sessions/capture.json"
}

tuned="$(now_ms)"
write_record "$tuned"
( while true; do sleep 5; write_record "$tuned"; done ) &
keeper=$!
disown "$keeper"

PIPCAST_SELF_CAPTURE="$work/controls.png" "$station" launch --home "$home" --assets "$root/plugin/station" \
  --target-bundle-id com.example.pipcast.never-frontmost >/dev/null

end=$(( SECONDS + 10 ))
while (( SECONDS < end )) && [[ ! -s "$work/controls.png" ]]; do sleep 0.2; done
if [[ ! -s "$work/controls.png" ]]; then
  [[ "${PIPCAST_CAPTURE_LOG:-}" == "1" ]] && cat "$home/station.log" >&2 || true
  echo "FAIL the station wrote no picture within 10 s" >&2
  exit 1
fi

mkdir -p "$root/artifacts/station"
cp "$work/controls.png" "$root/artifacts/station/controls.png"
width="$(sips -g pixelWidth "$work/controls.png" | awk '/pixelWidth/ {print $2}')"
height="$(sips -g pixelHeight "$work/controls.png" | awk '/pixelHeight/ {print $2}')"
echo "$root/artifacts/station/controls.png (${width}x${height})"
if [[ "${PIPCAST_CAPTURE_LOG:-}" == "1" ]]; then
  echo "== station.log"
  cat "$home/station.log"
fi
