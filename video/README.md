# The Pipcast video

The demo video, made with [Remotion](https://www.remotion.dev). Everything KLWD shows in it is the product's own: the design system's components from `design/components`, the band's plate from `packages/mod`, the words from `packages/contract`, the jingles from `plugin/station/sounds` and the icon's layers from `assets/icon-layers`. Nothing here changes them.

```bash
npm ci
```

```bash
npm run studio
```

opens Remotion Studio. `npm run render` renders the video to `out/pipcast.mp4`, and `npm run render:4k` at twice the size, for YouTube. `out/` is not committed.

## How it is put together

- `src/timeline.ts` is the running order: when each scene starts, where each jingle plays, and the soundtrack's plan. The picture and the music both read it, so a cut moved there moves the music with it.
- `src/program.ts` and `src/stories.ts` are what KLWD airs at each second: the board, each story's BREAKING NEWS, desk and outro, and the report on the hour.
- `src/design` plays the design system's components frame by frame. The opens and outros take their progress, the crawl its offset, Clawd his pose, and the CSS motion a custom property per frame (`motion.ts`), so every frame is the same picture however it is rendered. For the same reason the window's glass controls are drawn without `backdrop-filter`: headless Chrome leaves a backdrop-filtered layer out of some of its frames, and the controls blinked.
- `src/desktop` is the Mac: the wallpaper, the menu bar, the Claude desktop app, a browser and the pointer.
- `src/stage` is the screen at one moment (`Screen.tsx`) and the fixed frame it sits in on the paper (`Frame.tsx`). The camera only zooms inside that frame, never wider than the whole screen and never past its edges, and it holds perfectly still between moves. The scenes keep it on the whole screen and lean in only to read something: a second to get there, under three seconds there, a second back.
- `src/look/HeadlineBand.tsx` is the line above the frame that says what is happening, one line at a time.
- `src/scenes` are the scenes: the cold open, the name card, the desktop session from tuning in to the window's tricks (`Desk.tsx`, one script for the camera, the pointer, the windows and KLWD), and the finale, where the frame becomes the icon's tile and the icon builds itself, its signal going out of the beacon a ring at a time on the music's notes.
- `src/Soundtrack.tsx` lays the soundtrack, the jingles and the sound effects on the picture, at levels measured as a mix: about -16 LUFS, with the true peak under -1 dBFS.
- `scripts/music/score.js` is the soundtrack's score, in D major around the station's four-note logo, with the jingles' own instruments. It follows the plan in `src/timeline.ts` and never stops: only while a jingle plays does it break down, to a held D under BREAKING NEWS (which brings its own beat) and to a soft D major pad under the hour's fanfare, and as soon as the jingle is done its beat comes back over the D until the groove returns. `scripts/render-audio.mjs` renders it and the sound effects in Chrome, as `scripts/render-jingles.mjs` renders the jingles.
- `scripts/prepare.mjs` runs before the studio and every render: it copies the design system's stylesheet without its Google Fonts import, copies the icon's layers as markup, and renders the soundtrack in Chrome when its score changed. What it makes is in `src/generated` and `public/audio`, which are not committed.
- `scripts/stills.mjs <composition> <dir> <seconds...>` renders single frames, for checking a change without rendering the video.
