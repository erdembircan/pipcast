#!/bin/bash
# Builds the station binary into plugin/station, only when it or the stamp
# scripts/build.d/station.SOURCE is missing, or the stamp (the hash of the
# sources it was built from) differs from the sources' hash now. The station
# builds only on a Mac: anywhere else, as on CI, a stale binary is an error.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

binary="plugin/station/pipcast-station"
stamp="scripts/build.d/station.SOURCE"

if [ ! -f "$binary" ] || [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$(bash scripts/station-source.sh)" ]; then
  if [ "$(uname -s)" != Darwin ]; then
    echo "plugin/station/pipcast-station was built from other sources. Run scripts/build.sh on a Mac and commit what it builds." >&2
    exit 1
  fi
  bash scripts/build-station.sh
else
  echo "the station is up to date"
fi
