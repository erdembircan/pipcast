# SessionBoard

The listing, as the first station sketch drew it: one glossy blue row per tracked session, split hard across the middle, with the session's title as it is written and its state on a pill at the right.

- Provide `sessions`: `{ id, name, project, state }` with `state` one of `needs-input`, `error`, `ready`, `working`. Or give `sample`, a scene name.
- Rows sort INPUT, ERROR, READY, LIVE unless `sort` is off. Four rows at most: what airs with none and with five or more is still open.
- Titles truncate with an ellipsis rather than shrink.

Never show more than four rows at once: the text would fall under the 28px floor.
