# The band

The mod's control inside the Claude desktop app sits in the band directly above the prompt box, where the proof of concept put its **Track session** button. It puts a session on KLWD and takes it off. It was designed on the PiP Newsroom · Band canvas (https://claude.ai/artifact/LrMxrQF2mTCNXeLssgf9j1) and became one plate on PiP Newsroom · More than four (https://claude.ai/artifact/Jgfrd35WD6unpDQM6v2BoR), with the station's own pieces: the bug's chrome KLWD on its studio plate, the lower third's gold and the ticker clock's blue.

The band is one piece and no words besides the action's: no count, no status line, no on-air or off-air text, no explanation (your rule).

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

Our plate sits on that box, so it is its ground in both themes.

## What it does

| Behaviour | How | Where it is settled |
| --- | --- | --- |
| TUNE IN | Puts this session on KLWD: its row joins the listing and its stories air. The first session on air brings the window, which shows when you switch to another app | The proof of concept's Track session |
| TUNE OUT | Takes this session off KLWD: its row leaves the listing. With nothing on air there is no window | The same, Stop tracking |
| The window's close | Takes every session off at once, and the channel ends. TUNE OUT takes only this one | Frame, "Close stops tracking" |
| No limit | Every session can tune in, so TUNE IN never dims, and the band shows no count | Your rule, on PiP Newsroom · More than four |
| The slash command | Does what the plate does, from the prompt, as `/session-pip` does in the proof of concept | The proof of concept |
| A session that ends | /clear, /resume or exit takes its row off the listing; its band shows TUNE IN again | Event desks, "Not tracked" |

## The two states

| State | The plate |
| --- | --- |
| Off air | KLWD, then TUNE IN on the lower third's gold, however many sessions are on KLWD |
| On air | KLWD, then TUNE OUT on the ticker clock's blue |

## The piece

| Piece | In the mod | Size | Look |
| --- | --- | --- | --- |
| The plate | One `Svg`, drawn as an image, with a blank native `Button` laid over it | 22 px tall (`band-height`); 151 px wide with TUNE IN, 164 px with TUNE OUT | The bug's KLWD in chrome on the studio plate, slanted, with a gold edge; then, parted from the mark by an edge of its own, the action: TUNE IN on the lower third's gold with words in `on-gold` (9.4:1) and a `gold-lo` edge, or TUNE OUT on the ticker clock's blue with words in `on-air` (8.3:1) and a gold edge. Its `alt`: "KLWD, Tune in" or "KLWD, Tune out" |

## The rules

1. **Desktop only.** The band draws on the desktop surface; on any other it passes on what is beneath unchanged. The slash command works everywhere.
2. **A survey comes first.** While a survey holds the band (`hasSurvey`), ours steps aside and draws nothing.
3. **A line of our own.** Another mod may draw the band too. Ours is one line of its own, the plate and nothing else, under what the other mod drew. That stays exactly as it was drawn, on its own line: we never take it apart, set it in our row or draw over it. Every mod in the band does the same, so each mod has one line.
4. **The picture is 22 px tall** (`band-height`), as usage-band's marks are, about a regular macOS button's height.
5. **A picture loads no fonts and cannot read the theme.** So the words on the plate are outlines (or a subset of Anybody embedded in the `Svg`), and the plate carries its own ground, so it reads the same on the container's light and dark colours.
6. **The plate is a picture with a blank button over it.** A mod's `Button` shows only text, so the plate gets a `plain` Button with a blank label (en spaces, about one for every 8 px of the plate) laid over it in a `Box` that reaches two columns past the plate on each side, since the desktop draws a Button no wider than its Box and cuts a longer label with an ellipsis. This is usage-band's padlock. The press is the Button's; under the pointer the app inverts it, as it does every plain Button. There is no hover of our own, and nothing pops up: no tooltip, no `<title>`, no card.
7. **A screen reader** reads the picture's `alt` and then a button with no name, as with usage-band's padlock. The slash command works without either.
8. **No text of our own, and no count.** Nothing in the band but the plate, the same however many sessions are on KLWD. It needs about 165 px and never shrinks, so it fits beside a docked pane.
9. **Lines are `md` apart.** Between our line and another mod's, the app's own `md` gap, about the room the app leaves above and below the band's first line.
10. **Copy.** Caps on the action, and nothing else to write.

The two suggestions the Band canvas left open, this session's pill beside TUNE OUT and cells in each session's state colour, went with the cells: the plate carries no count.
