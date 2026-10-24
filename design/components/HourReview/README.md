# HourReview

THE HOUR IN REVIEW, the full-frame summary of the report on the hour: one glossy row per session with its project, one detail and its state pill.

- Provide `rows`: `{ id, project, state, detail }`, and `span` ("14:00–15:00") for the gold tab, or give `sample`, a scene name; `review-seven` has seven rows on two pages. `label` overrides THE HOUR IN REVIEW.
- Four rows a page, in the listing's order (needs input, error, ready, working), so the two graphics agree. With more than four, a tab at the right end of the header says which page it shows, and with `animate` the pages turn every 10 s, as the listing's do. The report gives each page a desk's 10 s.
- Keep `detail` short: a wait ("Waiting 4 min") or the lines changed ("+182 −40"). Nothing on it drops below 28px.

Used by `Broadcast` in `review` mode, between the desk and the return to the board. A quiet hour skips it.
