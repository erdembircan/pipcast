#!/bin/bash
# The root checks: lint, both type projects, Vitest, the licence, and both
# manifests validated by the engine bundled with the Claude desktop app.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

npm run lint
npm run typecheck
npm test
npx license-wizard --verify --strict

claude="$(bash scripts/claude-bin.sh)"
"$claude" plugin validate --strict .
"$claude" plugin validate --strict ./plugin
