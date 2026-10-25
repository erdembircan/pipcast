// The end: the frame the Mac was in shrinks into a square tile as the icon's
// dusk comes up in it. The icon then builds itself from its layers
// (assets/icon-layers): the city rises, the mast reaches up, the beacon
// lights, and the signal goes out from it on the station's four-note logo,
// each note sending a ring out of the beacon and pushing the others outward,
// as the windows light and the tile's corners round. Then the name, while the
// signal keeps going out on the music's last notes and comes to rest as the
// icon's three rings.
import type { CSSProperties } from 'react'

import { LAYERS, MARKUP } from '../generated/icon-layers.ts'
import { clamp01, ease, mix, seg } from '../lib/anim.ts'
import { Paper } from '../look/Paper.tsx'
import { INK, INK_SOFT, MONO, SANS, SERIF } from '../look/theme.ts'
import { SCREEN_H, SCREEN_W } from '../desktop/geometry.ts'
import { FRAME } from '../stage/Frame.tsx'
import { DURATION, LOGO_HITS, SCENES } from '../timeline.ts'
import { CAMERA } from './common.tsx'
import { DeskScreen } from './Desk.tsx'

const F = SCENES.finale
const [HIT_A, HIT_D, HIT_A2, HIT_D2] = LOGO_HITS

type LayerName = (typeof LAYERS.layers)[number]['name']

/** The desktop as the session left it, the whole screen, scaled to cover the tile it is turning into */
function Screenful({ T, rect }: { T: number; rect: { w: number; h: number } }) {
  const k = Math.max(rect.w / SCREEN_W, rect.h / SCREEN_H)
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, transformOrigin: '0 0', transform: `translate(${rect.w / 2 - (SCREEN_W / 2) * k}px, ${rect.h / 2 - (SCREEN_H / 2) * k}px) scale(${k})` }}>
      <DeskScreen T={T} />
    </div>
  )
}

/** How a lit layer comes on: a few quick flickers, as lights do */
function lit(T: number, at: number): number {
  if (T < at) return 0
  const k = Math.floor((T - at) * 30)
  if (k < 7) return [0.6, 0.15, 0.85, 0.3, 1, 0.55, 1][k] ?? 1
  return 1
}

/** A layer rising from below about its foot, landing with a little give */
function rise(T: number, at: number, dist: number, dur = 0.85): number {
  return (1 - ease.back(seg(T, at, at + dur))) * dist
}

/** A ring as layers.json gives it, to be drawn again at any size */
interface RingSpec {
  cx: number
  cy: number
  r: number
  strokeWidth: number
  opacity: number
}

const RING_SPECS: RingSpec[] = (['ring-1', 'ring-2', 'ring-3'] as const).map((name) => (LAYERS.layers.find((layer) => layer.name === name) as unknown as { ring: RingSpec }).ring)
const [R1, R2, R3] = RING_SPECS as [RingSpec, RingSpec, RingSpec]

/**
 * Where a ring of the signal can be: 0 is the beacon, where a ring is born
 * unseen, 1 to 3 are the icon's three rings, and 4 is a step past the last,
 * where a ring has faded away.
 */
const SLOTS = [
  { r: R1.r * 0.12, strokeWidth: R1.strokeWidth, opacity: 0 },
  { r: R1.r, strokeWidth: R1.strokeWidth, opacity: R1.opacity },
  { r: R2.r, strokeWidth: R2.strokeWidth, opacity: R2.opacity },
  { r: R3.r, strokeWidth: R3.strokeWidth, opacity: R3.opacity },
  { r: R3.r + (R3.r - R2.r), strokeWidth: R3.strokeWidth * 0.8, opacity: 0 },
]

/** The outro's first chord, and the logo it whispers after it (scripts/music/score.js, genOutro: 1.5, 2, 2.5 and 3.5 s in) */
const OUTRO = SCENES.endCard
const WHISPER = [1.5, 2.0, 2.5, 3.5].map((o) => OUTRO + o)

/**
 * The signal: on each of these notes the beacon sends a ring out and every
 * ring already out moves one place outward. Three notes of the logo build the
 * icon's three rings; the outro's chord and its whispered logo send five
 * more, and the last three to go out come to rest where the icon has them.
 */
const STEPS: Array<{ at: number; strength: number }> = [
  { at: HIT_D, strength: 1 },
  { at: HIT_A2, strength: 1 },
  { at: HIT_D2, strength: 1 },
  { at: OUTRO, strength: 0.8 },
  ...WHISPER.map((at) => ({ at, strength: 0.45 })),
]
const STEP = 0.8

/** The rings out at T, each at its place between the slots */
function ringsAt(T: number): Array<{ key: number; r: number; strokeWidth: number; opacity: number }> {
  const out: Array<{ key: number; r: number; strokeWidth: number; opacity: number }> = []
  STEPS.forEach((born, b) => {
    if (T < born.at) return
    let pos = 0
    for (let j = b; j < STEPS.length; j += 1) pos += ease.out(seg(T, STEPS[j]!.at, STEPS[j]!.at + STEP))
    if (pos >= SLOTS.length - 1) return
    const i = Math.floor(pos)
    const f = pos - i
    const a = SLOTS[i]!
    const z = SLOTS[i + 1]!
    out.push({ key: b, r: mix(a.r, z.r, f), strokeWidth: mix(a.strokeWidth, z.strokeWidth, f), opacity: mix(a.opacity, z.opacity, f) })
  })
  return out
}

/** The beacon flaring as it lights and as each ring leaves it */
function flareAt(T: number): number {
  let flare = T >= HIT_A ? Math.exp(-(T - HIT_A) * 4) : 0
  for (const s of STEPS) if (T >= s.at) flare = Math.max(flare, Math.exp(-(T - s.at) * 4) * 0.6 * s.strength)
  return flare
}

function Signal({ T }: { T: number }) {
  const rings = ringsAt(T)
  if (rings.length === 0) return null
  return (
    <svg width={1024} height={1024} viewBox="0 0 1024 1024" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      {rings.map((ring) => (
        <circle key={ring.key} cx={R1.cx} cy={R1.cy} r={ring.r} fill="none" stroke="#ffffff" strokeOpacity={ring.opacity} strokeWidth={ring.strokeWidth} />
      ))}
    </svg>
  )
}

/** The city rising, nearest towers last, as the desktop finishes dissolving into the dusk */
const TOWER_AT: Record<string, number> = { l3: F + 1.3, r3: F + 1.35, l2: F + 1.45, r2: F + 1.5, l1: F + 1.6, r1: F + 1.65 }
const STATION_AT = F + 1.7
const MAST = [F + 2.9, F + 3.75] as const

function layerStyle(name: LayerName, T: number): CSSProperties {
  const lightsAt: Record<string, number> = { l1: HIT_D, l2: HIT_D + 0.12, l3: HIT_D + 0.22, r1: HIT_A2, r2: HIT_A2 + 0.1, r3: HIT_A2 + 0.2 }
  const tower = /^tower-([lr]\d)(-lights)?$/.exec(name)
  if (tower) {
    const key = tower[1]!
    const y = rise(T, TOWER_AT[key]!, 380)
    const opacity = tower[2] ? lit(T, lightsAt[key]!) : clamp01(seg(T, TOWER_AT[key]!, TOWER_AT[key]! + 0.2))
    return { transform: `translateY(${y}px)`, opacity }
  }
  const stationY = rise(T, STATION_AT, 520, 0.75)
  switch (name) {
    case 'station':
      return { transform: `translateY(${stationY}px)`, opacity: clamp01(seg(T, STATION_AT, STATION_AT + 0.15)) }
    case 'station-lights':
      return { transform: `translateY(${stationY}px)`, opacity: lit(T, HIT_A2 + 0.05) }
    case 'station-sign':
      return { transform: `translateY(${stationY}px)`, opacity: clamp01(seg(T, STATION_AT, STATION_AT + 0.15)) }
    case 'mast': {
      // The mast draws up from the roof to where the beacon will be
      const p = ease.inOut(seg(T, MAST[0], MAST[1]))
      const top = ((256 + 395.5 * (1 - p)) / 1024) * 100
      return { clipPath: `inset(${top}% 0 0 0)`, transform: `translateY(${stationY}px)` }
    }
    case 'beacon': {
      // Dark as the mast reaches it, then it lights on the logo's first note
      const shown = seg(T, MAST[1] - 0.15, MAST[1])
      const on = T >= HIT_A ? 1 : 0
      const flare = flareAt(T)
      return { opacity: shown, filter: `brightness(${on ? 1 + 0.9 * flare : 0.35}) saturate(${on ? 1 : 0.4})`, transform: `scale(${1 + 0.18 * flare})` }
    }
    case 'beacon-glow': {
      if (T < HIT_A) return { opacity: 0 }
      const on = ease.out(seg(T, HIT_A, HIT_A + 0.35))
      const flare = flareAt(T)
      return { opacity: on * (0.85 + 0.15 * Math.min(1, flare)), transform: `scale(${mix(0.4, 1, on) * (1 + 0.3 * flare)})` }
    }
    case 'gloss':
      return { opacity: ease.inOut(seg(T, HIT_D2, HIT_D2 + 0.6)) }
    case 'rim':
      return { opacity: ease.inOut(seg(T, HIT_D2 + 0.1, HIT_D2 + 0.7)) }
    default:
      return {}
  }
}

/** The chrome sign catching the light as the last note lands */
function SignGlint({ T }: { T: number }) {
  const p = seg(T, HIT_D2 + 0.05, HIT_D2 + 0.55)
  if (p <= 0 || p >= 1) return null
  const x = mix(360, 680, ease.inOut(p))
  return (
    <div
      style={{ position: 'absolute', left: 0, top: 0, width: 1024, height: 1024, filter: 'brightness(2.4) saturate(0)', clipPath: `polygon(${x - 30}px 640px, ${x + 10}px 640px, ${x - 20}px 730px, ${x - 60}px 730px)` }}
      dangerouslySetInnerHTML={{ __html: MARKUP['station-sign'] ?? '' }}
    />
  )
}

/** The icon, built from its layers at time T, in its own 1024-unit space */
function Icon({ T }: { T: number }) {
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1024, height: 1024 }}>
        {LAYERS.layers.map((layer) => {
          // The three rings are the signal's, drawn where the first ring stacks
          if (layer.name === 'ring-1') return <Signal key="signal" T={T} />
          if (layer.name === 'ring-2' || layer.name === 'ring-3') return null
          return (
            <div
              key={layer.name}
              style={{ position: 'absolute', left: 0, top: 0, width: 1024, height: 1024, transformOrigin: `${layer.anchor[0]}px ${layer.anchor[1]}px`, ...layerStyle(layer.name, T) }}
              dangerouslySetInnerHTML={{ __html: MARKUP[layer.name] ?? '' }}
            />
          )
        })}
        <SignGlint T={T} />
      </div>
    </>
  )
}

export function Finale({ T }: { T: number }) {
  // The tile: the frame the Mac was in, shrinking into the icon's square as its dusk comes up in it
  const morph = CAMERA(seg(T, F + 0.3, F + 1.9))
  const up = ease.inOut(seg(T, SCENES.endCard, SCENES.endCard + 1.2))
  const side = mix(1024 * 0.7, 1024 * 0.44, up)
  const tile = { x: 960 - side / 2, y: mix(540, 400, up) - side / 2, w: side, h: side }
  const rect = { x: mix(FRAME.x, tile.x, morph), y: mix(FRAME.y, tile.y, morph), w: mix(FRAME.w, tile.w, morph), h: mix(FRAME.h, tile.h, morph) }
  // The icon inside it, covering the tile as it narrows to a square
  const k = Math.max(rect.w, rect.h) / 1024
  const focus = { x: 512, y: 512 }
  const round = ease.inOut(seg(T, HIT_A2, HIT_D2 + 0.45))
  const radius = Math.max(mix(16, 20, morph), 228 * k * round)
  const dissolve = ease.inOut(seg(T, F + 0.45, F + 1.25))
  const name = ease.out(seg(T, SCENES.endCard + 0.8, SCENES.endCard + 1.6))
  const tagline = ease.out(seg(T, SCENES.endCard + 1.15, SCENES.endCard + 1.95))
  const link = ease.out(seg(T, SCENES.endCard + 1.5, SCENES.endCard + 2.3))
  const tuned = ease.out(seg(T, SCENES.endCard + 2.9, SCENES.endCard + 3.7))
  const end = 1 - ease.inOut(seg(T, DURATION - 0.8, DURATION))
  const lift = ease.inOut(seg(T, HIT_D2, HIT_D2 + 0.8))
  const rise = (p: number): CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * 18}px)`, filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined })
  return (
    <Paper>
      <div style={{ position: 'absolute', inset: 0, opacity: end }}>
        <div
          style={{
            position: 'absolute',
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            borderRadius: radius,
            overflow: 'hidden',
            background: '#0b1d4d',
            boxShadow: `0 ${36 + 24 * lift}px ${90 + 30 * lift}px rgba(40, 32, 60, ${0.26 + 0.12 * lift}), 0 10px 26px rgba(40, 32, 20, 0.14)`,
          }}
        >
          {dissolve < 1 ? <Screenful T={T} rect={rect} /> : null}
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1024, height: 1024, transformOrigin: '0 0', transform: `translate(${rect.w / 2 - focus.x * k}px, ${rect.h / 2 - focus.y * k}px) scale(${k})`, opacity: dissolve }}>
            <Icon T={T} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 676, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ font: `500 112px/1 ${SERIF}`, letterSpacing: '-0.035em', color: INK, ...rise(name) }}>Pipcast</div>
          <div style={{ marginTop: 22, font: `400 38px/1.2 ${SANS}`, letterSpacing: '-0.015em', color: INK_SOFT, ...rise(tagline) }}>Picture in picture for Claude Code</div>
          <div style={{ marginTop: 30, font: `500 26px/1 ${MONO}`, color: INK, padding: '14px 22px', borderRadius: 14, background: 'rgba(20,20,19,0.05)', ...rise(link) }}>github.com/erdembircan/pipcast</div>
          <div style={{ marginTop: 26, font: `italic 400 34px/1 ${SERIF}`, color: INK_SOFT, ...rise(tuned) }}>Stay tuned.</div>
        </div>
      </div>
    </Paper>
  )
}
