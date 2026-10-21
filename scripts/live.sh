#!/bin/bash
# What the Claude desktop app runs. The app runs pipcast from the live checkout:
# a second checkout of this repository in a folder beside the main checkout,
# named after it (~/Developer/JS/pipcast-live beside ~/Developer/JS/pipcast).
# The pipcast marketplace points at that folder, so the checkout you work in
# never changes what the app runs. PIPCAST_LIVE names another folder.
#
#   scripts/live.sh               says what the app runs now
#   scripts/live.sh setup         makes the live checkout on master and points
#                                 the pipcast marketplace at it; run it once
#   scripts/live.sh pr <number>   puts a pull request's head in the app
#   scripts/live.sh master        puts master back
#   scripts/live.sh <ref>         puts any branch or commit in the app
#
# Sessions pick a change up on /reload-plugins, or when they start.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
# The main checkout, also when this runs from one of its worktrees
main="$(dirname "$(git -C "$root" rev-parse --path-format=absolute --git-common-dir)")"
live="${PIPCAST_LIVE:-$(dirname "$main")/$(basename "$main")-live}"

# The live checkout's commit and subject, on one line
describe() {
  git -C "$live" log -1 --format='%h %s'
}

need_live() {
  if [[ ! -e "$live/.git" ]]; then
    echo "There is no live checkout at $live: run scripts/live.sh setup first." >&2
    exit 1
  fi
}

# Brings what origin has; carries on with what this clone has when it cannot
fetch() {
  git -C "$main" fetch -q origin "$@" || echo "Could not fetch from origin: using what this clone already has." >&2
}

# Puts the live checkout on a commit; refuses while it holds changes of its own
put() {
  local commit="$1" what="$2" before
  need_live
  if [[ -n "$(git -C "$live" status --porcelain)" ]]; then
    echo "The live checkout at $live has changes of its own, so nothing moved:" >&2
    git -C "$live" status --short >&2
    exit 1
  fi
  before="$(describe)"
  git -C "$live" checkout -q --detach "$commit"
  echo "The app ran: $before"
  echo "It now runs: $(describe) ($what)"
  echo "Run /reload-plugins in a session to pick it up, or start a new one."
}

case "${1:-}" in
  '')
    need_live
    echo "The app runs $live, at $(describe)."
    if [[ "$(git -C "$live" rev-parse HEAD)" == "$(git -C "$main" rev-parse origin/master)" ]]; then
      echo "That is master."
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
    "$("$root/scripts/claude-bin.sh")" plugin marketplace add "$live"
    echo "Run /reload-plugins in a session to pick it up, or start a new one."
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
  *)
    fetch
    if ! commit="$(git -C "$main" rev-parse -q --verify "$1^{commit}")"; then
      echo "There is no branch or commit called $1." >&2
      exit 1
    fi
    put "$commit" "$1"
    ;;
esac
