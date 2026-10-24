#!/bin/bash
# Renders assets/icon.svg to PNGs at 1024, 512, 256 and 128 pixels, and every
# layer in assets/icon-layers to a 2048-pixel PNG in assets/icon-layers/png,
# all with a transparent ground, with the Chrome on this Mac. Then it stamps
# scripts/build.d/icon.SOURCE with the hash of what they were rendered from.
# scripts/build.sh ships the 512 one as the plugin's icon, which its manifest
# names.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

render() {
  rm -f "$2"
  local page="$tmp/$(basename "$2").html"
  printf '<!doctype html><html><body style="margin:0;background:transparent"><img src="file://%s" width="%s" height="%s" style="display:block"></body></html>' \
    "$1" "$3" "$3" > "$page"
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --default-background-color=00000000 --window-size="$3,$3" \
    --user-data-dir="$tmp/profile" --screenshot="$2" "file://$page" >/dev/null 2>&1
  [ -s "$2" ] || { echo "Chrome wrote nothing for $1" >&2; exit 1; }
}

for size in 1024 512 256 128; do
  render "$root/assets/icon.svg" "$root/assets/icon-$size.png" "$size"
done

mkdir -p "$root/assets/icon-layers/png"
rm -f "$root"/assets/icon-layers/png/*.png
for svg in "$root"/assets/icon-layers/*.svg; do
  render "$svg" "$root/assets/icon-layers/png/$(basename "$svg" .svg).png" 2048
done

bash "$root/scripts/icon-source.sh" > "$root/scripts/build.d/icon.SOURCE"
