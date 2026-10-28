# Ticker

The crawl along the bottom of the stage, and the clock: a slanted red LATEST tab, the stories still running in white on studio-deep under a gold rule with gold diamonds between them, and the time in a slanted blue box at the right end, where news channels keep it.

- Provide `items`: strings, or `{ lead, text, key }`, where `lead` is a caps word such as BREAKING, STILL WAITING or COMING UP, set in gold, and `key` says what the line is about (a story, a session), so the crawl still knows the line when its words change. Provide `time` ("14:32", 24-hour). Or give `sample`, a scene name, for both.
- `animate` crawls right to left at a steady 53 px a second (`PipNews.crawlSpeed`), whatever it carries. Each item comes on out of sight behind the clock and keeps its words until it has gone past the tab, so nothing changes while it is read. A new list changes only what comes next: the crawl takes the list in rounds, top to bottom, each item once a round, so news at the top comes on next. Each item, with its diamond, rides a run of its own that the compositor plays (`PipNews.crawlRun`), so the crawl keeps its pace however busy the page is, and nothing comes on but from behind the clock: if the page was held up long enough for the crawl's end to come into view, that stretch stays empty. Without the Web Animations API the crawl stands still.
- One crawl runs per `Stage`: a Ticker drawn after a cut, or after a stinger, carries on where the last one left off. While the page is hidden the crawl stands still, and it carries on from there when the page shows again. Outside a Stage each Ticker crawls on its own. With reduced motion the crawl stands still.
- A static frame shows the items from the start; `offset` (px) shows the crawl mid-way.
- `label` replaces LATEST.

Nothing covers the ticker, hover included, so it can carry news and the time of its own. It steps aside during a stinger and the ident on the hour.
