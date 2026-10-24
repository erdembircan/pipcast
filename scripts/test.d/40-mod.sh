#!/bin/bash
# The mod as it ships, on the engine bundled with the Claude desktop app: it is
# built into plugin/, plugin/ is validated strictly, and the kit tests in
# packages/mod/kit run against it. claude plugin test loads the plugin from the
# folder it is given and runs every test under that folder, so the kit and the
# sources it takes its words from are laid beside a copy of plugin/ in a
# temporary folder, with no other test among them.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

npm run build:plugin

claude="$(bash scripts/claude-bin.sh)"
"$claude" plugin validate --strict ./plugin

stage="$(mktemp -d "${TMPDIR:-/tmp}/pipcast-kit.XXXXXX")"
trap 'rm -rf "$stage"' EXIT
cp -R plugin/. "$stage/"
mkdir -p "$stage/packages/contract" "$stage/packages/mod"
cp -R packages/contract/src "$stage/packages/contract/src"
cp -R packages/mod/src packages/mod/kit "$stage/packages/mod/"
"$claude" plugin test "$stage"
