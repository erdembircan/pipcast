# Notes for agents working on pipcast

The README is for people who install Pipcast. How to build, test and try a change is in `docs/development.md`, and how the parts fit together in `docs/architecture.md`.

## plugin/ is built

`plugin/` is what an install copies, and only that: the mod bundled into one file, its manifest, its README, its state contract, its icon, the license, and the station with its page and jingles. `scripts/build.sh` writes all of it from the sources, and its last step stops when `plugin/` holds a file it does not make.

- Never edit `plugin/` by hand. The mod is in `packages/mod`, with its manifest in `packages/mod/plugin.json` and its README in `packages/mod/README.md`; the contract it shares with the station and the broadcast is in `packages/contract`; the broadcast is in `packages/director` and `packages/renderer`; the station is in `station/`.
- After changing any of them, run `scripts/build.sh` and commit what it builds with the change. CI builds again and fails when the result differs from what is committed.
- A change to what `plugin/` holds reaches the people who installed Pipcast only with a new version, so the pull request that makes it raises the version too. Release in `docs/development.md` says how. 1.0.0 is out through erdembircan-plugins, though untagged for now, so no change to `plugin/` can ship as 1.0.0.
- A change to `station/Sources` or `scripts/build-station.sh` means a new station binary, which only builds on a Mac. Run `scripts/build.sh` after the last such change, then commit.
- A change to the icon's drawing, in `scripts/build-icon.mjs` or in a token or letter outline it takes in, means new PNGs of the icon and its layers, which only render on a Mac with Chrome. Run `scripts/build.sh` there after the last such change, then commit.
- Keep sources, tests and tools out of `plugin/`. A new file the plugin needs goes in `SHIPS` in `scripts/build-plugin.mjs`, and in the build step that makes it.
- The development build, which takes cues, never goes into `plugin/`: its station code is inside `#if PIPCAST_DEV`, its page is `packages/dev`, and `scripts/build-dev.sh` builds both into `.dev/`. Keep every way in for a cue there.
- Code in `packages/mod/src`, `packages/contract/src` and `packages/dev/src` imports with relative paths only: the kit tests run against the built plugin in a folder of their own, and `scripts/cue.mjs` runs `packages/dev/src/cue.ts` with Node itself, and in neither does an alias such as `@pipcast/contract` resolve to anything.

## Anthropic's plugin directory

Anthropic's plugin directory, one of the two places people install Pipcast from, reads only `plugin/` and checks every version against its rules. Anthropic's plugin directory in `docs/development.md` says what they are and how a version reaches people.

- The directory takes Pipcast's versions from the `release` branch alone, and erdembircan-plugins from master, so a push anywhere but `release` changes nothing in the directory. While a version is with the directory, being scanned, with a reviewer, or approved and not yet live, leave `release` on it, however far master moves: moving it puts another version in front of the reviewer. When the portal asks for a change to that version, tell the user what moving `release` would bring the directory besides the fix, and move it only on their word. Release in `docs/development.md` says when `release` moves, and what moving it brings.
- `scripts/check-directory.mjs` checks the rules that can be checked here, and CI runs it. Fix what it reports. A file the directory's validator can't inspect, such as the station's binary, goes in its `HELD` list only with the reason it ships, and holds every version for a reviewer.
- `plugin/README.md`, built from `packages/mod/README.md`, is Pipcast's listing, and tells the people who add Pipcast everything it runs, reads and keeps. When the mod or the station starts to run, read or keep anything new, say so in its **What Pipcast runs and reads** or **Privacy** section, and in the same section of the root README, word for word.
- Never minify what ships: the directory holds code it can't read for a reviewer.

## What the desktop app runs

The Claude desktop app runs one Pipcast at a time, a release or the live checkout while a change is tried:

- **The release**, which the user installs in the app from one of the two places people get Pipcast: Anthropic's plugin directory, whose copy the desktop app hands to each of its sessions itself, outside Claude Code's plugin list, or the `erdembircan-plugins` marketplace (`erdembircan/plugin-marketplace` on GitHub, which lists the user's other plugins too), as `pipcast@erdembircan-plugins`. Nothing in this repository installs or updates it.
- **The live checkout**, `pipcast@pipcast`: a second checkout of this repository in a folder beside the main checkout, named after it (`~/Developer/JS/pipcast-live` beside `~/Developer/JS/pipcast`), which the app runs as its development build: its `plugin/` with the station and the page built to take cues. `scripts/live.sh` builds it into the live checkout's `.dev/`, which git ignores, and points the `pipcast` marketplace, this repository's own, at `.dev/marketplace`. That marketplace is for development only: nobody installs Pipcast from it. Every session reads the live checkout's build from `.dev/marketplace/plugin` when it starts or on `/reload-plugins`, and the station runs from there.

The main checkout and its worktrees change nothing the app runs.

- To let the user try a change in the app, use `scripts/live.sh`. Never check a branch or a commit out in the main checkout for that: it does not reach the app, and other sessions branch their work from the main checkout.
  - `scripts/live.sh` says what the app runs now.
  - With no live checkout yet, `scripts/live.sh setup` makes one on master, builds it, installs it and puts it in the app.
  - `scripts/live.sh pr <number>` builds a pull request's head and puts it in the app, `scripts/live.sh <branch or commit>` does the same for any other commit, and `scripts/live.sh master` for master. Each turns off the release that is on, and remembers which. A build that fails moves nothing.
  - `scripts/live.sh published` takes the live checkout out and turns that release back on. With no release in Claude Code's plugin list, it still takes the live checkout out, and the app runs no Pipcast from that list.
  - `scripts/live.sh remove` does the same, then uninstalls the live checkout and removes it with the `pipcast` marketplace.
  - `scripts/live.sh restart` stops the station on air and, while the live checkout is in the app, starts the live checkout's station in its place, so after a switch to it the station is its build even before every session has reloaded.
  - Then ask the user to run `/reload-plugins` in a session, or to start a new one.
- Only committed work reaches the app. Run `scripts/build.sh` and commit what it builds before you put a branch there.
- To air BREAKING NEWS or the report on the hour now, instead of waiting for a turn to end or the hour to strike, use `scripts/live.sh story` and `scripts/live.sh hour` (Cue a segment in `docs/development.md`). Only the live checkout's development build takes a cue. A cue airs in the user's window, with sound: ask before sending one, as before any change to what the app shows.
- A copy the desktop app hands in itself, from Anthropic's plugin directory or an upload in Customize > Plugins, is the one kind of release `scripts/live.sh` can't see or turn off, and desktop sessions run it over the live checkout. When the user has one, a change put in the app runs in their desktop sessions only while that copy is off: ask them to turn it off in Customize > Plugins first, and back on when they're done.
- Every session shares the live checkout and what the app runs. Run `scripts/live.sh` first, and do not move the app off another session's pull request unless the user asks you to.
- After merging a pull request the app was running, run `scripts/live.sh master` to keep it on master, or, when the user has a release, `scripts/live.sh published` to go back to it.
- To check `scripts/live.sh` itself, run `scripts/test.d/50-live.sh`: it works in a throwaway copy. Running `scripts/live.sh` changes what the user's app runs.
