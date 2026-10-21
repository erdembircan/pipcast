#!/bin/bash
# Runs every scripts/test.d/*.sh in name order, from the repository root,
# and stops at the first failure.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

shopt -s nullglob
for file in scripts/test.d/*.sh; do
  echo "== $file"
  bash "$file"
done
