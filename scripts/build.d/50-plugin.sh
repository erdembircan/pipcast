#!/bin/bash
# Bundles the mod into plugin/hooks, lays its manifest, state contract, icon and
# license beside it, and checks that plugin/ holds exactly what ships. It runs
# last: the bundle takes in the band's artwork, and the check takes in the
# station, its page and its jingles.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

npm run build:plugin
