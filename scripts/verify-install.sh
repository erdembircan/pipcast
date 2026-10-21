#!/bin/bash
# Installs the plugin from this clone, as a user would from a marketplace, but
# into a throwaway Claude configuration: CLAUDE_CONFIG_DIR is a new temporary
# folder, so the user's own configuration is never read or changed. Then it
# checks that the installed copy holds everything the mod and the station run
# from. The temporary folder is removed on every exit.
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
claude="$("$root/scripts/claude-bin.sh")"

config="$(mktemp -d "${TMPDIR:-/tmp}/pipcast-verify-install.XXXXXX")"
trap 'rm -rf "$config"' EXIT

failed=0

step() { echo "== $*"; }
check() { # description, then the test
  local what="$1"
  shift
  if "$@"; then
    echo "ok   $what"
  else
    echo "FAIL $what"
    failed=1
  fi
}

run() { # runs the engine with the throwaway configuration only
  CLAUDE_CONFIG_DIR="$config" "$claude" "$@"
}

step "add the clone as a marketplace"
run plugin marketplace add "$root"
added=$?
check "the marketplace was added (exit $added)" test "$added" -eq 0

step "install pipcast@pipcast"
run plugin install pipcast@pipcast
installed=$?
check "pipcast@pipcast was installed (exit $installed)" test "$installed" -eq 0

step "the installed copy"
binary="$(find "$config" -path '*/station/pipcast-station' -type f 2>/dev/null | head -n 1)"
if [[ -z "$binary" ]]; then
  echo "FAIL no station/pipcast-station anywhere under the throwaway configuration"
  failed=1
else
  plugin="${binary%/station/pipcast-station}"
  echo "info installed at ${plugin#"$config"/}"
  check "station/pipcast-station is executable" test -x "$plugin/station/pipcast-station"
  check "station/web/index.html" test -f "$plugin/station/web/index.html"
  for name in breaking breaking-out hour hour-out; do
    check "station/sounds/$name.m4a" test -f "$plugin/station/sounds/$name.m4a"
  done
  check "hooks/hooks.json" test -f "$plugin/hooks/hooks.json"
  check "hooks/register.tsx" test -f "$plugin/hooks/register.tsx"
  check "the installed station runs" "$plugin/station/pipcast-station" --version
fi

if [[ "$failed" -eq 0 ]]; then
  echo "verify-install: all checks passed"
else
  echo "verify-install: failed"
fi

exit "$failed"
