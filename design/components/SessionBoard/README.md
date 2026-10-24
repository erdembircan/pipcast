# SessionBoard

The listing, as the first station sketch drew it: one glossy blue row per tracked session, split hard across the middle, with the session's title as it is written and its state on a pill at the right. Four rows a page.

- Provide `sessions`: `{ id, name, project, state }` with `state` one of `needs-input`, `error`, `ready`, `working`. Or give `sample`, a scene name; `board-seven` has seven sessions on two pages.
- Rows sort INPUT, ERROR, READY, LIVE unless `sort` is off.
- Titles truncate with an ellipsis rather than shrink.
- With more than four sessions the board shows four a page, and a tab under the pills says which page it shows (1 OF 2), on the ticker clock's blue. With `animate` the page turns every 8 s: each row leaves to the right as BREAKING NEWS's words leave in its outro, and once it has gone the next page's row slides in from the left as the lower third does, rows 110 ms apart from the top, the tab last. The clock starts when the board appears, so it always comes back on its first page. A session that tunes in or out or changes state while a page is up takes its place at the next turn. With reduced motion a turn is a cut. Without `animate` the board holds its first page.
- Four or fewer: one page, no tab, drawn as the sessions come.

Never show more than four rows at once: the text would fall under the 28px floor.
