#!/bin/bash
# Builds the page the station shows into plugin/station/web.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

npm run build:web
