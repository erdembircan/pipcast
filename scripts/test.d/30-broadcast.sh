#!/bin/bash
# Builds the page, draws every fixture with it and checks that each picture
# exists and is not blank.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

npm run build:web
npm run render:fixtures

failed=0
for fixture in packages/renderer/fixtures/*.json; do
  name="$(basename "$fixture" .json)"
  picture="artifacts/fixtures/$name.png"
  if [ ! -f "$picture" ]; then
    echo "missing: $picture"
    failed=1
    continue
  fi
  size="$(stat -f%z "$picture")"
  if [ "$size" -le 20480 ]; then
    echo "blank: $picture is $size bytes"
    failed=1
  fi
done

exit "$failed"
