#!/bin/bash
# Prints the hex SHA-256 of what the icon's PNGs are rendered from:
# assets/icon.svg, every SVG in assets/icon-layers, and scripts/render-icon.sh.
# They are taken in byte order of their paths from the repository's root, each
# one as its path, a NUL byte and its content.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

{
  echo assets/icon.svg
  find assets/icon-layers -maxdepth 1 -type f -name '*.svg'
  echo scripts/render-icon.sh
} | LC_ALL=C sort | while IFS= read -r file; do
  printf '%s\0' "$file"
  cat "$file"
done | shasum -a 256 | cut -d ' ' -f 1
