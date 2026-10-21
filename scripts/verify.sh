#!/bin/bash
# Runs the four real-world checks in order and stops at the first failure:
# the station against the window server, the mod in a headless session, the
# whole broadcast end to end, and an install from this clone into a throwaway
# configuration. Run it from a terminal; the terminal keeps the keyboard
# throughout.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

for script in verify-station verify-mod verify-e2e verify-install; do
  echo "######## $script"
  bash "scripts/$script.sh"
done

echo "verify: all checks passed"
