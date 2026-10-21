#!/bin/bash
# Renders the four jingles into plugin/station/sounds, only when one is
# missing or the design system's bundle is newer than the newest of them.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

sounds="plugin/station/sounds"
names=(breaking breaking-out hour hour-out)

stale=0
newest=""
for name in "${names[@]}"; do
  file="$sounds/$name.m4a"
  if [ ! -f "$file" ]; then
    stale=1
  elif [ -z "$newest" ] || [ "$file" -nt "$newest" ]; then
    newest="$file"
  fi
done

if [ "$stale" = 0 ] && [ -n "$(find design/components/bundle.js -newer "$newest")" ]; then
  stale=1
fi

if [ "$stale" = 1 ]; then
  npm run build:jingles
else
  echo "jingles are up to date"
fi
