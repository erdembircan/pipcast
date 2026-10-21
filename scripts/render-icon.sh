#!/bin/bash
# Renders assets/icon.svg to PNGs with a transparent ground, with the Chrome on
# this Mac, and copies the 512 one to the plugin, whose manifest names it.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for size in 1024 512 256 128; do
  page="$tmp/icon-$size.html"
  printf '<!doctype html><html><body style="margin:0;background:transparent"><img src="file://%s/assets/icon.svg" width="%s" height="%s" style="display:block"></body></html>' \
    "$root" "$size" "$size" > "$page"
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --default-background-color=00000000 --window-size="$size,$size" \
    --user-data-dir="$tmp/profile" --screenshot="$root/assets/icon-$size.png" "file://$page" >/dev/null 2>&1
done

mkdir -p "$root/plugin/assets"
cp "$root/assets/icon-512.png" "$root/plugin/assets/icon.png"
