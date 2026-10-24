# SessionBoard

The listing, as the first station sketch drew it: one glossy blue row per tracked session, split hard across the middle, with the session's project on a plate at the left, its title as it is written, and its state on a pill at the right. Four rows a page.

- Provide `sessions`: `{ id, name, project, state }` with `state` one of `needs-input`, `error`, `ready`, `working`. Or give `sample`, a scene name; `board-seven` has seven sessions on two pages.
- Rows sort INPUT, ERROR, READY, LIVE unless `sort` is off.
- The project leads its row on a plate: the strap's dark ground under a gold rule, leaning forward like every tab, the name in caps. The plate is 200 wide whatever the name, so the titles start in line; a name longer than the plate is cut with an ellipsis. A session with no `project` has no plate.
- Titles truncate with an ellipsis rather than shrink.
- With more than four sessions the board shows four a page, and a tab under the pills says which page it shows (1 OF 2), on the ticker clock's blue. With `animate` the page turns every 8 s: each row leaves to the right as BREAKING NEWS's words leave in its outro, and once it has gone the next page's row slides in from the left as the lower third does, rows 110 ms apart from the top, the tab last. The clock starts when the board appears, so it always comes back on its first page. A session that tunes in or out or changes state while a page is up takes its place at the next turn. With reduced motion a turn is a cut. Without `animate` the board holds its first page.
- Provide `limits`, `{ kind, percent }` with `kind` `session` or `week` and `percent` a whole percent, to show the account's usage limits under the listing, on the page tab's line: SESSION, then WEEK, each its name in gold caps, a meter filled to the share used, and the figure. From 70% the meter and the figure turn gold, from 90% red. They stay put while the pages turn; without `limits` there are none. `board-limits` and `board-limits-near` show them.
- Four or fewer: one page, no tab, drawn as the sessions come.

Never show more than four rows at once: the text would fall under the 28px floor.
