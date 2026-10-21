# PlayWithSound

Review-board furniture, never part of the window: the window playing a run, and under it a button that plays the run again from the start with its jingles, each cued to its moment: BREAKING NEWS's intro jingle as each intro starts, its outro jingle as each outro starts, and the hour's two as its ident and its outro start. Browsers only make sound after a click, which is why the button is there; the window's own controls stay close, sound and Back to Claude.

- `sample`: a run, `"breaking"`, `"breaking-ready"`, `"breaking-complete"` or `"breaking-error"` (the board, the intro, the desk, the outro, back to the board), or `"hour"` and `"quiet-hour"` (the report on the hour, ident to outro).
- `jingle` and `cue` only matter for a run with no intro or outro: the one jingle to play, and when.
- `caption`: a line next to the button, in the review boards' caption style.
