// Everything the video sounds like: the soundtrack (scripts/music/score.js,
// rendered into public/audio by scripts/prepare.mjs), KLWD's own four jingles
// from plugin/station/sounds where the station plays them, its beat, laid where
// the station plays it from the same folder's loops (scripts/render-beat.mjs),
// and small sound effects for clicks, windows and camera moves.
import { Html5Audio, Sequence, interpolate, staticFile } from 'remotion'

import { HUSH_MS } from '../../packages/contract/src/constants.ts'

import breaking from '../../plugin/station/sounds/breaking.m4a'
import breakingOut from '../../plugin/station/sounds/breaking-out.m4a'
import hour from '../../plugin/station/sounds/hour.m4a'
import hourOut from '../../plugin/station/sounds/hour-out.m4a'
import {
  CLICK_ALLOW,
  CLICK_BACK,
  CLICK_BROWSER,
  CLICK_BROWSER_AGAIN,
  CLICK_HANDLE,
  CLICK_TAB,
  CLICK_TUNE_IN,
  DESKTOP_BACK,
  DESKTOP_OUT,
  DRAG_DOWN,
  DRAG_UP,
  RESIZE_DOWN,
  RESIZE_UP,
} from './scenes/Desk.tsx'
import { FPS, JINGLES, NEWS, SCENES } from './timeline.ts'

const JINGLE_FILES: Record<string, string> = { breaking, 'breaking-out': breakingOut, hour, 'hour-out': hourOut }

// Measured on the rendered video: about -16.4 LUFS integrated, with the true
// peak under -1 dBFS. The jingles and the beat keep their own level, as the
// station plays them; under them the soundtrack breaks down instead of
// stopping.
const MUSIC_VOLUME = 0.87
const JINGLE_VOLUME = 0.9
/** The hour's sign-off ends on its loudest chord, which lands on the music's fill into the groove: a little lower, so the encoded peak stays under -1 dBFS */
const JINGLE_TRIM: Record<string, number> = { 'hour-out': 0.85 }
const SFX_VOLUME = 0.3

type Sfx = 'click' | 'whoosh' | 'pop' | 'key' | 'thunk' | 'swoosh-up'

/** The sound effects, in global seconds, each with its level: the clicks, the desktops sliding, the window coming on, docking and landing, and two swishes at the big turns */
const SFX: Array<{ at: number; name: Sfx; level?: number }> = [
  { at: SCENES.name - 0.3, name: 'swoosh-up', level: 0.5 },
  { at: CLICK_TUNE_IN, name: 'click' },
  { at: CLICK_BROWSER, name: 'click' },
  { at: CLICK_BROWSER + 0.03, name: 'pop', level: 0.8 },
  { at: CLICK_BACK, name: 'click' },
  { at: CLICK_ALLOW, name: 'click' },
  { at: CLICK_BROWSER_AGAIN, name: 'click' },
  { at: CLICK_BROWSER_AGAIN + 0.03, name: 'pop', level: 0.8 },
  { at: DESKTOP_OUT, name: 'whoosh', level: 0.4 },
  { at: DESKTOP_BACK, name: 'whoosh', level: 0.4 },
  { at: DRAG_DOWN, name: 'click', level: 0.8 },
  { at: DRAG_UP, name: 'click', level: 0.6 },
  { at: DRAG_UP + 0.15, name: 'thunk', level: 0.45 },
  { at: CLICK_HANDLE, name: 'click' },
  { at: CLICK_HANDLE + 0.42, name: 'thunk', level: 0.6 },
  // The news over, the window docks in the side again by itself
  { at: NEWS.board + 0.47, name: 'thunk', level: 0.5 },
  { at: CLICK_TAB, name: 'click' },
  { at: CLICK_TAB + 0.05, name: 'whoosh', level: 0.35 },
  { at: RESIZE_DOWN, name: 'click', level: 0.7 },
  { at: RESIZE_UP, name: 'click', level: 0.5 },
  { at: SCENES.finale + 0.2, name: 'swoosh-up', level: 0.55 },
]

/** A jingle's level; one whose story is cut (Back to Claude) fades out as the station hushes it */
function jingleVolume(name: string, at: number, cut?: number, trim = 1) {
  const level = JINGLE_VOLUME * (JINGLE_TRIM[name] ?? 1) * trim
  if (cut === undefined) return level
  const f0 = (cut - at) * FPS
  return (f: number) => level * interpolate(f, [f0, f0 + (HUSH_MS / 1000) * FPS], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}

export function Soundtrack({ music, beat }: { music: boolean; beat: boolean }) {
  return (
    <>
      {music ? <Html5Audio src={staticFile('audio/music.wav')} volume={MUSIC_VOLUME} /> : null}
      {beat ? <Html5Audio src={staticFile('audio/beat.wav')} volume={JINGLE_VOLUME} /> : null}
      {JINGLES.map((j) => (
        <Sequence key={`${j.name}-${j.at}`} from={Math.round(j.at * FPS)} layout="none" name={`jingle: ${j.name}`}>
          <Html5Audio src={JINGLE_FILES[j.name]!} trimBefore={Math.round(j.from * FPS)} volume={jingleVolume(j.name, j.at, 'cut' in j ? j.cut : undefined, 'level' in j ? j.level : 1)} />
        </Sequence>
      ))}
      {music
        ? SFX.map((s) => (
            <Sequence key={`${s.name}-${s.at}`} from={Math.round(s.at * FPS)} layout="none" name={`sfx: ${s.name}`}>
              <Html5Audio src={staticFile(`audio/sfx-${s.name}.wav`)} volume={SFX_VOLUME * (s.level ?? 1)} />
            </Sequence>
          ))
        : null}
    </>
  )
}
