# Architecture

Pipcast is three programs that never call each other. Each Claude Code session runs the **mod**. One **station** process owns the window. The **broadcast** runs inside the station's web view. They meet in one folder of files, the **store**.

```text
 Claude Code session ─┐                                   ┌─ station (pipcast-station serve)
   the mod            │   ~/Library/Application Support/  │    the window, its controls, sound
   band, /pipcast,    ├──▶   Pipcast/sessions/<id>.json ───┤    ├─ reads the store every second
   events → record    │      control.json  station.json   │    └─ web view: the broadcast
 Claude Code session ─┘      prefs.json                    │         director → scenes → KLWD graphics
   (any number on air)                                     └─ quits when nothing is on air
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
  added?: number      // ready: lines added since the session's last finished story
  removed?: number    // ready: lines removed since then
  files?: number      // ready: files changed since then
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
- **On air** are the live records sorted by `tunedInAt`, then by `id`: all of them, with no limit. Every mod and the station apply this same rule, so they agree on who is on air without talking.
- `control.json`'s `closedAt` tells every mod that tuned in before that moment to tune out: the window's close took every session off the air.

## The mod

`plugin/` is a Claude Code plugin with one hooks module, `hooks/register.tsx`, which only wires hooks to the code in `plugin/src`.

- `src/contract` holds the types, constants and words that the mod, the station and the broadcast share.
- `src/core` holds the mod's logic with no `$` in it: the record reducer, the descriptions of tools and permissions, the diff counter and the ledger that reads git for the lines changed, the band's artwork, what a session's start says about it, the options `/pipcast` sets and how they are saved, and the services that tune in, tune out and check in. The services and the ledger talk to the world through an `Io` port: read, write, list and rename files, look up a file's size and when it last changed, run a command with a time limit, read the clock.
- `register.tsx` builds that port from `$` and hands it to the services. Only functions at the top of that file take `$`, which is what `claude plugin validate` asks for.

What it listens to:

| Event | What changes |
| --- | --- |
| `turn.start` | The session is working. Its own tree is read afresh, so what you changed between turns does not count as its work |
| `tool.call` | One activity line. `AskUserQuestion` is a needs-input story with the question; when the call returns, the session is working again. When a call that can change files returns, the main loop's or a subagent's, the tree it ran in is read again and what changed is booked (Lines changed, below) |
| `classic.PermissionRequest` | A needs-input story with the command and Claude's description of it |
| `classic.Stop` | While work the session started will wake it again, still working, with no story yet: a command left running in the background that works (Background commands, below), a subagent, a workflow, an MCP task or an MCP server's monitor, or a scheduled wake-up. Otherwise a ready story when files changed since the session's last finished story, with the lines, or a complete story with Claude's last words |
| `classic.StopFailure` | An error story, its kind in plain words |
| `turn.complete` | For a turn no `Stop` or `StopFailure` ended: an API error is an error story; an interrupt, or any other end, leaves the session ready, with no story |
| `classic.SessionStart`, `classic.UserPromptSubmit` | The session's title, when they carry one. A `SessionStart` that starts a new session, while **Tune in every new session** is on, sets it to tune in by itself (Tuning in by itself, below) |
| `session.attach` | The desktop app shows the session: one waiting to tune in by itself tunes in |
| `session.end` | The record is removed: the row leaves the board |

The mod keeps its record in memory whether or not the session is tuned in, so tuning in mid-turn shows the right state at once. It writes the record only while tuned in: at once for a new state or story, at most every 2 s for activity, and every 10 s as a heartbeat. The heartbeat also reads `control.json`, starts the station again if `station.json` has gone quiet for 20 s, and looks again at the background commands a finished turn waits on (Background commands, below).

The title on air is the one the engine keeps. The engine writes a session's title to a small file beside its transcript, `<the transcript's folder>/<session id>/custom-title.json`, the moment it changes: a rename in the desktop app or with `/rename`, or a title the app gives the session itself. While the session is tuned in, the mod reads that file once a minute, a read of a few dozen bytes that starts no process, and writes the record at once when the title has changed. Tuning in reads it first, so the record carries the current title from its first write. With no file, or no title in it, the title is the latest one a hook carried, else the default name; a file caught half-written leaves the title as it was. Every classic hook says where the transcript is; after a reload, before one has fired, the mod finds the transcript once with `find`.

### Lines changed

The lines on air are counted where the work happens, as it happens. The mod keeps a reading of each git working tree the session's work runs in: the session's own folder, and the worktree of each subagent, which the engine names in its note on the subagent beside the transcript (`<session id>/subagents/agent-<agent id>.meta.json`). A tree is first read just before the first call that can change files there. The calls that can are Bash, Edit, MultiEdit, Write and NotebookEdit, from the main loop or a subagent. After each one the tree is read again, unless the engine ran the call read-only, and what changed since the last reading is booked at once in two places. One is the hour it happened in, which the report on the hour adds up. The other is the tally for the session's next ready story. A turn that ends with work still running leaves its tally to the next turn.

A reading is the commit (`git rev-parse HEAD`), each tracked file's lines against that commit (`git diff-index -M --numstat`), and the untracked files (`git ls-files --others --exclude-standard`), each counted as all its lines added. So a new file counts once, whether it is later added, committed or both. When the commit has moved since the last reading, through a commit, a pull, a rebase or a checkout, nothing is booked and the next reading starts from the new commit. The session's own lines were booked as they were written, and lines that arrive from elsewhere are not its work. The one thing this misses is a single command that both changes files and commits them. Each turn also starts with a fresh reading of the session's own tree, so what you change between turns is not counted, and ends with one more, which catches what no call's reading did. Outside git, the edit tools' own figures count once a call has run.

The readings live in the mod's memory. A reload starts them over and keeps the record's stories and hours. The session's next story is numbered after the newest one the record holds, since the station takes a number it has already seen for a story that has aired.

### Background commands

A session stays working after a turn while a command it left running in the background works: the engine wakes the session when that command ends, and the session carries on. A command that runs until it is stopped never ends by itself, so the session does not wait on it. A session that keeps a dev server or a watcher up while it works on a pull request still finishes its turns, and each one's story lands as the turn ends.

A Stop names each background command by its task id and the line it runs, and nothing more. The mod tells what each command is doing from three things, cheapest first:

- **What it runs.** A line that runs a program that never ends by itself: `tail -f`, `docker compose up` unless detached, a program that runs a command on every change, such as `nodemon` or `watchexec`, or a build tool, test runner or runtime in watch mode, such as `tsc --watch`, `vite build --watch` or `npm run watch`. Never a bare flag: `gh pr checks --watch` ends when the checks do.
- **Whether it serves.** The engine runs each background command in a shell of its own, which leads its own process group and writes the command's output, and that of everything it starts, to a file named after the task, `<task id>.output`. One `ps` and one `lsof` find each command's processes from that file: the ones writing to it, the rest of the group the shell leads, and what they started. A second `lsof` asks whether any of them listens on a TCP port: a dev server, a database, a tunnel.
- **What it says.** The first and last 4 KB of its output, for a program saying it waits for files to change: `Watching for file changes.`, `waiting for changes`, `[nodemon] watching path(s)`.

A command none of these settle works, and so does one whose processes cannot be found: a Monitor's output goes to the engine rather than to its file, and a Monitor ends by its deadline. A look that cannot be made counts every command as working, as the mod counted them all before. No look runs while a subagent, a workflow, an MCP task or a scheduled wake-up holds the session anyway.

A server that starts listening a few seconds after the turn ends, or a watcher that says so after its first build, is still working at the first look. So while a turn's story waits on background commands alone, the heartbeat looks again: at every beat for two minutes after the turn ended, then about once a minute. Once none of them works, the story lands, with the lines the turn changed and how long the turn ran. A turn that starts first, because a command ended and woke the session or because you wrote to it, drops the waiting story and ends with one of its own. A look takes about 150 ms.

### Tuning in by itself

Pipcast has one option of its own, **Tune in every new session**: `userConfig.autoTuneIn` in the plugin's manifest, a boolean that is off by default. Claude Code keeps it with every plugin's options in `~/.claude/settings.json`, under `pluginConfigs` and the plugin's id (`pipcast@pipcast` for an install from this repository's marketplace), shows it in its plugin options (`/plugin configure pipcast@pipcast`), and hands it to the hooks module as the second argument of `register`. A change made in a session's plugin options reloads that session's module with the new value; a new session reads it as it starts.

While it is on, a new session tunes in by itself, once, as soon as it is both new and on the desktop:

- **New** is what `classic.SessionStart` says: a session that starts fresh, the one a `/clear` starts, or a fork. A resume carries on an old session, which is left as it is, and a compaction changes nothing.
- **On the desktop** is the desktop app showing it: `session.attach` with the `desktop` surface, or `desktop` already among `$.session.surfaces()` when the session starts, as after a `/clear`. A headless run, `claude -p` from a shell or a script, is shown nowhere, so it never tunes itself in, and nor does a session shown only in VS Code or on a phone over Remote Control.

A new session the desktop app has not shown yet waits until it does. The wait is kept in the session's `$.state` as `due`, so a reload does not lose it.

It is the same tune-in as **TUNE IN**: the record, the station, the plate turning to **TUNE OUT**, and the toast when the station cannot start. It happens once. Pressing the plate or running `/pipcast` first settles it, and so does the tune-in itself: a session you tune out stays off the air when the desktop app shows it again. A reload starts no session, so it never tunes one in, and turning the setting on changes only the sessions that start after it.

`/pipcast auto on` and `/pipcast auto off` change it from any session, `/pipcast auto` reads it, and `/pipcast` on its own still tunes the session in or out. The desktop app's plugin page shows no options for a plugin that Claude Code installed, so this is the way to change it in the desktop app. The mod saves it with Claude Code's own `claude plugin configure --values-stdin`, the command the desktop app's own plugin settings run, on the engine the session runs on: `CLAUDE_CODE_EXECPATH` when it is set, else the parent of a command the mod starts, which is the engine itself. The plugin's id is the entry in `claude plugin list --json` that is read from, or installed at, the mod's own folder. A copy Claude Code did not install, one loaded with `--plugin-dir` or handed to the session by the desktop app, keeps its options as `pipcast@inline` and is reached with `--plugin-dir`. After a save, every session reloads Pipcast with the new value. Each option is a boolean `userConfig` field with a word of its own after `/pipcast`.

### The band

Desktop only, and never while a survey holds it. The band is one line of its own: what another mod drew stays as it was, on its own line above ours. It draws one picture and no words of its own: a plate with KLWD in chrome and, at its end, TUNE IN or TUNE OUT. It shows no count, so it is the same however many sessions are on air. A mod's button shows only text, so the plate is an `Svg` with a blank, plain `Button` laid over it. The picture is built from outlines of the station's lettering, since an image loads no fonts.

## The station

`station/` is a Swift package. `StationCore` holds everything that can be tested without a window: the geometry, the visibility rule, reading the store, the preferences, the command line and the lock. `PipcastStation` is the app.

### One station, started by whoever needs it

`pipcast-station launch` starts a station unless one is serving, and returns at once. The mod runs it when a session tunes in and whenever the heartbeat finds the station gone. It starts `pipcast-station serve` in a session of its own, with no terminal and no parent waiting on it, so the station outlives the session that started it. `serve` takes `station.lock` or exits, which keeps one station however many sessions start one at the same moment.

The station quits by itself: 5 s after nothing is on air, or 20 s after it started if nothing came on air at all, or at once when its close button is pressed. With nothing on air there is no window.

### The window

The proof of concept's recipe: a borderless, non-activating `NSPanel` at the status-bar level (25), on every Space and beside full-screen apps, in an app with the accessory activation policy. It is shown only from `applicationDidFinishLaunching` on, so it never takes the keyboard from the app that started it.

- **When it shows.** While any app but Claude is frontmost. It hides while the Claude desktop app is, and while you are on Claude's full-screen Space, whichever app is frontmost there. It hides at once, with no fade.
- **Claude's full-screen Space.** The window is on every Space but the ones Claude fills alone in full screen, so it never shows over Claude in full screen, not even while you switch to it. A full-screen Space Claude shares with another app in Split View is not its own, and the window shows there as anywhere else.
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

`sessions` holds every record on air, as the store has them.

### Sound

The four jingles are rendered from the design system's scores at build time and played with `AVAudioPlayer`, at the Mac's volume. Sound starts on; the window remembers the choice.

## The broadcast

`packages/director` decides what airs. `packages/renderer` is the web page that draws it with the KLWD components from `design/`.

The director is a pure function of time and the latest snapshot. Each tick it returns a scene for the design system's `Broadcast` component, a key that changes when a new step begins, and any jingle to cue. The page ticks it every 250 ms and again as each snapshot arrives: the system runs a hidden page's timers late, and the director has to see every snapshot the window was hidden in. A segment is a list of steps:

| Segment | Steps |
| --- | --- |
| A story | BREAKING NEWS 1.9 s, cue `breaking`; the desk 10 s; the outro 1.4 s, cue `breaking-out` |
| The hour | The ident 7.5 s from five seconds before the hour, cue `hour`; the desk 10 s; THE HOUR IN REVIEW 10 s for each page of four rows, left out in a quiet hour; the outro 1.6 s, cue `hour-out` |

Between segments, the live board. The rules, from the design system's *Event desks*:

- Stories air one after another, in the order they land, at least 2 s apart. Nothing cuts in. A story that lands during another waits in the ticker as COMING UP.
- A story whose session has moved on is dropped before it airs, and cut short at the desk if it moves on while on air. A story cut short is not restarted.
- The report on the hour joins the queue only if the window shows as the hour strikes: at some moment in the five seconds before the hour, while its ident is due. If the window is hidden all that time, that hour's report is skipped, and showing the window later, tuning a session in or starting the station after the hour never brings it back. Once in the queue, the report waits its turn like a story and keeps its place while the window is hidden; one still waiting when the next report comes due is dropped. The next report covers everything since the last one that aired.
- While the window is hidden, Claude is in front and shows every story itself. Nothing airs: a segment on air when the window hides is cut, the stories waiting their turn are dropped, and a story that lands while it is hidden never joins the queue. Only the report on the hour waits.
- The board shows four sessions a page. With more, the listing turns its own pages every 8 s, on a clock that starts when the board appears, so it always comes back on its first page; what changes while a page is up waits for the next turn. THE HOUR IN REVIEW pages the same way, 10 s a page.
- With reduced motion, the openers show their last picture, the outros cut straight to the board, and the listing's pages cut instead of turning.

## Building and checking

| Script | What it does |
| --- | --- |
| `scripts/build.sh` | Builds the station binary, the web page, the jingles and the band's artwork into `plugin/station` and `plugin/src/core` |
| `scripts/test.sh` | Lint, types, the unit tests, the station's Swift tests, the mod's manifest and kit tests on the engine bundled with the desktop app, and `scripts/live.sh` in a throwaway copy of the repository |
| `scripts/verify.sh` | A real headless session tunes in and out, and a witness asks the window server where the window is and whether it ever took the keyboard. Another is renamed on air, off air and after the window's close, and its record has to follow each time. One more, with **Tune in every new session** on, stays off the air until a stand-in for the desktop app shows it, then tunes in by itself, and again after a `/clear`. An install into a throwaway configuration turns the setting on and off with `/pipcast auto`, and each value has to land where Claude Code keeps plugin options |
| `scripts/capture-controls.sh` | Shows the real broadcast with the controls on and saves the station's own picture of its window to `artifacts/station/controls.png`, for checking the glass by eye |
| `scripts/live.sh` | Shows or changes what the desktop app runs: the live checkout beside the clone, which the `pipcast` marketplace points at. `setup` makes it; `pr <number>`, a branch or a commit puts that in the app; `master` puts master back |

CI runs the lint, the types and the unit tests on every pull request and on master, and checks that `plugin/` holds what its sources build: it builds the page and the band's artwork again and fails on any difference, and it fails when the stamp beside the station binary or the jingles names other sources. The binary and the jingles are built on a Mac, so CI checks their stamps, not the files.

## Decisions

- **Files, not sockets.** A mod cannot keep writing to a child's input, and every session is its own process. Files need no server, survive any one of them crashing, and are easy to look at.
- **Only work that wakes a session keeps it working.** A `Stop` lists every task the engine has in flight as `background_tasks`, not only work the session waits on: memory consolidation, auto-mode scans and memory imports, teammates and cloud sessions that may sit idle, and a live connection to every artifact the session watches, which lasts as long as the session does. Taking the whole list as work kept a session that watches artifacts on LIVE after every turn, and its finished turns never aired. A task counts only when running means work that will end and wake the session: a `shell` while it works (the next decision), a `subagent`, a `workflow`, an `MCP task`, or a `monitor` that names its MCP server (an artifact's connection is a monitor with none). These are the engine's own labels, the `type` of each task. A scheduled wake-up in `session_crons` always counts.
- **A dev server never holds a session on LIVE.** Sessions keep a dev server or a watcher running while they work on a pull request, often for hours. Counting every background command as work kept such a session on LIVE through every turn, and none of its finished turns aired. A Stop tells a mod only each command's task id and the line it runs, and the line alone cannot tell `npm run dev` from `npm run build`. The processes can: the shell the engine starts for each command writes to a file named after the task, which ties each task to its processes, and `lsof` tells whether any of them listens on a port. Watchers listen on nothing, so what the line runs and what the output says catch them. Whatever cannot be told apart stays work, so a session waiting on its own timer, a test run or CI stays LIVE until it wakes.
- **One detached station.** A child of one session dies with that session; the station has to outlive whichever session started it, and decide for itself when to quit.
- **A web view for the picture.** The design system's components are the broadcast. Drawing them in the station's own web view makes the review boards and the window the same picture.
- **Jingles rendered ahead of time.** Native playback needs no click, keeps to the Mac's volume and costs nothing at run time.
- **Outlines in the band.** The desktop draws a mod's `Svg` as an image, which loads no fonts and cannot read the app's theme. Outlined letters and pieces with their own ground look the same everywhere.
- **Three private switches in the station.** The window never takes the keyboard, so its app is never active, and macOS treats it that way: AppKit draws Liquid Glass flat in a window without an active appearance, and the window server ignores a pointer set by an app that is not frontmost. The station forces its panel's active appearance (`_setForceMainAppearance:`), which changes how the panel is drawn and never makes it key, and sets its window-server connection's `SetsCursorInBackground` property. The third keeps the window off Claude's full-screen Space (the next decision). All three are looked up at run time: on a macOS without one, the station logs it and carries on with flat glass, the plain pointer, or a window that can show over Claude in full screen while you switch to it.
- **Off Claude's full-screen Space.** With Claude in full screen, switching to it from another Space showed the window over Claude for about a second. The window was on every Space, Claude's full-screen one too, so the window server drew it in its corner all through the slide, and the station hid it only once macOS named Claude the app in front, which it mostly does as the switch ends. AppKit then faded it out for another quarter of a second. On 24 October, through 14 switches, the station logged `hidden` the moment macOS named Claude, and its window left the screen 259 to 289 ms later; in 13 of them macOS named Claude only as the switch ended, and the slides took about a second. macOS tells an app nothing while a switch is under way, so no hide could come soon enough. Now the window is not on that Space at all: the station finds the Spaces Claude fills alone in the window server's list of Spaces (`CGSCopyManagedDisplaySpaces`) and takes the window off them (`CGSRemoveWindowsFromSpaces`). It stays off them through every switch and every time it shows again, and a new one, from Claude going full screen again, is found within a second. While you are on one, the window stays hidden whichever app is frontmost, so an app coming forward there, Spotlight say, neither brings it up over Claude nor airs a story you cannot see. And wherever Claude comes forward, the window now hides at once, with no fade.
- **The title from the engine's own file.** A mod gets no event for a rename and no call for the title, and the hooks carry the title only when a session starts or a prompt is sent, which misses a rename between prompts. The transcript records every rename too, but it runs to megabytes. `custom-title.json` holds the title alone, so reading it once a minute while on air costs next to nothing.
- **Nothing airs from while Claude is in front.** Claude shows every story itself while it is in front. Kept for the window, those stories aired one after another when you left Claude, each looking like news that had just happened. They are dropped instead; the board and the ticker still show where each session stands.
- **Lines counted where the work happens, as it happens.** Reading only the session's own folder, as each turn started and ended, missed most of the work. A subagent in a worktree of its own works in another folder. A commit made during a turn took its lines out of the next `git diff`. A turn that ended with work still running booked nothing, and one that ran past the hour booked its lines in the next. On 23 October the report at 14:00 read +0 −0 for two sessions whose implementers had written and committed their changes in worktrees of their own. Reading a tree after every call that can change files books the lines in the hour they are written, before a commit can hide them, in whichever worktree they are written. A reading takes about 40 ms in a repository of a few hundred files, and none follows a call the engine ran read-only.
- **Git that never takes the index lock.** The mod runs git in the trees the session works in, after every call that can change files, tuned in or not, while Claude or you may be running git there too. When files were touched without changing, `git diff` writes the index back under `.git/index.lock`, and a `git commit` that needs the lock at that moment fails. `git diff-index -M` gives the same counts and never writes the index. A new untracked file counts as git will count it once it is added: its lines, or none for a binary file or one over 1 MB. Its size is looked up first, so a big file is not read at all, and it is read again only when its size or the time it last changed moves.
- **No grace for the report on the hour.** It used to join the queue at the hour with the window hidden, and air when the window next showed, up to ten minutes after the hour. On 24 October the 01:00 report aired at 01:02, the moment you left Claude, and its clock struck 01:00 two minutes late. Now it joins the queue only if the window shows as the hour strikes. A report that joined keeps its place if you switch to Claude before it airs, until the next one comes due: it was due while you were watching.
- **The setting is Claude Code's own, and `/pipcast` changes it.** A plugin declares its options in its manifest, and Claude Code stores them, shows them in a terminal's `/plugin` and in VS Code's plugin form, and hands them to the hooks module, so Pipcast keeps no preference file of its own for them. The desktop app this was built against (3.6556.2) shows no options for a plugin that Claude Code installed, which is how Pipcast installs, so `/pipcast <option> on` and `off` are the way to change one there. They save it with Claude Code's own command, so every place that shows plugin options sees the same value.
- **Tuning in by itself waits for the desktop app.** The window and the band belong to the desktop app, and nothing else tells a desktop session from a headless one when it starts: both start with no surface, and a `claude -p` run from a desktop session's terminal inherits the desktop's environment. A session tunes in by itself only once the desktop app shows it, so a script's headless run never opens the window.
