// KLWD's tower and its city from the icon (assets/icon-layers), at night in
// a storm: the sky and its clouds (StormSky), the city's layers, the
// lightning, the beacon and the signal it sends out, and the rain over it all.
// Everything is placed in the icon's own units and seen through one camera:
// the icon's point at the middle of the frame and how many pixels to a unit.
import type { CSSProperties } from 'react'

import { LAYERS, MARKUP } from '../generated/icon-layers.ts'
import { clamp01, ease, mix, seg } from '../lib/anim.ts'
import { StormSky } from './StormSky.tsx'
import type { Light } from './StormSky.tsx'
import { FLASHES, NAME_HITS, SIGNAL_HITS, STRIKE } from './timeline.ts'

export const W = 1920
export const H = 1080

export interface Cam {
  x: number
  y: number
  s: number
}

/* ---------------------------------------------------------------- lightning */

type Flash = (typeof FLASHES)[number]

/** A stroke of lightning flickers: a few return strokes, each a bright pulse, then a short afterglow */
const PULSES: Array<[number, number]> = [
  [0, 1],
  [0.07, 0.35],
  [0.15, 0.9],
  [0.26, 0.45],
]

function pulse(dt: number): number {
  if (dt < 0) return 0
  let v = 0
  for (const [at, amp] of PULSES) {
    const d = dt - at
    if (d >= 0) v = Math.max(v, amp * Math.exp(-d * 16))
  }
  return v + 0.12 * Math.exp(-dt * 2.5)
}

/** How bright a flash is at T */
export function flashAt(f: Flash, T: number): number {
  return f.power * pulse(T - f.at)
}

/** The lights in the clouds at T: the four brightest flashes */
export function lightsAt(T: number): Light[] {
  return FLASHES.map((f) => ({ x: f.x, y: f.y, i: flashAt(f, T), r: f.r }))
    .filter((l) => l.i > 0.003)
    .sort((a, b) => b.i - a.i)
    .slice(0, 4)
}

/** How much the whole frame whites out at T: only the strikes that come down in front of us */
export function whiteAt(T: number): number {
  let v = 0
  for (const f of FLASHES) {
    if (!('bolt' in f) || f.power < 1) continue
    const dt = T - f.at
    if (dt < 0 || dt > 0.5) continue
    v = Math.max(v, (dt < 0.035 ? 0.85 : 0) + 0.5 * Math.exp(-(dt - 0.15) * 30) * (dt >= 0.15 ? 1 : 0))
  }
  return clamp01(v)
}

function rng(seed: number) {
  let a = seed * 9973 + 17
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A bolt from a cloud down to a point: the main channel broken into jagged steps, and a few forks off it */
function boltPaths(from: readonly number[], to: readonly number[], seed: number): Array<{ d: string; w: number }> {
  const r = rng(seed)
  function channel(a: [number, number], b: [number, number], rough: number, depth: number): Array<[number, number]> {
    let pts: Array<[number, number]> = [a, b]
    for (let k = 0; k < depth; k += 1) {
      const next: Array<[number, number]> = []
      for (let i = 0; i < pts.length - 1; i += 1) {
        const p = pts[i]!
        const q = pts[i + 1]!
        const len = Math.hypot(q[0] - p[0], q[1] - p[1])
        const nx = -(q[1] - p[1]) / len
        const ny = (q[0] - p[0]) / len
        const off = (r() - 0.5) * len * rough
        next.push(p, [(p[0] + q[0]) / 2 + nx * off, (p[1] + q[1]) / 2 + ny * off])
      }
      next.push(pts[pts.length - 1]!)
      pts = next
    }
    return pts
  }
  const d = (pts: Array<[number, number]>) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')
  const main = channel([from[0]!, from[1]!], [to[0]!, to[1]!], 0.42, 6)
  const out = [{ d: d(main), w: 1 }]
  for (let k = 0; k < 4; k += 1) {
    const at = main[Math.floor(main.length * (0.12 + 0.55 * r()))]!
    const dir = r() < 0.5 ? -1 : 1
    const len = 90 + 160 * r()
    const end: [number, number] = [at[0] + dir * len * (0.5 + 0.5 * r()), at[1] + len * (0.6 + 0.4 * r())]
    out.push({ d: d(channel(at, end, 0.5, 4)), w: 0.45 })
  }
  return out
}

const BOLTS = FLASHES.map((f) => ('bolt' in f ? boltPaths(f.bolt.from, f.bolt.to, f.bolt.seed) : null))

function Lightning({ T }: { T: number }) {
  return (
    <svg width={1024} height={1024} viewBox="0 0 1024 1024" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      {FLASHES.map((f, i) => {
        const paths = BOLTS[i]
        const dt = T - f.at
        if (!paths || dt < 0 || dt > 0.42) return null
        const v = Math.min(1, pulse(dt) * 2.6)
        if (v < 0.04) return null
        return (
          <g key={i} opacity={v} style={{ filter: 'drop-shadow(0 0 6px #ffffff) drop-shadow(0 0 22px #9fb6ff) drop-shadow(0 0 48px rgba(255,224,138,0.55))' }}>
            {paths.map((p, j) => (
              <path key={j} d={p.d} fill="none" stroke="#ffffff" strokeWidth={6 * p.w} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

/* ---------------------------------------------------------------- the signal */

interface RingSpec {
  cx: number
  cy: number
  r: number
  strokeWidth: number
  opacity: number
}
const RINGS = (['ring-1', 'ring-2', 'ring-3'] as const).map((name) => (LAYERS.layers.find((layer) => layer.name === name) as unknown as { ring: RingSpec }).ring)
const [R1, R2, R3] = RINGS as [RingSpec, RingSpec, RingSpec]
const SLOTS = [
  { r: R1.r * 0.12, strokeWidth: R1.strokeWidth, opacity: 0 },
  { r: R1.r, strokeWidth: R1.strokeWidth, opacity: R1.opacity },
  { r: R2.r, strokeWidth: R2.strokeWidth, opacity: R2.opacity },
  { r: R3.r, strokeWidth: R3.strokeWidth, opacity: R3.opacity },
  { r: R3.r + (R3.r - R2.r), strokeWidth: R3.strokeWidth * 0.8, opacity: 0 },
]

/** Each of these sends a ring out of the beacon and every ring already out one place further: the strike's, the signal on air every two seconds, and the name's logo */
const STEPS: number[] = [...SIGNAL_HITS]
for (let at = SIGNAL_HITS[3] + 2; at < 50; at += 2) STEPS.push(at)
STEPS.push(NAME_HITS[1], NAME_HITS[2], NAME_HITS[3])
const STEP = 0.8

function ringsAt(T: number) {
  const out: Array<{ key: number; r: number; strokeWidth: number; opacity: number }> = []
  STEPS.forEach((born, b) => {
    if (T < born) return
    let pos = 0
    for (let j = b; j < STEPS.length; j += 1) pos += ease.out(seg(T, STEPS[j]!, STEPS[j]! + STEP))
    if (pos >= SLOTS.length - 1) return
    const i = Math.floor(pos)
    const f = pos - i
    const a = SLOTS[i]!
    const z = SLOTS[i + 1]!
    out.push({ key: b, r: mix(a.r, z.r, f), strokeWidth: mix(a.strokeWidth, z.strokeWidth, f), opacity: mix(a.opacity, z.opacity, f) })
  })
  return out
}

/** The beacon flaring as each ring leaves it, brightest as the lightning strikes it */
function flareAt(T: number): number {
  let flare = T >= STRIKE ? 1.6 * Math.exp(-(T - STRIKE) * 3) : 0
  for (const s of STEPS) if (T >= s) flare = Math.max(flare, Math.exp(-(T - s) * 4) * 0.6)
  return flare
}

/** Before the strike the beacon blinks as a mast's light does in the night; after it, it's on air */
function beaconOn(T: number): number {
  if (T >= STRIKE) return 1
  const c = (T % 1.4) / 1.4
  return c < 0.45 ? 1 : 0.25
}

/* ---------------------------------------------------------------- the world */

function layerStyle(name: string, T: number, flash: number): CSSProperties {
  switch (name) {
    case 'beacon': {
      const flare = flareAt(T)
      const on = beaconOn(T)
      return { filter: `brightness(${(0.45 + 0.55 * on) * (1 + 0.9 * flare)})`, transform: `scale(${1 + 0.2 * Math.min(1.5, flare)})` }
    }
    case 'beacon-glow': {
      const flare = flareAt(T)
      const on = beaconOn(T)
      return { opacity: Math.min(1, 0.2 + 0.8 * on * (0.85 + 0.3 * flare)), transform: `scale(${0.7 + 0.3 * on + 0.35 * Math.min(1.5, flare)})` }
    }
    default:
      if (/^(tower|station|mast)/.test(name) && !name.endsWith('lights')) {
        // The lightning lights the buildings' faces for an instant
        return flash > 0.01 ? { filter: `brightness(${1 + 1.6 * flash})` } : {}
      }
      return {}
  }
}

export interface WorldProps {
  T: number
  cam: Cam
  /** 0 the storm, 1 the icon's clear dusk */
  clear: number
  rain: number
  /** The icon's tile, once the camera has pulled back to it: its corners in pixels and its radius. Omitted while the storm fills the frame. */
  tile?: { x0: number; y0: number; x1: number; y1: number; r: number }
  /** How dark the scene is held under words over it, 0 to 1 */
  dim?: number
  /** Keep the camera still: no shake on the thunder */
  steady?: boolean
}

/** The camera shaking on the big strikes, a few pixels, dying away */
function shakeAt(T: number): { x: number; y: number } {
  let x = 0
  let y = 0
  for (const f of FLASHES) {
    if (!('bolt' in f) || f.power < 1) continue
    const dt = T - f.at - 0.05
    if (dt < 0 || dt > 1.2) continue
    const a = 7 * Math.exp(-dt * 4)
    x += a * Math.sin(dt * 71)
    y += a * Math.sin(dt * 53 + 1.3)
  }
  return { x, y }
}

export function World({ T, cam, clear, rain, tile, dim = 0, steady = false }: WorldProps) {
  const lights = lightsAt(T).map((l) => ({ ...l, i: l.i * (1 - clear) }))
  const flash = Math.min(1, lights.reduce((sum, l) => sum + l.i, 0)) * 0.5
  const shake = steady ? { x: 0, y: 0 } : shakeAt(T)
  const view = { x: cam.x - shake.x / cam.s, y: cam.y - shake.y / cam.s, s: cam.s }
  const rings = ringsAt(T)
  const white = whiteAt(T) * (1 - clear)
  const clip = tile ? `inset(${tile.y0}px ${W - tile.x1}px ${H - tile.y1}px ${tile.x0}px round ${tile.r}px)` : undefined
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <StormSky width={W} height={H} t={T} cam={view} lights={lights} clear={clear} rain={rain} layer="sky" tile={tile} />
      <div style={{ position: 'absolute', inset: 0, clipPath: clip }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1024,
            height: 1024,
            transformOrigin: '0 0',
            transform: `translate(${W / 2 - view.x * view.s}px, ${H / 2 - view.y * view.s}px) scale(${view.s})`,
          }}
        >
          <Lightning T={T} />
          <svg width={1024} height={1024} viewBox="0 0 1024 1024" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            {rings.map((ring) => (
              <circle key={ring.key} cx={R1.cx} cy={R1.cy} r={ring.r} fill="none" stroke="#ffffff" strokeOpacity={ring.opacity} strokeWidth={ring.strokeWidth} />
            ))}
          </svg>
          {LAYERS.layers.map((layer) => {
            if (layer.name === 'sky' || layer.name.startsWith('ring-') || layer.name === 'gloss' || layer.name === 'rim') return null
            return (
              <div
                key={layer.name}
                style={{ position: 'absolute', left: 0, top: 0, width: 1024, height: 1024, transformOrigin: `${layer.anchor[0]}px ${layer.anchor[1]}px`, ...layerStyle(layer.name, T, flash) }}
                dangerouslySetInnerHTML={{ __html: MARKUP[layer.name] ?? '' }}
              />
            )
          })}
          {tile ? (
            <>
              <div style={{ position: 'absolute', left: 0, top: 0, width: 1024, height: 1024, opacity: clear }} dangerouslySetInnerHTML={{ __html: MARKUP.gloss ?? '' }} />
              <div style={{ position: 'absolute', left: 0, top: 0, width: 1024, height: 1024, opacity: clear }} dangerouslySetInnerHTML={{ __html: MARKUP.rim ?? '' }} />
            </>
          ) : null}
        </div>
      </div>
      {rain > 0.001 ? <StormSky width={W} height={H} t={T} cam={view} lights={lights} clear={clear} rain={rain} layer="rain" tile={tile} /> : null}
      {dim > 0 ? <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 70% at 50% 50%, rgba(1,3,10,${0.35 * dim}) 0%, rgba(1,3,10,${0.7 * dim}) 100%)` }} /> : null}
      {white > 0.01 ? <div style={{ position: 'absolute', inset: 0, background: '#eef3ff', opacity: white }} /> : null}
    </div>
  )
}

export { clamp01 }
