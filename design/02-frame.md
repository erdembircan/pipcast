# Frame

The feed plays in our own window, not in macOS's picture-in-picture. The proof of concept built that window; the supplied screenshot gives it the look of macOS's video picture-in-picture. Three controls sit on the picture, on hover only: close, sound, and Back to Claude. The window itself is designed on the PiP Newsroom · Window canvas.

## What the window does

| Behaviour | How | Where it is settled |
| --- | --- | --- |
| Floats above every app, the Dock, the menu bar and full-screen apps | A borderless, non-activating panel at the status-bar window level, on every Space but Claude's own full-screen ones | Technical reference 4.1, 4.2 |
| Never takes the keyboard | The panel never becomes the key window, so the app you are in keeps typing | Technical reference 4.3 |
| Hides while Claude is in front | It shows when any other app is frontmost, and hides at once when the Claude desktop app is or you are on Claude's own full-screen Space | `Visibility.swift` |
| Lives in one of four quadrants | The screen's visible area splits at its centre lines; on release the window goes to the quadrant that holds its centre, in 0.2 s | `Corner.swift` |
| Starts bottom right | The default quadrant | `Options.swift` |
| Is the size of its quadrant | It opens filling its quadrant, which is also the largest it can be | Your rule |
| Resizes down, never up | Drag an edge or a corner to make it smaller, to 50% of its quadrant size at most; it keeps 16:9 and its outer corner stays put | Your rule; 50%, picked on Pipcast Smallest Window |
| Close stops tracking | Ending the overlay is what stopping tracking does: every session goes off the air at once. The band's TUNE OUT takes one session off (The band) | README, "Stop tracking" |
| Back to Claude brings Claude forward | The window then hides by itself, because Claude is in front | `Visibility.swift` |
| Sound on and off | The sound button on hover switches the jingles on and off. Sound starts on and the window remembers the choice; it plays at the Mac's volume | Your rule |
| Fades while the pointer is elsewhere, with Transparent window on | The whole window shows at 40% (`pip-faded`), so what is under it reads through, and turns solid with the controls as the pointer reaches it; a drag that starts on it keeps it solid. Every segment airs the same way, BREAKING NEWS included | Your rule; 40% is a first figure |
| Minimizes to the side | On hover, a glass handle at the middle of the window's inner edge points to the side the window goes: its own, right for a window in a right quadrant and left for one in a left quadrant. Pressed, the window slides into that edge and the handle stays there as a tab; a click on the tab, or a pull toward the middle, brings the window back. Dragging a quarter of the window past either side edge minimizes it too, at once. It stays minimized when the station starts again | Your rule; PiP Newsroom · Minimize to the side |
| Comes out for BREAKING NEWS and the hour | While minimized, only a story's BREAKING NEWS or the report on the hour brings the window out. It comes out first, and the open starts as it lands. It goes back the moment the last outro ends, or as soon as your pointer leaves it if the pointer is on it then | Your rule |
| Shows only while something is tracked | With no tracked session there is no window at all | Your rule |
| Tracks every session tuned in | No limit: the listing shows four a page and turns to the next every 8 s | Your rule |

## Size: the quadrant

**The window's size is its quadrant.** It fills its quadrant at 16:9, 20 pt in from every side (`pip-margin`): from the screen's edges, as in the proof of concept, and from the centre lines, so it never crosses into the next quadrant. It opens at that size and never gets bigger. You can make it smaller, down to 50% of that size (`pip-min-scale`). The size is worked out again whenever the window moves to another screen or the screen changes.

A quadrant is a little taller than 16:9 on most Mac screens, so the window fills its quadrant's width and leaves a strip of desktop above or below. On a very wide screen it is the other way round.

| Screen (visible area, pt) | Quadrant | Window, full size | Smallest, 50% |
| --- | --- | --- | --- |
| 1280 × 800 | 640 × 400 | 600 × 338 | 300 × 169 |
| 13-inch MacBook Air, 1470 × 956 | 735 × 478 | 695 × 391 | 348 × 196 |
| 14-inch MacBook Pro, 1512 × 982 | 756 × 491 | 716 × 403 | 358 × 201 |
| 16-inch MacBook Pro, 1728 × 1117 | 864 × 558 | 824 × 464 | 412 × 232 |
| 27-inch display, 2560 × 1440 | 1280 × 720 | 1209 × 680 | 605 × 340 |
| 34-inch ultrawide, 3440 × 1440 | 1720 × 720 | 1209 × 680 | 605 × 340 |

`PipNews.pipSize(width, height)` gives the full size and `PipNews.pipRange(width, height)` both sizes. The station canvas shows every frame at the 14-inch MacBook Pro's full size, 716 × 403 pt.

## The look, taken from the screenshot

The screenshot's aspect (2000 × 1299, 1.54) matches a 14-inch MacBook Pro display at 1512 × 982 pt, so 1 pt = 1.32 screenshot px. Every figure is ±2 pt.

| Part | macOS's picture-in-picture, as captured | Ours |
| --- | --- | --- |
| Window | 16:9, black, soft shadow | The same proportions, ground and shadow |
| Corners | About 20 pt | `radius-pip`, 20 pt |
| Close | 33 pt Liquid Glass circle, top left, 8 pt in: clear glass, the picture showing through softened, a thin rim catching the light, a white X | The same, a third bigger: 44 pt (`pip-control`) on a 14-inch MacBook Pro, at your request, and sized for each screen (What the buttons cover, below) |
| Return | 33 pt Liquid Glass circle, top right, 8 pt in, macOS's glyph for leaving picture-in-picture | The same at 44 pt, Back to Claude, with the same glyph |
| Sound | None | The same glass at 44 pt, top right, 60 pt in: beside Back to Claude, 8 pt apart; a speaker with two waves, or with a slash when muted |
| While the controls show | The picture dims a little, so white glyphs read on clear glass | The same (`pip-dim`) |
| Under the pointer | Not in the screenshot | The glass brightens (`pip-glass-hover`). Nothing pops up: no name, no tooltip (your rule) |
| Play, ±10 s, timeline | Centre and bottom | None |

## What the buttons cover, in stage units

The buttons and the minimize handle are sized once for each screen, in proportion to its full window: each is its size on a 14-inch MacBook Pro times the screen's full window width over 716 pt, rounded to a whole point, and keeps that size while the window is resized. So they cover the most of the picture in the smallest window, and about the same part of it on every screen.

| Zone | 716 pt (full size, 14-inch MacBook Pro) | 358 pt (its smallest) |
| --- | --- | --- |
| Close | x 11–70, y 11–70 | x 21–139, y 21–139 |
| Sound | x 821–880, y 11–70 | x 681–799, y 21–139 |
| Back to Claude | x 890–949, y 11–70 | x 821–939, y 21–139 |
| Minimize handle, right quadrant | x 11–48, y 211–329 | x 21–97, y 152–387 |
| Minimize handle, left quadrant | x 912–949, y 211–329 | x 863–939, y 152–387 |

Every screen's smallest window is within 3 stage px of the second column. At full size, close covers the first letters of the KLWD bug and nothing else. In smaller windows the buttons reach further down the picture: in the smallest, they cover the ends of the listing's first row, its plate on the left and its pill on the right, and the wall monitor's header, only while the pointer is on the window and under the dimming. The centre and the ticker, with its clock, stay clear in every window. The minimize handle covers the start of the second and third rows at full size, and in the smallest window the start of all four and of the lower third at the desk: their project plates and its tag, or for a window in a left quadrant the ends of the rows' pills, also only on hover. In the smallest window the handle stays below close, or below Back to Claude in a left quadrant: 4.5 pt on a 14-inch MacBook Pro, and 3.5 to 7.5 pt on the screens in the size table above.

## Minimized to the side

Chosen on PiP Newsroom · Minimize to the side (https://claude.ai/artifact/6go2eqqt2RLHs75exM8Puq), design A. The reference is the picture in picture of iPhone and iPad, which you hide by dragging it off the left or right edge, leaving a tab with an arrow; macOS has no such move.

| Part | Ours |
| --- | --- |
| The handle | A capsule of clear glass, 28 × 88 pt (`pip-handle-width`, `pip-handle-height`) on a 14-inch MacBook Pro and sized for each screen as the buttons are, 8 pt in from the middle of the window's inner edge: the left edge of a window in a right quadrant, the right edge of one in a left quadrant. It shows on hover with the other controls and brightens under the pointer. Apple's `chevron.compact.right` or `chevron.compact.left`, white, 22 pt, points to the side the window goes |
| The tab | The handle at the screen's edge, at the size it has on the window: flat against the side of the visible area, its inner corners rounded, level with the middle of where the window rests. Its glass is dark there, `pip-black` at 55% (`pip-tab-dark`), so the white chevron, turned to point back in, reads over any app. Under the pointer it brightens; nothing pops up. With Transparent window on it fades to 40% with the rest of the window |
| Into the edge | 420 ms on `cubic-bezier(0.65, 0, 0.35, 1)`, the listing's rows leaving. The window slides straight sideways until it has gone; the handle rides along and stops at the edge, and over the last 160 ms its outer corners square off, its glass turns dark and its chevron turns over |
| Out of the edge | 460 ms on `cubic-bezier(0.2, 0.8, 0.2, 1)`, the lower third's entrance. Over the first 160 ms the tab rounds off, clears and turns its chevron, then rides out on the window's inner edge and fades with the controls unless the pointer is on the window |
| After a segment | The window goes back the moment the last outro ends, with no wait; if another story or the hour is waiting, it stays out for that one too |
| With Reduce motion | Nothing slides: the window and the tab cross-fade in 200 ms |
| VoiceOver | The handle: Minimize to the right, or Minimize to the left. The tab: Bring the window back |

The window goes into its own screen's edge and never slides onto a display beside it: the part past the edge is cut away as it goes. With the Dock on that side, the tab sits against the Dock.

## The rules

1. **One layout, scaled uniformly.** The picture is a TV picture, 960 × 540 (`stage-width`, `stage-height`), and scales with the window without reflowing.
2. **Text is 28px or larger** (`legibility-floor`): 8.8 pt in the smallest window, 300 pt wide, and 10.4 pt in a 14-inch MacBook Pro's smallest, 358 pt wide.
3. **Corners stay empty.** No text inside a 64px square at any corner.
4. **The bug sits at x 40**, the title-safe inset, level with the listing; on hover, close covers its first letters. Nothing in the top band reaches x 678, where sound sits in the smallest window on a 1280 × 800 screen (x 681 on a 14-inch MacBook Pro). The clock lives at the bottom right, in the ticker.
5. **The window is its quadrant.** It opens filling its quadrant at 16:9, 20 pt in from every side, never gets bigger, and resizes down to 50% of that.
6. **A smaller size you choose is kept as a share of the quadrant**, so it carries to another screen. The technical reference proposes `$.store` for remembering the corner; the size can sit beside it.

50% for the smallest size was picked by eye on a 14-inch MacBook Pro, on Pipcast Smallest Window (https://claude.ai/artifact/32Ddn39KzeKAYUQnQu1rgc): the window at true size on the whole screen, made smaller with a slider. Changing it touches no frame.
