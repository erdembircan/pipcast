// The Mac at work, from tuning in to the window's tricks, as one continuous
// session: the camera, the pointer, the windows and KLWD all run on one
// script in global seconds, so nothing jumps between the sections.
import { Easing } from 'remotion'

import { PLATE } from '../desktop/ClaudeApp.tsx'
import { CLAUDE_WINDOW, pipFrame } from '../desktop/geometry.ts'
import { ease, mix, seg } from '../lib/anim.ts'
import { HeadlineBand } from '../look/HeadlineBand.tsx'
import type { Line } from '../look/HeadlineBand.tsx'
import { Paper } from '../look/Paper.tsx'
import { Frame, WIDE } from '../stage/Frame.tsx'
import { Screen } from '../stage/Screen.tsx'
import type { PipState, TabState } from '../stage/Screen.tsx'
import { ASK, HOUR, NEWS, SCENES } from '../timeline.ts'
import { AirAt, cameraPath, pressAt, trackPointer, viewAt } from './common.tsx'
import type { PointerKey } from './common.tsx'

const BR = pipFrame('bottom-right')
const TL = pipFrame('top-left')

// Where things are on the screen
const TUNE_IN_AT = { x: CLAUDE_WINDOW.x + PLATE.x + 108, y: CLAUDE_WINDOW.y + PLATE.y + 11 }
const BROWSER_AT = { x: 1362, y: 430 }
const PARK = { x: 640, y: 420 }
const BACK_BR = { x: BR.x + BR.w - 8 - 22, y: BR.y + 8 + 22 }
const ALLOW = { x: 1088, y: 678 }
const GRAB = { x: 1180, y: 700 }
const DROP = { x: 424, y: 300 }
const HANDLE_TL = { x: TL.x + TL.w - 8 - 14, y: TL.y + TL.h / 2 }
const TAB_AT = { x: 14, y: TL.y + TL.h / 2 }
/** Where the pointer waits, off the window, while the news brings it out of the side */
const REST = { x: 900, y: 520 }
const RESIZE_FROM = { x: TL.x + TL.w - 2, y: TL.y + TL.h - 2 }
const SMALL_W = Math.round(TL.w * 0.75)
const RESIZE_TO = { x: TL.x + SMALL_W - 2, y: TL.y + Math.round((SMALL_W * 9) / 16) - 2 }

// When things happen, in global seconds
export const CLICK_TUNE_IN = 20.0
export const CLICK_BROWSER = 25.6
export const CLICK_BACK = ASK.back
export const CLICK_ALLOW = 46.2
export const CLICK_BROWSER_AGAIN = 49.2
/** Over to the second desktop and back again, as a swipe or Control-arrow does it */
export const DESKTOP_OUT = 65.6
export const DESKTOP_BACK = 67.4
export const DRAG_DOWN = 69.3
export const DRAG_UP = 70.65
export const CLICK_HANDLE = 72.3
export const CLICK_TAB = 80.2
export const RESIZE_DOWN = 82.25
export const RESIZE_UP = 83.7

const POINTER: PointerKey[] = [
  { t: 16.0, p: { x: 860, y: 560 } },
  { t: 17.6, p: { x: 845, y: 590 } },
  { t: 19.6, p: TUNE_IN_AT },
  { t: 20.35, p: TUNE_IN_AT },
  { t: 21.2, p: { x: 600, y: 812 } },
  { t: 24.3, p: { x: 600, y: 812 } },
  { t: 25.25, p: BROWSER_AT },
  { t: 25.9, p: BROWSER_AT },
  { t: 26.9, p: PARK },
  { t: 41.6, p: PARK },
  { t: 43.4, p: BACK_BR },
  { t: 44.05, p: BACK_BR },
  { t: 45.8, p: ALLOW },
  { t: 46.6, p: ALLOW },
  { t: 47.4, p: { x: 1150, y: 760 } },
  { t: 48.8, p: BROWSER_AT },
  { t: 49.45, p: BROWSER_AT },
  { t: 50.4, p: PARK },
  // The desktops slide under a pointer that stays where it is
  { t: 68.0, p: PARK },
  { t: 69.0, p: GRAB },
  { t: DRAG_DOWN, p: GRAB },
  { t: DRAG_UP - 0.05, p: DROP, e: ease.inOut },
  { t: 71.0, p: DROP },
  { t: 72.0, p: HANDLE_TL },
  { t: 72.6, p: HANDLE_TL },
  // Off the window while the news brings it out of the side and sends it back
  { t: 73.5, p: REST },
  { t: 79.0, p: REST },
  { t: 79.95, p: TAB_AT },
  { t: 80.5, p: TAB_AT },
  { t: 81.9, p: RESIZE_FROM },
  { t: RESIZE_DOWN, p: RESIZE_FROM },
  { t: RESIZE_UP - 0.05, p: RESIZE_TO, e: ease.inOut },
  { t: 84.0, p: RESIZE_TO },
  { t: 85.1, p: { x: 860, y: 560 } },
]

export const pointerAt = (T: number) => trackPointer(T, POINTER)

const INTO = Easing.bezier(0.65, 0, 0.35, 1)
const OUT_OF = Easing.bezier(0.2, 0.8, 0.2, 1)
const APPKIT_OUT = Easing.bezier(0, 0, 0.58, 1)
/** A desktop sliding in, as Spaces does: quick through the middle, settling at the end */
const SPACES = Easing.bezier(0.4, 0, 0.15, 1)

/** Which desktop shows at T: 0 the first, 1 the second, in between while they slide */
export function desktopAt(T: number): number {
  if (T < DESKTOP_BACK) return SPACES(seg(T, DESKTOP_OUT, DESKTOP_OUT + 0.6))
  return 1 - SPACES(seg(T, DESKTOP_BACK, DESKTOP_BACK + 0.6))
}

/**
 * The window's trips into the side of the screen and out again: in by its
 * handle, out by itself as the news breaks, back in the moment the story's
 * outro ends, and out by its tab
 */
const SIDE: Array<{ at: number; into: boolean; by: 'hand' | 'itself' }> = [
  { at: CLICK_HANDLE + 0.05, into: true, by: 'hand' },
  { at: NEWS.stinger, into: false, by: 'itself' },
  { at: NEWS.board + 0.05, into: true, by: 'itself' },
  { at: CLICK_TAB, into: false, by: 'hand' },
]

/** How far into the side the window is at T: 0 out, 1 all the way in */
function sideAt(T: number): number {
  let last: { at: number; into: boolean } | null = null
  for (const move of SIDE) if (move.at <= T) last = move
  if (!last) return 0
  return last.into ? INTO(seg(T, last.at, last.at + 0.42)) : 1 - OUT_OF(seg(T, last.at, last.at + 0.46))
}

/** Where KLWD's window is at T, on the screen: dragged to the top left, tucked into the side and out again, then made smaller */
export function windowAt(T: number): { x: number; y: number; w: number; h: number } {
  if (T < DRAG_DOWN) return BR
  if (T < DRAG_UP) {
    const p = pointerAt(T)
    return { ...BR, x: BR.x + (p.x - GRAB.x), y: BR.y + (p.y - GRAB.y) }
  }
  const dropped = { x: BR.x + (DROP.x - GRAB.x), y: BR.y + (DROP.y - GRAB.y) }
  const snap = APPKIT_OUT(seg(T, DRAG_UP, DRAG_UP + 0.2))
  let x = mix(dropped.x, TL.x, snap)
  const y = mix(dropped.y, TL.y, snap)
  x -= (TL.x + TL.w) * sideAt(T)
  let w = TL.w
  if (T >= RESIZE_DOWN) {
    const p = pointerAt(Math.min(T, RESIZE_UP))
    w = Math.min(TL.w, Math.max(Math.round(TL.w * 0.7), p.x - TL.x + 2))
  }
  return { x, y, w, h: Math.round((w * 9) / 16) }
}

const inside = (p: { x: number; y: number }, f: { x: number; y: number; w: number; h: number }) => p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h

/** KLWD's window shows while another app is in front */
const frontAt = (T: number): 'claude' | 'browser' => (T < CLICK_BROWSER + 0.02 || (T >= CLICK_BACK + 0.02 && T < CLICK_BROWSER_AGAIN + 0.02) ? 'claude' : 'browser')
const tuckedAt = (T: number) => sideAt(T) > 0

/** The moments the pointer comes onto the window and leaves it, found by walking the script */
const HOVER: Array<{ at: number; on: boolean }> = (() => {
  const out: Array<{ at: number; on: boolean }> = []
  let was = false
  for (let T = SCENES.tuneIn; T <= SCENES.finale; T += 1 / 120) {
    const on = frontAt(T) === 'browser' && !tuckedAt(T) && (inside(pointerAt(T), windowAt(T)) || (T >= DRAG_DOWN && T < DRAG_UP) || (T >= RESIZE_DOWN && T < RESIZE_UP))
    if (on !== was) {
      out.push({ at: T, on })
      was = on
    }
  }
  return out
})()

/** The controls showing: in over 0.15 s as the pointer comes on, out over 0.25 s as it leaves */
function hoverAt(T: number): number {
  let last: { at: number; on: boolean } | null = null
  for (const h of HOVER) if (h.at <= T) last = h
  if (!last) return 0
  return last.on ? ease.appkit(seg(T, last.at, last.at + 0.15)) : 1 - ease.appkit(seg(T, last.at, last.at + 0.25))
}

// The camera stays on the whole screen and leans in only to read something: a
// second to get there, under three seconds there, a second back.
const CORNER = (zoom: number) => ({ x: BR.x + BR.w / 2, y: BR.y + BR.h / 2, zoom })
const CAMERA = cameraPath(WIDE, [
  // TUNE IN, pressed
  [18.7, 19.6, { x: 660, y: 740, zoom: 1.55 }],
  [21.6, 22.6, WIDE],
  // The board, and the usage meters under it
  [30.0, 31.0, CORNER(1.45)],
  [33.8, 34.8, WIDE],
  // The question Claude asked, and Allow
  [44.2, 45.1, { x: 780, y: 560, zoom: 1.4 }],
  [47.0, 48.0, WIDE],
  // THE HOUR IN REVIEW
  [59.4, 60.3, CORNER(1.45)],
  [63.0, 64.0, WIDE],
])

export const DESK_LINES: Line[] = [
  { at: 16.25, until: 20.3, text: 'Tune in from Claude.' },
  { at: 20.4, until: 25.5, text: 'One press puts a session on air.' },
  { at: 25.6, until: 28.1, text: 'Switch apps. KLWD floats above them all.' },
  { at: 28.2, until: 31.6, text: 'Every session, live on one board.' },
  { at: 31.7, until: 35.9, text: 'Your usage limits, right underneath.' },
  { at: 36.0, until: 43.75, text: 'When Claude needs you, you’ll know.' },
  { at: 43.85, until: 50.9, text: 'One click takes you back to the question.' },
  { at: 51.0, until: HOUR.strike, text: 'At the top of every hour,' },
  { at: HOUR.strike + 0.1, until: 64.9, text: 'KLWD reports what each session did.' },
  { at: 65.05, until: 68.0, text: 'Switch desktops. KLWD stays put.' },
  { at: 68.1, until: 71.4, text: 'Out of your way. Never out of sight.' },
  { at: 71.5, until: 73.9, text: 'Tuck it into the side.' },
  { at: NEWS.stinger, until: NEWS.outro - 0.1, text: 'It still comes out for', tab: 'BREAKING NEWS' },
  { at: NEWS.outro, until: 79.9, text: 'Then it tucks itself away again.' },
  { at: 80.0, until: 82.1, text: 'Click the tab to bring it back.' },
  { at: 82.2, until: SCENES.finale - 0.2, text: 'Or drag an edge to make it smaller.' },
]

const CLICKS = [CLICK_TUNE_IN, CLICK_BROWSER, CLICK_BACK, CLICK_ALLOW, CLICK_BROWSER_AGAIN, CLICK_HANDLE, CLICK_TAB]

/** Each stay in the side, from the trip in to the trip out, and whether the pointer made each trip: the tab shows at the screen's edge */
const STAYS = SIDE.flatMap((move, i) => (move.into && SIDE[i + 1] ? [{ into: move.at, out: SIDE[i + 1]!.at, inBy: move.by, outBy: SIDE[i + 1]!.by }] : []))

function clockAt(T: number): string {
  if (T < 36) return 'Sat Oct 25  5:43 PM'
  if (T < SCENES.hour) return 'Sat Oct 25  5:47 PM'
  if (T < HOUR.strike) return 'Sat Oct 25  5:59 PM'
  if (T < SCENES.window) return 'Sat Oct 25  6:00 PM'
  if (T < NEWS.stinger) return 'Sat Oct 25  6:02 PM'
  return 'Sat Oct 25  6:03 PM'
}

/** The desktop at T, for the scenes before and after this one to start from or end on */
export function DeskScreen({ T }: { T: number }) {
  const front = frontAt(T)
  const pointer = pointerAt(T)
  const frame = windowAt(T)
  const dragging = (T >= DRAG_DOWN && T < DRAG_UP) || (T >= RESIZE_DOWN && T < RESIZE_UP)
  const press = Math.min(1, pressAt(T, CLICKS) + (dragging ? 1 : 0))
  const near = (p: { x: number; y: number }, r: number) => Math.abs(pointer.x - p.x) < r && Math.abs(pointer.y - p.y) < r * 1.6
  const side: 'left' | 'right' = T >= DRAG_UP ? 'left' : 'right'
  const back = { x: frame.x + frame.w - 8 - 22, y: frame.y + 30 }
  const handle = side === 'left' ? { x: frame.x + frame.w - 8 - 14, y: frame.y + frame.h / 2 } : { x: frame.x + 8 + 14, y: frame.y + frame.h / 2 }
  const hover = hoverAt(T)
  const under = near(handle, 16) && !tuckedAt(T) ? 'handle' : near(back, 22) ? 'back' : undefined
  // The window comes on as soon as another app is in front, and hides at once when Claude is
  const shown = front === 'browser'
  const since = T >= CLICK_BROWSER_AGAIN ? CLICK_BROWSER_AGAIN : CLICK_BROWSER
  const pop = ease.out(seg(T, since + 0.03, since + 0.3))
  const pip: PipState | null = shown
    ? { frame, content: <AirAt T={T} />, hover: tuckedAt(T) && T > CLICK_HANDLE + 0.3 ? 0 : hover, under, side, opacity: pop, scale: mix(0.965, 1, pop) }
    : null
  // The tab docks at the edge as the window goes in, and turns back into the handle as it comes out. Pressed,
  // the handle is already showing under the pointer; when the window goes in or out by itself, nothing is
  // hovering, so the tab fades in as the window docks and fades out as it leaves the edge.
  let tab: TabState | null = null
  for (const { into, out, inBy, outBy } of STAYS) {
    if (T >= into && T < out + 0.75) {
      const docked = T < out ? seg(T, into + 0.26, into + 0.42) : 1 - seg(T, out, out + 0.16)
      const fadeIn = inBy === 'itself' ? ease.appkit(seg(T, into + 0.05, into + 0.3)) : 1
      const fadeOut = T < out ? 1 : outBy === 'itself' ? 1 - ease.appkit(seg(T, out + 0.05, out + 0.3)) : 1 - ease.appkit(seg(T, out + 0.46, out + 0.71))
      tab = { side: 'left', x: Math.max(0, frame.x + frame.w - 8 - 28), cy: TL.y + TL.h / 2, docked, opacity: fadeIn * fadeOut, under: near(TAB_AT, 16) }
    }
  }
  const allowed = T >= CLICK_ALLOW ? seg(T, CLICK_ALLOW + 0.05, CLICK_ALLOW + 0.4) : 0
  const onPlate = near(TUNE_IN_AT, 14) && T < CLICK_TUNE_IN + 0.4
  return (
    <Screen
      front={front}
      claude={{
        tuned: T >= CLICK_TUNE_IN + 0.04,
        press: onPlate ? press : 0,
        plateHover: onPlate,
        transcript: T >= ASK.stinger ? 'permission' : 'working',
        allowHover: front === 'claude' && near(ALLOW, 30),
        allowPress: front === 'claude' && near(ALLOW, 30) ? press : 0,
        allowed,
      }}
      clock={clockAt(T)}
      time={T}
      desktop={desktopAt(T)}
      pip={pip}
      tab={tab}
      cursor={{ x: pointer.x, y: pointer.y, pressed: press, shape: T >= RESIZE_DOWN - 0.35 && T < RESIZE_UP + 0.1 ? 'resize' : 'arrow' }}
      clicks={[
        { ...TUNE_IN_AT, t: T - CLICK_TUNE_IN },
        { ...BROWSER_AT, t: T - CLICK_BROWSER },
        { ...BACK_BR, t: T - CLICK_BACK },
        { ...ALLOW, t: T - CLICK_ALLOW },
        { ...BROWSER_AT, t: T - CLICK_BROWSER_AGAIN },
        { ...HANDLE_TL, t: T - CLICK_HANDLE },
        { ...TAB_AT, t: T - CLICK_TAB },
      ]}
    />
  )
}

export const deskViewAt = (T: number) => viewAt(T, CAMERA)

export function Desk({ T }: { T: number }) {
  const enter = ease.out(seg(T, SCENES.tuneIn, SCENES.tuneIn + 0.45))
  return (
    <Paper>
      <Frame view={deskViewAt(T)} style={{ opacity: enter, transform: `scale(${mix(0.985, 1, enter)})` }}>
        <DeskScreen T={T} />
      </Frame>
      <HeadlineBand T={T} lines={DESK_LINES} />
    </Paper>
  )
}
