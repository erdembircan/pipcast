#!/bin/bash
# The root checks: lint, both type projects, Vitest, the licence, both
# manifests validated strictly by the engine bundled with the Claude desktop
# app, and the plugin against the plugin directory's submission checks: the
# engine's own, and scripts/check-directory.mjs.
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
"$claude" plugin validate --profile directory ./plugin
node scripts/check-directory.mjs
