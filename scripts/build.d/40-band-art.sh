#!/bin/bash
# Writes the band's lettering outlines (packages/mod/src/core/art.generated.ts).
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

npm run build:band-art
