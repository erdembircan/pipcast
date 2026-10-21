#!/bin/bash
# Renders the four jingles into plugin/station/sounds, only when one of them
# or SOURCE is missing, or SOURCE (the SHA-256 of the design system's bundle
# they were rendered from) differs from the bundle's hash now.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

sounds="plugin/station/sounds"
names=(breaking breaking-out hour hour-out)

stale=0
for name in "${names[@]}"; do
  if [ ! -f "$sounds/$name.m4a" ]; then
    stale=1
  fi
done

if [ ! -f "$sounds/SOURCE" ]; then
  stale=1
elif [ "$(cat "$sounds/SOURCE")" != "$(shasum -a 256 design/components/bundle.js | cut -d ' ' -f 1)" ]; then
  stale=1
fi

if [ "$stale" = 1 ]; then
  npm run build:jingles
else
  echo "jingles are up to date"
fi
