# NewsDesk

The studio for a news flash: the city through the studio window, drawn on the same pixel grid as Clawd, a key light in the story's colour, and Clawd behind the anchor desk.

The city follows the clock. `time` ("14:33"; the Broadcast passes the scene's clock) picks the part of the day, or `part` sets it:

| Part | From | The city |
| --- | --- | --- |
| Morning | 05:00 | A pale sky warming to peach at the horizon, a low sun behind the towers, blue-grey towers, a few windows lit |
| Afternoon | 11:00 | A clear blue sky, lighter towers, windows reflecting the sky, none lit |
| Evening | 17:00 | The station's own dusk: navy to violet to a coral glow, a third of the windows lit, red beacons on the masts |
| Night | 21:00 | A dark sky with stars, near-black towers, close to half the windows lit and one in ten blue with television, red beacons |

The towers and windows are the same at every hour; only the light changes. With no time and no part it shows the evening.

The desk runs the full width of the stage and is one solid piece, so nothing behind it shows through at any window size. Its glossy blue top is seen from just above, from Clawd's line at y 328 to a front edge that bows toward the camera (y 348 at the sides, 353 at the centre), and catches the key light under Clawd. A chrome lip with a gold trim runs along that edge, ending above the lower third. The front below is panelled, its centre panel backlit.

On the desk: the station mug left of Clawd (white, with the station's blue tab) and the script in front of Clawd, a stack of pages with a loose top page, its blue header band and lines of type. Both are drawn like the graphics, not in pixels.

- Provide `kind`; Clawd plays the story's act (urgent for needs your input, cheer for READY FOR REVIEW, talk for WORK COMPLETE and the hour, glance for an error) unless `act` names another. `pose`, `eyes`, `arms` and `facing` pin a frame for a storyboard.
- `animate` plays Clawd's act.
- It fills the 960 × 540 stage; `OTSBox` and `LowerThird` go on top of it.

Clawd's slot is fixed at x 138, y 211, 18px cells, so a 3D render can take it later without moving anything else.
