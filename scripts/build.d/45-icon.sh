#!/bin/bash
# Draws the icon and its layers (scripts/build-icon.mjs), then renders their
# PNGs, only when one of them or the stamp scripts/build.d/icon.SOURCE is
# missing, or the stamp differs from the hash of what they are rendered from
# now. They render only on a Mac, with its Chrome: anywhere else, as on CI,
# stale PNGs are an error.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

stamp="scripts/build.d/icon.SOURCE"

npm run build:icon

stale=0
for size in 1024 512 256 128; do
  if [ ! -f "assets/icon-$size.png" ]; then
    stale=1
  fi
done
for svg in assets/icon-layers/*.svg; do
  if [ ! -f "assets/icon-layers/png/$(basename "$svg" .svg).png" ]; then
    stale=1
  fi
done

if [ ! -f "$stamp" ]; then
  stale=1
elif [ "$(cat "$stamp")" != "$(bash scripts/icon-source.sh)" ]; then
  stale=1
fi

if [ "$stale" = 1 ]; then
  if [ "$(uname -s)" != Darwin ]; then
    echo "The icon's PNGs were rendered from another drawing. Run scripts/build.sh on a Mac and commit what it builds." >&2
    exit 1
  fi
  npm run render:icon
else
  echo "the icon's PNGs are up to date"
fi
