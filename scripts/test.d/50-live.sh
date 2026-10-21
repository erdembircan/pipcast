#!/bin/bash
# scripts/live.sh in a throwaway world: a bare copy of this repository as origin,
# with a pull request's ref, a clone of it as the main checkout, the live
# checkout beside that clone, and a throwaway Claude configuration for the
# marketplace. Your clone, your live checkout and your configuration are never
# read or changed. The temporary folder is removed on exit.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/pipcast-test-live.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

claude="$(bash "$root/scripts/claude-bin.sh")"
export CLAUDE_CONFIG_DIR="$tmp/config"
mkdir -p "$CLAUDE_CONFIG_DIR"

git clone -q --bare "$root" "$tmp/origin.git"
# A pull request whose head is master's parent
git -C "$tmp/origin.git" update-ref refs/pull/7/head "$(git -C "$tmp/origin.git" rev-parse 'master~1')"
git clone -q "$tmp/origin.git" "$tmp/pipcast"
# The script under test, in the throwaway main checkout
cp "$root/scripts/live.sh" "$tmp/pipcast/scripts/live.sh"
live="$tmp/pipcast/scripts/live.sh"

master="$(git -C "$tmp/pipcast" rev-parse origin/master)"
parent="$(git -C "$tmp/pipcast" rev-parse 'origin/master~1')"
runs() { git -C "$tmp/pipcast-live" rev-parse HEAD; }

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

check "with no live checkout, it says to run setup" grep -q "run scripts/live.sh setup" <<<"$("$live" 2>&1 || true)"

"$live" setup >/dev/null
check "setup makes the live checkout beside the clone, on master" test "$(runs)" = "$master"
check "setup points the pipcast marketplace at it" grep -qE 'Folder \(.*/pipcast-live\)' <<<"$("$claude" plugin marketplace list 2>&1)"
check "it says the app runs master" grep -q "That is master." <<<"$("$live")"
check "setup again keeps the live checkout" grep -q "already at" <<<"$("$live" setup)"

"$live" pr 7 >/dev/null
check "pr puts a pull request's head in the app" test "$(runs)" = "$parent"

"$live" master >/dev/null
check "master puts master back" test "$(runs)" = "$master"

"$live" "$parent" >/dev/null
check "a commit can be put in the app" test "$(runs)" = "$parent"

echo "a change" >>"$tmp/pipcast-live/README.md"
check "a live checkout with changes of its own is not moved" bash -c "! '$live' master >/dev/null 2>&1"
check "and stays where it was" test "$(runs)" = "$parent"
git -C "$tmp/pipcast-live" checkout -q -- README.md

check "an unknown name moves nothing" bash -c "! '$live' no-such-branch >/dev/null 2>&1"
check "and pr wants a number" bash -c "! '$live' pr >/dev/null 2>&1"

exit "$failed"
