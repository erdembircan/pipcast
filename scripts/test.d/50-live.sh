#!/bin/bash
# scripts/live.sh in a throwaway world: a bare copy of this repository as origin,
# with a pull request's ref, a clone of it as the main checkout, the live
# checkout beside that clone, a stand-in for the erdembircan-plugins
# marketplace holding the published release, a store of its own for the
# station, and a throwaway Claude configuration for both marketplaces. Your
# clone, your live checkout, your station and your configuration are never
# read or changed. The temporary folder is removed on exit.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/pipcast-test-live.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

claude="$(bash "$root/scripts/claude-bin.sh")"
export CLAUDE_CONFIG_DIR="$tmp/config"
export PIPCAST_HOME="$tmp/store"
mkdir -p "$CLAUDE_CONFIG_DIR"

git clone -q --bare "$root" "$tmp/origin.git"
# A pull request whose head is master's parent
git -C "$tmp/origin.git" update-ref refs/pull/7/head "$(git -C "$tmp/origin.git" rev-parse 'master~1')"
git clone -q "$tmp/origin.git" "$tmp/pipcast"
# The script under test, in the throwaway main checkout
cp "$root/scripts/live.sh" "$tmp/pipcast/scripts/live.sh"
live="$tmp/pipcast/scripts/live.sh"

# A stand-in for erdembircan-plugins, with master's plugin/ as the published
# release
published="$tmp/erdembircan-plugins"
mkdir -p "$published/.claude-plugin"
cp -R "$tmp/pipcast/plugin" "$published/pipcast"
cat >"$published/.claude-plugin/marketplace.json" <<'EOF'
{
  "name": "erdembircan-plugins",
  "description": "A stand-in for erdembircan/plugin-marketplace",
  "owner": { "name": "Erdem Bircan" },
  "plugins": [{ "name": "pipcast", "source": "./pipcast" }]
}
EOF

master="$(git -C "$tmp/pipcast" rev-parse origin/master)"
parent="$(git -C "$tmp/pipcast" rev-parse 'origin/master~1')"
runs() { git -C "$tmp/pipcast-live" rev-parse HEAD; }

# enabled, disabled or missing: an install in the throwaway configuration
state() {
  { "$claude" plugin list --json 2>/dev/null || true; } | node -e '
    let plugins = []
    try { plugins = JSON.parse(require("node:fs").readFileSync(0, "utf8")) } catch {}
    const plugin = plugins.find((entry) => entry.id === process.argv[1] && entry.scope === "user")
    process.stdout.write(plugin === undefined ? "missing" : plugin.enabled ? "enabled" : "disabled")
  ' "$1"
}

# Whether the throwaway configuration has a marketplace by that name
knows() {
  { "$claude" plugin marketplace list --json 2>/dev/null || true; } | node -e '
    let markets = []
    try { markets = JSON.parse(require("node:fs").readFileSync(0, "utf8")) } catch {}
    process.exit(markets.some((market) => market.name === process.argv[1]) ? 0 : 1)
  ' "$1"
}

# Runs a command with its output hidden, for a check on how it exits
quietly() {
  "$@" >/dev/null 2>&1
}

# Succeeds when the command it runs fails
not() {
  ! "$@"
}

failed=0

check() { # what it shows, then the test
  local what="$1"
  shift
  if "$@"; then
    echo "ok   $what"
  else
    echo "FAIL $what"
    failed=1
  fi
}

check "with nothing installed, it says the app runs no Pipcast" grep -q "The app runs no Pipcast." <<<"$("$live" 2>&1 || true)"
check "with no live checkout, pr says to run setup" grep -q "run scripts/live.sh setup" <<<"$("$live" pr 7 2>&1 || true)"
check "without erdembircan-plugins, published says to add it" grep -q "claude plugin marketplace add erdembircan/plugin-marketplace" <<<"$("$live" published 2>&1 || true)"
check "and fails" not quietly "$live" published

"$live" setup >/dev/null
check "setup makes the live checkout beside the clone, on master" test "$(runs)" = "$master"
check "setup points the pipcast marketplace at it" grep -qE 'Folder \(.*/pipcast-live\)' <<<"$("$claude" plugin marketplace list 2>&1)"
check "setup installs pipcast@pipcast and turns it on" test "$(state pipcast@pipcast)" = enabled
check "it says the app runs master" grep -q "That is master." <<<"$("$live")"
check "setup again keeps the live checkout" grep -q "already at" <<<"$("$live" setup)"

"$claude" plugin marketplace add "$published" >/dev/null
"$live" published >/dev/null
check "published installs the published release from erdembircan-plugins and turns it on" test "$(state pipcast@erdembircan-plugins)" = enabled
check "and turns the live checkout off" test "$(state pipcast@pipcast)" = disabled
check "it says the app runs the published release" grep -q "The app runs the published release, pipcast@erdembircan-plugins" <<<"$("$live")"

"$claude" plugin enable pipcast@pipcast --scope user >/dev/null
check "with both on, it says every session runs Pipcast twice" grep -q "runs Pipcast twice" <<<"$("$live")"
"$live" published >/dev/null
check "published again turns the live checkout off" test "$(state pipcast@pipcast)" = disabled
check "and keeps the published release on" test "$(state pipcast@erdembircan-plugins)" = enabled

"$live" pr 7 >/dev/null
check "pr puts a pull request's head in the app" test "$(runs)" = "$parent"
check "and turns the live checkout on" test "$(state pipcast@pipcast)" = enabled
check "and the published release off" test "$(state pipcast@erdembircan-plugins)" = disabled

"$live" master >/dev/null
check "master puts master in the app" test "$(runs)" = "$master"

"$live" "$parent" >/dev/null
check "a commit can be put in the app" test "$(runs)" = "$parent"

echo "a change" >>"$tmp/pipcast-live/README.md"
check "a live checkout with changes of its own is not moved" not quietly "$live" master
check "and stays where it was" test "$(runs)" = "$parent"
check "nor removed" not quietly "$live" remove
check "and stays installed" test "$(state pipcast@pipcast)" = enabled
git -C "$tmp/pipcast-live" checkout -q -- README.md

check "an unknown name moves nothing" not quietly "$live" no-such-branch
check "and pr wants a number" not quietly "$live" pr

"$live" remove >/dev/null
check "remove uninstalls pipcast@pipcast" test "$(state pipcast@pipcast)" = missing
check "and removes the pipcast marketplace" not knows pipcast
check "and the live checkout" test ! -e "$tmp/pipcast-live"
check "and puts the published release back" test "$(state pipcast@erdembircan-plugins)" = enabled
check "remove again finds nothing to remove" grep -q "no live checkout to remove" <<<"$("$live" remove)"

"$live" setup >/dev/null
check "setup after remove makes the live checkout again, on master" test "$(runs)" = "$master"
check "and puts it in the app" test "$(state pipcast@pipcast)" = enabled
check "taking the published release out" test "$(state pipcast@erdembircan-plugins)" = disabled

exit "$failed"
