# Ticker

The crawl along the bottom of the stage, and the clock: a slanted red LATEST tab, the stories still running in white on studio-deep under a gold rule with gold diamonds between them, and the time in a slanted blue box at the right end, where news channels keep it.

- Provide `items`: strings, or `{ lead, text }` where `lead` is a caps word such as BREAKING, STILL WAITING or COMING UP, set in gold. Provide `time` ("14:32", 24-hour). Or give `sample`, a scene name, for both.
- `animate` crawls right to left, one pass every 40 s; the crawl runs out behind the clock, which stays put. A static frame can set `offset` (px) to show the crawl mid-way.
- `label` replaces LATEST.

Nothing covers the ticker, hover included, so it can carry news and the time of its own. It steps aside during a stinger and the ident on the hour.
