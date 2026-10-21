#!/bin/bash
# The station's Swift tests. The Command Line Tools ship Swift Testing but
# leave its macro plugin off the default plugin path; Xcode's toolchain finds
# it by itself.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
plugins="/Library/Developer/CommandLineTools/usr/lib/swift/host/plugins/testing"

if [[ "$(xcode-select -p)" == "/Library/Developer/CommandLineTools" && -d "$plugins" ]]; then
  swift test --package-path "$root/station" -Xswiftc -plugin-path -Xswiftc "$plugins"
else
  swift test --package-path "$root/station"
fi
