// Small helpers for drawing motion from a time in seconds.
import { Easing } from 'remotion'

export type Ease = (x: number) => number

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const mix = (a: number, b: number, e: number) => a + (b - a) * e

/** Progress from 0 to 1 as t goes from a to b */
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))

export const ease = {
  linear: (x: number) => x,
  /** Screen Studio's camera: a soft start and a long settle */
  camera: Easing.bezier(0.45, 0, 0.15, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  out: Easing.bezier(0.2, 0.8, 0.2, 1),
  outSoft: Easing.bezier(0.25, 1, 0.5, 1),
  in: Easing.bezier(0.55, 0, 1, 0.45),
  /** macOS window and control fades */
  appkit: Easing.bezier(0.25, 0.1, 0.25, 1),
  /** A little overshoot, for things that land */
  back: Easing.bezier(0.34, 1.4, 0.64, 1),
} satisfies Record<string, Ease>

export interface Key<T> {
  t: number
  v: T
  /** The easing from the previous key to this one */
  e?: Ease
}

/** A value through keyframes; held before the first and after the last. */
export function track(t: number, keys: Array<Key<number>>): number {
  if (keys.length === 0) return 0
  const first = keys[0]!
  if (t <= first.t) return first.v
  for (let i = 1; i < keys.length; i += 1) {
    const b = keys[i]!
    if (t <= b.t) {
      const a = keys[i - 1]!
      const e = (b.e ?? ease.inOut)(seg(t, a.t, b.t))
      return mix(a.v, b.v, e)
    }
  }
  return keys[keys.length - 1]!.v
}

export interface Point {
  x: number
  y: number
}
