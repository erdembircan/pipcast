# Data sources

Where every word and figure on the stage comes from once the mod is built. Checked against the mod API's types and the current Claude Code docs (21 October); none of it has been run in a live session yet (Open questions, 4).

| On the stage | Where it comes from | Notes |
| --- | --- | --- |
| The story: needs your input, finished, stopped on an error | `PermissionRequest`, the `AskUserQuestion` call, `Stop`, `StopFailure` | A `Stop` with background tasks or scheduled wake-ups still pending is still working, unless the task is a command that runs until it is stopped: a dev server, a watcher, a log it follows. The engine gives only each command's task id and its line, so the mod also looks at the command's processes for a port they listen on |
| Working, the LIVE pill | `turn.start`, until the turn ends | |
| A session's title | Whatever title the engine gives the session | When it has none, its default name ("web-shop-3f") |
| The project | The session's repository or folder (`$.session.repo()`, `cwd`) | The repository's name, else the folder's. It leads the session's row in the listing on a plate, starts the ticker's working lines and ends the desk's strap, and names the rows of THE HOUR IN REVIEW |
| CLAUDE ASKS, a permission | The tool and its input: a command and Claude's own description of it (`npm install`, "Install dependencies"); for the file tools, the verb and the file ("Edit src/auth/session.ts") | The command in gold, the description under it; never a sentence of ours. A sandboxed network request raises no `PermissionRequest`: it arrives as a notification about 6 s later, with the host it wants |
| CLAUDE ASKS, a question | The `AskUserQuestion` call: the question as Claude wrote it | Up to four questions with options; the monitor shows the first question |
| CHANGES: lines and files | Counted by us with git in every working tree the session's work runs in, its own folder and each subagent's worktree, after every call that can change files; outside git, Claude's own Edit and Write calls | The engine hands a mod no per-turn count. Lines count in the hour they are written, and a later commit keeps them; a command that both changes files and commits them is missed. Two sessions in one checkout blur together |
| CLAUDE SAYS | Claude's final message (`Stop`) | Markdown stripped, cut at a sentence end within three lines; "Finished" when the message is empty |
| THE ERROR | `StopFailure`'s kind, in plain words, with its details | Not documented: a usage-limit pause, or a context grown too long |
| "Finished in 9 min" | The turn's duration (`turn.complete`) | |
| "Waiting 0:12", STILL WAITING · 3 min, "Stopped after 31 min" | Our own clock, from the event | A wait ends when the next event shows it was answered |
| The ticker's working lines | Each tool call's input: the file being edited, or a command's description | |
| The board across sessions | Each session's mod writes its state to a store every session on the machine shares | A session that stops checking in leaves the board: a crash isn't documented to send an end |
| The usage limits under the listing | The usage limits Claude Code reports to a mod: `$.session.usage()` when a session tunes in, `session.measure` after each reply and whenever a limit moves a whole point | The account's, not a session's: the board shows the newest reading any session on air took. SESSION is the five-hour window and WEEK the seven-day one, read as usage-band reads them; a gateway's spend limit is left out. Claude Code stops reporting a window once it resets, so the mod keeps it and the board reads it as 0% until a new one comes. An account with no plan reports none |
| The report on the hour | Our own log of each session's stories and line counts, hour by hour | Nothing in the engine keeps one |
| The clock | The machine's | |
