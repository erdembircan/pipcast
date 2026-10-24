# Notes for agents working on pipcast

## plugin/ is built

`plugin/` is what an install copies, and only that: the mod bundled into one file, its manifest, its state contract, its icon, the license, and the station with its page and jingles. `scripts/build.sh` writes all of it from the sources, and its last step stops when `plugin/` holds a file it does not make.

- Never edit `plugin/` by hand. The mod is in `packages/mod`, with its manifest in `packages/mod/plugin.json`; the contract it shares with the station and the broadcast is in `packages/contract`; the broadcast is in `packages/director` and `packages/renderer`; the station is in `station/`.
- After changing any of them, run `scripts/build.sh` and commit what it builds with the change. CI builds again and fails when the result differs from what is committed.
- A change to `station/Sources` or `scripts/build-station.sh` means a new station binary, which only builds on a Mac. Run `scripts/build.sh` after the last such change, then commit.
- Keep sources, tests and tools out of `plugin/`. A new file the plugin needs goes in `SHIPS` in `scripts/build-plugin.mjs`, and in the build step that makes it.
- Code in `packages/mod/src` and `packages/contract/src` imports with relative paths only: the kit tests run against the built plugin in a folder of their own, where an alias such as `@pipcast/contract` resolves to nothing.

## What the desktop app runs

The Claude desktop app runs pipcast from the live checkout: a second checkout of this repository in a folder beside the main checkout, named after it (`~/Developer/JS/pipcast-live` beside `~/Developer/JS/pipcast`). The `pipcast` marketplace points at that folder, and every session reads the plugin from its `plugin/` folder when it starts or on `/reload-plugins`. The main checkout and its worktrees change nothing the app runs.

- To let the user try a change in the app, use `scripts/live.sh`. Never check a branch or a commit out in the main checkout for that: it does not reach the app, and other sessions branch their work from the main checkout.
  - `scripts/live.sh` says what the app runs now.
  - `scripts/live.sh pr <number>` puts a pull request's head in the app, `scripts/live.sh <branch or commit>` puts any other commit there, and `scripts/live.sh master` puts master back.
  - Then ask the user to run `/reload-plugins` in a session, or to start a new one.
- Only committed work reaches the app. Run `scripts/build.sh` and commit what it builds before you put a branch there.
- Every session shares the live checkout. Run `scripts/live.sh` first, and do not move it off another session's pull request unless the user asks you to.
- After merging a pull request, run `scripts/live.sh master` if the app was running master or that pull request.
- With no live checkout yet, `scripts/live.sh setup` makes one and points the marketplace at it.
- To check `scripts/live.sh` itself, run `scripts/test.d/50-live.sh`: it works in a throwaway copy. Running `scripts/live.sh` changes what the user's app runs.
