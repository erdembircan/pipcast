#!/bin/bash
# Builds the station binary into plugin/station.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
bash "$root/scripts/build-station.sh"
