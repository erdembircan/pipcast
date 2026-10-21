# HourReview

THE HOUR IN REVIEW, the full-frame summary of the report on the hour: one glossy row per session with its project, one detail and its state pill.

- Provide `rows`: `{ id, project, state, detail }`, and `span` ("14:00–15:00") for the gold tab, or give `sample`, a scene name. `label` overrides THE HOUR IN REVIEW.
- Four rows at most, in the listing's order (needs input, error, ready, working), so the two graphics agree.
- Keep `detail` short: a wait ("Waiting 4 min") or the lines changed ("+182 −40"). Nothing on it drops below 28px.

Used by `Broadcast` in `review` mode, between the desk and the return to the board. A quiet hour skips it.
