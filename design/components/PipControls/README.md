# PipControls

Our window's four controls, as they look on hover, in the Liquid Glass of macOS's picture-in-picture: clear glass circles, 44 pt (`pip-control`), a third bigger than macOS's 33 pt, 8 pt in from the top corners, the picture showing through softened and lifted, with a sheen from above and a rim that catches the light at the top left and bottom right (`pn-glass`). While they show, the picture dims a little (`pip-dim`) so the white glyphs read on any frame, as Apple asks of clear glass over media. Close sits at the top left; Transparent window, sound and Back to Claude at the top right, 8 pt apart, with Back to Claude in the corner. The glyphs follow Apple's: an X; a window with solid contents, or the same window with its contents a checkerboard while Transparent window is on; a speaker with two waves, or crossed by a slash; the window behind with an arrow out of its corner and a solid window in front, for leaving picture-in-picture.

Review boards mimic the glass with CSS (a light blur, a white tint, the sheen and the rim); the app uses macOS's own Liquid Glass, which also bends the picture at the edges.

- Provide `width` in pt. The buttons keep their point size, so they cover more of a smaller window.
- `sound`: `"on"` (the default) or `"off"`, the state the sound button shows: a speaker with two waves, or crossed by a slash.
- `transparent`: `"off"` (the default) or `"on"`, the state the Transparent window button shows: a window with solid contents, or its contents a checkerboard, see-through.
- `hover`: `"close"`, `"transparent"`, `"sound"` or `"back"`, the button under the pointer. Its glass brightens (`pip-glass-hover`). Nothing pops up, no name and no tooltip; the names (Stop tracking, Make the window transparent or Make the window solid, Mute or Unmute, Back to Claude) are for VoiceOver only.
- Close stops tracking, and with nothing tracked there is no window. Transparent window turns the setting over, the same Claude Code plugin option `/pipcast transparency` sets: while it is on, the window fades to 40% (`pip-faded`) whenever the pointer is elsewhere. Sound switches the jingles on and off; it starts on and the window remembers the choice. Back to Claude brings the Claude desktop app forward, and the window hides because Claude is in front.

There is no play, skip or timeline: nothing else sits on the picture. Usually mounted through `Pip` with `controls`.
