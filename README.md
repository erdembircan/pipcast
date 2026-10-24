<p align="center"><img src="assets/icon-256.png" width="128" height="128" alt="Pipcast"></p>

# Pipcast

**KLWD, a local TV news channel for your Claude Code sessions.**

Pipcast puts a small window in a corner of your screen that airs your Claude Code sessions as a 1990s local news broadcast. The channel is KLWD. Most of the time it shows a live board of the sessions you tuned in. When one of them needs you, finishes, or stops on an error, KLWD cuts to BREAKING NEWS: a stinger, then the anchor desk, where Clawd reads the story, then back to the board. Every hour on the hour it airs a short report on what each session did.

The window shows only while you're in another app. Switch back to Claude and it gets out of the way.

<p align="center"><img src="assets/screenshots/breaking.png" width="716" alt="KLWD on air: Clawd at the anchor desk with a READY FOR REVIEW story"></p>

## What it does

- **Tune in from Claude.** Press **TUNE IN** in the band above the prompt box, or run `/pipcast`. Run `/pipcast auto on` and each new session tunes in by itself. There is no limit on how many sessions can be on air.
- **The live board.** Each session on air gets a row with its project on a plate, its title, and its state on a pill: INPUT when it needs you, ERROR when it stopped on an error, READY when it finished, LIVE while it works. With more than four on air, the board shows four at a time and turns to the next four every 8 seconds. Under the listing, two meters show your account's usage limits, the current session's and the week's, from the newest reading any session on air took: gold from 70%, red from 90%.
- **BREAKING NEWS for every story.** A session that needs your input, that is ready for review, whose work is complete, or that stopped on an error airs as its own segment. Stories air one after another, in the order they land. Nothing cuts in, and KLWD airs only what happens while you're away from Claude: switch to Claude and the stories still waiting are dropped, along with any that land while you're there.
- **On the hour.** The station clock strikes the hour, Clawd reads the headlines, and THE HOUR IN REVIEW shows what each session did. If you're in Claude as the hour strikes, that hour is skipped, and the next report covers it.
- **A window that stays out of the way.** It fills its quarter of the screen, resizes down to 70% from its edges, and moves to another corner when you drag it there. It floats above every app and never takes the keyboard. Run `/pipcast transparency on` and it fades to 40% while the pointer is elsewhere, so you can see what is under it.
- **Controls on hover.** Close stops tracking every session, the speaker turns the jingles on and off, and Back to Claude brings Claude to the front.

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

1. In a Claude Code session in the desktop app, press **TUNE IN** in the band above the prompt box, or run `/pipcast`.
2. Switch to another app. KLWD appears in the bottom-right corner of the screen.
3. When the session needs you or finishes, KLWD airs it as BREAKING NEWS.
4. Hover over the window for its controls. Drag it to move it to another corner, or drag an edge to make it smaller.
5. Press **TUNE OUT**, or run `/pipcast` again, to take the session off the air.

The band shows KLWD and what pressing it does: **TUNE IN** in gold while this session is off the air, **TUNE OUT** in blue while it is on.

### Settings

Pipcast has two settings, kept with Claude Code's other plugin options. Both are off until you turn them on. Turn either on or off with `/pipcast` from any session, in the desktop app or in a terminal; `/pipcast auto` or `/pipcast transparency` on its own says whether that one is on, and `/pipcast` with nothing after it still tunes the session in or out. The desktop app's plugin page doesn't list the settings, so `/pipcast` is the way to change them there. In Claude Code in a terminal, `/plugin configure pipcast@pipcast` shows the same two.

#### Tune in every new session

While it is on, each new session in the desktop app tunes in by itself as it opens, so there is no **TUNE IN** to press, and a `/clear` starts a new session that tunes in again. A session that resumes, such as an older one you open again, waits for **TUNE IN** as before, and **TUNE OUT** still takes any session off the air. The setting changes the sessions that start after it, not the ones already open.

```text
/pipcast auto on
```

```text
/pipcast auto off
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

```bash
scripts/test.sh
```

runs every check: lint, types, the unit tests of each part, the station's Swift tests, the built plugin's manifest and the mod's kit tests against it on the engine bundled with the Claude desktop app, and `scripts/live.sh` in a throwaway copy of the repository.

```bash
scripts/verify.sh
```

runs the whole thing for real, with no window of yours involved: a headless Claude Code session tunes in, the station starts and shows its window, the session tunes out, and the station quits. With **Transparent window** on, the window server has to show that window at 40%, or whole while the pointer is on it, and whole once it is off. Another session is renamed on air, off air and after the window's close, and its title on air has to follow each time. One more, with **Tune in every new session** on, has to stay off the air until a stand-in for the desktop app shows it, then tune in by itself, and again after a `/clear`. An install into a throwaway configuration then has to hold exactly the files in `plugin/`, with no source or test among them. It also has to turn both settings on and off with `/pipcast auto` and `/pipcast transparency`, each value landing where Claude Code keeps plugin options, and the second in the file the station reads as well.

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

## License

MIT, generated and verified with [license-wizard](https://github.com/erdembircan/license-wizard). The fonts in `assets/fonts` are under the SIL Open Font License; their license files sit beside them.
