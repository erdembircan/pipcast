# Event desks

Every story a session sends airs as BREAKING NEWS: the same open, the same jingle and the red BREAKING tab. What changes from story to story starts at the desk: the headline, the wall monitor, Clawd's act, the key light behind him, and the session's pill on the board afterwards. Working is not a story: it never interrupts. Once an hour the channel also airs a scheduled report, which is not a story either (On the hour, below).

The stories are the states the engine reports. The signals are confirmed in the mod API's types and the current hooks reference, and have not been exercised yet (Open questions, 4). Data sources has where every figure on the stage comes from.

| Story | The engine's signal | Headline | Wall monitor | Clawd | Afterwards |
| --- | --- | --- | --- | --- | --- |
| Needs your input | A permission ask (`PermissionRequest`) or a question to you (the `AskUserQuestion` call) | NEEDS YOUR INPUT | CLAUDE ASKS: the command in gold with Claude's own description of it, or the question, quoted; "Waiting 0:12" | urgent | The session moves to the top of the board with its red INPUT pill; the ticker says STILL WAITING on every pass until you answer |
| Finished, files changed | The turn ends with an answer (`Stop`), and its edits or `git diff` show changes | READY FOR REVIEW | CHANGES: the diffstat and the files changed; "Finished in 9 min" | cheer | The row shows a green READY pill; the ticker carries the story once |
| Finished, nothing changed | The turn ends with an answer, and nothing changed | WORK COMPLETE | CLAUDE SAYS: its last words, quoted; "Finished in 6 min" | talk | As above: READY, and the ticker once |
| Stopped on an error | The turn ends on an error (`StopFailure`, with its kind: overloaded, rate limit, server error, a login or billing problem, a reply too long) | STOPPED ON AN ERROR | THE ERROR: the kind of error, in plain words; "Stopped after 31 min" | glance | The row shows a red ERROR pill, under any INPUT; the ticker says STILL WAITING on every pass until the session runs again |

Every story's desk runs 10 s.

**Not tracked**, by decision: a turn you interrupt yourself, a session sitting idle until its next prompt, a session ending (/clear, /resume, logout or exit: its row leaves the board), and the engine's internal events (compaction, subagents, task lists, model switches). A turn that ends while background work will wake it again is still working, not finished.

## The flash, in order

1. **The intro.** BREAKING NEWS, for every story. One progress value drives it over 1.4 s: a red wave crosses the glass wall behind the words and leaves each pane glowing (0–100%), the chrome words slam in one line after another (22–60%), and a glint crosses them (60–92%). There is no title: the session is first named at the desk, on the strap. The jingle plays from the first frame (Sound, in the README). The storyboard frames on the canvas are this same picture at 34%, 74% and 100%.
2. **The anchor desk.** Clawd behind the desk in front of the city at the hour on the clock (morning, afternoon, evening or night), the wall monitor powering on at the right, the lower third sliding in. Clawd's act starts with the headline, and the key light behind him takes the story's colour.
3. **The outro.** The intro's last picture, run out over 1.2 s: a glint crosses the words, the words leave to the right, the red wave sweeps back across the wall and darkens it, and the open fades away to the board underneath. Its own jingle closes the segment (Sound, in the README).
4. **Back to the live board**, with the story carried on in its row and in the ticker.

## Stacking

- Stories air one after another, in the order they land. Nothing cuts in.
- A story that lands while another is at the desk goes into the ticker at once as COMING UP, and airs with its own BREAKING NEWS as soon as that segment's outro ends.
- A story that is cut off is not restarted. If you answer while a question's desk is on air, that story ends there, and the next one, or the board, follows.
- First come, first served, with no roundups: stories that land together or during another story wait in the ticker as COMING UP and air one by one, each with its own BREAKING NEWS, in the order they landed.
- A story whose session has moved on before it airs (you answered it in Claude) is dropped.
- Only what lands while you are away from Claude airs. While Claude is in front the window is hidden, and Claude shows every story itself: a segment on air when you switch to Claude is cut there, the stories waiting as COMING UP are dropped, and a story that lands while you are in Claude never airs. Back in another app, the board and the ticker show where every session stands, and the next BREAKING NEWS is the next story to land.

## On the hour

Every hour on the hour the channel airs a short report on the sessions, the way a station runs the news at the top of the hour. It is routine, not news, so it wears the station's own blue and gold and never an event's colour. It covers the hour since the last report.

| Segment | What airs | Clawd | Time |
| --- | --- | --- | --- |
| Ident | The station clock: a dial in the wall monitor's chrome bezel, a glossy blue face, gold hour marks, chrome hands and a gold seconds hand that steps with each pip. On the long pip the minute hand jumps to the hour and a glint crosses the face; then the clock steps aside and ON THE HOUR slams in in chrome. No strip or subtitle under it. Its jingle: the pips, then a brass fanfare on the logo (Sound, in the README) | — | 7.5 s, from five seconds before the hour |
| Headlines | The desk. Tab ON THE HOUR, headline 2 STORIES (a story is a session whose state changed this hour), the strap counting them by kind. The wall monitor's THIS HOUR shows the lines changed and the span | talk | 10 s |
| The hour in review | Full frame. One row per session in the listing's order: its project, one detail (the lines changed, or how long it has waited) and its state pill | — | 10 s |
| Outro | The ident's last picture, run out: a glint crosses the words, the words leave to the right, the clock drops back, and the ident fades to the board underneath. Its own jingle closes the report (Sound, in the README) | — | 1.4 s |
| Back to the board | The ticker leads with ON THE HOUR and says when the next report airs | — | — |

- **A quiet hour**, when no session changed state: the ident, the desk and the outro, headline A QUIET HOUR, the strap saying all is well. No review.
- **First come, first served.** A story on air at the hour delays the report until its outro ends; it waits in the queue like any story, the ticker saying COMING UP The 15:00 report, and then airs as the whole hour segment, countdown and all. A story that lands during the report waits as COMING UP until the report ends.
- **Its own outro.** The report ends on the ident run out, after THE HOUR IN REVIEW or, in a quiet hour, after the desk; a story waiting as COMING UP airs once it ends.
- **Nothing tracked:** no report, and no window.
- **Every hour the same:** no report is special, 18:00 included.
- **The window is hidden at the hour** (Claude is in front): that hour's report is skipped. The report joins the queue only if the window shows as the hour strikes, in the five seconds of its countdown, so a window that shows, or a session that tunes in, after the hour never brings it back. A report already waiting its turn behind a story keeps its place if the window hides, and airs when the window shows again, unless the next report has come due by then. The next report covers everything since the last one that aired.
