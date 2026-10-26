# Developing Pipcast

This is for working on Pipcast itself. To install and use it, see the [README](../README.md).

## How it works

Pipcast has three parts.

- **The mod**, in `packages/mod`, runs inside each Claude Code session. It draws the band, answers `/pipcast`, follows the session's events, and writes what it sees to a small file for that session.
- **The station**, in `station/`, is a native macOS app with one always-on-top window. It reads every session's file and plays the broadcast in that window.
- **The broadcast**, in `packages/director` and `packages/renderer`, is what plays in the window: the director that decides what airs and when, and the KLWD graphics from the design system in `design/`.

The sessions and the station talk only through files in `~/Library/Application Support/Pipcast`. [architecture.md](architecture.md) has the details.

An install gets none of this source. It copies `plugin/`, which holds only what runs, all of it built from the source: the mod bundled into one file, the station's binary, the broadcast's page and its sounds, and the plugin's manifest, icon and license.

## Build

Pipcast builds with Node.js 22 or later and the Swift toolchain that comes with Xcode or its Command Line Tools.

```bash
npm ci
```

```bash
scripts/build.sh
```

builds everything an install gets into `plugin/`: the mod bundled into one file, the station, the broadcast's page and its sounds, with the plugin's manifest, icon and license. `plugin/` belongs to the build. Don't edit it by hand or keep anything else in it: the build stops when it finds a file there that it doesn't make. Commit what it builds, since an install copies `plugin/` as it is, and CI fails a pull request whose `plugin/` differs from what its sources build.

The plugin's icon is KLWD's tower over the city at dusk, its beacon sending out the board's signal. `scripts/build-icon.mjs` draws it in layers from the design system's colours and the band's letters: `assets/icon.svg` stacks them, and `assets/icon-layers` holds each one on its own, as an SVG and as a 2048-pixel PNG, with `layers.json` saying how they stack, for animating the icon. The build draws them every time; their PNGs render only on a Mac, with Chrome, and on CI the build stops when the PNGs were rendered from another drawing.

## The manifest and the listing

The plugin's manifest is `packages/mod/plugin.json`, which the build copies to `plugin/.claude-plugin/plugin.json`. Its `version` is the plugin's version, and the manifest is the only place it is set: the marketplace's entry in `.claude-plugin/marketplace.json` leaves it out, the station's `Constants.version` and the root `package.json` repeat it, and tests fail when either of them differs. The entry does repeat the manifest's display fields, `displayName`, `description`, `author`, `homepage`, `repository`, `license` and `keywords`, because Claude Code shows the entry's own value wherever it sets one, and a test fails when they differ from the manifest's.

The manifest also carries what Anthropic's plugin directory lists and Claude Code itself ignores: the icon, `assets/icon-1024.png` copied to `plugin/assets/icon.png`; links to the README, the issues and the README's privacy section; and the screenshots, as links to `assets/screenshots` on the master branch, which show once the repository is public.

## Test

```bash
scripts/test.sh
```

runs every check: lint, types, the unit tests of each part, the station's Swift tests, the marketplace and the built plugin validated by the engine bundled with the Claude desktop app, the plugin against the plugin directory's submission checks as well, the mod's kit tests against it, and `scripts/live.sh` in a throwaway copy of the repository.

```bash
scripts/verify.sh
```

runs the whole thing for real, with no window of yours involved: a headless Claude Code session tunes in, the station starts and shows its window, the session tunes out, and the station quits. With **Transparent window** on, the window server has to show that window at 40%, or whole while the pointer is on it, and whole once it is off. Another session is renamed on air, off air and after the window's close, and its title on air has to follow each time. One more, with nothing saved for **Tune in every new session**, which leaves it on, has to stay off the air until a stand-in for the desktop app shows it, then tune in by itself, and again after a `/clear`. An install into a throwaway configuration then has to hold exactly the files in `plugin/`, with no source or test among them. There `/pipcast auto` has to say **Tune in every new session** is on before anything is saved, and `/pipcast auto` and `/pipcast transparency` have to turn both settings on and off, each value landing where Claude Code keeps plugin options, and the second in the file the station reads as well.

## Try a change in the desktop app

The desktop app runs pipcast from the live checkout: a second checkout of this repository in a folder beside your clone, named after it (`~/Developer/JS/pipcast-live` beside `~/Developer/JS/pipcast`). The `pipcast` marketplace points at it, and every session reads the plugin from its `plugin/` folder when it starts or on `/reload-plugins`. Your clone never changes what the app runs, so you can switch branches in it freely.

```bash
scripts/live.sh setup
```

makes the live checkout on master and points the marketplace at it. Run it once.

```bash
scripts/live.sh pr 12
```

puts a pull request in the app. `scripts/live.sh <branch or commit>` puts any other commit there, `scripts/live.sh master` puts master back, and `scripts/live.sh` on its own says what the app runs now. Then run `/reload-plugins` in a session, or start a new one. Only committed work reaches the app, so run `scripts/build.sh` and commit what it builds first.

## The demo video

`video/` holds the demo video, made with [Remotion](https://www.remotion.dev) from the product's own pieces: the design system's components, the band's plate, the jingles and the icon's layers, each played frame by frame. Its soundtrack is synthesised from a score in `video/scripts/music`, in Chrome, as the jingles are. It has dependencies of its own:

```bash
npm --prefix video ci
```

```bash
npm --prefix video run studio
```

opens it in Remotion Studio, rendering the soundtrack first if its score changed. `npm --prefix video run render` renders it to `video/out/pipcast.mp4`, and `render:4k` at twice the size; `video/out/` is not committed.

## README screenshots

The README's three grids of screenshots, `assets/screenshots/in-use.jpg`, `on-air.jpg` and `window.jpg`, are drawn from the demo video's own pieces, in `video/src/readme`: moments of the video's desktop, two states the video only passes through, and KLWD's pictures in its window. With the video's dependencies installed,

```bash
npm --prefix video run readme
```

renders all three again, in Chrome. Render them after a change to what they show, and commit them with it. The picture at the top of the README, `assets/screenshots/breaking.png`, is not one of them.
