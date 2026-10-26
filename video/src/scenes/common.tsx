// Pieces every scene uses: KLWD's picture at a moment of the video, the
// camera's path, and the pointer's.
import { Easing } from 'remotion'

import { OnAir } from '../design/OnAir.tsx'
import { ease, mix, seg } from '../lib/anim.ts'
import type { Ease, Point } from '../lib/anim.ts'
import { onAir } from '../program.ts'
import { settle } from '../stage/Frame.tsx'
import type { View } from '../stage/Frame.tsx'

/** What KLWD airs at the video's second T; `crawl`, when given, is how long its crawl has run (0 draws it from its first item) */
export function AirAt({ T, crawl }: { T: number; crawl?: number }) {
  const now = onAir(T)
  return <OnAir scene={now.scene} t={now.t} crawl={crawl ?? now.crawl} clock={T} identFrom={now.identFrom} />
}

/** A camera move: an even ease in and out that slows to a stop on its last frames, with no long creep at its end */
export const CAMERA: Ease = Easing.bezier(0.6, 0, 0.3, 1)

export interface ViewKey {
  t: number
  v: View
  e?: Ease
}

/** The camera through its keyframes. Between two keys it moves; at a key it holds perfectly still until the next move starts. */
export function viewAt(T: number, keys: ViewKey[]): View {
  const first = keys[0]!
  if (T <= first.t) return settle(first.v)
  for (let i = 1; i < keys.length; i += 1) {
    const b = keys[i]!
    if (T <= b.t) {
      const a = keys[i - 1]!
      const from = settle(a.v)
      const to = settle(b.v)
      if (from.x === to.x && from.y === to.y && from.zoom === to.zoom) return to
      const e = (b.e ?? CAMERA)(seg(T, a.t, b.t))
      // Zoom moves in log space, so a push in feels even all the way
      const zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * e)
      return settle({ x: mix(from.x, to.x, e), y: mix(from.y, to.y, e), zoom })
    }
  }
  return settle(keys[keys.length - 1]!.v)
}

/** A hold and a move: [moveStart, moveEnd, view] steps from a starting view */
export function cameraPath(start: View, moves: Array<[number, number, View]>): ViewKey[] {
  const keys: ViewKey[] = [{ t: -1, v: start }]
  let current = start
  for (const [a, b, v] of moves) {
    keys.push({ t: a, v: current }, { t: b, v })
    current = v
  }
  return keys
}

export interface PointerKey {
  t: number
  p: Point
  e?: Ease
}

/** The pointer through its keyframes, with a slight arc between them, as a hand moves a mouse */
export function trackPointer(t: number, keys: PointerKey[]): Point {
  const first = keys[0]!
  if (t <= first.t) return first.p
  for (let i = 1; i < keys.length; i += 1) {
    const b = keys[i]!
    if (t <= b.t) {
      const a = keys[i - 1]!
      const e = (b.e ?? ease.inOut)(seg(t, a.t, b.t))
      const dx = b.p.x - a.p.x
      const dy = b.p.y - a.p.y
      const bow = Math.sin(e * Math.PI) * 0.08
      return { x: mix(a.p.x, b.p.x, e) - dy * bow, y: mix(a.p.y, b.p.y, e) + dx * bow }
    }
  }
  return keys[keys.length - 1]!.p
}

/** How far the button is down around a click at `at` */
export function pressAt(t: number, clicks: number[]): number {
  let p = 0
  for (const at of clicks) {
    if (t >= at - 0.07 && t < at) p = Math.max(p, seg(t, at - 0.07, at))
    else if (t >= at && t < at + 0.14) p = Math.max(p, 1 - seg(t, at, at + 0.14))
  }
  return p
}
