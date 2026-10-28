#!/bin/bash
# scripts/live.sh in a throwaway world: a bare copy of this repository as origin,
# with a pull request's ref, a clone of it as the main checkout, the live
# checkout beside that clone, two stand-in marketplaces with master's plugin/ as
# a release of Pipcast, which the test installs the way the app would, a store
# of its own for the station, and a throwaway Claude configuration for the
# marketplaces. A copy from Anthropic's plugin directory or an upload can't be
# made here, neither a terminal's pipcast@synced nor the one the desktop app
# hands in: those go untested.
# Your clone, your live checkout, your station and your configuration are never
# read or changed. The temporary folder is removed on exit.
# The live checkout's build here is its plugin/ as it is
# (PIPCAST_LIVE_BUILD=release): the development build takes npm and Swift,
# and scripts/test.d/60-dev.sh tries it.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/pipcast-test-live.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

claude="$(bash "$root/scripts/claude-bin.sh")"
export CLAUDE_CONFIG_DIR="$tmp/config"
export PIPCAST_HOME="$tmp/store"
# The live checkout's build is its plugin/ as it is: no npm or Swift here
export PIPCAST_LIVE_BUILD=release
mkdir -p "$CLAUDE_CONFIG_DIR"

git clone -q --bare "$root" "$tmp/origin.git"
# A pull request whose head is master's parent
git -C "$tmp/origin.git" update-ref refs/pull/7/head "$(git -C "$tmp/origin.git" rev-parse 'master~1')"
git clone -q "$tmp/origin.git" "$tmp/pipcast"
# The script under test, in the throwaway main checkout
cp "$root/scripts/live.sh" "$tmp/pipcast/scripts/live.sh"
live="$tmp/pipcast/scripts/live.sh"
# Where live.sh keeps the releases it turned off
record="$tmp/pipcast/.git/pipcast-live-releases"

# A stand-in for erdembircan-plugins, with master's plugin/ as a release
erdembircan="$tmp/erdembircan-plugins"
mkdir -p "$erdembircan/.claude-plugin"
cp -R "$tmp/pipcast/plugin" "$erdembircan/pipcast"
cat >"$erdembircan/.claude-plugin/marketplace.json" <<'EOF'
{
  "name": "erdembircan-plugins",
  "description": "A stand-in for erdembircan/plugin-marketplace",
  "owner": { "name": "Erdem Bircan" },
  "plugins": [{ "name": "pipcast", "source": "./pipcast" }]
}
EOF

# Another place that lists Pipcast
other="$tmp/other-plugins"
mkdir -p "$other/.claude-plugin"
cp -R "$tmp/pipcast/plugin" "$other/pipcast"
cat >"$other/.claude-plugin/marketplace.json" <<'EOF'
{
  "name": "other-plugins",
  "description": "A stand-in for another place that lists Pipcast",
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

# Succeeds when a release is gone from the configuration but its marketplace is not
uninstalled_but_listed() {
  [[ "$(state pipcast@erdembircan-plugins)" == missing ]] && knows erdembircan-plugins
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

check "with nothing installed, it says the app runs no Pipcast from Claude Code's plugin list" grep -qF "The app runs no Pipcast from Claude Code's plugin list." <<<"$("$live" 2>&1 || true)"
check "and that a copy from Anthropic's plugin directory or an upload never shows there" grep -qF "never shows in that list" <<<"$("$live" 2>&1 || true)"
check "with no live checkout, pr says to run setup" grep -q "run scripts/live.sh setup" <<<"$("$live" pr 7 2>&1 || true)"
check "with nothing installed, published installs nothing" quietly "$live" published
check "and turns nothing on" test "$(state pipcast@pipcast)" = missing

"$live" setup >/dev/null
check "setup makes the live checkout beside the clone, on master" test "$(runs)" = "$master"
check "setup points the pipcast marketplace at the live checkout's build, in .dev/marketplace" grep -qE 'Folder \(.*/pipcast-live/\.dev/marketplace\)' <<<"$("$claude" plugin marketplace list 2>&1)"
check "which holds the commit's plugin/" cmp -s "$tmp/pipcast-live/plugin/.claude-plugin/plugin.json" "$tmp/pipcast-live/.dev/marketplace/plugin/.claude-plugin/plugin.json"
check "and names the commit it was built from" test "$(cat "$tmp/pipcast-live/.dev/marketplace/BUILT-FROM")" = "$master"
check "while the live checkout stays clean around it" test -z "$(git -C "$tmp/pipcast-live" status --porcelain)"
check "setup installs pipcast@pipcast and turns it on" test "$(state pipcast@pipcast)" = enabled
check "it says the app runs master" grep -q "That is master." <<<"$("$live")"
check "setup again keeps the live checkout" grep -q "already at" <<<"$("$live" setup)"

# The way the app installs a release: from a marketplace, at user scope
"$claude" plugin marketplace add "$erdembircan" >/dev/null
"$claude" plugin marketplace add "$other" >/dev/null
"$claude" plugin install pipcast@erdembircan-plugins --scope user >/dev/null
"$claude" plugin install pipcast@other-plugins --scope user >/dev/null
"$claude" plugin disable pipcast@other-plugins --scope user >/dev/null
check "with the live checkout and a release both on, it says both are on" grep -q "Both are on" <<<"$("$live")"

"$live" published >/dev/null
check "published turns the live checkout off" test "$(state pipcast@pipcast)" = disabled
check "and leaves the release on" test "$(state pipcast@erdembircan-plugins)" = enabled
check "and a release that was off stays off" test "$(state pipcast@other-plugins)" = disabled
check "it says the app runs the release" grep -q "The app runs the release, pipcast@erdembircan-plugins" <<<"$("$live")"

"$live" pr 7 >/dev/null
check "pr puts a pull request's head in the app" test "$(runs)" = "$parent"
check "and turns the live checkout on" test "$(state pipcast@pipcast)" = enabled
check "and turns the release off" test "$(state pipcast@erdembircan-plugins)" = disabled
check "it remembers the release it turned off" grep -qxF "pipcast@erdembircan-plugins" "$record"
check "and not the one that was already off" not quietly grep -qxF "pipcast@other-plugins" "$record"
check "and builds the pull request's head for the app" test "$(cat "$tmp/pipcast-live/.dev/marketplace/BUILT-FROM")" = "$parent"

out="$("$live" master)"
check "master puts master in the app" test "$(runs)" = "$master"
check "a commit with no development build goes in as it is, and it says so" grep -qF "which takes no cues" <<<"$out"
"$claude" plugin marketplace add "$tmp/pipcast-live" >/dev/null
check "with the pipcast marketplace pointed elsewhere, it says so" grep -qF "not at the live checkout's build" <<<"$("$live")"
"$live" master >/dev/null
check "and a move points it at the build again" grep -qE 'Folder \(.*/pipcast-live/\.dev/marketplace\)' <<<"$("$claude" plugin marketplace list 2>&1)"
check "restart with no station on air says so" grep -qF "No station is on air." <<<"$("$live" restart)"
check "story with no development build on air fails, and says why" grep -qE "comes before cues|No station is on air" <<<"$("$live" story 2>&1 || true)"
check "and exits with an error" not quietly "$live" story

"$live" "$parent" >/dev/null
check "a commit can be put in the app" test "$(runs)" = "$parent"

"$live" published >/dev/null
check "published turns back on the release it turned off" test "$(state pipcast@erdembircan-plugins)" = enabled
check "and leaves the one that was already off alone" test "$(state pipcast@other-plugins)" = disabled
check "and takes the live checkout out" test "$(state pipcast@pipcast)" = disabled
check "and forgets it" test ! -e "$record"

"$live" master >/dev/null
echo "a change" >>"$tmp/pipcast-live/README.md"
check "a live checkout with changes of its own is not moved" not quietly "$live" "$parent"
check "and stays where it was" test "$(runs)" = "$master"
check "nor removed" not quietly "$live" remove
check "and stays installed" test "$(state pipcast@pipcast)" = enabled
git -C "$tmp/pipcast-live" checkout -q -- README.md

check "an unknown name moves nothing" not quietly "$live" no-such-branch
check "and pr wants a number" not quietly "$live" pr

"$live" remove >/dev/null
check "remove uninstalls pipcast@pipcast" test "$(state pipcast@pipcast)" = missing
check "and removes the pipcast marketplace" not knows pipcast
check "and the live checkout" test ! -e "$tmp/pipcast-live"
check "and turns the release back on" test "$(state pipcast@erdembircan-plugins)" = enabled
check "remove again finds nothing to remove" grep -q "no live checkout to remove" <<<"$("$live" remove)"

"$live" setup >/dev/null
check "setup after remove makes the live checkout again, on master" test "$(runs)" = "$master"
check "and puts it in the app" test "$(state pipcast@pipcast)" = enabled
check "taking the release out" test "$(state pipcast@erdembircan-plugins)" = disabled

"$claude" plugin uninstall pipcast@erdembircan-plugins --scope user >/dev/null
"$claude" plugin uninstall pipcast@other-plugins --scope user >/dev/null
out="$("$live" published 2>&1 || true)"
check "with no release in the list, published takes the live checkout out all the same" test "$(state pipcast@pipcast)" = disabled
check "and installs no release, even from a marketplace Claude Code has" uninstalled_but_listed
check "and says the app now runs no Pipcast from Claude Code's plugin list" grep -qF "It now runs no Pipcast from Claude Code's plugin list." <<<"$out"
check "and that a copy from Anthropic's plugin directory or an upload never shows there" grep -qF "never shows in that list" <<<"$out"

"$live" master >/dev/null
check "master puts the live checkout back in the app" test "$(state pipcast@pipcast)" = enabled
"$live" remove >/dev/null
check "with no release in the list, remove uninstalls pipcast@pipcast all the same" test "$(state pipcast@pipcast)" = missing
check "and removes the live checkout" test ! -e "$tmp/pipcast-live"

exit "$failed"
