#!/bin/bash
# The development build and its cues, with nothing of yours involved. First
# scripts/build-dev.sh builds this checkout's development build, which has to
# hold the files plugin/ holds, with a station that says +dev and a page with
# the dev director, while plugin/ stays as built. Then scripts/cue.mjs runs
# against a throwaway store: what it says with no station on air, or one that
# takes no cues, and the cue that story, hour and cue each write into the
# store's dev folder beside a stand-in for the development build and a session
# on air, or why they write none. No station starts and no window shows. The
# temporary folder is removed on exit.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/pipcast-test-dev.XXXXXX")"
stand_in=""
finish() {
  if [[ -n "$stand_in" ]]; then
    kill "$stand_in" 2>/dev/null || true
  fi
  rm -rf "$tmp"
}
trap finish EXIT

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

# Succeeds when the command it runs fails
not() {
  ! "$@"
}

# The files a folder holds, one path a line, in order
files() {
  (cd "$1" && find . -type f ! -name '.DS_Store' | LC_ALL=C sort)
}

# The development build
bash scripts/build-dev.sh >/dev/null
next=".dev/marketplace/plugin.next"
marker="waits for the window to show and the air to clear"
check "build-dev.sh builds the development build into .dev/marketplace/plugin.next" test -x "$next/station/pipcast-station"
check "which holds the files plugin/ holds" test "$(files plugin)" = "$(files "$next")"
check "with a station that says +dev" grep -qx "pipcast-station [0-9.]*+dev" <<<"$("$next/station/pipcast-station" --version)"
check "while the one in plugin/ doesn't" grep -qx "pipcast-station [0-9.]*" <<<"$(plugin/station/pipcast-station --version)"
check "and a page with the dev director" grep -qF "$marker" "$next/station/web/station.js"
check "which the page in plugin/ has none of" not grep -qF "$marker" plugin/station/web/station.js
check "and the rest as plugin/ has it" diff -rq -x station plugin "$next"
check "while plugin/ stays as git has it" test -z "$(git status --porcelain plugin)"

# Cues, with a throwaway store
export PIPCAST_HOME="$tmp/store"
# Nothing takes a cue here: no waiting for one to be taken
export PIPCAST_DEV_WAIT_MS=0
cue=(node "$root/scripts/cue.mjs")
cues="$PIPCAST_HOME/dev"
mkdir -p "$PIPCAST_HOME/sessions"

# How many cues the dev folder holds
count() {
  find "$cues" -name '*.json' 2>/dev/null | wc -l | tr -d ' '
}

# The newest cue's file
newest() {
  find "$cues" -name '*.json' 2>/dev/null | LC_ALL=C sort | tail -n 1
}

# Whether a field of the newest cue is exactly the JSON given
field_is() { # <field> <json>
  node -e '
    const { readFileSync } = require("node:fs")
    const { isDeepStrictEqual } = require("node:util")
    const cue = JSON.parse(readFileSync(process.argv[1], "utf8"))
    process.exit(isDeepStrictEqual(cue[process.argv[2]], JSON.parse(process.argv[3])) ? 0 : 1)
  ' "$(newest)" "$1" "$2"
}

# Whether the newest cue has no such field
lacks() { # <field>
  node -e '
    const cue = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))
    process.exit(process.argv[2] in cue ? 1 : 0)
  ' "$(newest)" "$1"
}

# Whether the newest cue's id is its file's name
named_by_its_file() {
  node -e '
    const { readFileSync } = require("node:fs")
    const { basename } = require("node:path")
    const cue = JSON.parse(readFileSync(process.argv[1], "utf8"))
    process.exit(cue.id === basename(process.argv[1], ".json") ? 0 : 1)
  ' "$(newest)"
}

# A stand-in for a station on air, the development build unless a version is
# given, and a session on air with a story of its own: written again before
# each step, so neither goes stale
on_air() { # [<version>]
  local now
  now="$(node -e 'process.stdout.write(String(Date.now()))')"
  printf '{"v":1,"pid":%s,"startedAt":%s,"heartbeatAt":%s,"version":"%s"}' "$stand_in" "$now" "$now" "${1:-1.0.0+dev}" >"$PIPCAST_HOME/station.json"
  printf '{"v":1,"id":"s1","title":"Fix the login form","project":"web-shop","state":"ready","stateAt":%s,"tunedInAt":%s,"checkedInAt":%s,"stories":[{"id":"s1:1","kind":"ready","at":%s,"added":12,"removed":3,"files":2,"durationMs":240000}],"activity":[],"hours":[]}' "$now" "$now" "$now" "$now" >"$PIPCAST_HOME/sessions/s1.json"
}

check "with no station on air, story says so" grep -qF "No station is on air, so nothing would take the cue." <<<"$("${cue[@]}" story 2>&1 || true)"
check "and writes no cue" test "$(count)" = 0

sleep 600 &
stand_in=$!
# Its end is no news: the shell says nothing when it is killed
disown "$stand_in"
on_air 1.0.0
check "with a station on air that takes no cues, story says so" grep -qF "The station on air takes no cues" <<<"$("${cue[@]}" story 2>&1 || true)"
check "and writes no cue" test "$(count)" = 0

on_air
"${cue[@]}" story >/dev/null
check "with the development build on air, story writes one cue into the store's dev folder" test "$(count)" = 1
check "named by when it was written" bash -c 'basename "$1" | grep -qE "^[0-9]{13}-[0-9a-f]{4}\.json$"' _ "$(newest)"
check "with no temporary file left" test -z "$(find "$cues" -name '*.tmp')"
check "and that name for its id" named_by_its_file
check "a ready story with nothing else, by default" field_is stories '[{"kind":"ready"}]'

on_air
"${cue[@]}" story needs-input --title "Tidy the release notes" --project docs-site --command "npm test" --quote "Run the tests?" --minutes 3 >/dev/null
check "story takes a kind and its words and figures" field_is stories '[{"kind":"needs-input","title":"Tidy the release notes","project":"docs-site","command":"npm test","quote":"Run the tests?","minutes":3}]'
on_air
"${cue[@]}" story ready --added 120 --removed 30 --files 5 --minutes 9 >/dev/null
check "and a ready story's lines, files and minutes" field_is stories '[{"kind":"ready","added":120,"removed":30,"files":5,"minutes":9}]'
on_air
"${cue[@]}" story --session login >/dev/null
check "--session on its own airs that session's newest story again, as it was" field_is stories '[{"kind":"ready","session":"s1","title":"Fix the login form","project":"web-shop","added":12,"removed":3,"files":2,"minutes":4}]'
on_air
"${cue[@]}" story complete --session s1 >/dev/null
check "--session with a kind lands a story of that kind on the session" field_is stories '[{"kind":"complete","session":"s1","title":"Fix the login form","project":"web-shop"}]'

on_air
before="$(count)"
check "--command on a ready story is refused" grep -qF -- "--command is for needs-input stories." <<<"$("${cue[@]}" story ready --command "npm test" 2>&1 || true)"
check "--quote on a ready story is refused" grep -qF -- "--quote is for needs-input, complete and error stories." <<<"$("${cue[@]}" story --quote "Done." 2>&1 || true)"
check "a figure that isn't a whole number is refused" grep -qF -- "--added takes a whole number." <<<"$("${cue[@]}" story --added lots 2>&1 || true)"
check "a kind that isn't one is refused" grep -qF "The kind of story is needs-input, ready, complete or error." <<<"$("${cue[@]}" story breaking 2>&1 || true)"
check "an option that isn't one is refused" grep -qF "Unknown option --colour." <<<"$("${cue[@]}" story --colour red 2>&1 || true)"
check "--session that matches no session on air is refused, naming the ones on air" grep -qF 'No session on air matches "checkout". On air: Fix the login form (s1).' <<<"$("${cue[@]}" story --session checkout 2>&1 || true)"
check "--session with --title is refused" grep -qF -- "--session takes the title and project of the session it names" <<<"$("${cue[@]}" story --session s1 --title "Other" 2>&1 || true)"
check "and none of them writes a cue" test "$(count)" = "$before"

on_air
"${cue[@]}" hour >/dev/null
check "hour cues the report on the next hour" field_is segment '"hour"'
check "from the sessions on air" lacks samples
on_air
"${cue[@]}" hour --sessions 5 >/dev/null
check "hour --sessions takes that many sample sessions" field_is samples 5
on_air
"${cue[@]}" hour --quiet >/dev/null
check "hour --quiet takes four sample sessions" field_is samples 4
check "and makes a quiet hour of them" field_is quiet true
check "hour --sessions past 7 is refused, with the reason the page would drop it" grep -qF "That cue would be dropped: samples must be a whole number from 1 to 7." <<<"$("${cue[@]}" hour --sessions 9 2>&1 || true)"

on_air
printf '{"segment":"story","stories":[{"kind":"error","quote":"Claude is overloaded right now."}]}' >"$tmp/error.json"
"${cue[@]}" cue "$tmp/error.json" >/dev/null
check "cue sends a file's cue as it is" field_is stories '[{"kind":"error","quote":"Claude is overloaded right now."}]'
check "with an id of its own" named_by_its_file
on_air
printf '{"id":"my-cue","segment":"hour","samples":2}' | "${cue[@]}" cue - >/dev/null
check "cue takes its input with -, and keeps the cue's own id" field_is id '"my-cue"'
printf '{"segment":"story","stories":[{"kind":"error","added":1}]}' >"$tmp/bad.json"
check "cue refuses one the page would drop, and says why" grep -qF "That cue would be dropped: stories[0].added is for ready stories." <<<"$("${cue[@]}" cue "$tmp/bad.json" 2>&1 || true)"

exit "$failed"
