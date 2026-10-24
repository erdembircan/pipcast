#!/bin/bash
# Builds the station in release mode and puts the binary in plugin/station. The
# hash of the sources it was built from (scripts/station-source.sh) goes to
# scripts/build.d/station.SOURCE, which build.d/10-station.sh compares.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

# -S: the shipped binary has no debug map, so it carries no path of the machine that built it
swift build -c release --package-path station --product pipcast-station -Xlinker -S
bin="$(swift build -c release --package-path station --show-bin-path)"

mkdir -p plugin/station
cp "$bin/pipcast-station" plugin/station/pipcast-station
chmod 755 plugin/station/pipcast-station
bash scripts/station-source.sh > scripts/build.d/station.SOURCE

size="$(wc -c < plugin/station/pipcast-station | tr -d ' ')"
echo "plugin/station/pipcast-station: $size bytes ($(lipo -archs plugin/station/pipcast-station))"
