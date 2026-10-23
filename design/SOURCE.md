# The design system

This folder began as a copy of the PiP Newsroom design system, which defines everything KLWD looks and sounds like: the graphics, the motion, the jingles' scores, and the rules for what airs when. The artifact is the design's prototype; this folder is what the product draws with, and it changes here when the product needs it to.

- Source: https://claude.ai/artifact/GnLta8btVSfqWWe83uPvcx
- Copied from version 48 (`1792599111-0a56`) on 21 October 2026
- Changed here since:
  - The board's ring (22 October 2026). It sends out its signal, a wave every 3 s that keeps time with the clock, as chosen on PiP Newsroom · Board motion (https://claude.ai/artifact/3cbyt3B4yT8ttGrM6tCiVk), and an outro's board now shows the ring as it fades in. The artifact keeps the still ring.
  - Stacking, in Event desks (22 October 2026). Only what lands while you are away from Claude airs: the stories waiting when you switch to Claude are dropped, and so is a story that lands while you are there. The report on the hour still waits. The artifact still has stories wait in the ticker while the window is hidden.
  - The Ticker's crawl (22 October 2026). It moves on a belt at a steady 53 px a second instead of a CSS animation, keeps each item's words until it has gone past the tab, and carries on across cuts. The artifact keeps its old crawl.
  - The Ticker's belt (23 October 2026). It is a layer of its own (`will-change: transform`), so the crawl moves it each frame and redraws nothing, and the window takes about a quarter less of the Mac's processor while it shows. The artifact has no belt.
  - Data sources (23 October 2026). Lines changed are counted in every working tree a session's work runs in, a subagent's worktree among them, after each call that can change files, so they reach the hour they are written in and a commit keeps them. The artifact still counts them with git as each turn starts and ends.
  - The chrome words (24 October 2026). BREAKING NEWS and the hour's words draw their outline on a layer of its own under the chrome, so it runs round the outside of each letter. Stroked on the letters themselves, it also traced where the font's pieces overlap, and each R showed a dark box where its bowl meets its leg. The artifact still strokes the letters.
- The designs: PiP Newsroom · Station (https://claude.ai/artifact/LaUs1pnGjjsvs9W2PfR6hS), PiP Newsroom · Window (https://claude.ai/artifact/D4c6cARgruAfEgBvdoUt8Q) and PiP Newsroom · Band (https://claude.ai/artifact/LrMxrQF2mTCNXeLssgf9j1)

The broadcast draws with `components/bundle.js` and `components/bundle.css` as they are. Make the product's changes here and list them above. Copying the artifact's files over this folder again would undo them, so bring anything new from the artifact across by hand.

`components/Band`, `components/PromptSketch`, `components/Pip`, `components/PipControls` and `components/PlayWithSound` are review-board pieces. The product draws the band in the mod and the window natively, so they are here as the reference those follow, not as code that runs.
