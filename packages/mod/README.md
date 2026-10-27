# Pipcast

**Picture in picture for Claude Code.**

Start Claude on something, switch to another app, and keep an eye on it from the corner of your screen. Pipcast puts a small window there that floats over whatever you're working in, the way a video does when you pop it out into picture in picture, and shows you what your Claude Code sessions are up to. When one needs you, finishes, or stops on an error, you see it and hear it, without going back to check.

What plays in the window is KLWD, a local TV news channel for your sessions, styled as a 1990s local news broadcast. Most of the time it shows a live board of your sessions. When something happens, KLWD cuts to BREAKING NEWS and Clawd reads the story from the anchor desk. Every hour on the hour, it airs a short report on what each session did.

## Requirements

- A Mac with Apple silicon, on macOS 14 or later. The window's controls use Liquid Glass on macOS 26 and later.
- Claude Code, in the Code tab of the Claude desktop app or in a terminal. Pipcast is a mod for Claude Code, so it doesn't run in chat or Cowork.

## Get started

1. After you add Pipcast, start a new session in the Code tab of the Claude desktop app. If Claude Code says plugins changed, run `/reload-plugins`. From then on, each new session goes on air by itself.
2. Give Claude something to do, then switch to another app. KLWD appears in the bottom-right corner of your screen.
3. When the session needs your input, finishes, or stops on an error, KLWD airs it as BREAKING NEWS.
4. Click **Back to Claude** on the window, or switch to Claude yourself, and the window gets out of the way.

A session that was already open, or one you resume, goes on air when you press **TUNE IN** in the band above the prompt box, or run `/pipcast`. Press **TUNE OUT**, or run `/pipcast` again, to take the session off the air. In Claude Code in a terminal, `/pipcast` is how a session goes on air.

## What's on

**The board** is KLWD's live picture of every session on air, one row each: its project, its title, and where it stands. **INPUT**: it's waiting on you, with a question or a permission to give. **ERROR**: it stopped on an error. **READY**: it finished, and it's ready for you to look at. **LIVE**: Claude is working on it. Under the board, two meters show your account's usage limits, the current session's and the week's.

**BREAKING NEWS** gives every story a segment of its own: the stinger and its jingle, then Clawd reading what happened at the anchor desk, with a beat under the story. A session has a story when it needs your input, when it finishes with changes ready for review, when it finishes without changing anything, and when it stops on an error. KLWD only airs what happens while you're away from Claude.

**On the hour**, the station clock strikes, Clawd reads the headlines, and THE HOUR IN REVIEW shows what each session did: the lines it changed, or how long it has been waiting on you.

## The window

The window looks and works like macOS's picture in picture for video: a 16:9 window with rounded corners that floats above every app, on every desktop. It never takes the keyboard, and it hides while Claude is in front. Drag it to another corner, resize it from an edge, or tuck it into the side of the screen, and BREAKING NEWS and the hour still bring it out. Hover over it for its controls: **Close** takes every session off the air, **Mute** turns the jingles and the beat off, and **Back to Claude** brings Claude to the front. Sound plays at your Mac's volume.

The window is there while at least one session is on air, and closes a few seconds after the last one goes off.

## Settings

| Setting | Default | What it does | Change it |
| --- | --- | --- | --- |
| **Tune in every new session** | On | Each new session in the desktop app goes on air as it opens. With it off, every session waits for **TUNE IN** | `/pipcast auto on` or `/pipcast auto off` |
| **Transparent window** | Off | The window fades to 40% while the pointer is elsewhere, and turns solid again as soon as the pointer is on it | `/pipcast transparency on` or `/pipcast transparency off` |

Run `/pipcast auto` or `/pipcast transparency` on its own to see whether that setting is on.

## What Pipcast runs and reads

Pipcast is two programs, and both run only on your Mac.

**The mod** is Pipcast's code inside Claude Code. It runs in every Claude Code session while Pipcast is on, on air or not, so a session that goes on air mid-turn shows where it stands at once. It draws the band above the prompt box, answers `/pipcast`, and follows each session's events: turns starting and ending, the tools Claude calls, permission requests and errors. It never reads the prompts you send.

The mod reads:

- what each tool call is about: the file it reads or edits, the command it runs, the site it fetches from, and the text of a question Claude asks you
- what a permission request is for: the command, file, site or tool
- Claude's last message when a turn ends
- the session's title, from the file Claude Code keeps beside the session's transcript in `~/.claude/projects`, and the note there that names the folder a subagent works in
- your account's usage limits, as Claude Code reports them
- the environment variables `HOME`, `CLAUDE_CONFIG_DIR` and `CLAUDE_CODE_EXECPATH`, and `PIPCAST_HOME`, `PIPCAST_STATION_BIN` and `PIPCAST_TARGET_BUNDLE_ID`, which are for Pipcast's own tests

It writes a session's file only while the session is on air, and it runs these programs and no others:

- `git`, only to read (`rev-parse`, `diff-index` and `ls-files`), in the folders where Claude works, and it reads the files there that git doesn't track yet, to count the lines each session changes
- `ps`, `lsof`, `head` and `tail`, when a turn ends with commands still running in the background, to tell from their processes and the start and end of their output whether they're still at work
- `find`, to find the folder of the session's transcript when no hook has said where it is
- `sh` and `ps`, to find the Claude Code program the session runs on, and that program's `claude plugin list` and `claude plugin configure`, when you run `/pipcast auto` or `/pipcast transparency`
- `mkdir`, `mv`, `rm` and `chmod`, on its own files
- the station

**The station** is a small macOS app that comes with Pipcast: the program `station/pipcast-station` in the plugin, built from the Swift source in Pipcast's repository. The mod starts it when the first session goes on air, and it quits a few seconds after the last one goes off. It reads the sessions' files, shows the broadcast in its window, a web page that comes with the plugin, and plays the jingles and the beat in `station/sounds`. It checks which app is in front, to hide while Claude is, and where the pointer is, to show the window's controls. Its window never takes the keyboard, so macOS treats the station as an app in the background, and three private macOS switches, looked up as it runs, make up for that: one draws the window's glass controls as an active window's, one lets the station set the pointer for resizing, and one keeps the window off Claude's full-screen desktop. For Pipcast's own checks, it has a `snapshot` command that draws a still of its page, and it saves a picture of its own window, and no other, when `PIPCAST_SELF_CAPTURE` is set. It asks for no permission: no screen recording, no accessibility, no automation.

Neither part makes a network request, and neither downloads or installs anything.

## Privacy

Everything stays on your Mac. Pipcast sends nothing anywhere, and has no account, analytics or telemetry.

It keeps its files in one folder, `~/Library/Application Support/Pipcast`, which only your user can open:

- a file for each session on air, with its project's folder name, its title, its state, what Claude is doing, the question Claude asked or what a permission is for, Claude's last words when a turn ends, the lines and files it changed in each hour, and your account's usage limits. A session deletes its file when it goes off the air or ends. A file left behind by a session that stopped without ending, as when Claude Code is force-quit, is deleted the next time a session goes on air, once it's an hour old.
- the window's corner and size, whether it's tucked into the side, whether sound is on, when the hour last aired, when the window was last closed, **Transparent window**, and the station's process number and version
- the station's own log of what its window did, for fixing problems, cut back at 1 MB

Claude Code keeps Pipcast's two settings with your other plugins' options.

Uninstalling Pipcast leaves that folder in place. To remove everything Pipcast kept, delete `~/Library/Application Support/Pipcast`.

KLWD is an ordinary window, so it appears in screen shares and recordings, with your session titles and Claude's questions on it. Tune sessions out, or close the window, before you share your screen.

## Source and support

Pipcast is open source, under the MIT license, at [erdembircan/pipcast](https://github.com/erdembircan/pipcast). Everything in the plugin is built from that repository: the mod from its TypeScript, the station from its Swift, the broadcast's page from its TypeScript and its design system, and the sounds from the design system's scores. The page loads React's own production files, copied unchanged from its npm package, with React's license beside them, and the typefaces Anybody and Archivo, under the SIL Open Font License, with theirs. [Developing Pipcast](https://github.com/erdembircan/pipcast/blob/master/docs/development.md) says how to build it yourself.

To report a problem or ask a question, open an issue at [erdembircan/pipcast](https://github.com/erdembircan/pipcast/issues).
