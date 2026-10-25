<p align="center"><img src="assets/icon-256.png" width="128" height="128" alt="Pipcast"></p>

# Pipcast

**Picture in picture for Claude Code.**

Pipcast gives Claude Code the picture in picture that macOS gives a video. Pop a video out of its page and it keeps playing in a small window in a corner of the screen, above every app, while you get on with something else. Pipcast does the same for your Claude Code sessions: a window in the corner that floats over whatever you're working in and shows you what Claude is up to. The name is that idea, PiP and broadcast.

What plays in the window is KLWD, a local TV news channel for your sessions, styled as a 1990s local news broadcast. Most of the time it shows a live board of the sessions you tuned in. When one of them needs you, finishes, or stops on an error, KLWD cuts to BREAKING NEWS: a stinger, then the anchor desk, where Clawd reads the story, then back to the board. Every hour on the hour it airs a short report on what each session did.

The window shows only while you're in another app. Switch back to Claude and it gets out of the way.

<!-- The demo video goes here once it is on YouTube: a still from it, linked to the video. -->

<p align="center"><img src="assets/screenshots/breaking.png" width="716" alt="KLWD on air: Clawd at the anchor desk with a READY FOR REVIEW story"></p>

## Picture in picture

The window is modelled on macOS's picture in picture for video, and drawn to look like it: a black 16:9 window with rounded corners and a soft shadow, and clear Liquid Glass controls that show only while the pointer is on it.

- **Above everything.** It floats above every app, the Dock and the menu bar, on every desktop, and never takes the keyboard, so the app you're typing in keeps typing. It hides while Claude is in front, where you can see your sessions for yourself.
- **In a corner.** It fills its quarter of the screen and starts in the bottom-right corner. Drag it to another corner to move it there, or drag an edge to make it smaller, down to 70%.
- **Tucked into the side.** Press the handle on its inner edge, or drag a quarter of it past the screen's side, and it slides into that side, leaving a small tab, as picture in picture does on iPhone and iPad. BREAKING NEWS and the report on the hour still bring it out, and it goes back as they end. Click the tab to bring it back.
- **Controls on hover.** Close stops tracking every session, the speaker turns the jingles on and off, and Back to Claude brings Claude to the front.
- **See through it.** Run `/pipcast transparency on` and it fades to 40% while the pointer is elsewhere, so you can see what is under it.

## What it does

- **Tune in from Claude.** Each new session in the desktop app tunes in by itself as it opens. Any other session tunes in when you press **TUNE IN** in the band above the prompt box, or run `/pipcast`. Run `/pipcast auto off` and new sessions wait for **TUNE IN** too. There is no limit on how many sessions can be on air.
- **The live board.** Each session on air gets a row with its project on a plate, its title, and its state on a pill: INPUT when it needs you, ERROR when it stopped on an error, READY when it finished, LIVE while it works. With more than four on air, the board shows four at a time and turns to the next four every 8 seconds. Under the listing, two meters show your account's usage limits, the current session's and the week's, from the newest reading any session on air took: gold from 70%, red from 90%.
- **BREAKING NEWS for every story.** A session that needs your input, that is ready for review, whose work is complete, or that stopped on an error airs as its own segment. Stories air one after another, in the order they land. Nothing cuts in, and KLWD airs only what happens while you're away from Claude: switch to Claude and the stories still waiting are dropped, along with any that land while you're there.
- **On the hour.** The station clock strikes the hour, Clawd reads the headlines, and THE HOUR IN REVIEW shows what each session did: a row each, named as on the board by its project's plate and its title, with the lines it changed or how long it has waited. If you're in Claude as the hour strikes, that hour is skipped, and the next report covers it.

## Requirements

- macOS 14 or later, on Apple silicon. The window's controls use Liquid Glass on macOS 26 and later.
- The Claude desktop app, with Claude Code.

## Install

In the Claude desktop app, click **+** next to the prompt box, then **Plugins**. Choose **Add marketplace**, enter `erdembircan/pipcast`, and add **Pipcast**.

From a shell:

```bash
claude plugin marketplace add erdembircan/pipcast
```

```bash
claude plugin install pipcast@pipcast
```

New sessions load it.

## Use it

1. Start a new Claude Code session in the desktop app. It tunes in to KLWD by itself. A session that was already open, or one you resume, tunes in when you press **TUNE IN** in the band above the prompt box, or run `/pipcast`.
2. Switch to another app. KLWD appears in the bottom-right corner of the screen.
3. When the session needs you or finishes, KLWD airs it as BREAKING NEWS.
4. Hover over the window for its controls. Drag it to move it to another corner, drag an edge to make it smaller, or press the handle on its inner edge to minimize it to the side of the screen; dragging a quarter of it past the screen's left or right edge does the same. Click the tab it leaves there to bring it back.
5. Press **TUNE OUT**, or run `/pipcast`, to take the session off the air.

The band shows KLWD and what pressing it does: **TUNE IN** in gold while this session is off the air, **TUNE OUT** in blue while it is on.

### Settings

Pipcast has two settings, kept with Claude Code's other plugin options. **Tune in every new session** is on until you turn it off, and **Transparent window** is off until you turn it on. Turn either on or off with `/pipcast` from any session, in the desktop app or in a terminal; `/pipcast auto` or `/pipcast transparency` on its own says whether that one is on, and `/pipcast` with nothing after it still tunes the session in or out. The desktop app's plugin page doesn't list the settings, so `/pipcast` is the way to change them there. In Claude Code in a terminal, `/plugin configure pipcast@pipcast` shows the same two.

#### Tune in every new session

It is on until you turn it off. While it is on, each new session in the desktop app tunes in by itself as it opens, so there is no **TUNE IN** to press, and a `/clear` starts a new session that tunes in again. A session that resumes, such as an older one you open again, waits for **TUNE IN**, and **TUNE OUT** still takes any session off the air. With it off, every session waits for **TUNE IN**. The setting changes the sessions that start after it, not the ones already open.

```text
/pipcast auto off
```

```text
/pipcast auto on
```

#### Transparent window

While it is on, the window fades to 40% whenever the pointer is elsewhere, so you can read what is under it, and turns solid again, with its controls, as soon as the pointer is on it. It stays solid while you drag it. Everything airs as before, BREAKING NEWS and its jingle included. A change reaches the window within a second, from any session.

```text
/pipcast transparency on
```

```text
/pipcast transparency off
```

## How it works

Pipcast has three parts.

- **The mod**, in `packages/mod`, runs inside each Claude Code session. It draws the band, answers `/pipcast`, follows the session's events, and writes what it sees to a small file for that session.
- **The station**, in `station/`, is a native macOS app with one always-on-top window. It reads every session's file and plays the broadcast in that window.
- **The broadcast**, in `packages/director` and `packages/renderer`, is what plays in the window: the director that decides what airs and when, and the KLWD graphics from the design system in `design/`.

The sessions and the station talk only through files in `~/Library/Application Support/Pipcast`. [docs/architecture.md](docs/architecture.md) has the details.

An install gets none of this source. It copies `plugin/`, which holds only what runs, all of it built from the source: the mod bundled into one file, the station's binary, the broadcast's page and the jingles, and the plugin's manifest, icon and license.

## Privacy

KLWD is an ordinary window. It appears in screen shares and recordings, with session titles and Claude's questions on it. Everything stays on your Mac: nothing is sent anywhere.

## Develop

Pipcast builds with Node.js 22 or later and the Swift toolchain that comes with Xcode or its Command Line Tools.

```bash
npm ci
```

```bash
scripts/build.sh
```

builds everything an install gets into `plugin/`: the mod bundled into one file, the station, the broadcast's page and the jingles, with the plugin's manifest, icon and license. `plugin/` belongs to the build. Don't edit it by hand or keep anything else in it: the build stops when it finds a file there that it doesn't make. Commit what it builds, since an install copies `plugin/` as it is, and CI fails a pull request whose `plugin/` differs from what its sources build.

The plugin's icon is KLWD's tower over the city at dusk, its beacon sending out the board's signal. `scripts/build-icon.mjs` draws it in layers from the design system's colours and the band's letters: `assets/icon.svg` stacks them, and `assets/icon-layers` holds each one on its own, as an SVG and as a 2048-pixel PNG, with `layers.json` saying how they stack, for animating the icon. The build draws them every time; their PNGs render only on a Mac, with Chrome, and on CI the build stops when the PNGs were rendered from another drawing.

```bash
scripts/test.sh
```

runs every check: lint, types, the unit tests of each part, the station's Swift tests, the built plugin's manifest and the mod's kit tests against it on the engine bundled with the Claude desktop app, and `scripts/live.sh` in a throwaway copy of the repository.

```bash
scripts/verify.sh
```

runs the whole thing for real, with no window of yours involved: a headless Claude Code session tunes in, the station starts and shows its window, the session tunes out, and the station quits. With **Transparent window** on, the window server has to show that window at 40%, or whole while the pointer is on it, and whole once it is off. Another session is renamed on air, off air and after the window's close, and its title on air has to follow each time. One more, with nothing saved for **Tune in every new session**, which leaves it on, has to stay off the air until a stand-in for the desktop app shows it, then tune in by itself, and again after a `/clear`. An install into a throwaway configuration then has to hold exactly the files in `plugin/`, with no source or test among them. There `/pipcast auto` has to say **Tune in every new session** is on before anything is saved, and `/pipcast auto` and `/pipcast transparency` have to turn both settings on and off, each value landing where Claude Code keeps plugin options, and the second in the file the station reads as well.

### Try a change in the desktop app

The desktop app runs pipcast from the live checkout: a second checkout of this repository in a folder beside your clone, named after it (`~/Developer/JS/pipcast-live` beside `~/Developer/JS/pipcast`). The `pipcast` marketplace points at it, and every session reads the plugin from its `plugin/` folder when it starts or on `/reload-plugins`. Your clone never changes what the app runs, so you can switch branches in it freely.

```bash
scripts/live.sh setup
```

makes the live checkout on master and points the marketplace at it. Run it once.

```bash
scripts/live.sh pr 12
```

puts a pull request in the app. `scripts/live.sh <branch or commit>` puts any other commit there, `scripts/live.sh master` puts master back, and `scripts/live.sh` on its own says what the app runs now. Then run `/reload-plugins` in a session, or start a new one. Only committed work reaches the app, so run `scripts/build.sh` and commit what it builds first.

### The demo video

`video/` holds the demo video, made with [Remotion](https://www.remotion.dev) from the product's own pieces: the design system's components, the band's plate, the jingles and the icon's layers, each played frame by frame. Its soundtrack is synthesised from a score in `video/scripts/music`, in Chrome, as the jingles are. It has dependencies of its own:

```bash
npm --prefix video ci
```

```bash
npm --prefix video run studio
```

opens it in Remotion Studio, rendering the soundtrack first if its score changed. `npm --prefix video run render` renders it to `video/out/pipcast.mp4`, and `render:4k` at twice the size; `video/out/` is not committed.

## License

MIT, generated and verified with [license-wizard](https://github.com/erdembircan/license-wizard). The fonts in `assets/fonts` are under the SIL Open Font License; their license files sit beside them.
