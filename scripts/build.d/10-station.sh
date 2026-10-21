#!/bin/bash
# Builds the station binary into plugin/station, only when it or its
# pipcast-station.SOURCE stamp is missing, or the stamp (the hash of the sources
# it was built from) differs from the sources' hash now.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

binary="plugin/station/pipcast-station"
stamp="$binary.SOURCE"

if [ ! -f "$binary" ] || [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$(bash scripts/station-source.sh)" ]; then
  bash scripts/build-station.sh
else
  echo "the station is up to date"
fi
