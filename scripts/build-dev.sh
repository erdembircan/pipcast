#!/bin/bash
# Builds the development build of the plugin from this checkout into
# .dev/marketplace/plugin.next: what plugin/ holds, with the station built with
# PIPCAST_DEV and its page built from packages/dev, so that both take cues.
# scripts/live.sh runs it in the live checkout, then swaps what it builds into
# .dev/marketplace/plugin, the folder the app reads. Nothing else installs it,
# and it never goes into plugin/. .dev/ is git-ignored.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

dev="$root/.dev"
next="$dev/marketplace/plugin.next"
mkdir -p "$dev/marketplace"

# The repository's tools: installed when they are missing, and again when
# package-lock.json has changed since the last build here
lock="$(shasum -a 256 package-lock.json | cut -d ' ' -f 1)"
stamp="$(cat "$dev/npm.SOURCE" 2>/dev/null || true)"
if [[ ! -d node_modules || (-n "$stamp" && "$stamp" != "$lock") ]]; then
  npm ci --no-audit --no-fund --loglevel=error
fi
echo "$lock" >"$dev/npm.SOURCE"

# The station, with the cues compiled in. Its own scratch folder, so the build
# that ships keeps its own
swift=(build -c release --package-path station --product pipcast-station -Xswiftc -DPIPCAST_DEV --scratch-path "$dev/swift")
swift "${swift[@]}"
bin="$(swift "${swift[@]}" --show-bin-path)"

# The page, from packages/dev, into .dev/web
node scripts/build-web.mjs --dev

# The plugin: plugin/ as committed, with that station and that page
rm -rf "$next"
cp -R plugin "$next"
cp "$bin/pipcast-station" "$next/station/pipcast-station"
chmod 755 "$next/station/pipcast-station"
rm -rf "$next/station/web"
cp -R "$dev/web" "$next/station/web"

echo "Built the development build in $next"
