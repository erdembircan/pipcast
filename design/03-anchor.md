# Anchor

Clawd is copied, never drawn. The Claude Code engine (version 2.1.299) draws Clawd in the terminal out of quadrant block glyphs. `PipNews.CLAWD_SOURCE` holds those tables verbatim, and `PipNews.clawdGrid()` turns any pose into an 18 × 10 grid of square cells. One glyph becomes 2 × 4 cells, because a terminal quadrant is twice as tall as it is wide. The default pose matches the engine's own 8px Clawd SVG cell for cell.

- Body: `clay`, the engine's `clawd_body` colour. Eyes and eyelids: `clawd-eye`, from that same SVG.
- Never add a mouth, never recolour Clawd, never redraw a pose. A new pose is built only from the engine's pieces.
- Draw Clawd at whole cells (18px at the desk) with crisp edges. Move in whole poses; the bob is at most 6px.
- At the desk Clawd sits behind the desk top. The legs are hidden, the arms rest just above the desk.
- **The anchor slot is fixed:** x 138, y 211 on the stage, 18 × 10 cells of 18px (324 × 180), cut by the desk top at y 328. A 3D Clawd, rendered later in Blender or similar, replaces the pixel one in exactly this slot, so no layout changes when it arrives.

## The engine's pieces

| Piece | Values |
| --- | --- |
| Poses | default, arms-up, look-left, look-right |
| Arms | down, up, one-up |
| Eyes | open, left, right, closed, wink |
| Feet | both, left, right |
| Turn frames | right-12, right-30, right-55, right-75, edge, back-105, back-125, back-150, back, left-75, left-55, left-30, left-12 |

## Acts: what Clawd does on air

Each act is ours, built only from the pieces above. A static frame shows the act's key pose.

| Act | When | Moving | Key pose |
| --- | --- | --- | --- |
| idle | Waiting between stories | Blinks every 3.8 s; glances left now and then | default |
| talk | Reading a story: WORK COMPLETE, the hour | Arms beat down and one-up; bobs 2px | default |
| urgent | Needs your input | One arm up, then both; quick bob | one arm up |
| cheer | READY FOR REVIEW | Arms up and down; hops 6px | arms up |
| swivel | Start of a desk segment | Turns from edge-on to the camera in 0.5 s | facing the camera |
| glance | Looking at the wall monitor: STOPPED ON AN ERROR | Eyes right for half of every 5 s | eyes right |

Clawd has no mouth, so Clawd talks with arm beats and the bob, timed with the lower third's reveal. The words are always on screen.

## Still open in this stage

- Does Clawd also appear on the live board, small, at the desk's edge? Or only when the feed cuts to the desk?
- Which act opens every desk segment: swivel first, then the event's act?
