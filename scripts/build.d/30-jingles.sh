#!/bin/bash
# Renders the four jingles into plugin/station/sounds, only when one of them or
# the stamp scripts/build.d/jingles.SOURCE is missing, or the stamp (the
# SHA-256 of the design system's bundle they were rendered from) differs from
# the bundle's hash now. They render only on a Mac: anywhere else, as on CI,
# stale jingles are an error.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

sounds="plugin/station/sounds"
stamp="scripts/build.d/jingles.SOURCE"
names=(breaking breaking-out hour hour-out)

stale=0
for name in "${names[@]}"; do
  if [ ! -f "$sounds/$name.m4a" ]; then
    stale=1
  fi
done

if [ ! -f "$stamp" ]; then
  stale=1
elif [ "$(cat "$stamp")" != "$(shasum -a 256 design/components/bundle.js | cut -d ' ' -f 1)" ]; then
  stale=1
fi

if [ "$stale" = 1 ]; then
  if [ "$(uname -s)" != Darwin ]; then
    echo "The jingles in plugin/station/sounds were rendered from another design/components/bundle.js. Run scripts/build.sh on a Mac and commit what it builds." >&2
    exit 1
  fi
  npm run build:jingles
else
  echo "jingles are up to date"
fi
