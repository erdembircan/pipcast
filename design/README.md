PiP Newsroom turns a picture-in-picture window into a local TV news channel about your tracked Claude Code sessions. The window is our own, the proof of concept's always-on-top panel, drawn to look like macOS's video picture-in-picture; it is not the system's PiP. The channel is **KLWD**. Most of the time it airs the **live board**, a listing of the sessions, their projects and their state. When a session needs your input or is ready for review, it cuts to a **news flash**: a stinger, then the anchor desk, where Clawd, the Claude Code mascot, anchors the story in front of the city at dusk. Every hour on the hour it airs a short scheduled report, **On the hour**: the station clock strikes the hour, Clawd reads the hour's headlines at the desk, and THE HOUR IN REVIEW shows what each session did.

The look is **Local at Six**: a 1990s local-station package of glossy blue bars, gold trims, chrome lettering and slanted tabs. The production designs are on the station canvas, one page per part of the broadcast; the **Review sequence** section says what each page decides and where it stands.

The current design is this system and three canvases, and nothing else: PiP Newsroom · Station (https://claude.ai/artifact/LaUs1pnGjjsvs9W2PfR6hS) for the broadcast, PiP Newsroom · Window (https://claude.ai/artifact/D4c6cARgruAfEgBvdoUt8Q) for the window, and PiP Newsroom · Band (https://claude.ai/artifact/LrMxrQF2mTCNXeLssgf9j1) for the band above the prompt, where a session tunes in. Artifacts titled OUTDATED (the first prototype canvas, the clock options canvas and an early draft doc) are records only: take no style or behaviour from them.

## How the frames are built

- Every frame on the station canvas is `PipNews.Pip` fed a named scene from `PipNews.samples` (`sample="run-return"`). A graphic shown on its own is its own component, fed the same way. Frames carry no styling of their own.
- Change a token, a component or a sample scene here, then re-install the system on the canvas, and every frame re-renders. Never restyle a frame by hand.
- The stage is a fixed 960 × 540 picture that scales uniformly with the window. Every size in this system is in stage units unless it says pt.
- The sample sessions (api-server, web-shop, docs-site, desktop-app) are examples, not anyone's real work.

## Content fundamentals

Write like a local newsroom: present tense, active voice, four words or fewer in a headline.

- **The event is the headline; the session is the strap.** Headlines come from a fixed vocabulary: `NEEDS YOUR INPUT`, `READY FOR REVIEW`, `WORK COMPLETE` and `STOPPED ON AN ERROR` for the stories, and `2 STORIES` or `A QUIET HOUR` on the hour. The session's title and project go on the strap underneath, so a long title never breaks a headline.
- Set headlines, tabs, labels, the listing's pills and its project plates in caps. Session titles in the listing appear as they are written; straps, ticker items and monitor copy are in sentence case.
- Claude is "Claude", the one who asks. The anchor is "Clawd". Never "the AI" or "the bot".
- Quote Claude on the wall monitor, three lines at most: the command it wants to run in gold with its own description of it (`npm install`, "Install dependencies"), the question it asks, or its last words when it finished with nothing changed. An error is its kind, in plain words. Data sources has where each comes from.
- Write numbers as "12 min", "4 files", "+182 −40" (a true minus sign). Times are 24-hour: "14:32".
- No emoji and no exclamation marks anywhere on the stage. Urgency comes from colour, the stinger and Clawd.
- A ticker item that carries news leads with a caps word: `STILL WAITING Fix flaky checkout test needs your input · 4 min`.

| Segment | Open | Tab | Headline | Wall monitor |
| --- | --- | --- | --- | --- |
| Needs your input | BREAKING NEWS stinger | BREAKING | NEEDS YOUR INPUT | CLAUDE ASKS: the command and its description, or the question, quoted; "Waiting 0:12" |
| Finished, files changed | BREAKING NEWS stinger | BREAKING | READY FOR REVIEW | CHANGES, "+182 −40", "4 files changed" |
| Finished, nothing changed | BREAKING NEWS stinger | BREAKING | WORK COMPLETE | CLAUDE SAYS and its last words, quoted |
| Stopped on an error | BREAKING NEWS stinger | BREAKING | STOPPED ON AN ERROR | THE ERROR, in plain words |
| On the hour (scheduled) | the ON THE HOUR ident: the station clock | ON THE HOUR | 2 STORIES, or A QUIET HOUR | THIS HOUR: "+1,546 −368", "Across 4 sessions", "14:00 to 15:00" |

## Visual foundations

### The picture

- The window is the size of its screen quadrant: it fills the quadrant at 16:9, 20 pt in from every side (`pip-margin`), and moves between the four quadrants. It opens at that size, never gets bigger, and resizes down to 70% of it (`pip-min-scale`). The Frame section has the numbers per screen.
- Ground every frame in the studio gradient: `studio-top` to `studio-ink` to `studio-deep`, top to bottom. There is one theme, `On air`.
- Keep every piece of text at 28px or more (`legibility-floor`). That is 12.3 pt in the smallest window (420 pt wide) and 20.9 pt at full size on a 14-inch MacBook Pro.

### Colour

- Blue is the station: `bar` and `bar-lo` for glossy bars, `bar-edge` for the 1px highlight on top, `gloss` for the sheen over the top half.
- The listing's rows are the first station sketch's brighter blue: `row-hi` at the top, `row` down to a hard split across the middle, then `row-lo` and `row-base`.
- Gold is the trim: `gold` for rules and the edges of headline bars, `gold-hi` for ticker leads and the monitor's figure, text on gold in `on-gold`.
- BREAKING NEWS is red, `breaking`: the stinger and the BREAKING tab for every story, and the stories that need you (INPUT, ERROR). Finished stories are green, `ready`: the READY pill and the CHANGES and CLAUDE SAYS headers. Each family has a `-hi` top, a `-deep` ground and an `on-` partner for text on it. Working sessions and the report on the hour are gold: the station's own colour, so routine never looks like news.
- The usage limits take usage-band's steps in these colours: the listing's blue below 70%, gold from 70%, `breaking` red from 90%. The figure is always there, so colour is never the only signal.
- `clay` is Clawd's alone. Nothing else on the stage uses it.
- Every state is a word as well as a colour (INPUT, ERROR, READY, LIVE), so colour is never the only signal: INPUT and ERROR share red, and the word tells them apart.

### Type

- `display` (Anybody) for everything with station character: the bug, the stinger, headlines, tabs, labels, and the listing's titles and pills. Always italic and heavy, expanded with `font-stretch`: 110–120% for headlines and the bug, 130% in the listing.
- `text` (Archivo) for what has to be read quickly: straps, ticker items, monitor copy, the clock, and the projects on the listing's plates.
- `mono` (IBM Plex Mono) only for captions on the canvas, never on the stage.

### Shape and finish

- Graphics lean forward by `slant` (−12°): tabs, headline bars, straps, the listing's project plates, and the ticker's LATEST tab and clock. Text inside is set straight again.
- Bars are glossy: a gradient with a `gloss` sheen, or the listing's hard split across the middle, and a light top edge. Headline bars carry a `gold-hi` edge on top and a `gold-lo` edge below.
- Chrome lettering (`chrome-hi`, `chrome`, `chrome-lo`) is for the bug, the stinger, the ident on the hour (its words, and the station clock's bezel, hands and mark) and the monitor's bezel, and nothing else.
- Rounded corners: the listing's rows (`radius-row`) and pills (`radius-tag`), other bars (`radius-bar`) and the monitor (`radius-monitor`).

### Layout

- The stage has four bands, top to bottom: the top band with the KLWD bug (y 24–68); the content, either the listing from y 92 or the anchor desk; the lower third (y 364–460); and the ticker (y 484–540), with the clock at its right end.
- The bug sits at the title-safe inset (`safe-inset`, x 40), level with the listing. On hover, the close button sits over its first letters. The right end of the top band stays empty for return.
- At the desk, Clawd sits at x 138, y 211 at 18px cells, behind the desk top at y 328. The desk runs the full width; its chrome and gold lip follows the front edge (y 348 at the sides, 361 at the centre with the trim), above the lower third. The station mug stands left of Clawd and the script lies in front of Clawd. The wall monitor stands at the right, x 556–920.
- The listing shows four rows a page, 68 tall with 12 between, sorted needs input, error, ready, working. Each row leads with its session's project on a plate, 200 wide and 44 tall, so the titles start in line; a name longer than the plate is cut with an ellipsis, and a session with no project has no plate. With more than four sessions a tab under the pills says which page it shows (1 OF 2), on the ticker clock's blue, at y 422–462; four or fewer is one page and no tab.
- Under the listing, on the page tab's line (y 422–462) from x 48, the account's usage limits: SESSION, Claude's five-hour window, then WEEK, its seven-day one. Each is its name in the ticker's gold caps, a meter on the project plate's ground and gold rule filled with the listing row's gloss to the share used, and the figure in the clock's type, a whole percent. They are on the board only, from the first reading a session takes, and stay put while the pages turn; the page tab keeps the right end.
- THE HOUR IN REVIEW keeps the listing's order: its header at y 84, four rows of 72 a page from y 150 to 462, above the ticker. Each row reads as the session's row on the board: the project on the listing's plate, 16 in from the row's edge, the title 20 after it, as it is written, over one detail, and the state pill at the right. With more than four sessions its page tab sits at the right end of the header, y 90–130.
- The ident's clock starts at the centre and steps to x 250 at the hour, leaving the right half to ON THE HOUR.

### Motion

Motion has no token family, so the values live here.

| Piece | Motion |
| --- | --- |
| The board | The ring at the top right sends out its signal: a wave leaves the ring every 3 s and spreads across the studio to two and a half times the ring's size, fading as it goes, 9 s from the ring to gone. The waves keep time with the clock, so they carry on under an outro's fade and never restart when the board comes back |
| The listing's pages | With more than four sessions a page holds 8 s, then turns: each row leaves to the right as BREAKING NEWS's words leave in its outro (420 ms, fading as it goes), and once it has gone the next page's row slides in from the left as the lower third does (460 ms), rows 110 ms apart from the top, the page tab last. The clock starts when the board appears, so the board always comes back on its first page; what changes while a page is up waits for the next turn. THE HOUR IN REVIEW turns the same way, 10 s a page |
| Stinger, the intro | Runs on one progress value: a red wave crosses the glass wall and leaves its panes glowing, the chrome words slam in one line after another, and a glint crosses them. No title: the session is named at the desk. 1.4 s, the same for every story |
| Stinger, the outro | After every desk: the intro's last picture, run out over 1.2 s. A glint crosses the words, the words leave to the right one after the other, the red wave sweeps back across the wall and darkens it, and the open fades away to the board underneath |
| Ident, on the hour | Runs on one progress value over 7.5 s, from five seconds before the hour: the clock's seconds hand steps once with each pip; on the long pip the minute hand jumps to the hour and a glint crosses the face, then the clock steps left and ON THE HOUR slams in. Nothing runs under it |
| Ident, the outro | Ends the report: the ident's last picture, run out over 1.4 s. A glint crosses the words, the words leave to the right one after the other, the clock drops back and fades, and the ident fades away to the board underneath |
| Lower third | Slides in from the left over 460 ms; the strap follows 150 ms later; a glint crosses the headline every 5 s |
| Wall monitor | Powers on like a tube set: a bright line opening to the full screen over 560 ms |
| Ticker | Crawls right to left at a steady 53 px a second, whatever it carries. Each item keeps its words until it has gone past the tab, and the crawl carries on across cuts; the clock stays put at its right end |
| Clawd | Moves in whole poses (see Anchor), with a bob of 6px at most |

All of it moves by transform and opacity, which the system's compositor plays at the display's own rate. The stinger and the ident, intros and outros, draw every piece from their one progress value and hand the whole run to the compositor as keyframes drawn from the same pictures, so a moving frame and the storyboard frame at that moment are the same picture. In Low Power Mode WebKit gives the page 30 frames a second and runs its timers late, and the compositor keeps its pace. Two pieces are still moved by the page itself: the ticker's belt, a layer of its own that it moves each frame, and Clawd, whose poses step 12 times a second on a layer of his own, so a step redraws him alone.

With reduced motion, all of it stops; the intro and the ident show their last frame, the outros cut straight to the board, the listing's pages cut from one to the next on the same clock, and the picture still reads.

### Sound

BREAKING NEWS gets two jingles, one for its intro and one for its outro, and so does the hour, all built on the station's four-note logo: one note per call letter, K-L-W-D, up a fourth, a fifth and a fourth (A, D, A, D in D). BREAKING NEWS sets it over D minor and plays the same for every story. The jingles are synthesised with Web Audio from a short score (`PipNews.playJingle`), so the window and the review boards play the same thing.

| Jingle | What it plays | Length |
| --- | --- | --- |
| BREAKING NEWS, intro | A drum roll and a riser before the words; the logo's four notes on four brass hits as BREAKING and NEWS slam in, the last and biggest as NEWS lands; then the beat runs on through the cut to the desk, holds for two bars and fades out about three seconds into the desk | 5.8 s from the stinger's start |
| BREAKING NEWS, outro | A short roll as the glint crosses the words; three of the logo's notes on three hits as the words leave, over D minor and then the dominant; the fourth on a closing chord in D major as the open fades to the board, ringing out over it | 3.4 s from the outro's start |
| On the hour | Five short pips on D as the seconds hand steps through the last five seconds, and a long one as the minute hand jumps to the hour; then the logo's four notes on a stately brass fanfare in D major, on the strike, as ON THE lands, as HOUR lands, and the last and biggest as the words settle, ringing out into the desk. Routine, not news: no roll and no riser | 9.6 s from five seconds before the hour |
| On the hour, outro | The logo's four notes come back down on bells, top to bottom, over a soft pad as the words leave; then a warm D major chord as the clock goes and the ident fades to the board, dying away under it. No pips, no roll | 3.6 s from the outro's start |

On the window, the sound button switches the jingles on and off: sound starts on, the window remembers the choice, and it plays at the Mac's volume. Browsers only make sound after a click, so review boards play a jingle from a button under the window (`PlayWithSound`), never on it.

## Iconography

- Clawd is pixel art, copied from the engine's own glyphs, and so is the city behind the desk, which follows the clock through morning, afternoon, evening and night (the NewsDesk card). The desk and what stands on it (the station mug, the script) are drawn like the graphics, with gloss and chrome. There are no icons on the stage: states are words on pills (INPUT, ERROR, READY, LIVE). No photographs, no emoji.
- The window has four controls, close, Transparent window, sound and Back to Claude, shown on hover in the Liquid Glass of macOS's own picture-in-picture: clear glass the picture shows through, a thin rim that catches the light, white glyphs drawn like Apple's, over a light dimming of the picture. The buttons are 44 pt, a third bigger than macOS's. The one under the pointer brightens; nothing pops up, no name and no tooltip. Review boards mimic the glass; the app uses macOS's own material. There is no play, skip or timeline: nothing else sits on the picture.
- The band above the prompt box carries the station into the Claude desktop app, inside the rounded container the desktop draws round every mod's band: one plate, the bug's chrome KLWD on the studio plate and, at its end, TUNE IN on the lower third's gold or TUNE OUT on the ticker clock's blue. No count and no words besides the action's: no status line, no on-air or off-air text. The plate is a picture with its own ground, so it reads the same on the app's light and dark themes. The Band section has the rules.

## Using the components

- A frame: `PipNews.Pip` with `width` in pt and `sample` (a scene name) or `scene`. Add `controls` to show close, Transparent window, sound and Back to Claude as they look on hover, `animate` to play.
- `sample="loop"` plays the board and its stories: board, BREAKING NEWS and a permission ask, the board, then BREAKING NEWS and changes ready for review while the question still waits, and the board with both. `sample="hour"` plays the 15:00 report: the board at 14:59, the ident, the desk, THE HOUR IN REVIEW, the outro, back to the board; `sample="quiet-hour"` plays a quiet hour. `sample="breaking"`, `"breaking-ready"`, `"breaking-complete"` and `"breaking-error"` play one story each as it airs, from the board and back.
- The parts (`TopBand`, `Ticker`, `SessionBoard`, `StatePill`, `LowerThird`, `OTSBox`, `Stinger`, `Ident`, `HourReview`, `NewsDesk`, `Clawd`) are placed on the 960 × 540 stage. Pass `inline` to show one on its own inside a `.pn-surface` container. `Ticker`, `SessionBoard` and `HourReview` also take `sample`, to draw a scene's data (`board-seven` and `review-seven` have seven sessions, two pages). `SessionBoard` and `HourReview` turn their pages only with `animate`; without it they hold their first page.
- The band: `PipNews.Band` with `tuned`. Show it in the app with `PipNews.PromptSketch`, review-board furniture that takes the same props, `theme="dark"` for the app's dark theme, `beside="usage"` for another mod's band beside ours, and `width` for a narrow column.
- `PipNews.pipSize(width, height)` gives the window's full size on a screen of that size in pt; `PipNews.pipRange(width, height)` gives its full and smallest sizes.
