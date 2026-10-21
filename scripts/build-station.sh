#!/bin/bash
# Builds the station in release mode and puts the binary in plugin/station.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

swift build -c release --package-path station --product pipcast-station
bin="$(swift build -c release --package-path station --show-bin-path)"

mkdir -p plugin/station
cp "$bin/pipcast-station" plugin/station/pipcast-station
chmod 755 plugin/station/pipcast-station

size="$(wc -c < plugin/station/pipcast-station | tr -d ' ')"
echo "plugin/station/pipcast-station: $size bytes ($(lipo -archs plugin/station/pipcast-station))"
