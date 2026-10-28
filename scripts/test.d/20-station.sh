#!/bin/bash
# The station's Swift tests, and the development build of the station, which
# scripts/build-dev.sh makes, compiled as it compiles it: CI compiles no Swift,
# so this is where the code only that build has, inside #if PIPCAST_DEV, is
# checked. The Command Line Tools ship Swift Testing but leave its macro plugin
# off the default plugin path; Xcode's toolchain finds it by itself.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
plugins="/Library/Developer/CommandLineTools/usr/lib/swift/host/plugins/testing"

if [[ "$(xcode-select -p)" == "/Library/Developer/CommandLineTools" && -d "$plugins" ]]; then
  swift test --package-path "$root/station" -Xswiftc -plugin-path -Xswiftc "$plugins"
else
  swift test --package-path "$root/station"
fi

swift build -c release --package-path "$root/station" --product pipcast-station -Xswiftc -DPIPCAST_DEV --scratch-path "$root/.dev/swift"
