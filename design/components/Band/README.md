# Band

What the mod draws in the band above the prompt box of the Claude desktop app: one plate and nothing else. KLWD in chrome on the studio plate, and at its end the action: TUNE IN puts this session on KLWD, TUNE OUT takes it off. There is no count, no status line and no on-air or off-air text. The Band section has the rules.

- `tuned`: this session is on air, and the plate says TUNE OUT.
- `parts`: outlines the plate, for the build board.

In the mod the plate is one `Svg` picture, 22 px tall (`band-height`), its words as outlines, with a blank native `Button` laid over it. It carries its own ground, so it reads the same on the app's light and dark themes. This component draws it with the package's classes (`pn-mark` and the band's own) for review boards. Show it in the app with `PromptSketch`.
