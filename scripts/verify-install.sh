#!/bin/bash
# Installs the plugin from this clone, as a user would from a marketplace, but
# into a throwaway Claude configuration: CLAUDE_CONFIG_DIR is a new temporary
# folder, so the user's own configuration is never read or changed. Then it
# checks that the installed copy holds everything the mod and the station run
# from, and runs /pipcast auto, /pipcast auto on and /pipcast auto off in a
# headless session on that copy, started without CLAUDE_CODE_EXECPATH as a
# desktop session is: each value has to land in the throwaway configuration's
# plugin options. No model call is made. The temporary folder is removed on
# every exit.
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

step "/pipcast auto, in a headless session on the installed copy"
store="$config/pipcast-home"
out="$config/engine-out.jsonl"
notes="$config/notes.log"
mkdir -p "$store"
: >"$notes"

state() { # one of /pipcast auto's replies, from the contract
  node -e "import('$root/plugin/src/contract/copy.ts').then((m) => process.stdout.write(m.optionState('auto', process.argv[1] === 'on')))" "$1"
}
auto_on="$(state on)"
auto_off="$(state off)"

say() { # one prompt, as the session reads it
  printf '{"type":"user","message":{"role":"user","content":"%s"}}\n' "$1"
}

saved() { # what the throwaway settings hold for the option, or unset
  node -e '
    const fs = require("node:fs")
    const file = process.argv[1]
    const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {}
    const value = settings.pluginConfigs?.["pipcast@pipcast"]?.options?.autoTuneIn
    process.stdout.write(value === undefined ? "unset" : String(value))
  ' "$config/settings.json"
}

(
  sleep 3
  echo "before $(saved)" >>"$notes"
  say "/pipcast auto"
  sleep 6
  say "/pipcast auto on"
  sleep 8
  echo "after-on $(saved)" >>"$notes"
  say "/pipcast auto off"
  sleep 8
  echo "after-off $(saved)" >>"$notes"
) | env -u CLAUDE_CODE_EXECPATH CLAUDE_CONFIG_DIR="$config" PIPCAST_HOME="$store" PIPCAST_STATION_BIN=/usr/bin/false \
  CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 "$claude" -p \
  --input-format stream-json --output-format stream-json --verbose \
  --model haiku --no-session-persistence >"$out" 2>&1

check "nothing was saved before /pipcast auto on" grep -qx "before unset" "$notes"
check "/pipcast auto said the setting is off" grep -qF -- "$auto_off" "$out"
check "/pipcast auto on saved it on" grep -qx "after-on true" "$notes"
check "/pipcast auto on answered that it is on" grep -qF -- "$auto_on" "$out"
check "/pipcast auto off saved it off" grep -qx "after-off false" "$notes"

if [[ "$failed" -eq 0 ]]; then
  echo "verify-install: all checks passed"
else
  echo "verify-install: failed"
fi

exit "$failed"
