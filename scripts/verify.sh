#!/bin/bash
# Runs the five real-world checks in order and stops at the first failure: the
# station against the window server, the mod in a headless session, a headless
# session renamed on air, off air and after the window's close, the whole
# broadcast end to end, and an install from this clone into a throwaway
# configuration. Run it from a terminal; the terminal keeps the keyboard
# throughout.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

for script in verify-station verify-mod verify-title verify-e2e verify-install; do
  echo "######## $script"
  bash "scripts/$script.sh"
done

echo "verify: all checks passed"
