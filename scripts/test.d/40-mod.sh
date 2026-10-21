#!/bin/bash
# The mod's manifest and hooks validated strictly, and its kit tests run, on the
# engine bundled with the Claude desktop app.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

claude="$(bash scripts/claude-bin.sh)"
"$claude" plugin validate --strict ./plugin
"$claude" plugin test plugin
