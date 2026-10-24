# Pip

The feed as it airs: our own picture-in-picture window, drawn to look like macOS's, with the 960 × 540 stage scaled inside it.

- Provide `width` in pt, and either `sample` (a scene name from `PipNews.samples`, or a run: `loop`, `breaking`, `breaking-ready`, `breaking-complete`, `breaking-error`, `hour`, `quiet-hour`) or `scene` (a scene object). In the product the width comes from the screen: the window fills its quadrant, so `PipNews.pipSize(screenWidth, screenHeight).width`, 716 on a 14-inch MacBook Pro.
- `controls` shows close, Transparent window, sound and Back to Claude as they look on hover; `sound` (`"on"` or `"off"`), `transparent` (`"off"` or `"on"`) and `hover` (`"close"`, `"transparent"`, `"sound"` or `"back"`) pass to them (`PipControls`).
- `blank` draws the window with nothing in it: the window itself, for designing the window.
- `animate` plays the motion: the ticker crawl, Clawd's act and, with a run, the whole run.
- `shadow` (default on) draws the window's shadow; turn it off when the frame is the artboard. `radius` overrides the 20 pt corner. Children replace the broadcast, for a stage of your own.

Use one `Pip` per frame on the station canvas. Do not style the picture from outside: change the tokens or the components.
