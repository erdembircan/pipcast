#!/bin/bash
# Installs the plugin from this clone, as a user would from a marketplace, but
# into a throwaway Claude configuration: CLAUDE_CONFIG_DIR is a new temporary
# folder, so the user's own configuration is never read or changed. Then it
# checks that the installed copy holds everything the mod and the station run
# from, and exactly the files plugin/ holds, with no TypeScript source, test or
# tsconfig.json among them. Last, it runs /pipcast auto, /pipcast auto on and
# /pipcast auto off, then the same for /pipcast transparency, in a headless
# session on that copy, started without CLAUDE_CODE_EXECPATH as a desktop
# session is: each value has to land in the throwaway configuration's plugin
# options, and Transparent window's in the throwaway store's options.json as
# well. Then the session tunes in, to a stand-in for the station, and two
# presses of the window's Transparent window button, on and then off, are
# written to options.json as the station writes them: the session's next
# check-in has to save each in the plugin options and take the press off
# options.json. No model call is made. The temporary folder is removed on
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
  check "hooks/register.js" test -f "$plugin/hooks/register.js"
  check "the installed station runs" "$plugin/station/pipcast-station" --version

  # plugin/ as the build's own check reads it (scripts/build-plugin.mjs): the
  # files on disk that git tracks or would add, less what .gitignore keeps out
  shipped="$(git -C "$root" ls-files --cached --others --exclude-standard -- plugin | while IFS= read -r path; do
    if [[ -e "$root/$path" ]]; then
      echo "${path#plugin/}"
    fi
  done | LC_ALL=C sort)"
  installed="$(cd "$plugin" && find . -type f ! -name .DS_Store | sed 's|^\./||' | LC_ALL=C sort)"
  check "the installed copy holds exactly the files plugin/ holds" test "$installed" = "$shipped"
  if [[ "$installed" != "$shipped" ]]; then
    diff <(echo "$shipped") <(echo "$installed") | sed 's/^/     /'
  fi
  sources="$(find "$plugin" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.test.*' -o -name tsconfig.json \) ! -name '*.d.ts')"
  check "the installed copy holds no TypeScript source, test or tsconfig.json" test -z "$sources"
fi

step "/pipcast auto, /pipcast transparency and the window's button, in a headless session on the installed copy"
store="$config/pipcast-home"
out="$config/engine-out.jsonl"
notes="$config/notes.log"
mkdir -p "$store"
: >"$notes"

station="$config/stand-in-station"
cat >"$station" <<'EOF'
#!/bin/sh
echo "started 4242"
EOF
chmod +x "$station"

state() { # <word> <on|off>: one of /pipcast <word>'s replies, from the contract
  node -e "import('$root/packages/contract/src/copy.ts').then((m) => process.stdout.write(m.optionState(process.argv[1], process.argv[2] === 'on')))" "$1" "$2"
}
auto_on="$(state auto on)"
auto_off="$(state auto off)"
transparency_on="$(state transparency on)"
transparency_off="$(state transparency off)"

say() { # one prompt, as the session reads it
  printf '{"type":"user","message":{"role":"user","content":"%s"}}\n' "$1"
}

saved() { # <key>: what the throwaway settings hold for that option, or unset
  node -e '
    const fs = require("node:fs")
    const file = process.argv[1]
    const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {}
    const value = settings.pluginConfigs?.["pipcast@pipcast"]?.options?.[process.argv[2]]
    process.stdout.write(value === undefined ? "unset" : String(value))
  ' "$config/settings.json" "$1"
}

shared() { # what the throwaway store's options.json tells the station: on, off, or none
  node -e '
    const fs = require("node:fs")
    const file = process.argv[1]
    if (!fs.existsSync(file)) { process.stdout.write("none"); process.exit(0) }
    const options = JSON.parse(fs.readFileSync(file, "utf8"))
    process.stdout.write(options.transparent === true ? "on" : options.transparent === false ? "off" : "bad")
  ' "$store/options.json"
}

press() { # <true|false>: a press of the window's Transparent window button, as the station writes it
  printf '{"v":1,"transparent":%s,"pressedAt":%s}\n' "$1" "$(( $(date +%s) * 1000 ))" >"$store/options.json.tmp"
  mv "$store/options.json.tmp" "$store/options.json"
}

pending() { # whether the store's options.json still holds a press: pressed, or none
  node -e '
    const fs = require("node:fs")
    const options = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
    process.stdout.write(options.pressedAt === undefined ? "none" : "pressed")
  ' "$store/options.json"
}

(
  sleep 3
  echo "before $(saved autoTuneIn)" >>"$notes"
  say "/pipcast auto"
  sleep 6
  say "/pipcast auto on"
  sleep 8
  echo "after-on $(saved autoTuneIn)" >>"$notes"
  say "/pipcast auto off"
  sleep 8
  echo "after-off $(saved autoTuneIn)" >>"$notes"
  echo "before-transparency $(saved transparentWindow) $(shared)" >>"$notes"
  say "/pipcast transparency"
  sleep 6
  say "/pipcast transparency on"
  sleep 8
  echo "transparency-after-on $(saved transparentWindow) $(shared)" >>"$notes"
  say "/pipcast transparency off"
  sleep 8
  echo "transparency-after-off $(saved transparentWindow) $(shared)" >>"$notes"
  say "/pipcast"
  sleep 6
  press true
  sleep 30
  echo "press-on $(saved transparentWindow) $(shared) $(pending)" >>"$notes"
  press false
  sleep 30
  echo "press-off $(saved transparentWindow) $(shared) $(pending)" >>"$notes"
) | env -u CLAUDE_CODE_EXECPATH CLAUDE_CONFIG_DIR="$config" PIPCAST_HOME="$store" PIPCAST_STATION_BIN="$station" \
  CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 "$claude" -p \
  --input-format stream-json --output-format stream-json --verbose \
  --model haiku --no-session-persistence >"$out" 2>&1

check "nothing was saved before /pipcast auto on" grep -qx "before unset" "$notes"
check "/pipcast auto said the setting is off" grep -qF -- "$auto_off" "$out"
check "/pipcast auto on saved it on" grep -qx "after-on true" "$notes"
check "/pipcast auto on answered that it is on" grep -qF -- "$auto_on" "$out"
check "/pipcast auto off saved it off" grep -qx "after-off false" "$notes"
check "nothing was saved for Transparent window, and the store had no options.json, before /pipcast transparency on" grep -qx "before-transparency unset none" "$notes"
check "/pipcast transparency said the setting is off" grep -qF -- "$transparency_off" "$out"
check "/pipcast transparency on saved it on and told the station" grep -qx "transparency-after-on true on" "$notes"
check "/pipcast transparency on answered that it is on" grep -qF -- "$transparency_on" "$out"
check "/pipcast transparency off saved it off and told the station" grep -qx "transparency-after-off false off" "$notes"
check "a press of the window's button, on, was saved by the next check-in and taken off options.json" grep -qx "press-on true on none" "$notes"
check "a press of the window's button, off, was saved by the next check-in and taken off options.json" grep -qx "press-off false off none" "$notes"

if [[ "$failed" -eq 0 ]]; then
  echo "verify-install: all checks passed"
else
  echo "verify-install: failed"
fi

exit "$failed"
