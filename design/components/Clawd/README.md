# Clawd

The anchor: Clawd, the Claude Code mascot, rendered from the engine's own glyph tables as an 18 × 10 grid of square cells.

- Provide `cell` (px per cell; 18 at the desk) and either `act` (idle, talk, urgent, cheer, swivel, glance) or a fixed frame: `pose` (default, arms-up, look-left, look-right), `eyes` (open, left, right, closed, wink), `arms` (down, up, one-up), `feet` (both, left, right) or `facing` (one of the 13 turn frames).
- `animate` plays the act; without it you get the act's key pose.
- `label` replaces the accessible name.

Never redraw, recolour or add a mouth: change `CLAWD_SOURCE` only by copying a newer engine's tables. The Anchor section lists every piece and act.
