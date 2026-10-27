#!/bin/bash
# Puts a change to Pipcast in the Claude desktop app, for trying it, and takes
# it out again. It is for development only: it never installs or updates a
# release of Pipcast. People install the release in the app, from Anthropic's
# plugin directory or from erdembircan-plugins (pipcast@erdembircan-plugins),
# and so do you.
#
# The change runs from the live checkout: a second checkout of this repository
# in a folder beside the main checkout, named after it
# (~/Developer/JS/pipcast-live beside ~/Developer/JS/pipcast), installed as
# pipcast@pipcast from the pipcast marketplace, this repository's own, which
# points at that folder. The checkout you work in never changes what the app
# runs. PIPCAST_LIVE names another folder, and PIPCAST_HOME another store for
# the station.
#
#   scripts/live.sh               says what the app runs now
#   scripts/live.sh setup         makes the live checkout on master, installs
#                                 it and puts it in the app
#   scripts/live.sh pr <number>   puts a pull request's head in the app
#   scripts/live.sh master        puts master in the app
#   scripts/live.sh <ref>         puts any branch or commit in the app
#   scripts/live.sh published     takes the live checkout out of the app and
#                                 turns back on the release it turned off
#   scripts/live.sh remove        does the same, then uninstalls the live
#                                 checkout and removes it with the pipcast
#                                 marketplace
#
# Putting the live checkout in the app turns off every release of Pipcast that
# is on in Claude Code's plugin list, and remembers which; published turns
# those back on. Sessions pick a change up on /reload-plugins, or when they
# start.
#
# A copy from Anthropic's plugin directory is the one release live.sh can't see
# or turn off: the desktop app hands it to each of its sessions itself, outside
# Claude Code's plugin list, and runs it over any installed Pipcast, the live
# checkout too. Turn it off in Customize > Plugins while you try a change.
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
# Where live.sh keeps the releases it turned off, one id a line
record="$(git -C "$main" rev-parse --path-format=absolute --git-common-dir)/pipcast-live-releases"
# Said wherever Claude Code's plugin list shows no Pipcast at all
directory_note="A copy from Anthropic's plugin directory never shows in that list: the desktop app hands it to each of its sessions itself."

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
# pipcast install but the live checkout's, from a marketplace, an upload or a
# terminal's sync of Anthropic's plugin directory, leaving out those a
# project's settings hold. A copy the desktop app hands in from the directory
# is never among them
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

# Puts the live checkout on a commit and in the app
put() {
  local commit="$1" what="$2" before
  need_live
  need_clean moved
  before="$(running)"
  git -C "$live" checkout -q --detach "$commit"
  step_in
  moved "$before" "$what"
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
        ;;
    esac
    ;;
  setup)
    if [[ -e "$live/.git" ]]; then
      echo "The live checkout is already at $live."
    else
      fetch master
      git -C "$main" worktree add -q --detach "$live" origin/master
      echo "Made the live checkout at $live, on master."
    fi
    before="$(running)"
    if ! "$claude" plugin marketplace add "$live" >/dev/null; then
      unmoved "Could not point the $live_market marketplace at $live"
    fi
    if [[ "$(listed state "$live_id")" == missing ]] && ! "$claude" plugin install "$live_id" --scope user >/dev/null; then
      unmoved "Could not install $live_id from the live checkout"
    fi
    step_in
    moved "$before"
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
      if [[ -x "$live/plugin/station/pipcast-station" ]]; then
        "$live/plugin/station/pipcast-station" stop --home "$store" >/dev/null
      fi
      git -C "$main" worktree remove "$live"
    fi
    echo "Removed the live checkout at $live, with $live_id and the $live_market marketplace. scripts/live.sh setup makes them again."
    moved "$before"
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
