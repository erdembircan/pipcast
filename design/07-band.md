# The band

The mod's control inside the Claude desktop app sits in the band directly above the prompt box, where the proof of concept put its **Track session** button. It puts a session on KLWD and takes it off. It is designed on the PiP Newsroom · Band canvas (https://claude.ai/artifact/LrMxrQF2mTCNXeLssgf9j1), with the station's own pieces: the bug's chrome KLWD, the lower third's gold tab and the ticker clock's blue one.

The band is two pieces and no words besides the tab's: no status line, no on-air or off-air text, no explanation (your rule).

## The container is the app's

The desktop draws every mod's band inside one container of its own, above the prompt box; a mod draws only what goes in it.

| | What it is | Where it comes from |
| --- | --- | --- |
| Box | A rounded box a step off the app's ground, no border, as wide as the prompt box, 6 px above it | Measured on a screenshot of the dark theme: `#212121` on `#151515` (`app-band-dark`) |
| Height | One band line is 40 px; the box is about 43 px tall for one line, up to 11 lines before it scrolls | The app's code: each line is padded to 40 px (`(40px - 1lh) / 2` above and below) |
| Corners | About 11 px | Measured |
| Inside | Content sits 8 px in from the sides, centred in the line | The app's code (`px-[8px]`), and measured |
| Buttons | A mod's buttons are one line of text tall | The app's code |
| Light theme | `app-band`, a step darker than the ground | Inferred, not measured yet |

Our chip and tab sit on that box, so it is their ground in both themes.

## What it does

| Behaviour | How | Where it is settled |
| --- | --- | --- |
| TUNE IN | Puts this session on KLWD: its row joins the listing and its stories air. The first session on air brings the window, which shows when you switch to another app | The proof of concept's Track session |
| TUNE OUT | Takes this session off KLWD: its row leaves the listing. With nothing on air there is no window | The same, Stop tracking |
| The window's close | Takes every session off at once, and the channel ends. TUNE OUT takes only this one | Frame, "Close stops tracking" |
| Four at most | The chip's four cells are the listing's four rows. With four on air, a fifth session's TUNE IN is dimmed, with no button over it | Your rule |
| The slash command | Does what the tab does, from the prompt, as `/session-pip` does in the proof of concept | The proof of concept |
| A session that ends | /clear, /resume or exit takes its row off the listing; its band shows TUNE IN again | Event desks, "Not tracked" |

## The four states

| State | Chip | Tab |
| --- | --- | --- |
| Off air, nothing on KLWD | Four empty cells | TUNE IN |
| Off air, room on KLWD | One blue cell per session on air | TUNE IN |
| On air | This session's cell in gold, the others on air in blue | TUNE OUT |
| KLWD is full | Four blue cells | TUNE IN, dimmed, with no button over it |

## The pieces

| Piece | In the mod | Size | Look |
| --- | --- | --- | --- |
| The chip | One `Svg`, drawn as an image | 22 px tall (`band-height`), about 105 px wide | The bug's KLWD in chrome on the studio plate, slanted, with a gold edge; then four cells: empty (`studio-deep`), on air (the listing's blue), this session (gold). Its `alt`: "KLWD: 3 of 4 sessions on air" |
| TUNE IN | One `Svg`, with a blank native `Button` laid over it | 22 px tall, about 85 px wide | The lower third's tab in gold, words in `on-gold` (9.4:1). Dimmed when KLWD is full; its `alt` then says so |
| TUNE OUT | The same | 22 px tall, about 95 px wide | The ticker clock's blue tab with its gold edge, words in `on-air` (8.3:1) |

## The rules

1. **Desktop only.** The band draws on the desktop surface; on any other it passes on what is beneath unchanged. The slash command works everywhere.
2. **A survey comes first.** While a survey holds the band (`hasSurvey`), ours steps aside and draws nothing.
3. **A line of our own.** Another mod may draw the band too. Ours is one line of its own, the chip and the tab and nothing else, under what the other mod drew. That stays exactly as it was drawn, on its own line: we never take it apart, set it in our row or draw over it. Every mod in the band does the same, so each mod has one line.
4. **Every picture is 22 px tall** (`band-height`), as usage-band's marks are, about a regular macOS button's height.
5. **A picture loads no fonts and cannot read the theme.** So the words in the chip and the tabs are outlines (or a subset of Anybody embedded in the `Svg`), and each piece carries its own ground, the studio plate or the tab, so it reads the same on the container's light and dark colours.
6. **A tab is a picture with a blank button over it.** A mod's `Button` shows only text, so each tab gets a `plain` Button with a blank label (en spaces, about one for every 8 px of the tab) laid over it in a `Box` that reaches two columns past the tab on each side, since the desktop draws a Button no wider than its Box and cuts a longer label with an ellipsis. This is usage-band's padlock. The press is the Button's; under the pointer the app inverts it, as it does every plain Button. There is no hover of our own, and nothing pops up: no tooltip, no `<title>`, no card.
7. **A screen reader** reads the picture's `alt` and then a button with no name, as with usage-band's padlock. The slash command works without either.
8. **No text of our own.** Nothing in the band but the chip and the tab; the cells say how full KLWD is and which cell is this session. The two pieces need about 210 px and never shrink, so they fit beside a docked pane.
9. **Gaps are columns.** One column between the chip and the tab. The boards draw a column at 8 px; the desktop's own figure is not measured yet.
10. **Copy.** Caps on the tabs, and nothing else to write.

Two suggestions are on the canvas, not decided: this session's pill beside TUNE OUT, and the cells in each session's state colour.
