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
| Resizes down, never up | Drag an edge or a corner to make it smaller, to 70% of its quadrant size at most; it keeps 16:9 and its outer corner stays put | Your rule; 70% is a first figure |
| Close stops tracking | Ending the overlay is what stopping tracking does: every session goes off the air at once. The band's TUNE OUT takes one session off (The band) | README, "Stop tracking" |
| Back to Claude brings Claude forward | The window then hides by itself, because Claude is in front | `Visibility.swift` |
| Sound on and off | The sound button on hover switches the jingles on and off. Sound starts on and the window remembers the choice; it plays at the Mac's volume | Your rule |
| Fades while the pointer is elsewhere, with Transparent window on | The whole window shows at 40% (`pip-faded`), so what is under it reads through, and turns solid with the controls as the pointer reaches it; a drag that starts on it keeps it solid. Every segment airs the same way, BREAKING NEWS included | Your rule; 40% is a first figure |
| Shows only while something is tracked | With no tracked session there is no window at all | Your rule |
| Tracks every session tuned in | No limit: the listing shows four a page and turns to the next every 8 s | Your rule |

## Size: the quadrant

**The window's size is its quadrant.** It fills its quadrant at 16:9, 20 pt in from every side (`pip-margin`): from the screen's edges, as in the proof of concept, and from the centre lines, so it never crosses into the next quadrant. It opens at that size and never gets bigger. You can make it smaller, down to 70% of that size (`pip-min-scale`). The size is worked out again whenever the window moves to another screen or the screen changes.

A quadrant is a little taller than 16:9 on most Mac screens, so the window fills its quadrant's width and leaves a strip of desktop above or below. On a very wide screen it is the other way round.

| Screen (visible area, pt) | Quadrant | Window, full size | Smallest, 70% |
| --- | --- | --- | --- |
| 1280 × 800 | 640 × 400 | 600 × 338 | 420 × 236 |
| 13-inch MacBook Air, 1470 × 956 | 735 × 478 | 695 × 391 | 486 × 273 |
| 14-inch MacBook Pro, 1512 × 982 | 756 × 491 | 716 × 403 | 501 × 282 |
| 16-inch MacBook Pro, 1728 × 1117 | 864 × 558 | 824 × 464 | 577 × 325 |
| 27-inch display, 2560 × 1440 | 1280 × 720 | 1209 × 680 | 846 × 476 |
| 34-inch ultrawide, 3440 × 1440 | 1720 × 720 | 1209 × 680 | 846 × 476 |

`PipNews.pipSize(width, height)` gives the full size and `PipNews.pipRange(width, height)` both sizes. The station canvas shows every frame at the 14-inch MacBook Pro's full size, 716 × 403 pt.

## The look, taken from the screenshot

The screenshot's aspect (2000 × 1299, 1.54) matches a 14-inch MacBook Pro display at 1512 × 982 pt, so 1 pt = 1.32 screenshot px. Every figure is ±2 pt.

| Part | macOS's picture-in-picture, as captured | Ours |
| --- | --- | --- |
| Window | 16:9, black, soft shadow | The same proportions, ground and shadow |
| Corners | About 20 pt | `radius-pip`, 20 pt |
| Close | 33 pt Liquid Glass circle, top left, 8 pt in: clear glass, the picture showing through softened, a thin rim catching the light, a white X | The same, a third bigger: 44 pt (`pip-control`), at your request |
| Return | 33 pt Liquid Glass circle, top right, 8 pt in, macOS's glyph for leaving picture-in-picture | The same at 44 pt, Back to Claude, with the same glyph |
| Sound | None | The same glass at 44 pt, top right, 60 pt in: beside Back to Claude, 8 pt apart; a speaker with two waves, or with a slash when muted |
| While the controls show | The picture dims a little, so white glyphs read on clear glass | The same (`pip-dim`) |
| Under the pointer | Not in the screenshot | The glass brightens (`pip-glass-hover`). Nothing pops up: no name, no tooltip (your rule) |
| Play, ±10 s, timeline | Centre and bottom | None |

## What the buttons cover, in stage units

The buttons keep their size in points, so they cover the most of the picture in the smallest window.

| Zone | 716 pt (full size, 14-inch MacBook Pro) | 420 pt (the smallest on any screen) |
| --- | --- | --- |
| Close | x 11–70, y 11–70 | x 18–119, y 18–119 |
| Sound | x 821–880, y 11–70 | x 722–823, y 18–119 |
| Back to Claude | x 890–949, y 11–70 | x 841–942, y 18–119 |

At full size, close covers the first letters of the KLWD bug and nothing else. In smaller windows the buttons reach further down the picture: in the smallest, 420 pt, they also cover the top of the listing's first row and of the wall monitor's header, only while the pointer is on the window and under the dimming. The centre, the lower third and the ticker, with its clock, stay clear in every window.

## The rules

1. **One layout, scaled uniformly.** The picture is a TV picture, 960 × 540 (`stage-width`, `stage-height`), and scales with the window without reflowing.
2. **Text is 28px or larger** (`legibility-floor`): 12.3 pt in the smallest window, 420 pt wide.
3. **Corners stay empty.** No text inside a 64px square at any corner.
4. **The bug sits at x 40**, the title-safe inset, level with the listing; on hover, close covers its first letters. Nothing in the top band reaches x 722, where sound sits in the smallest window. The clock lives at the bottom right, in the ticker.
5. **The window is its quadrant.** It opens filling its quadrant at 16:9, 20 pt in from every side, never gets bigger, and resizes down to 70% of that.
6. **A smaller size you choose is kept as a share of the quadrant**, so it carries to another screen. The technical reference proposes `$.store` for remembering the corner; the size can sit beside it.

70% for the smallest size is a first figure: changing it touches no frame.
