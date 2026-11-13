# Developing Pipcast

This is for working on Pipcast itself. To install and use it, see the [README](../README.md).

## How it works

Pipcast has three parts.

- **The mod**, in `packages/mod`, runs inside each Claude Code session. It draws the band, answers `/pipcast`, follows the session's events, and writes what it sees to a small file for that session.
- **The station**, in `station/`, is a native macOS app with one always-on-top window. It reads every session's file and plays the broadcast in that window.
- **The broadcast**, in `packages/director` and `packages/renderer`, is what plays in the window: the director that decides what airs and when, and the KLWD graphics from the design system in `design/`.

The sessions and the station talk only through files in `~/Library/Application Support/Pipcast`. [architecture.md](architecture.md) has the details.

An install gets none of this source. It copies `plugin/`, which holds only what runs, all of it built from the source: the mod bundled into one file, the station's binary, the broadcast's page and its sounds, and the plugin's manifest, icon, README and license.

## Build

Pipcast builds with Node.js 22 or later and the Swift toolchain that comes with Xcode or its Command Line Tools.

```bash
npm ci
```

```bash
scripts/build.sh
```

builds everything an install gets into `plugin/`: the mod bundled into one file, the station, the broadcast's page and its sounds, with the plugin's manifest, icon, README and license. `plugin/` belongs to the build. Don't edit it by hand or keep anything else in it: the build stops when it finds a file there that it doesn't make. Commit what it builds, since an install copies `plugin/` as it is, and CI fails a pull request whose `plugin/` differs from what its sources build.

The build minifies nothing, so the people who install Pipcast can read every line it runs. The broadcast's page is its own code, `station.js`, bundled as written, and the design system's bundle, `design/components/bundle.js`, which the build copies as it is to `design.js` beside it, and React's production files from its npm package, copied unchanged into `plugin/station/web/vendor` with React's license. The page loads React first, then `design.js`, then `station.js`.

The globe's pictures of the Earth are in `design/textures`, which the build copies to `plugin/station/web/textures`; `CREDITS.txt` there says where they come from.

The plugin's icon is KLWD's tower over the city at dusk, its beacon sending out the board's signal. `scripts/build-icon.mjs` draws it in layers from the design system's colours and the band's letters: `assets/icon.svg` stacks them, and `assets/icon-layers` holds each one on its own, as an SVG and as a 2048-pixel PNG, with `layers.json` saying how they stack, for animating the icon. The build draws them every time; their PNGs render only on a Mac, with Chrome, and on CI the build stops when the PNGs were rendered from another drawing.

## The manifest and the README

The plugin's manifest is `packages/mod/plugin.json`, which the build copies to `plugin/.claude-plugin/plugin.json`. Its `version` is the plugin's version, and the manifest is the only place it is set: the marketplaces' entries leave it out, the station's `Constants.version` and the root `package.json` repeat it, and tests fail when either of them differs.

The plugin's README is `packages/mod/README.md`, which the build copies to `plugin/README.md`. It is written for someone deciding whether to add Pipcast, and it says everything Pipcast runs, reads and keeps. Its sections **What Pipcast runs and reads** and **Privacy** are in this repository's README too, word for word, and `packages/mod/test/readme.test.ts` fails when the two differ. When Pipcast starts to run, read or keep anything new, say so in both.

The manifest also names the plugin's icon, `assets/icon-1024.png` copied to `plugin/assets/icon.png`.

Two marketplaces list Pipcast as well. Each entry repeats the manifest's display fields, `displayName`, `description`, `author`, `homepage`, `repository`, `license` and `keywords`, because Claude Code shows an entry's own value wherever it sets one:

- **pipcast**, in this repository's `.claude-plugin/marketplace.json`, is for development only, and lists nothing but Pipcast: `scripts/live.sh` installs the live checkout from it, and `scripts/verify-install.sh` installs this clone from it. Nobody installs Pipcast from it. Its entry names `./plugin`, and a test fails when its display fields differ from the manifest's.
- **erdembircan-plugins**, in [erdembircan/plugin-marketplace](https://github.com/erdembircan/plugin-marketplace), is where people install Pipcast from: a marketplace of your Claude Code plugins, Pipcast among them. Its entry is a `git-subdir` source that installs `plugin/` from this repository's master branch. When a display field changes in the manifest, change it in that entry too.

## Test

```bash
scripts/test.sh
```

runs every check: lint, types, the unit tests of each part, the station's Swift tests and its development build compiled, the marketplace and the built plugin validated by the engine bundled with the Claude desktop app, the mod's kit tests against it, `scripts/live.sh` in a throwaway copy of the repository, and the development build and `scripts/cue.mjs` with a throwaway store.

```bash
scripts/verify.sh
```

runs the whole thing for real, with no window of yours involved: a headless Claude Code session tunes in, the station starts and shows its window, the session tunes out, and the station quits. With **Transparent window** on, the window server has to show that window at 40%, or whole while the pointer is on it, and whole once it is off. Another session is renamed on air, off air and after the window's close, and its title on air has to follow each time. One more, with nothing saved for **Tune in every new session**, which leaves it on, has to stay off the air until a stand-in for the desktop app shows it, then tune in by itself, and again after a `/clear`. An install into a throwaway configuration then has to hold exactly the files in `plugin/`, with no source or test among them. There `/pipcast auto` has to say **Tune in every new session** is on before anything is saved, and `/pipcast auto`, `/pipcast transparency` and `/pipcast oldtv` have to turn all three settings on and off, each value landing where Claude Code keeps plugin options, and the last two in the file the station reads as well. The station's own checks end with one more: a station starts with **Old TV** on, and two pictures of its window a moment apart have to differ, since the grain moves; started with it off, they have to match. With Reduce Motion on, that check is skipped.

## Try a change in the desktop app

The desktop app runs one Pipcast at a time: the release you installed from erdembircan-plugins (`pipcast@erdembircan-plugins`), or the live checkout while you try a change.

The live checkout, `pipcast@pipcast`, is a second checkout of this repository in a folder beside your clone, named after it (`~/Developer/JS/pipcast-live` beside `~/Developer/JS/pipcast`). The app runs it as its development build: what its `plugin/` holds, with the station and its page built to take cues (Cue a segment, below). `scripts/live.sh` builds that into the live checkout's `.dev/` folder and points the `pipcast` marketplace at `.dev/marketplace`, so every session reads the plugin from `.dev/marketplace/plugin` when it starts or on `/reload-plugins`, and the station runs from there. The live checkout's own `plugin/` stays the release build, as committed. `.dev/` and `node_modules/` stay out of git at any commit, through your clone's `.git/info/exclude`, which `scripts/live.sh` keeps. Your clone never changes what the app runs, so you can switch branches in it freely.

`scripts/live.sh` moves the live checkout in and out of the app. It is for development only: it never installs or updates a release. Install the release in the app, as the README says, and update it there.

```bash
scripts/live.sh setup
```

makes the live checkout on master, builds it, installs it from the `pipcast` marketplace and puts it in the app. The first build installs the repository's tools in the live checkout and builds all of the station, which takes a few minutes; after that a build takes seconds, unless the station's sources changed.

```bash
scripts/live.sh pr 12
```

puts a pull request in the app. `scripts/live.sh <branch or commit>` puts any other commit there and `scripts/live.sh master` puts master there. Each checks the commit out in the live checkout, builds it with the commit's own `scripts/build-dev.sh` and swaps the build in, then turns off the release that is on, and remembers which. A build that fails moves nothing. A commit from before the development build has no `scripts/build-dev.sh`: its `plugin/` goes in as it is, and takes no cues. A station running the build that was in the app is restarted on the new build when the move changes it, and one that a release in Claude Code's plugin list started is replaced with the live checkout's, since the move turned that release off.

```bash
scripts/live.sh published
```

takes the live checkout out and turns that release back on. With no release in Claude Code's plugin list, it still takes the live checkout out, and the app runs no Pipcast from that list. `scripts/live.sh` on its own says what the app runs now, and whether the station on air takes cues. After any of them, run `/reload-plugins` in a session, or start a new one. Only committed work reaches the app, so run `scripts/build.sh` and commit what it builds first.

```bash
scripts/live.sh remove
```

does the same, then takes the live checkout out of Claude Code altogether: it uninstalls `pipcast@pipcast` and removes the `pipcast` marketplace and the live checkout's folder, its build with it. A station started from the live checkout runs from that folder, so `remove` stops the station first, and a session on air starts it again from the release within half a minute. `scripts/live.sh setup` makes the live checkout again.

An upload in **Customize > Plugins** is the one kind of release `scripts/live.sh` can't see or turn off. The desktop app hands it to each of its sessions itself, outside Claude Code's plugin list, and it runs over any installed Pipcast, the live checkout too. So while you try a change, turn the upload off in **Customize > Plugins**, and back on when you're done.

Each install keeps its own settings, since Claude Code saves a plugin's options under its id.

Any session on air starts the station when it finds none, from the plugin it runs, and a session that hasn't reloaded since you switched the app from one Pipcast to another still runs the one before. A move leaves alone a station that an upload started, and says so. Turn the upload off in Customize > Plugins first, and then

```bash
scripts/live.sh restart
```

stops the station on air and starts the live checkout's in its place, whatever the sessions run: they feed it as they feed any station. With a release in the app, it stops the station, and a session on air starts its own again within 10 seconds.

## Cue a segment

BREAKING NEWS airs when a session's turn ends while you're away from Claude, and the report on the hour only as the hour strikes. To see one now, cue it, from the sessions on air or with words and figures of your own.

Only the development build takes a cue: the live checkout's build, the one `scripts/live.sh` puts in the app. Its station and page are built with a way in for a cue. The station and the page in `plugin/`, which every release installs, have none, so nothing that ships can air a segment that didn't happen.

```bash
scripts/live.sh story
```

cues BREAKING NEWS, ready for review, with the design system's sample session and figures. Name another kind of story, `needs-input`, `complete` or `error`, and give it words and figures of your own:

```bash
scripts/live.sh story needs-input --title "Fix flaky checkout test" --command "npm install" --quote "Install dependencies" --minutes 3
```

`--title` and `--project` name its session. `--command` is what a story that needs input asks to run, and `--quote` what a story says: Claude's description of the command or its question, its last words, or the error. `--added`, `--removed` and `--files` are what a ready story changed. `--minutes` is how long a story that needs input has waited, or how long the turn of any other ran. What you leave out comes from the design system's sample for the kind. The story airs on a session of its own, which leaves the board when the story is over.

`--session` lands the story on a session on air instead, named by its id or a piece of its title, with that session's title and project. On its own, `--session` airs that session's newest story again, as it was.

```bash
scripts/live.sh hour
```

cues the report on the next hour, now, from the sessions on air: what they did since the last report, as the report at the hour would show it if nothing else happened. `--sessions` with a number from 1 to 7 makes it the design system's sample sessions instead, and `--quiet` makes it a quiet hour, with every session working and no story.

`--weather clear`, `clouds` or `storm` adds KLWD WEATHER to that report, on a week made up for the cue that gives that outlook, and `--used` sets how much of that week is used, from 1 to 99.

```bash
scripts/live.sh warning
```

cues STORM WARNING, on a made-up week forecast to run out, 72% used unless `--used` says otherwise.

```bash
scripts/live.sh forecast
```

turns the board to the weekly forecast, now, as it turns at :15, :30 and :45: EXTENDED FORECAST for 10 seconds, and back. It is no segment, so it has no jingle and brings no window out of the side. It goes by your real week and its real reset, and says in the log, `turned to nothing`, when the forecast has no outlook yet (the week's first day, or a week used up). `--weather clear`, `clouds` or `storm` goes by a week made up for the cue instead, as the report's does, and `--used` sets how much of it is used, from 1 to 99.

A cue waits until the window shows and nothing else is on air or due (a forecast cue also waits for the window to be out of the side), so you can cue it from Claude and then switch to another app. It waits five minutes at most. Then it airs as the real thing does: the same open, desk, review and outro, the jingles and the beat, and the window out of the side for it. Hiding the window cuts it, as it cuts any segment. Nothing it airs is kept: the report on the next hour still comes at the hour, covering the whole hour, and a story that lands while a cue is on air waits its turn and airs after it. With no cue, the development build airs what a release does.

### The cue

A cue is a JSON file in the store's `dev` folder. The development build's station takes each one, hands it to its page and deletes it. `scripts/live.sh cue` sends one you wrote, from a file, or from its input with `-`, and gives it an `id` of its own, so the same cue can be sent again.

A story cue airs one to eight stories, one after another, each with what `story` takes:

```json
{
  "segment": "story",
  "stories": [
    { "kind": "needs-input", "title": "Fix flaky checkout test", "project": "web-shop", "command": "npm install", "quote": "Install dependencies" },
    { "kind": "ready", "added": 182, "removed": 40, "files": 4, "minutes": 9 }
  ]
}
```

`session` is the id of a session on air.

An hour cue's report covers the sessions you give it, 1 to 24, in place of the ones on air. `story` is the kind of a session's newest story this hour, if it had one, and `state` is where the session stands now, by default where that story left it. `added`, `removed` and `files` are its lines this hour, and `minutes` how long a session that needs input or stopped on an error has waited, back to the start of this hour at most. `samples`, 1 to 7, and `quiet` are what `--sessions` and `--quiet` set.

```json
{
  "segment": "hour",
  "sessions": [
    { "title": "Refactor auth middleware", "project": "api-server", "added": 1204, "removed": 310 },
    { "title": "Fix flaky checkout test", "project": "web-shop", "story": "needs-input", "minutes": 27 }
  ]
}
```

An hour cue with `weather`, `clear`, `clouds` or `storm`, adds KLWD WEATHER to its report, and `used`, 1 to 99, sets the made-up week's share. A warning cue is `{ "segment": "warning" }`, with `used` as well if you want. A forecast cue is `{ "segment": "forecast" }`, with `weather` and `used` if you want a week made up.

`packages/dev/src/cue.ts` says what each field takes. `scripts/live.sh` checks a cue with it before it sends one, and says what is wrong with one the page would drop. The development build logs each cue it takes in `station.log`, with every sound and window the page asks for, so the log also says what aired.

## Release

People who install from erdembircan-plugins get `plugin/` from master's newest commit. An install already made moves only with the version: `claude plugin update pipcast@erdembircan-plugins` keeps the copy it has while `version` stays the same, whatever changed in `plugin/`.

Every pull request that changes something for the people who use Pipcast adds it to `CHANGELOG.md` under Unreleased, at the top, in Keep a Changelog's format: under Added, Changed or Fixed. Not every pull request is a release. A release raises the version: the patch when it brings only fixes, as in 1.0.1, and the minor when it brings something new, as in 1.1.0. Raise it in `packages/mod/plugin.json`, in `Constants.version` in `station/Sources/StationCore/Constants.swift`, and in the root `package.json` and `package-lock.json`; tests fail when they differ. In the same pull request, give what Unreleased holds the version's heading, `## [<version>] - <date>`, dated the day the pull request merges, with an empty Unreleased back above it. At the bottom of the file, link the version to the comparison of its tag with the one before, as in `[1.1.0]: https://github.com/erdembircan/pipcast/compare/v1.0.0...v1.1.0`, and Unreleased to the comparison of the new tag with `HEAD`; both work once the tag is pushed. The station's binary carries its version, so run `scripts/build.sh` on a Mac and commit what it builds. 1.0.0 is out: erdembircan-plugins has offered it since the repository went public on 28 October 2026.

Once a version is on master, tag its commit `v<version>`, as in `v1.1.0`, and push the tag. Pipcast publishes no GitHub releases. People who install from erdembircan-plugins have had the version since the merge.

## The demo video

`video/` holds the demo video, made with [Remotion](https://www.remotion.dev) from the product's own pieces: the design system's components, the band's plate, the jingles and the icon's layers, each played frame by frame. Its soundtrack is synthesised from a score in `video/scripts/music`, in Chrome, as the jingles are. It has dependencies of its own:

```bash
npm --prefix video ci
```

```bash
npm --prefix video run studio
```

opens it in Remotion Studio, rendering the soundtrack first if its score changed. `npm --prefix video run render` renders it to `video/out/pipcast.mp4`, and `render:4k` at twice the size; `video/out/` is not committed.

The video is on YouTube at https://youtu.be/WZc3zm6nB9g, with `assets/youtube-thumbnail.jpg` as its thumbnail; `video/README.md` says how each is rendered. It opens Pipcast's playlist on YouTube, https://www.youtube.com/playlist?list=PLCbk0boCLtOs, which holds every video about Pipcast, oldest first. Both READMEs link to the demo in the playlist, https://www.youtube.com/watch?v=WZc3zm6nB9g&list=PLCbk0boCLtOs, which starts the demo and plays the rest of the playlist after it: the README at its top, with the demo's thumbnail as YouTube's embedded player shows it, title bar, play button and all, `assets/youtube-thumbnail-play.jpg`, which `npm --prefix video run thumbnail` renders with the thumbnail, and the plugin's README, `packages/mod/README.md`, under its introduction. When a new video goes up, add it to the playlist, and the READMEs' link stays as it is. When a new cut of the demo goes up, it has a link of its own: change the link at the top of this paragraph and the `v=` in both READMEs' link, and put the new cut in the playlist in place of the old one. The picture copies what YouTube shows for the demo, so when the demo's title, its channel's name or picture, or YouTube's player changes, change `video/src/thumbnail/YouTubeOverlay.tsx` and `channel-avatar.png` beside it to match, and render the picture again.

## README screenshots

The README's three grids of screenshots, `assets/screenshots/in-use.jpg`, `on-air.jpg` and `window.jpg`, are drawn from the demo video's own pieces, in `video/src/readme`: moments of the video's desktop, two states the video only passes through, and KLWD's pictures in its window. With the video's dependencies installed,

```bash
npm --prefix video run readme
```

renders all three again, in Chrome. Render them after a change to what they show, and commit them with it. The picture under the video's thumbnail at the top of the README, `assets/screenshots/breaking.png`, is not one of them.
