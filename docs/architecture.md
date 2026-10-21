# Architecture

Pipcast is three programs that never call each other. Each Claude Code session runs the **mod**. One **station** process owns the window. The **broadcast** runs inside the station's web view. They meet in one folder of files, the **store**.

```text
 Claude Code session ─┐                                   ┌─ station (pipcast-station serve)
   the mod            │   ~/Library/Application Support/  │    the window, its controls, sound
   band, /pipcast,    ├──▶   Pipcast/sessions/<id>.json ───┤    ├─ reads the store every second
   events → record    │      control.json  station.json   │    └─ web view: the broadcast
 Claude Code session ─┘      prefs.json                    │         director → scenes → KLWD graphics
   (up to four on air)                                     └─ quits when nothing is on air
```

Every part is built from small pieces with no side effects of their own, so each can be tested alone: the mod's record reducer and band artwork, the station's geometry and store reading, the director's schedule. The side effects sit at the edges: the mod's file and process calls, the station's window, the web view's bridge.

## The store

One folder, `~/Library/Application Support/Pipcast`, created with mode 0700. `PIPCAST_HOME` moves it, for tests.

| File | Written by | What it holds |
| --- | --- | --- |
| `sessions/<session id>.json` | That session's mod | Its `SessionRecord` while it is tuned in |
| `station.json` | The station | `{ v, pid, startedAt, heartbeatAt, version }`, rewritten every 5 s |
| `control.json` | The station | `{ v, closedAt }`: when the window's close button was pressed |
| `prefs.json` | The station | `{ v, sound, quadrant, scale, lastReportAt }` |
| `station.lock` | The station | Held with `flock` for as long as a station serves, so there is only ever one |
| `station.log` | The station | One line per event worth knowing, for debugging; cut back at 1 MB |

A file is written whole to `<name>.tmp` and renamed into place, so a reader sees the old version or the new one, never half of one. A reader that still meets a file it cannot parse skips it until the next read.

### The session record

```ts
type SessionState = 'working' | 'needs-input' | 'ready' | 'error'
type StoryKind = 'needs-input' | 'ready' | 'complete' | 'error'

interface Story {
  id: string          // `${sessionId}:${seq}`, unique for the session
  kind: StoryKind
  at: number          // ms since the epoch, when it landed
  command?: string    // needs-input, a permission: the command, or "Edit src/a.ts"
  quote?: string      // the description, the question, the last words, or the error in words
  added?: number      // ready: lines added during the turn
  removed?: number    // ready: lines removed
  files?: number      // ready: files changed
  durationMs?: number // ready, complete, error: how long the turn ran
}

interface SessionRecord {
  v: 1
  id: string           // the session's id
  title: string        // the session's title as it is written
  project: string      // the repository's name, else the folder's
  state: SessionState
  stateAt: number      // when the state last changed
  tunedInAt: number    // when it tuned in: the order on air
  checkedInAt: number  // the mod's heartbeat, every 10 s
  stories: Story[]     // the newest 10, oldest first
  activity: { at: number; text: string }[]  // the newest 3 tool lines, oldest first
  hours: { hour: string; added: number; removed: number; files: number }[]  // the newest 3, keyed "YYYY-MM-DDTHH" in local time
}
```

- A record is **live** while `now - checkedInAt` is 45 s or less. A session that stops checking in, because it crashed or the Mac slept, leaves the board.
- **On air** are the live records sorted by `tunedInAt`, then by `id`, the first four of them. Every mod and the station apply this same rule, so they agree on who is on air without talking.
- `control.json`'s `closedAt` tells every mod that tuned in before that moment to tune out: the window's close took every session off the air.

## The mod

`plugin/` is a Claude Code plugin with one hooks module, `hooks/register.tsx`, which only wires hooks to the code in `plugin/src`.

- `src/contract` holds the types, constants and words that the mod, the station and the broadcast share.
- `src/core` holds the mod's logic with no `$` in it: the record reducer, the descriptions of tools and permissions, the diff counter, the band's artwork, and the services that tune in, tune out and check in. The services talk to the world through an `Io` port: read, write, list and rename files, run a command, read the clock.
- `register.tsx` builds that port from `$` and hands it to the services. Only functions at the top of that file take `$`, which is what `claude plugin validate` asks for.

What it listens to:

| Event | What changes |
| --- | --- |
| `turn.start` | The session is working. The diff counter takes its baseline with `git diff --numstat HEAD` |
| `tool.call` | One activity line. `AskUserQuestion` is a needs-input story with the question; when the call returns, the session is working again |
| `classic.PermissionRequest` | A needs-input story with the command and Claude's description of it |
| `classic.Stop` | With background work or scheduled wake-ups pending, still working. Otherwise a ready story when files changed, with the diff, or a complete story with Claude's last words |
| `classic.StopFailure` | An error story, its kind in plain words |
| `turn.complete` | An interrupted turn leaves the session ready, with no story |
| `classic.SessionStart`, `classic.UserPromptSubmit` | The session's title, when they carry one |
| `session.end` | The record is removed: the row leaves the board |

The mod keeps its record in memory whether or not the session is tuned in, so tuning in mid-turn shows the right state at once. It writes the record only while tuned in: at once for a new state or story, at most every 2 s for activity, and every 10 s as a heartbeat. The heartbeat also reads `control.json`, counts who is on air for the band, and starts the station again if `station.json` has gone quiet for 20 s.

The title on air is the one the engine keeps. The engine writes a session's title to a small file beside its transcript, `<the transcript's folder>/<session id>/custom-title.json`, the moment it changes: a rename in the desktop app or with `/rename`, or a title the app gives the session itself. While the session is tuned in, the mod reads that file every 2 s, a read of a few dozen bytes that starts no process, and writes the record at once when the title has changed. Tuning in reads it first, so the record carries the current title from its first write. With no file, or no title in it, the title is the latest one a hook carried, else the default name; a file caught half-written leaves the title as it was. Every classic hook says where the transcript is; after a reload, before one has fired, the mod finds the transcript once with `find`.

### The band

Desktop only, and never while a survey holds it. The band keeps what another mod drew there and sits beside it. It draws two pictures and no words of its own: the chip, KLWD in chrome with four cells for the four places on air, and a tab, TUNE IN or TUNE OUT. A mod's button shows only text, so each tab is an `Svg` with a blank, plain `Button` laid over it. With four sessions on air, another session's TUNE IN is drawn dim, with no button. The pictures are built from outlines of the station's lettering, since an image loads no fonts.

## The station

`station/` is a Swift package. `StationCore` holds everything that can be tested without a window: the geometry, the visibility rule, reading the store, the preferences, the command line and the lock. `PipcastStation` is the app.

### One station, started by whoever needs it

`pipcast-station launch` starts a station unless one is serving, and returns at once. The mod runs it when a session tunes in and whenever the heartbeat finds the station gone. It starts `pipcast-station serve` in a session of its own, with no terminal and no parent waiting on it, so the station outlives the session that started it. `serve` takes `station.lock` or exits, which keeps one station however many sessions start one at the same moment.

The station quits by itself: 5 s after nothing is on air, or 20 s after it started if nothing came on air at all, or at once when its close button is pressed. With nothing on air there is no window.

### The window

The proof of concept's recipe: a borderless, non-activating `NSPanel` at the status-bar level (25), on every Space and beside full-screen apps, in an app with the accessory activation policy. It is shown only from `applicationDidFinishLaunching` on, so it never takes the keyboard from the app that started it.

- **When it shows.** While any app but Claude is frontmost. It hides while the Claude desktop app is.
- **Its size.** Its quarter of the screen's visible area, less 20 pt on every side, at 16:9. You can make it smaller, down to 70%, by dragging one of the two edges that face the middle of the screen, or the corner between them; the outer corner stays put. Over those edges the pointer becomes macOS's window-resize pointer, with a single arrow when the window is as big or as small as it gets. The size is kept as a share of the quarter, so it carries to another screen.
- **Moving it.** Drag it anywhere. On release it goes to the quarter that holds its centre, in 0.2 s.
- **Its look.** Corners of 20 pt, a hairline edge, macOS's own shadow.
- **Its controls.** On hover the picture dims a little and three 44 pt glass buttons appear, 8 pt in from the top corners: close at the top left, sound and Back to Claude at the top right. They use macOS's clear Liquid Glass where there is one, and brighten under the pointer. Nothing pops up over them.

### The web view and its bridge

The broadcast is a web page in a `WKWebView` that never receives a mouse event: a transparent view above it takes every click and drag. The two sides speak in JSON messages.

| From | Message | When |
| --- | --- | --- |
| Station | `{ type: 'snapshot', now, visible, sessions, lastReportAt }` | When the store changes, when the window shows or hides, and every second |
| Page | `{ type: 'ready' }` | Once it is listening for the station's messages |
| Page | `{ type: 'cue', jingle }` | A segment starts that has a jingle; the station plays it unless sound is off |
| Page | `{ type: 'reported', at }` | The report on the hour starts; the station keeps `at` as `lastReportAt` |
| Station | `{ type: 'still', input }` | Snapshot mode: draw this one picture, without motion |
| Page | `{ type: 'rendered' }` | Snapshot mode: the picture is drawn |

`sessions` holds the records on air, at most four, as the store has them.

### Sound

The four jingles are rendered from the design system's scores at build time and played with `AVAudioPlayer`, at the Mac's volume. Sound starts on; the window remembers the choice.

## The broadcast

`packages/director` decides what airs. `packages/renderer` is the web page that draws it with the KLWD components from `design/`.

The director is a pure function of time and the latest snapshot. Each tick it returns a scene for the design system's `Broadcast` component, a key that changes when a new step begins, and any jingle to cue. A segment is a list of steps:

| Segment | Steps |
| --- | --- |
| A story | BREAKING NEWS 1.9 s, cue `breaking`; the desk 10 s; the outro 1.4 s, cue `breaking-out` |
| The hour | The ident 7.5 s from five seconds before the hour, cue `hour`; the desk 10 s; THE HOUR IN REVIEW 10 s, left out in a quiet hour; the outro 1.6 s, cue `hour-out` |

Between segments, the live board. The rules, from the design system's *Event desks*:

- Stories air one after another, in the order they land, at least 2 s apart. Nothing cuts in. A story that lands during another waits in the ticker as COMING UP.
- A story whose session has moved on is dropped before it airs, and cut short at the desk if it moves on while on air. A story cut short is not restarted.
- The report on the hour waits its turn like a story. If the window is hidden at the hour, it airs when the window shows again within ten minutes of the hour, and is skipped after that.
- While the window is hidden nothing airs, and a segment on air when it hides is cut.
- With reduced motion, the openers show their last picture and the outros cut straight to the board.

## Building and checking

| Script | What it does |
| --- | --- |
| `scripts/build.sh` | Builds the station binary, the web page, the jingles and the band's artwork into `plugin/station` and `plugin/src/core` |
| `scripts/test.sh` | Lint, types, the unit tests, the station's Swift tests, and the mod's manifest and kit tests on the engine bundled with the desktop app |
| `scripts/verify.sh` | A real headless session tunes in and out, and a witness asks the window server where the window is and whether it ever took the keyboard. Another is renamed on air, off air and after the window's close, and its record has to follow each time |
| `scripts/capture-controls.sh` | Shows the real broadcast with the controls on and saves the station's own picture of its window to `artifacts/station/controls.png`, for checking the glass by eye |

## Decisions

- **Files, not sockets.** A mod cannot keep writing to a child's input, and every session is its own process. Files need no server, survive any one of them crashing, and are easy to look at.
- **One detached station.** A child of one session dies with that session; the station has to outlive whichever session started it, and decide for itself when to quit.
- **A web view for the picture.** The design system's components are the broadcast. Drawing them in the station's own web view makes the review boards and the window the same picture.
- **Jingles rendered ahead of time.** Native playback needs no click, keeps to the Mac's volume and costs nothing at run time.
- **Outlines in the band.** The desktop draws a mod's `Svg` as an image, which loads no fonts and cannot read the app's theme. Outlined letters and pieces with their own ground look the same everywhere.
- **Two private switches in the station.** The window never takes the keyboard, so its app is never active, and macOS treats it that way: AppKit draws Liquid Glass flat in a window without an active appearance, and the window server ignores a pointer set by an app that is not frontmost. The station forces its panel's active appearance (`_setForceMainAppearance:`), which changes how the panel is drawn and never makes it key, and sets its window-server connection's `SetsCursorInBackground` property. Both are looked up at run time: on a macOS without one, the station logs it and carries on with flat glass or the plain pointer.
- **The title from the engine's own file.** A mod gets no event for a rename and no call for the title, and the hooks carry the title only when a session starts or a prompt is sent, which misses a rename between prompts. The transcript records every rename too, but it runs to megabytes. `custom-title.json` holds the title alone, so reading it every 2 s while on air costs next to nothing.
