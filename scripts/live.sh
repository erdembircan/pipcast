#!/bin/bash
# Puts a change to Pipcast in the Claude desktop app, for trying it, and takes
# it out again. It is for development only: it never installs or updates a
# release of Pipcast. People install the release in the app, from Anthropic's
# plugin directory or from erdembircan-plugins (pipcast@erdembircan-plugins),
# and so do you.
#
# The change runs from the live checkout: a second checkout of this repository
# in a folder beside the main checkout, named after it
# (~/Developer/JS/pipcast-live beside ~/Developer/JS/pipcast), as its
# development build: what its plugin/ holds, with the station and its page
# built to take cues. live.sh builds that into the live checkout's .dev/, which
# git ignores, with the commit's own scripts/build-dev.sh, and points the
# pipcast marketplace, this repository's own, at .dev/marketplace, so the app
# reads it from .dev/marketplace/plugin as pipcast@pipcast. The checkout you
# work in never changes what the app runs. PIPCAST_LIVE names another folder,
# and PIPCAST_HOME another store for the station.
#
#   scripts/live.sh               says what the app runs now
#   scripts/live.sh setup         makes the live checkout on master, builds it,
#                                 installs it and puts it in the app
#   scripts/live.sh pr <number>   puts a pull request's head in the app
#   scripts/live.sh master        puts master in the app
#   scripts/live.sh <ref>         puts any branch or commit in the app
#   scripts/live.sh published     takes the live checkout out of the app and
#                                 turns back on the release it turned off
#   scripts/live.sh remove        does the same, then uninstalls the live
#                                 checkout and removes it with the pipcast
#                                 marketplace
#   scripts/live.sh restart       stops the station on air, and while the live
#                                 checkout is in the app starts its station in
#                                 its place
#   scripts/live.sh story ...     cues BREAKING NEWS in the development build
#   scripts/live.sh hour ...      cues the report on the next hour in it
#   scripts/live.sh cue <file>    cues what a JSON file holds, or - its input
#
# .dev/ and node_modules/ stay out of git at any commit through the main
# checkout's .git/info/exclude, which live.sh keeps, so the live checkout stays
# clean. Putting a commit in the app builds it first, and a build that fails
# moves nothing. A commit from before the development build has no
# scripts/build-dev.sh: its plugin/ goes in as it is, and takes no cues. A
# station running the build that was in the app is restarted on the new build
# when a move changes it. Putting the live checkout in the app turns off every
# release of Pipcast that is on in Claude Code's plugin list, and remembers
# which; published turns those back on. Sessions pick a change up on
# /reload-plugins, or when they start.
#
# story, hour and cue run the live checkout's own scripts/cue.mjs. A branch
# called story, hour, cue or restart needs its full name, refs/heads/<name>.
# PIPCAST_LIVE_BUILD=release puts a commit's plugin/ in as it is, without
# building, for scripts/test.d/50-live.sh.
#
# A copy the desktop app hands in itself, from Anthropic's plugin directory or
# an upload in Customize > Plugins, is the one kind of release live.sh can't
# see or turn off: it stays outside Claude Code's plugin list, and runs over
# any installed Pipcast, the live checkout too. Turn it off in Customize >
# Plugins while you try a change.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
# The main checkout, also when this runs from one of its worktrees
main="$(dirname "$(git -C "$root" rev-parse --path-format=absolute --git-common-dir)")"
live="${PIPCAST_LIVE:-$(dirname "$main")/$(basename "$main")-live}"
# The store the sessions and the station share
store="${PIPCAST_HOME:-$HOME/Library/Application Support/Pipcast}"
claude="$("$root/scripts/claude-bin.sh")"

# The live checkout's install, and the marketplace it comes from
live_id="pipcast@pipcast"
live_market="pipcast"
# The folder that marketplace points at, and the plugin the app reads in it
mount="$live/.dev/marketplace"
plugin="$mount/plugin"
# Where live.sh keeps the releases it turned off, one id a line
record="$(git -C "$main" rev-parse --path-format=absolute --git-common-dir)/pipcast-live-releases"
# Said wherever Claude Code's plugin list shows no Pipcast at all
directory_note="A copy from Anthropic's plugin directory or an upload never shows in that list: the desktop app hands it to each of its sessions itself."

# The live checkout's commit and subject, on one line
describe() {
  git -C "$live" log -1 --format='%h %s'
}

# What Claude Code lists for an install outside a project's settings: its
# state (enabled, disabled or missing) or its version
listed() { # state|version <id>
  { "$claude" plugin list --json 2>/dev/null || true; } | node -e '
    let plugins = []
    try { plugins = JSON.parse(require("node:fs").readFileSync(0, "utf8")) } catch {}
    const plugin = plugins.find((entry) => entry.id === process.argv[2] && entry.scope !== "project" && entry.scope !== "local")
    if (process.argv[1] === "version") process.stdout.write(plugin?.version ?? "")
    else process.stdout.write(plugin === undefined ? "missing" : plugin.enabled ? "enabled" : "disabled")
  ' "$1" "$2"
}

# The releases of Pipcast in Claude Code's plugin list, one id a line: every
# pipcast install but the live checkout's, from a marketplace or a terminal's
# sync of Anthropic's plugin directory, leaving out those a project's settings
# hold. A copy the desktop app hands in, from the directory or an upload, is
# never among them
releases() {
  { "$claude" plugin list --json 2>/dev/null || true; } | node -e '
    let plugins = []
    try { plugins = JSON.parse(require("node:fs").readFileSync(0, "utf8")) } catch {}
    const ids = plugins
      .filter((entry) => typeof entry.id === "string" && entry.id.startsWith("pipcast@") && entry.id !== process.argv[1] && entry.scope !== "project" && entry.scope !== "local")
      .map((entry) => entry.id)
    process.stdout.write([...new Set(ids)].sort().map((id) => id + "\n").join(""))
  ' "$live_id"
}

# Whether Claude Code has a marketplace by that name
known() { # <marketplace>
  { "$claude" plugin marketplace list --json 2>/dev/null || true; } | node -e '
    let markets = []
    try { markets = JSON.parse(require("node:fs").readFileSync(0, "utf8")) } catch {}
    process.exit(markets.some((market) => market.name === process.argv[1]) ? 0 : 1)
  ' "$1"
}

# The folder the pipcast marketplace points at, or nothing
mounted() {
  { "$claude" plugin marketplace list --json 2>/dev/null || true; } | node -e '
    let markets = []
    try { markets = JSON.parse(require("node:fs").readFileSync(0, "utf8")) } catch {}
    process.stdout.write(markets.find((market) => market.name === process.argv[1])?.path ?? "")
  ' "$live_market"
}

# Points the pipcast marketplace at the development build, unless it already
# does. What is installed from it follows at once, with no reinstall
mount() {
  if [[ "$(mounted)" != "$mount" ]]; then
    "$claude" plugin marketplace add "$mount" >/dev/null
  fi
}

# Keeps the live checkout's build and tools out of git at any commit, also one
# from before .dev/ was in .gitignore: the main checkout's info/exclude holds
# for every worktree of it, so the live checkout stays clean and can be removed
exclude() {
  local file pattern
  file="$(git -C "$main" rev-parse --path-format=absolute --git-common-dir)/info/exclude"
  mkdir -p "$(dirname "$file")"
  for pattern in /.dev/ /node_modules/; do
    if ! grep -qxF "$pattern" "$file" 2>/dev/null; then
      echo "$pattern" >>"$file"
    fi
  done
}

# The commit the build in the app came from, or nothing
built_from() {
  cat "$mount/BUILT-FROM" 2>/dev/null || true
}

# One hash of every file in a station's folder, to tell when a build changed
# it; nothing for a folder that isn't there
fingerprint() { # <station folder>
  if [[ -d "$1" ]]; then
    (cd "$1" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256) | shasum -a 256 | cut -d ' ' -f 1
  fi
}

# The binary of the station on air, as the system names it, or nothing
station_binary() {
  local pid
  pid="$(node -e '
    try {
      const status = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))
      if (Number.isInteger(status.pid) && status.pid > 0) process.stdout.write(String(status.pid))
    } catch {}
  ' "$store/station.json")"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    ps -o comm= -p "$pid" 2>/dev/null || true
  fi
}

# Whether the station on air takes cues: its station.json says +dev
takes_cues() {
  node -e '
    try {
      const status = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))
      process.exit(typeof status.version === "string" && status.version.endsWith("+dev") ? 0 : 1)
    } catch { process.exit(1) }
  ' "$store/station.json"
}

# Stops the station on air, whichever it is, with the first station binary to
# hand: any of them stops any station
stop_station() {
  local binary
  for binary in "$plugin/station/pipcast-station" "$live/plugin/station/pipcast-station" "$root/plugin/station/pipcast-station"; do
    if [[ -x "$binary" ]]; then
      "$binary" stop --home "$store" >/dev/null
      return
    fi
  done
}

# Puts the live checkout's station on air in place of whichever runs, there and
# then, rather than leaving it to a session: one that hasn't reloaded since a
# switch would start the station of the Pipcast it still runs. Stops a station
# that a session starts in between, and tries again; false when one keeps
# coming back
start_live_station() {
  local binary
  for _ in 1 2 3; do
    stop_station
    "$plugin/station/pipcast-station" launch --home "$store" --assets "$plugin/station" >/dev/null
    binary=""
    for _ in $(seq 30); do
      binary="$(station_binary)"
      if [[ -n "$binary" ]]; then
        break
      fi
      sleep 0.1
    done
    if [[ "$binary" == "$plugin/station/pipcast-station" ]]; then
      return 0
    fi
  done
  return 1
}

# Builds the live checkout's commit into .dev/marketplace/plugin.next, then
# swaps it in for the build in the app with two renames, so a station running
# the build before keeps running and is never overwritten. False when the
# build fails, which leaves the build in the app as it was
build() {
  local commit next="$mount/plugin.next"
  commit="$(git -C "$live" rev-parse HEAD)"
  mkdir -p "$mount"
  rm -rf "$next"
  if [[ "${PIPCAST_LIVE_BUILD:-}" != release && -f "$live/scripts/build-dev.sh" ]]; then
    if ! bash "$live/scripts/build-dev.sh"; then
      rm -rf "$next"
      return 1
    fi
  else
    cp -R "$live/plugin" "$next"
    echo "The app runs $(git -C "$live" rev-parse --short HEAD)'s plugin/ as it is, which takes no cues."
  fi
  mkdir -p "$mount/.claude-plugin"
  cp "$live/.claude-plugin/marketplace.json" "$mount/.claude-plugin/marketplace.json"
  rm -rf "$mount/plugin.old"
  if [[ -e "$plugin" ]]; then
    mv "$plugin" "$mount/plugin.old"
  fi
  mv "$next" "$plugin"
  rm -rf "$mount/plugin.old"
  echo "$commit" >"$mount/BUILT-FROM"
}

# After a move: a station running the build that was in the app is restarted
# on the new build when the move changed it. One running anything else is left
# to scripts/live.sh restart, since it may be a copy the desktop app hands in
settle_station() { # <fingerprint of the station before the move>
  local binary
  binary="$(station_binary)"
  if [[ -z "$binary" ]]; then
    return
  fi
  if [[ "$binary" == "$plugin/station/pipcast-station" ]]; then
    if [[ "$1" != "$(fingerprint "$plugin/station")" ]]; then
      if start_live_station; then
        echo "Restarted the station on this build."
      else
        echo "A session started its own station again each time the old one stopped: run scripts/live.sh restart once every session on air has reloaded." >&2
      fi
    fi
  else
    echo "The station on air runs from $(dirname "$(dirname "$binary")"), not the live checkout's build. If that is a copy the desktop app hands in, from Anthropic's plugin directory or an upload, turn Pipcast off in Customize > Plugins first. Then scripts/live.sh restart puts the live checkout's station on air in its place."
  fi
}

# Turns an install on or off, unless it already is. A missing install is never
# turned on: Claude Code would record it as on all the same.
turn() { # on|off <id>
  case "$1:$(listed state "$2")" in
    on:disabled) "$claude" plugin enable "$2" >/dev/null ;;
    off:enabled) "$claude" plugin disable "$2" >/dev/null ;;
  esac
}

# Puts the live checkout in the app: turns it on, then turns off every release
# that is on, and remembers which. On first, so a release that won't turn off
# leaves both on, which live.sh reports, never neither
step_in() {
  local id
  turn on "$live_id"
  for id in $(releases); do
    if [[ "$(listed state "$id")" == enabled ]]; then
      turn off "$id"
      if ! grep -qxF "$id" "$record" 2>/dev/null; then
        echo "$id" >>"$record"
      fi
    fi
  done
}

# Takes the live checkout out of the app: turns back on the releases it turned
# off, then turns it off. With none remembered and none on, it turns on every
# release. Releases first, so a step that fails leaves both on, never neither
step_out() {
  local id all back="" some_on=0
  all="$(releases)"
  for id in $all; do
    if [[ "$(listed state "$id")" == enabled ]]; then
      some_on=1
    fi
  done
  if [[ -f "$record" ]]; then
    for id in $(cat "$record"); do
      if grep -qxF "$id" <<<"$all"; then
        back="$back $id"
      fi
    done
  fi
  if [[ -z "$back" && $some_on -eq 0 ]]; then
    back="$all"
  fi
  for id in $back; do
    turn on "$id"
  done
  turn off "$live_id"
  rm -f "$record"
}

# What the app runs, as a phrase
running() {
  local live_now id ids="" versions=""
  live_now="$(listed state "$live_id")"
  for id in $(releases); do
    if [[ "$(listed state "$id")" == enabled ]]; then
      ids="${ids:+$ids and }$id"
      versions="${versions:+$versions and }$id $(listed version "$id")"
    fi
  done
  if [[ "$live_now" == enabled && -n "$ids" ]]; then
    echo "both the live checkout and the release, $ids"
  elif [[ "$live_now" == enabled && -e "$live/.git" ]]; then
    echo "the live checkout in $live, at $(describe)"
  elif [[ "$live_now" == enabled ]]; then
    echo "the live checkout, which is missing from $live"
  elif [[ -n "$ids" ]]; then
    echo "the release, $versions"
  else
    echo "no Pipcast from Claude Code's plugin list"
  fi
}

# Stops with a reason when a step fails, before anything moved
unmoved() { # <what failed>
  echo "$1, so nothing moved: the app runs $(running)." >&2
  exit 1
}

# Stops when the build is in place but the marketplace could not be pointed at it
unmounted() {
  echo "The live checkout's build of $(git -C "$live" rev-parse --short HEAD) is in $plugin, but the $live_market marketplace could not be pointed there, so the app runs $(running). scripts/live.sh setup tries again." >&2
  exit 1
}

need_live() {
  if [[ ! -e "$live/.git" ]]; then
    echo "There is no live checkout at $live: run scripts/live.sh setup first." >&2
    exit 1
  fi
  if [[ "$(listed state "$live_id")" == missing ]]; then
    echo "The live checkout at $live is not installed as $live_id: run scripts/live.sh setup first." >&2
    exit 1
  fi
}

# A live checkout with changes of its own is neither moved nor removed
need_clean() { # <what did not happen>
  if [[ -n "$(git -C "$live" status --porcelain)" ]]; then
    echo "The live checkout at $live has changes of its own, so nothing $1:" >&2
    git -C "$live" status --short >&2
    exit 1
  fi
}

# Brings what origin has; carries on with what this clone has when it cannot
fetch() {
  git -C "$main" fetch -q origin "$@" || echo "Could not fetch from origin: using what this clone already has." >&2
}

# Says what the app ran and what it runs now
moved() { # <what it ran> [<what was put there>]
  local now
  now="$(running)"
  echo "The app ran $1."
  echo "It now runs $now${2:+ ($2)}."
  if [[ "$now" == 'no Pipcast'* ]]; then
    echo "$directory_note"
  fi
  echo "Run /reload-plugins in a session to pick it up, or start a new one."
}

# Puts the live checkout on a commit, builds it and puts it in the app
put() {
  local commit="$1" what="$2" before was print
  need_live
  exclude
  need_clean moved
  before="$(running)"
  was="$(git -C "$live" rev-parse HEAD)"
  print="$(fingerprint "$plugin/station")"
  git -C "$live" checkout -q --detach "$commit"
  if ! build; then
    git -C "$live" checkout -q --detach "$was"
    unmoved "Could not build $what"
  fi
  if ! mount; then
    unmounted
  fi
  step_in
  moved "$before" "$what"
  settle_station "$print"
}

case "${1:-}" in
  '')
    now="$(running)"
    echo "The app runs $now."
    case "$now" in
      both*)
        echo "Both are on: run scripts/live.sh published or scripts/live.sh master to keep one."
        ;;
      'no Pipcast'*)
        echo "$directory_note"
        echo "Run scripts/live.sh setup to try the live checkout."
        ;;
      'the live checkout in'*)
        if [[ "$(git -C "$live" rev-parse HEAD)" == "$(git -C "$main" rev-parse origin/master)" ]]; then
          echo "That is master."
        fi
        built="$(built_from)"
        if [[ "$(mounted)" != "$mount" ]]; then
          echo "But the $live_market marketplace points at $(mounted), not at the live checkout's build in $mount: scripts/live.sh setup points it there."
        elif [[ -n "$built" && "$built" != "$(git -C "$live" rev-parse HEAD)" ]]; then
          echo "But its build in the app is from ${built:0:7}: scripts/live.sh $(git -C "$live" rev-parse --short HEAD) builds the commit it is at."
        fi
        ;;
    esac
    station="$(station_binary)"
    if [[ -n "$station" ]]; then
      if takes_cues; then
        echo "The station on air takes cues: scripts/live.sh story or scripts/live.sh hour airs one now."
      else
        echo "The station on air takes no cues."
      fi
      if [[ "$now" == 'the live checkout in'* && "$station" != "$plugin/station/pipcast-station" ]]; then
        echo "It runs from $(dirname "$(dirname "$station")"), not the live checkout's build. If that is a copy the desktop app hands in, from Anthropic's plugin directory or an upload, turn Pipcast off in Customize > Plugins first. Then scripts/live.sh restart puts the live checkout's station on air in its place."
      fi
    fi
    ;;
  setup)
    if [[ -e "$live/.git" ]]; then
      echo "The live checkout is already at $live."
    else
      fetch master
      git -C "$main" worktree add -q --detach "$live" origin/master
      echo "Made the live checkout at $live, on master."
    fi
    exclude
    before="$(running)"
    print="$(fingerprint "$plugin/station")"
    if ! build; then
      unmoved "Could not build the live checkout at $(git -C "$live" rev-parse --short HEAD)"
    fi
    if ! mount; then
      unmounted
    fi
    if [[ "$(listed state "$live_id")" == missing ]] && ! "$claude" plugin install "$live_id" --scope user >/dev/null; then
      unmoved "Could not install $live_id from the live checkout"
    fi
    step_in
    moved "$before"
    settle_station "$print"
    ;;
  pr)
    number="${2:-}"
    if [[ ! "$number" =~ ^[0-9]+$ ]]; then
      echo "Usage: scripts/live.sh pr <number>" >&2
      exit 1
    fi
    git -C "$main" fetch -q origin "pull/$number/head"
    put "$(git -C "$main" rev-parse FETCH_HEAD)" "pull request #$number"
    ;;
  master)
    fetch master
    put "$(git -C "$main" rev-parse origin/master)" "master"
    ;;
  published)
    before="$(running)"
    step_out
    moved "$before"
    ;;
  remove)
    if [[ ! -e "$live/.git" && "$(listed state "$live_id")" == missing ]] && ! known "$live_market"; then
      echo "There is no live checkout to remove: the app runs $(running)."
      exit 0
    fi
    if [[ -e "$live/.git" ]]; then
      exclude
      need_clean "was removed"
    fi
    before="$(running)"
    step_out
    if [[ "$(listed state "$live_id")" != missing ]]; then
      "$claude" plugin uninstall "$live_id" --scope user >/dev/null
    fi
    if known "$live_market"; then
      "$claude" plugin marketplace remove "$live_market" >/dev/null
    fi
    if [[ -e "$live/.git" ]]; then
      # The station may be running from the live checkout's folder, so stop it,
      # whichever install started it: a session on air starts it again from the
      # install it runs within half a minute
      stop_station
      git -C "$main" worktree remove "$live"
    fi
    echo "Removed the live checkout at $live, with $live_id and the $live_market marketplace. scripts/live.sh setup makes them again."
    moved "$before"
    ;;
  restart)
    if [[ -z "$(station_binary)" ]]; then
      echo "No station is on air."
    elif [[ "$(listed state "$live_id")" == enabled && -x "$plugin/station/pipcast-station" ]]; then
      if start_live_station; then
        echo "The live checkout's station is on air in place of the one that ran."
      else
        echo "A session started its own station again each time the old one stopped: run scripts/live.sh restart once every session on air has reloaded." >&2
        exit 1
      fi
    else
      stop_station
      echo "Stopped the station: a session on air starts it again, from the plugin it runs, within 10 s."
    fi
    ;;
  story | hour | cue)
    if [[ ! -e "$live/.git" ]]; then
      echo "There is no live checkout at $live: run scripts/live.sh setup first." >&2
      exit 1
    fi
    if [[ ! -f "$live/scripts/cue.mjs" ]]; then
      echo "The live checkout is at $(git -C "$live" rev-parse --short HEAD), which comes before cues: put a newer commit in the app with scripts/live.sh." >&2
      exit 1
    fi
    exec node "$live/scripts/cue.mjs" "$@"
    ;;
  *)
    fetch
    if ! commit="$(git -C "$main" rev-parse -q --verify "$1^{commit}")"; then
      echo "There is no branch or commit called $1." >&2
      exit 1
    fi
    put "$commit" "$1"
    ;;
esac
