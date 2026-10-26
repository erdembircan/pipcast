#!/bin/bash
# What the Claude desktop app runs: the published release of Pipcast or the
# live checkout, one of them and never both.
#
# The published release is pipcast@erdembircan-plugins, from the
# erdembircan-plugins marketplace (erdembircan/plugin-marketplace on GitHub).
# The live checkout is a second checkout of this repository in a folder beside
# the main checkout, named after it (~/Developer/JS/pipcast-live beside
# ~/Developer/JS/pipcast), installed as pipcast@pipcast from the pipcast
# marketplace, this repository's own, which points at that folder. The
# checkout you work in never changes what the app runs. PIPCAST_LIVE names
# another folder.
#
#   scripts/live.sh               says what the app runs now
#   scripts/live.sh setup         makes the live checkout on master, installs
#                                 it and puts it in the app; run it once
#   scripts/live.sh pr <number>   puts a pull request's head in the app
#   scripts/live.sh master        puts master in the app
#   scripts/live.sh <ref>         puts any branch or commit in the app
#   scripts/live.sh published     updates the published release and puts it
#                                 back in the app
#
# Putting a commit in the app takes the published release out of it, and
# published takes the live checkout out. Sessions pick a change up on
# /reload-plugins, or when they start.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
# The main checkout, also when this runs from one of its worktrees
main="$(dirname "$(git -C "$root" rev-parse --path-format=absolute --git-common-dir)")"
live="${PIPCAST_LIVE:-$(dirname "$main")/$(basename "$main")-live}"
claude="$("$root/scripts/claude-bin.sh")"

# The two installs the app can run
live_id="pipcast@pipcast"
published_id="pipcast@erdembircan-plugins"

# The live checkout's commit and subject, on one line
describe() {
  git -C "$live" log -1 --format='%h %s'
}

# What Claude Code lists for an install at user scope: its state (enabled,
# disabled or missing) or its version
listed() { # state|version <id>
  { "$claude" plugin list --json 2>/dev/null || true; } | node -e '
    let plugins = []
    try { plugins = JSON.parse(require("node:fs").readFileSync(0, "utf8")) } catch {}
    const plugin = plugins.find((entry) => entry.id === process.argv[2] && entry.scope === "user")
    if (process.argv[1] === "version") process.stdout.write(plugin?.version ?? "")
    else process.stdout.write(plugin === undefined ? "missing" : plugin.enabled ? "enabled" : "disabled")
  ' "$1" "$2"
}

# Turns an install on or off, unless it already is. A missing install is never
# turned on: Claude Code would record it as on all the same.
turn() { # on|off <id>
  case "$1:$(listed state "$2")" in
    on:disabled) "$claude" plugin enable "$2" --scope user >/dev/null ;;
    off:enabled) "$claude" plugin disable "$2" --scope user >/dev/null ;;
  esac
}

# What the app runs, as a phrase
running() {
  local live_now published_now
  live_now="$(listed state "$live_id")"
  published_now="$(listed state "$published_id")"
  if [[ "$live_now" == enabled && "$published_now" == enabled ]]; then
    echo "both the published release and the live checkout"
  elif [[ "$live_now" == enabled && -e "$live/.git" ]]; then
    echo "the live checkout in $live, at $(describe)"
  elif [[ "$live_now" == enabled ]]; then
    echo "the live checkout, which is missing from $live"
  elif [[ "$published_now" == enabled ]]; then
    echo "the published release, $published_id $(listed version "$published_id")"
  else
    echo "no Pipcast"
  fi
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

# Brings what origin has; carries on with what this clone has when it cannot
fetch() {
  git -C "$main" fetch -q origin "$@" || echo "Could not fetch from origin: using what this clone already has." >&2
}

# Says what the app ran and what it runs now
moved() { # <what it ran> [<what was put there>]
  echo "The app ran $1."
  echo "It now runs $(running)${2:+ ($2)}."
  echo "Run /reload-plugins in a session to pick it up, or start a new one."
}

# Puts the live checkout on a commit and in the app; refuses while the live
# checkout holds changes of its own
put() {
  local commit="$1" what="$2" before
  need_live
  if [[ -n "$(git -C "$live" status --porcelain)" ]]; then
    echo "The live checkout at $live has changes of its own, so nothing moved:" >&2
    git -C "$live" status --short >&2
    exit 1
  fi
  before="$(running)"
  git -C "$live" checkout -q --detach "$commit"
  turn off "$published_id"
  turn on "$live_id"
  moved "$before" "$what"
}

case "${1:-}" in
  '')
    now="$(running)"
    echo "The app runs $now."
    case "$now" in
      both*)
        echo "Every session runs Pipcast twice: run scripts/live.sh published or scripts/live.sh master to keep one."
        ;;
      'no Pipcast')
        echo "Run scripts/live.sh published to put the published release in the app, or scripts/live.sh setup to put the live checkout there."
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
    turn off "$published_id"
    "$claude" plugin marketplace add "$live" >/dev/null
    if [[ "$(listed state "$live_id")" == missing ]]; then
      "$claude" plugin install "$live_id" --scope user >/dev/null
    fi
    turn on "$live_id"
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
    if [[ "$(listed state "$published_id")" == missing ]]; then
      echo "The published release, $published_id, is not installed, so nothing moved. Install it from a terminal, then run scripts/live.sh published again:" >&2
      echo "  claude plugin marketplace add erdembircan/plugin-marketplace" >&2
      echo "  claude plugin install $published_id" >&2
      exit 1
    fi
    before="$(running)"
    if ! "$claude" plugin update "$published_id" --scope user >/dev/null 2>&1; then
      echo "Could not update the published release: it stays at $(listed version "$published_id")." >&2
    fi
    turn off "$live_id"
    turn on "$published_id"
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
