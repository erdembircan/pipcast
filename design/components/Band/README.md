# Band

What the mod draws in the band above the prompt box of the Claude desktop app: the chip and a tab, and nothing else. TUNE IN puts this session on KLWD, TUNE OUT takes it off. There is no status line and no on-air or off-air text. The Band section has the rules.

- `onAir`: sessions on KLWD across the Mac, 0 to 4, this one included when `tuned`.
- `tuned`: this session is on air. The tab says TUNE OUT and this session's cell is gold.
- With four on air and this one off, KLWD is full: TUNE IN is drawn dim, with no button over it.
- `parts`: outlines the two pieces, for the build board.
- Suggestions, not decided: `pill`, this session's state (`working`, `needs-input`, `ready`, `error`) on a pill beside TUNE OUT; `states`, each on-air session's state, comma-separated with this one first, colouring the cells.

In the mod the chip and each tab are `Svg` pictures, 22 px tall (`band-height`), their words as outlines; each tab has a blank native `Button` laid over it. Each piece carries its own ground, so it reads the same on the app's light and dark themes. This component draws them with the package's classes (`pn-mark`, `pn-l3-tag`, `pn-ticker-clock`) for review boards. Show it in the app with `PromptSketch`.
