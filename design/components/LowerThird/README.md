# LowerThird

The headline of a news flash: a slanted glossy tab (red BREAKING for every story, gold for the hour), the event in chrome-white caps on a glossy blue bar with gold edges, and the session on a dark strap underneath.

- Provide `kind` (`needs-input`, `ready`, `complete`, `error` or `hourly`), `session` and `project`. The tab and headline come from the event's fixed vocabulary; `tag`, `headline` and `strap` override them, and the hour uses them for its counts.
- It sits at `lower-third-top` (y 364) and ends at y 460, above the ticker.
- With `animate` on its stage, it slides in over 460 ms, the strap follows 150 ms later, and a glint crosses the headline every 5 s.

Do not put the session title in the headline: the event is the headline, the session is the strap.
