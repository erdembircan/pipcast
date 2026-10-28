// The station's CSS motion, drawn from a time instead of left to the browser's
// clock, so every frame of the video is the same picture whenever it is
// rendered. Each function is the matching @keyframes in
// design/components/bundle.css, with its duration, delay and easing.
import { Easing } from 'remotion'

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const mix = (a: number, b: number, e: number) => a + (b - a) * e

const SLIDE = Easing.bezier(0.2, 0.8, 0.2, 1)
const LEAVE = Easing.bezier(0.65, 0, 0.35, 1)
const SWEEP = Easing.bezier(0.42, 0, 0.58, 1)
const POWER = Easing.bezier(0.2, 0.7, 0.2, 1)
const SIGNAL = Easing.bezier(0.2, 0.6, 0.4, 1)

/** pn-slide: in from the left, 460 ms. `x` is a percentage of the piece's own width. */
export function slide(ms: number, delay = 0, duration = 460): { x: number; o: number } {
  const e = SLIDE(clamp01((ms - delay) / duration))
  return { x: mix(-110, 0, e), o: e }
}

/** pn-turn-leave: out to the right, 420 ms. `x` is in stage px. */
export function leave(ms: number, delay = 0, duration = 420): { x: number; o: number } {
  const e = LEAVE(clamp01((ms - delay) / duration))
  return { x: mix(0, 180, e), o: mix(1, 0, e) }
}

/** pn-sweep: the lower third's glint, every 5 s from 700 ms. `x` is a percentage. */
export function sweep(ms: number): number {
  if (ms < 700) {
    return 0
  }
  const c = ((ms - 700) % 5000) / 5000
  return c <= 0.7 ? -88 : mix(-88, 52, SWEEP((c - 0.7) / 0.3))
}

/** pn-power: the wall monitor powers on like a tube set, 560 ms. */
export function power(ms: number): { scaleY: number; brightness: number } {
  const p = clamp01(ms / 560)
  if (p <= 0.6) {
    const e = POWER(p / 0.6)
    return { scaleY: mix(0.02, 1.04, e), brightness: mix(3, 1.3, e) }
  }
  const e = POWER((p - 0.6) / 0.4)
  return { scaleY: mix(1.04, 1, e), brightness: mix(1.3, 1, e) }
}

/** pn-signal: one wave of the backdrop's signal, leaving the ring, 9 s from the ring to gone. */
export function signalWave(ms: number): { scale: number; o: number } {
  const p = (((ms % 9000) + 9000) % 9000) / 9000
  const scale = mix(1, 2.5, SIGNAL(p))
  const o = p < 0.08 ? SIGNAL(p / 0.08) : mix(1, 0, SIGNAL((p - 0.08) / 0.92))
  return { scale, o }
}

export const CRAWL_SPEED = 53
