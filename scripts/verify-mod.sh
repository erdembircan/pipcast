#!/bin/bash
# Runs the mod in real, headless Claude Code sessions on the engine bundled
# with the desktop app. In the first, with Tune in every new session off and
# Transparent window on, /pipcast has to tune in (a record in the store,
# options.json telling the station the window is transparent, the station
# launched), a second /pipcast has to tune out (the record gone), and, with
# another session's READY record planted in the store, /pipcast clear has to
# take this session off the air at once, count the other, and write clear.json.
# A session that ends while tuned in has to take its record with it. In the second, with
# nothing saved for Tune in every new session, which leaves it on, and
# Transparent window off, the session has to stay off the air while nothing
# shows it, tune in by itself once a stand-in for the desktop app attaches as
# the app does (ui_attach), telling the station the window is solid, draw the
# band as the plate alone when the stand-in asks for it as the app does
# (ui_render), with no other mod in the band, stay off the air after /pipcast
# tunes it out and a second window shows it, and tune in again after /clear.
# No model call is made and no station is started: PIPCAST_STATION_BIN is a
# stand-in that logs its arguments. Everything lives in a temporary folder that
# is removed on exit.
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
claude="$("$root/scripts/claude-bin.sh")"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/pipcast-verify-mod.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

home="$tmp/home"
auto_home="$tmp/home-auto"
calls="$tmp/station-calls.log"
notes="$tmp/notes.log"
out="$tmp/engine-out.jsonl"
auto_out="$tmp/engine-out-auto.jsonl"
station="$tmp/stand-in-station"
mkdir -p "$home" "$auto_home"

cat >"$station" <<EOF
#!/bin/sh
echo "\$@" >> "$calls"
echo "started 4242"
EOF
chmod +x "$station"

words() { # prints one of the command's replies, from the contract
  node -e "import('$root/packages/contract/src/copy.ts').then((m) => process.stdout.write(m.REPLY[process.argv[1]]))" "$1"
}
tuned_in="$(words tunedIn)"
tuned_out="$(words tunedOut)"
cleared_one_more="$(node -e "import('$root/packages/contract/src/copy.ts').then((m) => process.stdout.write(m.clearedReply(1, true)))")"

# "ok" when the store's one record exists and parses, with v 1 and an id
record_state() { # <store>
  node -e '
    const fs = require("node:fs")
    const dir = process.argv[1]
    const names = fs.existsSync(dir) ? fs.readdirSync(dir) : []
    const json = names.filter((name) => name.endsWith(".json"))
    if (json.length === 0) { process.stdout.write(names.length === 0 ? "none" : "tmp-only"); process.exit(0) }
    const record = JSON.parse(fs.readFileSync(dir + "/" + json[0], "utf8"))
    process.stdout.write(json.length === 1 && record.v === 1 && typeof record.id === "string" && record.id !== "" ? "ok" : "bad")
  ' "$1/sessions"
}

# What options.json in a store tells the station of Transparent window: on,
# off, or none when there is no file
options_state() { # <store>
  node -e '
    const fs = require("node:fs")
    const file = process.argv[1] + "/options.json"
    if (!fs.existsSync(file)) { process.stdout.write("none"); process.exit(0) }
    const options = JSON.parse(fs.readFileSync(file, "utf8"))
    process.stdout.write(options.v === 1 && options.transparent === true ? "on" : options.v === 1 && options.transparent === false ? "off" : "bad")
  ' "$1"
}

# How the engine answered the stand-in's ask for the band: alone when the tree
# is our line by itself, the plate in a Box with no line above it and nothing
# of the engine's own drawing in it; stacked when it is anything else; none
# when no answer came
band_state() { # <engine output> <request id>
  node -e '
    const fs = require("node:fs")
    const [file, id] = process.argv.slice(1)
    let tree
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      let message
      try { message = JSON.parse(line) } catch { continue }
      if (message?.type === "control_response" && message.response?.request_id === id) tree = message.response.response?.tree
    }
    if (tree === undefined) { process.stdout.write("none"); process.exit(0) }
    const text = JSON.stringify(tree)
    const alone = tree.type === "Box" && tree.props?.alignItems === "center" && tree.props?.rowGap === undefined &&
      text.includes("\"type\":\"Svg\"") && !text.includes("\"type\":\"engine\"")
    process.stdout.write(alone ? "alone" : "stacked")
  ' "$1" "$2"
}

# The settings a session runs with: the plugin's options, given as JSON, for
# the plugin as --plugin-dir loads it. An option left out has the manifest's
# default.
settings() { # <options as JSON>
  printf '{"pluginConfigs":{"pipcast@inline":{"options":%s}}}' "$1"
}

command='{"type":"user","message":{"role":"user","content":"/pipcast"}}'
clear='{"type":"user","message":{"role":"user","content":"/clear"}}'
clear_ready='{"type":"user","message":{"role":"user","content":"/pipcast clear"}}'

# Writes the record of a live session that is READY, as another session's mod
# would, for /pipcast clear to count
plant_ready() { # <session id> <store>
  node -e '
    const fs = require("node:fs")
    const [id, dir] = process.argv.slice(1)
    const now = Date.now()
    fs.mkdirSync(dir + "/sessions", { recursive: true })
    fs.writeFileSync(dir + "/sessions/" + id + ".json", JSON.stringify({
      v: 1, id, title: id, project: "other", state: "ready", stateAt: now - 5000, tunedInAt: now - 5000,
      checkedInAt: now, stories: [], activity: [], hours: [], limits: [],
    }))
  ' "$1" "$2"
}

# "ok" when clear.json in a store holds v 1 and a number for clearedAt, none
# when there is no file
clear_state() { # <store>
  node -e '
    const fs = require("node:fs")
    const file = process.argv[1] + "/clear.json"
    if (!fs.existsSync(file)) { process.stdout.write("none"); process.exit(0) }
    const cleared = JSON.parse(fs.readFileSync(file, "utf8"))
    process.stdout.write(cleared.v === 1 && typeof cleared.clearedAt === "number" ? "ok" : "bad")
  ' "$1"
}

# The desktop app showing the session, as it says so: each window is a client
attach() { # <client id>
  printf '{"type":"control_request","request_id":"attach-%s","request":{"subtype":"ui_attach","surface":"desktop","client_id":"%s"}}\n' "$1" "$1"
}

# The desktop app asking a window's session to draw the band above the prompt
band() { # <request id>
  printf '{"type":"control_request","request_id":"%s","request":{"subtype":"ui_render","surface":"desktop","client_id":"window-1","component":"AbovePrompt","instance_id":"above-prompt","props":{"hasSurvey":false,"isWorking":false,"maxRows":12,"bodyColumns":100,"scroll":{"offset":0,"bodyRows":12},"view":{}}}}\n' "$1"
}

(
  echo "$command"
  sleep 3
  echo "after-in $(record_state "$home")" >>"$notes"
  echo "options-in $(options_state "$home")" >>"$notes"
  echo "$command"
  sleep 3
  echo "after-out $(record_state "$home")" >>"$notes"
  echo "$command"
  sleep 3
  echo "after-in-again $(record_state "$home")" >>"$notes"
  plant_ready other-session "$home"
  echo "$clear_ready"
  sleep 3
  rm -f "$home/sessions/other-session.json"
  echo "after-clear $(record_state "$home")" >>"$notes"
  echo "clear-file $(clear_state "$home")" >>"$notes"
  echo "$command"
  sleep 3
  echo "after-in-last $(record_state "$home")" >>"$notes"
) | PIPCAST_HOME="$home" \
  PIPCAST_STATION_BIN="$station" \
  PIPCAST_TARGET_BUNDLE_ID=com.example.pipcast.never-frontmost \
  CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 \
  "$claude" -p \
  --input-format stream-json --output-format stream-json --verbose \
  --model haiku --no-session-persistence --settings "$(settings '{"autoTuneIn":false,"transparentWindow":true}')" --plugin-dir "$root/plugin" >"$out" 2>&1

sleep 1
echo "after-end $(record_state "$home")" >>"$notes"
echo "running $(pgrep -f "$tmp" | wc -l | tr -d ' ')" >>"$notes"

(
  sleep 3
  echo "auto-unshown $(record_state "$auto_home")" >>"$notes"
  attach window-1
  sleep 3
  echo "auto-shown $(record_state "$auto_home")" >>"$notes"
  echo "auto-options $(options_state "$auto_home")" >>"$notes"
  band band-1
  sleep 2
  echo "$command"
  sleep 3
  echo "auto-out $(record_state "$auto_home")" >>"$notes"
  attach window-2
  sleep 3
  echo "auto-shown-again $(record_state "$auto_home")" >>"$notes"
  echo "$clear"
  sleep 3
  echo "auto-cleared $(record_state "$auto_home")" >>"$notes"
) | PIPCAST_HOME="$auto_home" \
  PIPCAST_STATION_BIN="$station" \
  PIPCAST_TARGET_BUNDLE_ID=com.example.pipcast.never-frontmost \
  CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 \
  "$claude" -p \
  --input-format stream-json --output-format stream-json --verbose \
  --model haiku --no-session-persistence --settings "$(settings '{"transparentWindow":false}')" --plugin-dir "$root/plugin" >"$auto_out" 2>&1

sleep 1
echo "auto-end $(record_state "$auto_home")" >>"$notes"
echo "auto-running $(pgrep -f "$tmp" | wc -l | tr -d ' ')" >>"$notes"
echo "band $(band_state "$auto_out" band-1)" >>"$notes"

failed=0

check() { # fixed text to find, in a file, and what it shows
  if grep -qF -- "$1" "$2"; then
    echo "ok   $3"
  else
    echo "FAIL $3"
    failed=1
  fi
}

check "after-in ok" "$notes" "the first /pipcast wrote the session's record"
check "options-in on" "$notes" "tuning in told the station the window is transparent"
check "$tuned_in" "$out" "the first /pipcast answered that it tuned in"
check "launch --home $home --assets $root/plugin/station --target-bundle-id com.example.pipcast.never-frontmost" "$calls" "the station was launched with the store, the assets and the target"
check "after-out none" "$notes" "the second /pipcast removed the record"
check "$tuned_out" "$out" "the second /pipcast answered that it tuned out"
check "after-in-again ok" "$notes" "a third /pipcast wrote the record again"
check "$cleared_one_more" "$out" "/pipcast clear counted the other session that was READY and took this one off the air"
check "after-clear none" "$notes" "/pipcast clear took the READY session off the air at once, its record gone"
check "clear-file ok" "$notes" "/pipcast clear wrote the moment to clear.json"
check "after-in-last ok" "$notes" "a last /pipcast wrote the record again"
check "after-end none" "$notes" "the session ending took the record with it"
check "running 0" "$notes" "nothing is left running"
check "auto-unshown none" "$notes" "with nothing saved for Tune in every new session, a session nothing shows stays off the air"
check "auto-shown ok" "$notes" "the desktop app showing the new session tuned it in, on the setting's default"
check "auto-options off" "$notes" "tuning in by itself told the station the window is solid"
check "band alone" "$notes" "the band the desktop app asked for is the plate alone, with no line above it"
check "launch --home $auto_home --assets $root/plugin/station --target-bundle-id com.example.pipcast.never-frontmost" "$calls" "the station was launched for it"
check "auto-out none" "$notes" "/pipcast took it off the air"
check "$tuned_out" "$auto_out" "/pipcast answered that it tuned out"
check "auto-shown-again none" "$notes" "a second window showing it left it off the air"
check "auto-cleared ok" "$notes" "after /clear the new session tuned itself in"
check "auto-end none" "$notes" "the second session ending took its record with it"
check "auto-running 0" "$notes" "nothing is left running after the second session"

if [[ "$failed" -eq 0 ]]; then
  echo "mod verified"
else
  echo "mod check failed"
  tail -c 2000 "$out"
  tail -c 2000 "$auto_out"
fi

exit "$failed"
