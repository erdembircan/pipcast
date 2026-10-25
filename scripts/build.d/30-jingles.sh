#!/bin/bash
# Renders the jingles and the beat into plugin/station/sounds, only when one of
# their files or the stamp scripts/build.d/jingles.SOURCE is missing, or the
# stamp (the SHA-256 of the design system's bundle they were rendered from)
# differs from the bundle's hash now. They render only on a Mac: anywhere else,
# as on CI, stale sounds are an error.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

sounds="plugin/station/sounds"
stamp="scripts/build.d/jingles.SOURCE"
files=(breaking.m4a breaking-out.m4a hour.m4a hour-out.m4a beat-minor.caf beat-major.caf)

stale=0
for file in "${files[@]}"; do
  if [ ! -f "$sounds/$file" ]; then
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
    echo "The sounds in plugin/station/sounds were rendered from another design/components/bundle.js. Run scripts/build.sh on a Mac and commit what it builds." >&2
    exit 1
  fi
  npm run build:jingles
else
  echo "the jingles and the beat are up to date"
fi
