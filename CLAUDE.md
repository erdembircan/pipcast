# Notes for agents working on pipcast

The README is for people who install Pipcast. How to build, test and try a change is in `docs/development.md`, and how the parts fit together in `docs/architecture.md`.

## plugin/ is built

`plugin/` is what an install copies, and only that: the mod bundled into one file, its manifest, its state contract, its icon, the license, and the station with its page and jingles. `scripts/build.sh` writes all of it from the sources, and its last step stops when `plugin/` holds a file it does not make.

- Never edit `plugin/` by hand. The mod is in `packages/mod`, with its manifest in `packages/mod/plugin.json`; the contract it shares with the station and the broadcast is in `packages/contract`; the broadcast is in `packages/director` and `packages/renderer`; the station is in `station/`.
- After changing any of them, run `scripts/build.sh` and commit what it builds with the change. CI builds again and fails when the result differs from what is committed.
- A change to what `plugin/` holds reaches the people who installed Pipcast only with a new version, so the pull request that makes it raises the version too. Release in `docs/development.md` says how.
- A change to `station/Sources` or `scripts/build-station.sh` means a new station binary, which only builds on a Mac. Run `scripts/build.sh` after the last such change, then commit.
- A change to the icon's drawing, in `scripts/build-icon.mjs` or in a token or letter outline it takes in, means new PNGs of the icon and its layers, which only render on a Mac with Chrome. Run `scripts/build.sh` there after the last such change, then commit.
- Keep sources, tests and tools out of `plugin/`. A new file the plugin needs goes in `SHIPS` in `scripts/build-plugin.mjs`, and in the build step that makes it.
- Code in `packages/mod/src` and `packages/contract/src` imports with relative paths only: the kit tests run against the built plugin in a folder of their own, where an alias such as `@pipcast/contract` resolves to nothing.

## What the desktop app runs

The Claude desktop app runs one of two installs of pipcast, never both:

- **The published release**, `pipcast@erdembircan-plugins`, from the `erdembircan-plugins` marketplace (`erdembircan/plugin-marketplace` on GitHub), whose entry installs `plugin/` from master. It is what the app runs day to day.
- **The live checkout**, `pipcast@pipcast`: a second checkout of this repository in a folder beside the main checkout, named after it (`~/Developer/JS/pipcast-live` beside `~/Developer/JS/pipcast`), installed from the `pipcast` marketplace, this repository's own, which points at that folder. Every session reads it from its `plugin/` folder when it starts or on `/reload-plugins`.

The main checkout and its worktrees change nothing the app runs.

- To let the user try a change in the app, use `scripts/live.sh`. Never check a branch or a commit out in the main checkout for that: it does not reach the app, and other sessions branch their work from the main checkout.
  - `scripts/live.sh` says what the app runs now.
  - `scripts/live.sh pr <number>` puts a pull request's head in the app, `scripts/live.sh <branch or commit>` puts any other commit there, and `scripts/live.sh master` puts master there. Each takes the published release out of the app.
  - `scripts/live.sh published` updates the published release and puts it back, taking the live checkout out.
  - Then ask the user to run `/reload-plugins` in a session, or to start a new one.
- Only committed work reaches the app. Run `scripts/build.sh` and commit what it builds before you put a branch there.
- Every session shares the live checkout and what the app runs. Run `scripts/live.sh` first, and do not move the app off another session's pull request unless the user asks you to.
- After merging a pull request the app was running, run `scripts/live.sh published`.
- With no live checkout yet, `scripts/live.sh setup` makes one on master, installs it and puts it in the app.
- To check `scripts/live.sh` itself, run `scripts/test.d/50-live.sh`: it works in a throwaway copy. Running `scripts/live.sh` changes what the user's app runs.
